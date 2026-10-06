/**
 * استبدال بيانات المكتب بنسخة — ولا يضيع ما كان أيًّا كان موضع التعثّر.
 *
 * ما على الجهاز يُنقل جانبًا (لا يُحذف): القاعدة بملفّاتها، والمخزن. ثم تُكتب النسخة وتُفتح.
 * وإن تعثّر شيءٌ — **في النقل نفسه** أو في الكتابة — عاد ما نُقل إلى مكانه، ولا يُمحى إلا ما
 * كتبته النسخة. وكان النقل خارج الحماية: مخزنٌ يمسك ملفًّا منه برنامجٌ آخر (عارض صور، أو
 * مضادّ فيروسات) يرفض ويندوز نقله بعد أن نُقلت القاعدة — فيبقى البرنامج بقاعدةٍ مغلقة ولا
 * قاعدة في مكانها، فيفتح فارغًا، والبيانات سليمةٌ جانبًا لا يعرف المكتب أين.
 *
 * والجهاز يُعطى بعمليّاته (`SwapOps`) — فيُختبر كلّ موضع تعثّرٍ بلا Electron (`tests/restoreSwap.test.ts`).
 */
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type SwapOps = {
  /** مجلّد بيانات المكتب: فيه `diwan.db` و`store`. */
  dir: string;
  /** المجلّد الذي يُنقل إليه ما كان (`before-restore-…`) — موجودٌ قبل الاستدعاء. */
  aside: string;
  /** نسخةٌ متّسقة من القاعدة الجارية إلى ملف — قبل أن تُغلق. */
  snapshot: (target: string) => void;
  /** تُغلق القاعدة فتُنقل ملفّاتها. */
  close: () => void;
  /** تُفتح القاعدة من مكانها وتُرحَّل إلى صيغة هذا الإصدار. */
  reopen: () => void;
  /** تُكتب قاعدة النسخة في مكانها. */
  placeDb: (dbFile: string) => void;
  /** يُكتب مخزن النسخة في مجلّده (وقد أُنشئ فارغًا). */
  writeStore: (store: string) => void | Promise<void>;
  /** النقل والنسخ — يُعطيان في الاختبار ليتعثّرا حيث يُراد. */
  rename?: (from: string, to: string) => void;
  copy?: (from: string, to: string) => void;
};

const DB_SUFFIXES = ['', '-wal', '-shm'] as const;

export async function swapInBackup(o: SwapOps): Promise<void> {
  const rename = o.rename ?? renameSync;
  const copy = o.copy ?? copyFileSync;
  const dbFile = join(o.dir, 'diwan.db');
  const store = join(o.dir, 'store');
  const moved: [from: string, to: string][] = [];
  const move = (from: string, to: string) => {
    if (!existsSync(from)) return;
    rename(from, to);
    moved.push([from, to]);
  };
  /** هل بدأت النسخة تكتب في مكان البيانات؟ قبلها لا يُمحى شيءٌ في مكانها. */
  let writing = false;

  o.snapshot(join(o.aside, 'diwan.db'));
  o.close();
  try {
    for (const suffix of DB_SUFFIXES) move(dbFile + suffix, join(o.aside, `current.db${suffix}`));
    move(store, join(o.aside, 'store'));
    writing = true;
    o.placeDb(dbFile);
    mkdirSync(store, { recursive: true });
    await o.writeStore(store);
    o.reopen();
  } catch (e) {
    o.close();
    const stuck: string[] = [];
    if (writing) {
      // ما كتبته النسخة وحده يُمحى — فالأصل كلّه جانبًا.
      for (const suffix of DB_SUFFIXES) {
        try {
          rmSync(dbFile + suffix, { force: true });
        } catch {
          stuck.push(dbFile + suffix);
        }
      }
      try {
        rmSync(store, { recursive: true, force: true });
      } catch {
        stuck.push(store);
      }
    }
    for (const [from, to] of [...moved].reverse()) {
      try {
        rename(to, from);
      } catch {
        // الملف يُنسخ إن لم يُنقل؛ والمجلّد يبقى جانبًا ويُقال مكانه.
        try {
          if (statSync(to).isFile()) copy(to, from);
          else throw new Error('مجلّد');
        } catch {
          stuck.push(from);
        }
      }
    }
    // القاعدة في مكانها تُفتح؛ وإن لم تعد فلا تُفتح — فتحُها يُنشئ قاعدةً فارغة توهم بضياع كلّ شيء.
    if (existsSync(dbFile)) o.reopen();
    if (stuck.length) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new Error(
        `تعذّر الاسترجاع (${reason})، ولم يعد كلّ شيءٍ إلى مكانه. بيانات المكتب الأصلية سليمةٌ في: ${o.aside} — لا تحذفه، وأغلق البرنامج وأرسل هذه الرسالة إلى المطوّر.`
      );
    }
    throw e;
  }
}
