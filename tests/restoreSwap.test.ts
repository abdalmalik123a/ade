/**
 * استرجاع النسخة لا يُضيع ما كان — في أيّ موضعٍ تعثّر (الموجة ١، البند ٣).
 *
 * وكان النقل نفسه خارج الحماية: مخزنٌ يمسك ملفًّا منه برنامجٌ آخر يرفض ويندوز نقله بعد أن
 * نُقلت القاعدة، فيبقى البرنامج بلا قاعدة في مكانها ويفتح فارغًا. فصارت القاعدة التي لم تعد
 * تُقفل (فلا تُنشأ فارغة)، ويبقى أثرٌ يعيدها الإقلاعُ التالي من مجلّد الأصل (مراجعة ٧ ت١).
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INCOMPLETE_MARKER,
  deleteBeforeRestore,
  listBeforeRestore,
  recoverIncompleteRestore,
  swapInBackup,
  writeIncompleteMarker,
  type SwapOps
} from '../src/main/services/restoreSwap';

const text = (p: string) => readFileSync(p, 'utf8');

/** مكتبٌ ببياناته: قاعدةٌ وملفّ سجلّها، ومخزنٌ فيه مستمسك. */
function office() {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-restore-'));
  const aside = join(dir, 'before-restore-x');
  mkdirSync(aside);
  writeFileSync(join(dir, 'diwan.db'), 'قاعدة المكتب');
  writeFileSync(join(dir, 'diwan.db-wal'), 'سجلّ القاعدة');
  mkdirSync(join(dir, 'store', 'attachments'), { recursive: true });
  writeFileSync(join(dir, 'store', 'attachments', 'scan.png'), 'مستمسك');
  const calls: string[] = [];
  const ops = (extra: Partial<SwapOps> = {}): SwapOps => ({
    dir,
    aside,
    snapshot: (target) => {
      writeFileSync(target, readFileSync(join(dir, 'diwan.db')));
      calls.push('snapshot');
    },
    close: () => calls.push('close'),
    reopen: () => calls.push('reopen'),
    placeDb: (f) => writeFileSync(f, 'قاعدة النسخة'),
    writeStore: (s) => writeFileSync(join(s, 'restored.png'), 'من النسخة'),
    ...extra
  });
  /** البيانات كما كانت قبل الاسترجاع، في مكانها. */
  const intact = () => {
    expect(text(join(dir, 'diwan.db'))).toBe('قاعدة المكتب');
    expect(text(join(dir, 'diwan.db-wal'))).toBe('سجلّ القاعدة');
    expect(text(join(dir, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
    expect(existsSync(join(dir, 'store', 'restored.png'))).toBe(false);
  };
  return { dir, aside, calls, ops, intact };
}

type Office = ReturnType<typeof office>;

/** استرجاعٌ لم تعد قاعدته: النقل عائدةً يتعثّر والنسخ كذلك. */
function stuckOps(o: Office, extra: Partial<SwapOps> = {}): SwapOps {
  let back = false;
  return o.ops({
    rename: (from, to) => {
      if (back && to.startsWith(join(o.dir, 'diwan.db'))) throw new Error('EPERM');
      renameSync(from, to);
    },
    copy: () => {
      throw new Error('EBUSY');
    },
    placeDb: () => {
      back = true;
      throw new Error('قرصٌ ممتلئ');
    },
    ...extra
  });
}

describe('استرجاع النسخة', () => {
  it('ينجح: النسخة في مكانها، وما كان جانبًا لا يُحذف', async () => {
    const o = office();
    await swapInBackup(o.ops());
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة النسخة');
    expect(text(join(o.dir, 'store', 'restored.png'))).toBe('من النسخة');
    expect(existsSync(join(o.dir, 'store', 'attachments'))).toBe(false);
    expect(text(join(o.aside, 'current.db'))).toBe('قاعدة المكتب');
    expect(text(join(o.aside, 'current.db-wal'))).toBe('سجلّ القاعدة');
    expect(text(join(o.aside, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
    expect(text(join(o.aside, 'diwan.db'))).toBe('قاعدة المكتب');
    expect(o.calls).toEqual(['snapshot', 'close', 'reopen']);
  });

  /** خطأ SQLite برمزه — كما يرميه `VACUUM INTO` على قاعدةٍ متضرّرة. */
  const sqliteError = (code: string) => Object.assign(new Error('database disk image is malformed'), { code });

  it('القاعدة الحالية متضرّرة (لا تُنسخ نسخةً متّسقة): يمضي الاسترجاع، وأصلها جانبًا كما هو (D100)', async () => {
    for (const code of ['SQLITE_CORRUPT', 'SQLITE_NOTADB']) {
      const o = office();
      await swapInBackup(
        o.ops({
          // VACUUM INTO يكتب بعض الملفّ ثم يسقط — وما كتبه لا يبقى كأنّه نسخة
          snapshot: (target) => {
            writeFileSync(target, 'نصف نسخة');
            throw sqliteError(code);
          }
        })
      );
      expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة النسخة');
      expect(text(join(o.aside, 'current.db'))).toBe('قاعدة المكتب');
      expect(text(join(o.aside, 'current.db-wal'))).toBe('سجلّ القاعدة');
      expect(text(join(o.aside, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
      expect(existsSync(join(o.aside, 'diwan.db'))).toBe(false);
      expect(o.calls).toEqual(['close', 'reopen']);
    }
  });

  it('وغير التلف في النسخة المتّسقة (قرصٌ ممتلئ) يوقف الاسترجاع قبل أن يُمسّ شيء', async () => {
    const o = office();
    await expect(
      swapInBackup(
        o.ops({
          snapshot: () => {
            throw sqliteError('SQLITE_FULL');
          }
        })
      )
    ).rejects.toThrow('malformed');
    o.intact();
    expect(o.calls).toEqual([]);
  });

  it('تتعثّر كتابة المخزن: يعود كلّ شيءٍ كما كان، ويُقال سبب التعثّر نفسه', async () => {
    const o = office();
    await expect(
      swapInBackup(
        o.ops({
          writeStore: () => {
            throw new Error('النسخة تالفة');
          }
        })
      )
    ).rejects.toThrow('النسخة تالفة');
    o.intact();
    expect(o.calls.at(-1)).toBe('reopen');
  });

  it('يتعثّر نقل المخزن (ملفٌّ مفتوحٌ في برنامجٍ آخر): تعود القاعدة، ولا يُمسّ المخزن', async () => {
    const o = office();
    const busy = (from: string, to: string) => {
      if (from === join(o.dir, 'store')) throw new Error('EBUSY: resource busy or locked');
      renameSync(from, to);
    };
    await expect(swapInBackup(o.ops({ rename: busy }))).rejects.toThrow('EBUSY');
    o.intact();
    // والقاعدة أُعيدت ثم فُتحت — لا برنامجٌ بلا قاعدة.
    expect(o.calls.at(-1)).toBe('reopen');
  });

  it('وتُقال للمكتب بالعربية: بقيت بياناته، وملفٌّ مفتوحٌ في برنامجٍ آخر — لا إنكليزيةً خامًا', async () => {
    const o = office();
    const busy = (from: string, to: string) => {
      if (from === join(o.dir, 'store')) throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
      renameSync(from, to);
    };
    const err = await swapInBackup(o.ops({ rename: busy })).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain('بقيت بيانات المكتب كما كانت');
    expect(message).toContain('مفتوحٌ في برنامجٍ آخر');
    expect(message).toContain('أغلقه وأعد المحاولة');
    // وما ليس من هذا الباب يُقال كما هو.
    const o2 = office();
    const other = await swapInBackup(o2.ops({ writeStore: () => { throw new Error('النسخة تالفة'); } })).catch((e: Error) => e);
    expect((other as Error).message).toBe('تعذّر الاسترجاع فبقيت بيانات المكتب كما كانت: النسخة تالفة');
  });

  it('وإن لم يعد شيءٌ إلى مكانه قيل أين البيانات — ولا يُمحى الأصل', async () => {
    const o = office();
    let back = false;
    const stubborn = (from: string, to: string) => {
      if (back && to === join(o.dir, 'store')) throw new Error('EPERM');
      renameSync(from, to);
    };
    await expect(
      swapInBackup(
        o.ops({
          rename: stubborn,
          placeDb: () => {
            back = true;
            throw new Error('قرصٌ ممتلئ');
          }
        })
      )
    ).rejects.toThrow(o.aside);
    // القاعدة عادت وفُتحت؛ والمخزن الأصلي سليمٌ جانبًا حيث قيل.
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة المكتب');
    expect(text(join(o.aside, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
    expect(o.calls.at(-1)).toBe('reopen');
  });

  it('نقلُ القاعدة عائدةً يتعثّر فتُنسخ — فتعود وتُفتح', async () => {
    const o = office();
    let back = false;
    const stuckDb = (from: string, to: string) => {
      if (back && to.startsWith(join(o.dir, 'diwan.db'))) throw new Error('EPERM');
      renameSync(from, to);
    };
    await expect(
      swapInBackup(
        o.ops({
          rename: stuckDb,
          placeDb: () => {
            back = true;
            throw new Error('قرصٌ ممتلئ');
          }
        })
      )
    ).rejects.toThrow('قرصٌ ممتلئ');
    o.intact();
    expect(o.calls.at(-1)).toBe('reopen');
  });

  it('وقاعدةٌ لم تعد لا تُفتح — فتحُها يُنشئ قاعدةً فارغة توهم بضياع كلّ شيء', async () => {
    const o = office();
    await expect(swapInBackup(stuckOps(o))).rejects.toThrow(o.aside);
    expect(existsSync(join(o.dir, 'diwan.db'))).toBe(false);
    expect(o.calls.filter((c) => c === 'reopen')).toEqual([]);
    // والأصل سليمٌ جانبًا حيث قيل.
    expect(text(join(o.aside, 'current.db'))).toBe('قاعدة المكتب');
  });

  it('وتُقفل القاعدة فلا يفتحها أحدٌ فارغة، ويبقى أثرٌ يعيدها الإقلاع', async () => {
    const o = office();
    const locks: string[] = [];
    await expect(
      swapInBackup(stuckOps(o, { lock: (why) => locks.push(why), markIncomplete: (info) => writeIncompleteMarker(o.dir, info) }))
    ).rejects.toThrow('قرصٌ ممتلئ');
    expect(locks).toHaveLength(1);
    // الرسالة تقول السبب وأين الأصل — وهي ما يُعرض لمن يطلب القاعدة بعدها.
    expect(locks[0]).toContain('قرصٌ ممتلئ');
    expect(locks[0]).toContain(o.aside);
    const marker = JSON.parse(text(join(o.dir, INCOMPLETE_MARKER))) as { aside: string; reason: string };
    expect(marker.aside).toBe(o.aside);
    expect(marker.reason).toBe('قرصٌ ممتلئ');
  });

  it('وتعذّرُ كتابة الأثر لا يمنع القفل', async () => {
    const o = office();
    const locks: string[] = [];
    await expect(
      swapInBackup(
        stuckOps(o, {
          lock: (why) => locks.push(why),
          markIncomplete: () => {
            throw new Error('قرصٌ ممتلئ ثانيةً');
          }
        })
      )
    ).rejects.toThrow(o.aside);
    expect(locks).toHaveLength(1);
  });

  it('وإذا عادت القاعدة فلا قفل ولا أثر', async () => {
    const o = office();
    const locks: string[] = [];
    await expect(
      swapInBackup(
        o.ops({
          lock: (why) => locks.push(why),
          markIncomplete: (info) => writeIncompleteMarker(o.dir, info),
          writeStore: () => {
            throw new Error('النسخة تالفة');
          }
        })
      )
    ).rejects.toThrow('النسخة تالفة');
    expect(locks).toEqual([]);
    expect(existsSync(join(o.dir, INCOMPLETE_MARKER))).toBe(false);
    o.intact();
  });
});

describe('الإقلاع بعد استرجاعٍ لم تعد قاعدته', () => {
  /** استرجاعٌ متعثّر كامل: القاعدة لم تعد ومعها أثرها. */
  async function stuck(): Promise<Office> {
    const o = office();
    await expect(swapInBackup(stuckOps(o, { markIncomplete: (info) => writeIncompleteMarker(o.dir, info) }))).rejects.toThrow();
    return o;
  }

  it('بلا أثرٍ لا يفعل شيئًا', () => {
    const o = office();
    expect(recoverIncompleteRestore(o.dir)).toEqual({ state: 'none' });
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة المكتب');
  });

  it('يُعيد القاعدة من النسخة المتّسقة، ويعيد المخزن، ويمحو الأثر — ولا يمسّ ما جانبًا', async () => {
    const o = await stuck();
    expect(existsSync(join(o.dir, 'diwan.db'))).toBe(false);
    const r = recoverIncompleteRestore(o.dir);
    expect(r).toEqual({ state: 'recovered', aside: o.aside, storeBack: true });
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة المكتب');
    expect(text(join(o.dir, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
    expect(existsSync(join(o.dir, INCOMPLETE_MARKER))).toBe(false);
    // والأصل جانبًا باقٍ — لا يُحذف شيءٌ في الإعادة.
    expect(text(join(o.aside, 'current.db'))).toBe('قاعدة المكتب');
  });

  it('ولو غابت النسخة المتّسقة أُعيدت القاعدة وسجلّها من الملفّات الأصلية', async () => {
    const o = await stuck();
    rmSync(join(o.aside, 'diwan.db'));
    expect(recoverIncompleteRestore(o.dir).state).toBe('recovered');
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة المكتب');
    expect(text(join(o.dir, 'diwan.db-wal'))).toBe('سجلّ القاعدة');
  });

  it('ومخزنٌ لم يعد هو أيضًا يعود من جانبه', async () => {
    const o = office();
    let back = false;
    await expect(
      swapInBackup(
        stuckOps(o, {
          rename: (from, to) => {
            if (back && (to === join(o.dir, 'store') || to.startsWith(join(o.dir, 'diwan.db')))) throw new Error('EPERM');
            renameSync(from, to);
          },
          placeDb: () => {
            back = true;
            throw new Error('قرصٌ ممتلئ');
          },
          markIncomplete: (info) => writeIncompleteMarker(o.dir, info)
        })
      )
    ).rejects.toThrow(o.aside);
    expect(existsSync(join(o.dir, 'store'))).toBe(false);
    expect(recoverIncompleteRestore(o.dir)).toEqual({ state: 'recovered', aside: o.aside, storeBack: true });
    expect(text(join(o.dir, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
  });

  it('وما كتبه الاسترجاع المتعثّر في مكان المخزن يُركَن بجانبه ولا يحلّ محلّ الأصل', async () => {
    const o = await stuck();
    // المخزن الأصلي جانبًا، وفي مكانه ما كتبته النسخة المتعثّرة قبل أن تتعثّر.
    renameSync(join(o.dir, 'store'), join(o.aside, 'store'));
    mkdirSync(join(o.dir, 'store'), { recursive: true });
    writeFileSync(join(o.dir, 'store', 'restored.png'), 'من النسخة المتعثّرة');
    expect(recoverIncompleteRestore(o.dir).state).toBe('recovered');
    expect(text(join(o.dir, 'store', 'attachments', 'scan.png'))).toBe('مستمسك');
    expect(existsSync(join(o.dir, 'store', 'restored.png'))).toBe(false);
    expect(readdirSync(o.aside).some((f) => f.startsWith('store-'))).toBe(true);
  });

  it('وإن غاب مجلّد الأصل أو خلا من قاعدة: يفشل ويبقى الأثر — ولا قاعدة فارغة', async () => {
    const o = await stuck();
    rmSync(join(o.aside, 'diwan.db'));
    rmSync(join(o.aside, 'current.db'));
    rmSync(join(o.aside, 'current.db-wal'));
    expect(recoverIncompleteRestore(o.dir)).toMatchObject({ state: 'failed', aside: o.aside });
    expect(existsSync(join(o.dir, 'diwan.db'))).toBe(false);
    expect(existsSync(join(o.dir, INCOMPLETE_MARKER))).toBe(true);
    rmSync(o.aside, { recursive: true, force: true });
    expect(recoverIncompleteRestore(o.dir)).toMatchObject({ state: 'failed' });
    expect(existsSync(join(o.dir, 'diwan.db'))).toBe(false);
  });

  it('وقاعدةٌ ملفّها فارغ لا تُعدّ نسخةً سليمة', async () => {
    const o = await stuck();
    writeFileSync(join(o.aside, 'diwan.db'), '');
    expect(recoverIncompleteRestore(o.dir).state).toBe('recovered');
    // الفارغة تُتجاوز إلى الأصل.
    expect(text(join(o.dir, 'diwan.db'))).toBe('قاعدة المكتب');
  });

  it('وقاعدةٌ عادت بيد المطوّر قبل الإقلاع تُنهي الأثر وحده', async () => {
    const o = await stuck();
    writeFileSync(join(o.dir, 'diwan.db'), 'أعادها المطوّر');
    expect(recoverIncompleteRestore(o.dir)).toEqual({ state: 'none' });
    expect(text(join(o.dir, 'diwan.db'))).toBe('أعادها المطوّر');
    expect(existsSync(join(o.dir, INCOMPLETE_MARKER))).toBe(false);
  });
});

describe('مجلّدات ما قبل الاسترجاع (before-restore-*) — قائمة وحذف يدوي', () => {
  it('listBeforeRestore تقرأ المجلّدات المطابقة وتفرزها أحدثًا أولًا وتحسب الحجم', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-asides-'));
    try {
      const d1 = join(dir, 'before-restore-2026-10-18-10-00-00');
      const d2 = join(dir, 'before-restore-2026-10-19-12-30-00');
      const notAside = join(dir, 'before-restore-invalid');
      const regular = join(dir, 'store');
      mkdirSync(d1);
      mkdirSync(d2);
      mkdirSync(notAside);
      mkdirSync(regular);

      writeFileSync(join(d1, 'file1.txt'), Buffer.alloc(100));
      mkdirSync(join(d2, 'sub'));
      writeFileSync(join(d2, 'sub', 'file2.txt'), Buffer.alloc(250));

      const list = listBeforeRestore(dir);
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        name: 'before-restore-2026-10-19-12-30-00',
        at: '2026-10-19T12:30:00',
        bytes: 250
      });
      expect(list[1]).toEqual({
        name: 'before-restore-2026-10-18-10-00-00',
        at: '2026-10-18T10:00:00',
        bytes: 100
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('deleteBeforeRestore ترفض الأسماء غير المطابقة ومحاولات الالتفاف', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-asides-'));
    try {
      expect(deleteBeforeRestore(dir, '..')).toBe(false);
      expect(deleteBeforeRestore(dir, '../secret')).toBe(false);
      expect(deleteBeforeRestore(dir, 'before-restore-../evil')).toBe(false);
      expect(deleteBeforeRestore(dir, 'random-folder')).toBe(false);
      expect(deleteBeforeRestore(dir, 'before-restore-nonexistent')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('deleteBeforeRestore ترفض حذف المجلّد إن كان مذكورًا في أثر استرجاع غير مكتمل', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-asides-'));
    try {
      const targetName = 'before-restore-2026-10-19-10-00-00';
      const targetDir = join(dir, targetName);
      mkdirSync(targetDir);
      writeFileSync(join(targetDir, 'data.db'), 'original data');

      writeIncompleteMarker(dir, { aside: targetDir, reason: 'test stuck' });
      expect(existsSync(join(dir, INCOMPLETE_MARKER))).toBe(true);

      // يرفض حذفه لأن الأثر يعتمد عليه
      expect(deleteBeforeRestore(dir, targetName)).toBe(false);
      expect(existsSync(targetDir)).toBe(true);

      // بعد إزالة الأثر (أو لمجلّد آخر لا يرتبط به)، يمكن الحذف
      rmSync(join(dir, INCOMPLETE_MARKER));
      expect(deleteBeforeRestore(dir, targetName)).toBe(true);
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

