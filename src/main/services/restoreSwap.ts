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
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
  /**
   * القاعدة لم تعد إلى مكانها فلا تُفتح قاعدةٌ فارغة: يُقفل `getDb()` برسالةٍ (مراجعة ٧ ت١). فأيّ نداءٍ تالٍ كان
   * يُنشئ `diwan.db` فارغًا — فإن تابع المكتب العمل أيّامًا انشطرت السلسلة وتكرّر الترقيم.
   */
  lock?: (reason: string) => void;
  /** ويُكتب أثرٌ يبقى بعد إغلاق البرنامج فلا يُنشأ البديل الفارغ في الإقلاع القادم (`recoverIncompleteRestore`). */
  markIncomplete?: (info: { aside: string; reason: string }) => void;
};

/** أثر استرجاعٍ لم تعد قاعدته: في مجلّد البيانات، يبقى حتى تعود القاعدة. */
export const INCOMPLETE_MARKER = 'restore-incomplete.json';

const DB_SUFFIXES = ['', '-wal', '-shm'] as const;

/**
 * سببُ التعثّر لمن يقرؤه المكتب: ملفٌّ ممسوكٌ أو ممنوع (EBUSY وEPERM وEACCES) كان يظهر إنكليزيًّا خامًا في واجهةٍ
 * عربية؛ فيُقال ما يُفعل، ويلحقه الأصل بين قوسين للمطوّر.
 */
function describeFailure(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: unknown } | null)?.code;
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' || /\b(EBUSY|EPERM|EACCES)\b/.test(msg)) {
    return `ملفٌّ في بيانات المكتب مفتوحٌ في برنامجٍ آخر (عارض صور أو مضادّ فيروسات أو نافذة مستكشف) — أغلقه وأعد المحاولة. [${msg}]`;
  }
  return msg;
}

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

  const snapshot = join(o.aside, 'diwan.db');
  try {
    o.snapshot(snapshot);
  } catch (e) {
    // قاعدةٌ متضرّرة لا تُنسخ نسخةً متّسقة (VACUUM يسقط عليها) — وأصلها كلّه يُنقل جانبًا كما هو بعد سطرين،
    // فلا يمنع تلفُها استرجاعَ ما يُصلحها (D100). وغير التلف يوقف الاسترجاع قبل أن يُمسّ شيء.
    if (!/^SQLITE_(CORRUPT|NOTADB)/.test(String((e as { code?: unknown } | null)?.code ?? ''))) throw e;
    // وما كتبه VACUUM قبل أن يسقط ليس نسخة: لا يبقى فيحسبه الإقلاع أصلًا (`recoverIncompleteRestore`).
    rmSync(snapshot, { force: true });
  }
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
    const reason = e instanceof Error ? e.message : String(e);
    // القاعدة في مكانها تُفتح؛ وإن لم تعد فلا تُفتح — فتحُها يُنشئ قاعدةً فارغة توهم بضياع كلّ شيء.
    if (existsSync(dbFile)) o.reopen();
    else {
      const lockMessage =
        `قاعدة بيانات المكتب لم تعد إلى مكانها بعد استرجاعٍ متعثّر (${describeFailure(e)}) — أُوقف كلّ شيءٍ حتى لا تُفتح قاعدةٌ فارغة. ` +
        `بياناتك الأصلية سليمةٌ في: ${o.aside}. يُعاد فتح ديوان فيحاول إعادتها بنفسه؛ فإن لم يفعل فأغلقه وافتحه من جديد.`;
      try {
        o.markIncomplete?.({ aside: o.aside, reason });
      } catch {
        // القفل قائمٌ في هذه الجلسة، ومجلّد الأصل مذكورٌ في الرسالة — فتعذّر الأثر لا يُضيع شيئًا.
      }
      o.lock?.(lockMessage);
      throw new Error(lockMessage);
    }
    if (stuck.length) {
      throw new Error(
        `تعذّر الاسترجاع (${describeFailure(e)})، ولم يعد كلّ شيءٍ إلى مكانه. بيانات المكتب الأصلية سليمةٌ في: ${o.aside} — لا تحذفه، وأغلق البرنامج وأرسل هذه الرسالة إلى المطوّر.`
      );
    }
    throw new Error(`تعذّر الاسترجاع فبقيت بيانات المكتب كما كانت: ${describeFailure(e)}`);
  }
}

/** يُكتب أثر الاسترجاع غير المكتمل: ما نُقل جانبًا ولماذا. */
export function writeIncompleteMarker(dir: string, info: { aside: string; reason: string }): void {
  writeFileSync(join(dir, INCOMPLETE_MARKER), JSON.stringify({ ...info, at: new Date().toISOString() }, null, 2));
}

export type Recovery =
  | { state: 'none' }
  /** `storeBack`: هل عاد مجلّد الملفّات (المستمسكات) إلى مكانه؟ وإلا بقي جانبًا في `aside/store`. */
  | { state: 'recovered'; aside: string; storeBack: boolean }
  | { state: 'failed'; aside: string | null; reason: string };

const usable = (file: string): boolean => {
  try {
    return statSync(file).size > 0;
  } catch {
    return false;
  }
};

/** مجلّد ما كتبه الاسترجاع المتعثّر قبل أن يتعثّر — يُركَن جانبًا ولا يُحذف. */
const PARTIAL_STORE = 'store-الاسترجاع-المتعثّر';

/**
 * في الإقلاع: استرجاعٌ سابقٌ لم تعد قاعدته إلى مكانها (ملفٌّ كان ممسوكًا ورفض ويندوز نقله) — فتُعاد الآن من
 * النسخة المتّسقة التي أُخذت قبل الاسترجاع (`aside/diwan.db`)، أو من الملفّات الأصلية (`current.db…`).
 *
 * لا يُنشأ بديلٌ فارغ أبدًا: إن تعذّرت الإعادة بقي الأثر وأُغلق البرنامج برسالة. ولا يُحذف شيءٌ جانبًا.
 * وقاعدةٌ عادت بيد المطوِّر قبل الإقلاع تُنهي الأثر وحده.
 */
export function recoverIncompleteRestore(dir: string): Recovery {
  const marker = join(dir, INCOMPLETE_MARKER);
  if (!existsSync(marker)) return { state: 'none' };
  const dbFile = join(dir, 'diwan.db');
  if (existsSync(dbFile)) {
    try {
      rmSync(marker, { force: true });
    } catch {
      // الأثر يبقى ويُحاول إنهاؤه في الإقلاع القادم.
    }
    return { state: 'none' };
  }
  let aside: string | null = null;
  try {
    aside = (JSON.parse(readFileSync(marker, 'utf8')) as { aside?: string }).aside ?? null;
  } catch {
    aside = null;
  }
  if (!aside || !existsSync(aside)) {
    return { state: 'failed', aside, reason: 'مجلّد الأصل المنقول جانبًا غير موجود' };
  }
  try {
    const snapshot = join(aside, 'diwan.db');
    const current = join(aside, 'current.db');
    if (usable(snapshot)) {
      copyFileSync(snapshot, dbFile);
    } else if (usable(current)) {
      for (const suffix of DB_SUFFIXES) if (existsSync(current + suffix)) copyFileSync(current + suffix, dbFile + suffix);
    } else {
      return { state: 'failed', aside, reason: 'لا قاعدة سليمة في مجلّد الأصل' };
    }
  } catch (e) {
    // نصفُ قاعدةٍ منسوخة لا تبقى في مكانها: تُمحى لتُعاد المحاولة كاملةً، فلا تُفتح مبتورة.
    for (const suffix of DB_SUFFIXES) rmSync(dbFile + suffix, { force: true });
    return { state: 'failed', aside, reason: e instanceof Error ? e.message : String(e) };
  }
  // المخزن الأصلي جانبًا يعود؛ وما كتبه الاسترجاع المتعثّر في مكانه يُركَن بجانبه.
  let storeBack = true;
  const asideStore = join(aside, 'store');
  if (existsSync(asideStore)) {
    const store = join(dir, 'store');
    try {
      if (existsSync(store)) renameSync(store, join(aside, PARTIAL_STORE));
      renameSync(asideStore, store);
    } catch {
      storeBack = false;
    }
  }
  try {
    rmSync(marker, { force: true });
  } catch {
    // القاعدة عادت؛ والأثر الباقي يُنهى في الإقلاع القادم لأنّها في مكانها.
  }
  return { state: 'recovered', aside, storeBack };
}

export type BeforeRestoreAside = { name: string; at: string; bytes: number };

function dirSize(d: string): number {
  let total = 0;
  try {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      if (ent.isDirectory()) total += dirSize(full);
      else if (ent.isFile()) total += statSync(full).size;
    }
  } catch {
    // ignore
  }
  return total;
}

/** قراءة مجلّدات before-restore-* داخل مجلّد البيانات (أحدثها أوّلًا، بحجم محتوياتها). */
export function listBeforeRestore(dir: string): BeforeRestoreAside[] {
  if (!existsSync(dir)) return [];
  const entries: BeforeRestoreAside[] = [];
  try {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const m = ent.name.match(/^before-restore-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
      if (!m) continue;
      // الاسم بتوقيت غرينتش (`stamp` في `ipc/backup.ts`) — فبلا `Z` يُقرأ محلّيًّا ويُعرض أبكر بفرق المنطقة (D101).
      const at = `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`;
      const bytes = dirSize(join(dir, ent.name));
      entries.push({ name: ent.name, at, bytes });
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => b.name.localeCompare(a.name));
}

/** حذف مجلّد قبل الاسترجاع يدويًّا — ويرفض الحذف إن كان المجلّد مذكورًا في أثر استرجاعٍ متعثّر لم يكتمل. */
export function deleteBeforeRestore(dir: string, name: string): boolean {
  if (!/^before-restore-[\w-]+$/.test(name) || name.includes('..')) return false;
  const target = join(dir, name);
  if (!existsSync(target)) return false;
  const marker = join(dir, INCOMPLETE_MARKER);
  if (existsSync(marker)) {
    try {
      const info = JSON.parse(readFileSync(marker, 'utf8')) as { aside?: string };
      if (info.aside && (info.aside === target || info.aside.endsWith(name))) {
        return false;
      }
    } catch {
      return false;
    }
  }
  try {
    rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

