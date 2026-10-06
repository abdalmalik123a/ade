/**
 * استرجاع النسخة لا يُضيع ما كان — في أيّ موضعٍ تعثّر (الموجة ١، البند ٣).
 *
 * وكان النقل نفسه خارج الحماية: مخزنٌ يمسك ملفًّا منه برنامجٌ آخر يرفض ويندوز نقله بعد أن
 * نُقلت القاعدة، فيبقى البرنامج بلا قاعدة في مكانها ويفتح فارغًا.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { swapInBackup, type SwapOps } from '../src/main/services/restoreSwap';

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
    let back = false;
    const stuckDb = (from: string, to: string) => {
      if (back && to.startsWith(join(o.dir, 'diwan.db'))) throw new Error('EPERM');
      renameSync(from, to);
    };
    await expect(
      swapInBackup(
        o.ops({
          rename: stuckDb,
          copy: () => {
            throw new Error('EBUSY');
          },
          placeDb: () => {
            back = true;
            throw new Error('قرصٌ ممتلئ');
          }
        })
      )
    ).rejects.toThrow(o.aside);
    expect(existsSync(join(o.dir, 'diwan.db'))).toBe(false);
    expect(o.calls.filter((c) => c === 'reopen')).toEqual([]);
    // والأصل سليمٌ جانبًا حيث قيل.
    expect(text(join(o.aside, 'current.db'))).toBe('قاعدة المكتب');
  });
});
