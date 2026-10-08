/**
 * «اترك بلا حفظ؟» و«أتحذف؟» (ج١): السجلّ والسؤال بلا React ولا نافذة.
 *
 * ما تحرسه مسودّةٌ أو معلّقة (المحرّر، والشبّاك) لا يُسجَّل ولا يُسأل عنه — فهنا الشاشات التي لا مسودّة لها.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ask, confirmAction, mountHost, type AskOptions } from '../src/renderer/src/kit/ask';
import { addGuard, canLeaveAll, confirmLeave, hasUnsaved, onUnsavedLabel, touchGuards, unsavedLabel, type LeaveGuard } from '../src/renderer/src/kit/leaveGuard';

type Answer = (o: AskOptions<string>) => string | Promise<string>;

/** سائلٌ مصنوع: يسجّل ما سُئل وما عُرض من خيارات، ويجيب بما يُعطاه. */
function asker(answer: Answer) {
  const asked: AskOptions<string>[] = [];
  const fn = (async (o: AskOptions<string>) => {
    asked.push(o);
    return answer(o);
  }) as unknown as Parameters<typeof confirmLeave>[1];
  return { fn, asked };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function guard(partial: Partial<LeaveGuard> & { dirty?: boolean } = {}): LeaveGuard & { dirty: boolean } {
  const g = {
    dirty: partial.dirty ?? true,
    label: partial.label ?? 'الترويسة',
    isDirty: () => g.dirty,
    save: partial.save
  };
  return g;
}

describe('ask: السؤال من أيّ مكان', () => {
  it('بلا مضيفٍ مركَّب الجواب هو الاحتياط — لا يمضي حذفٌ بلا سؤال', async () => {
    expect(await ask({ title: 'ت', choices: [{ key: 'a', label: 'أ' }], fallback: 'a' })).toBe('a');
    expect(await confirmAction({ title: 'أتحذف؟', confirm: 'احذف', danger: true })).toBe(false);
  });

  it('وبمضيفٍ يُسأل المضيف، وإذا فُكّ عاد الاحتياط', async () => {
    const seen: string[] = [];
    const off = mountHost(async (o) => {
      seen.push(o.title);
      return 'yes';
    });
    expect(await confirmAction({ title: 'أتحذف؟', confirm: 'احذف' })).toBe(true);
    expect(seen).toEqual(['أتحذف؟']);
    off();
    expect(await confirmAction({ title: 'أتحذف؟', confirm: 'احذف' })).toBe(false);
  });

  it('وزرّ الحذف أحمر، و«ألغِ» هو الاحتياط والأوّل', async () => {
    let seen: AskOptions<string> | null = null;
    const off = mountHost(async (o) => {
      seen = o;
      return 'no';
    });
    await confirmAction({ title: 'ت', confirm: 'احذف نهائيًّا', danger: true });
    off();
    expect(seen!.fallback).toBe('no');
    expect(seen!.choices.map((c) => [c.key, c.tone])).toEqual([
      ['no', 'neutral'],
      ['yes', 'danger']
    ]);
  });
});

describe('confirmLeave: شاشةٌ واحدة', () => {
  it('نظيفةٌ تُغادَر بلا سؤال', async () => {
    const { fn, asked } = asker(() => 'stay');
    expect(await confirmLeave(guard({ dirty: false }), fn)).toBe(true);
    expect(asked).toEqual([]);
  });

  it('وفيها عملٌ بلا حفظٍ ممكن: «ابقَ» و«اترك بلا حفظ» فقط، والاحتياط «ابقَ»', async () => {
    const { fn, asked } = asker(() => 'discard');
    expect(await confirmLeave(guard(), fn)).toBe(true);
    expect(asked[0]!.choices.map((c) => c.key)).toEqual(['stay', 'discard']);
    expect(asked[0]!.fallback).toBe('stay');
    expect(asked[0]!.title).toContain('الترويسة');
    expect((await confirmLeave(guard(), asker(() => 'stay').fn))).toBe(false);
  });

  it('وإن أمكن حفظها زِيد «احفظ ثم اترك» — ونجاحه يأذن بالمغادرة', async () => {
    let saved = 0;
    const g = guard({
      save: async () => {
        saved++;
        return true;
      }
    });
    const { fn, asked } = asker(() => 'save');
    expect(await confirmLeave(g, fn)).toBe(true);
    expect(asked[0]!.choices.map((c) => c.key)).toEqual(['stay', 'discard', 'save']);
    expect(saved).toBe(1);
  });

  it('وحفظٌ تعثّر أو رمى يُبقي الموظف حيث هو — لا يغادر بعملٍ ظنّه محفوظًا', async () => {
    const failing = guard({ save: async () => false });
    expect(await confirmLeave(failing, asker(() => 'save').fn)).toBe(false);
    const throwing = guard({
      save: async () => {
        throw new Error('قرصٌ ممتلئ');
      }
    });
    expect(await confirmLeave(throwing, asker(() => 'save').fn)).toBe(false);
  });
});

describe('canLeaveAll: الانتقال في الشريط', () => {
  it('بلا حرّاسٍ أو بنظيفةٍ: يمرّ بلا سؤال', async () => {
    const { fn, asked } = asker(() => 'stay');
    expect(await canLeaveAll(fn)).toBe(true);
    cleanups.push(addGuard(guard({ dirty: false })));
    expect(await canLeaveAll(fn)).toBe(true);
    expect(asked).toEqual([]);
    expect(hasUnsaved()).toBe(false);
  });

  it('يُسأل عن كلّ شاشةٍ متّسخة بالترتيب، ويقف عند أوّل «ابقَ»', async () => {
    cleanups.push(addGuard(guard({ label: 'الأسئلة' })));
    cleanups.push(addGuard(guard({ label: 'الترويسة' })));
    const first = asker(() => 'discard');
    expect(await canLeaveAll(first.fn)).toBe(true);
    expect(first.asked.map((o) => o.title)).toEqual(['في «الأسئلة» تعديلاتٌ لم تُحفظ', 'في «الترويسة» تعديلاتٌ لم تُحفظ']);

    const second = asker((o) => (o.title.includes('الأسئلة') ? 'stay' : 'discard'));
    expect(await canLeaveAll(second.fn)).toBe(false);
    expect(second.asked).toHaveLength(1);
  });

  it('ونقرتان معًا سؤالٌ واحد', async () => {
    cleanups.push(addGuard(guard()));
    let release!: (v: string) => void;
    const slow = asker(() => new Promise<string>((r) => (release = r)));
    const a = canLeaveAll(slow.fn);
    const b = canLeaveAll(slow.fn);
    expect(a).toBe(b);
    release('discard');
    expect(await a).toBe(true);
    expect(slow.asked).toHaveLength(1);
    // وبعد الجواب سؤالٌ جديد.
    expect(await canLeaveAll(asker(() => 'stay').fn)).toBe(false);
  });
});

describe('ما لم يُحفظ يصل العملية الرئيسة', () => {
  it('اسم أوّل شاشةٍ متّسخة، ويُبلَّغ كلّ تغيّرٍ مرّةً لا أكثر', () => {
    const seen: (string | null)[] = [];
    cleanups.push(onUnsavedLabel((l) => seen.push(l)));
    const g = guard({ dirty: false, label: 'أوراق الأسئلة' });
    const remove = addGuard(g);
    expect(unsavedLabel()).toBeNull();
    g.dirty = true;
    touchGuards();
    touchGuards();
    expect(unsavedLabel()).toBe('أوراق الأسئلة');
    g.dirty = false;
    touchGuards();
    g.dirty = true;
    touchGuards();
    remove();
    // فُكّت الشاشة وهي متّسخة: تُمحى من السجلّ فلا يسأل الإغلاق عن شاشةٍ لم تعد.
    expect(unsavedLabel()).toBeNull();
    expect(seen).toEqual(['أوراق الأسئلة', null, 'أوراق الأسئلة', null]);
  });
});
