/**
 * الذكاء المحلي — يتعلّم من مكتبه هو، بلا شبكة ولا حساب.
 *
 * وأثمنُ ما يُتعلَّم منه ليس مجموعةً عامة، بل **تصحيحاتُ الموظف**: كل مرّة يعيد
 * تسمية حقلٍ اقترحه البرنامج، أو يسحب حدّ الترويسة، أو يرفض اقتراحًا — يُقيَّد
 * ما اقتُرح وما اختير. فيتحسّن الكاشف **لهذا المكتب**.
 *
 * **وهذه لا تُجمع بأثر رجعي**: من لم يقيّدها من اليوم الأول فقدها. ولذلك يُبنى
 * الجدول الآن ولو لم يُستعمل ما فيه إلا بعد شهور.
 *
 * وأربعُ قواعدَ لا تُخترق (§١٦):
 *
 * ١. **طبقةُ اقتراحٍ لا طبقةُ قرار** — يُعاد `Suggestion` بدرجة ثقةٍ وسبب،
 *    والموظف يحكم. ولا يُكتب في الوثيقة شيءٌ مباشرةً.
 * ٢. **الحتميّةُ أولًا** — وما هنا عَدٌّ لا نموذج: «سمّاه مكتبك هكذا أربع مرّات»
 *    سببٌ يُقال ويُراجَع، بخلاف وزنٍ في شبكة.
 * ٣. **يعمل بلا شيء من هذا** — الجدول فارغٌ في اليوم الأول، والقواعد تكفي.
 * ٤. **لا شيء يغادر الجهاز** — لا نداء شبكةٍ ولو للتحديث.
 */
import type { Database } from 'better-sqlite3';
import { APPLY_THRESHOLD, type Suggestion } from '@shared/doc';
import { normalizeFold } from '@shared/arabic';

/** ما يُصحَّح — ولكلٍّ مفتاحُ مدخلٍ يخصّه. */
export type CorrectionKind =
  | 'fieldName'
  | 'letterheadEdge'
  | 'category'
  | 'clip'
  | 'duplicate';

export type Correction = {
  kind: CorrectionKind;
  /** ما رآه البرنامج: السطر، أو مفتاح الترويسة، أو اسم الملف. */
  input: string;
  /** ما اقترحه — أو `null` إن لم يقترح شيئًا. */
  suggested: string | null;
  /** ما اختاره الموظف. */
  chosen: string;
};

/**
 * اتفاقاتٌ تكفي ليصير الرأيُ رأيَ المكتب.
 *
 * واحدةٌ قد تكون زلّة، واثنتان صدفة. وثلاثٌ عادة — وعندها تتجاوز الثقةُ عتبة
 * التطبيق فيُقترح بلا تردّد.
 */
export const HABIT = 3;

export function prepareLearning(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS corrections (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kind       TEXT NOT NULL,
      input      TEXT NOT NULL,
      suggested  TEXT,
      chosen     TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_corrections_lookup ON corrections(kind, input);
  `);
}

/** مفتاحُ المدخل: يُقصّ ويُوحَّد فراغُه، فلا يفترق سطران بمسافة. */
const key = (input: string): string => input.replace(/\s+/g, ' ').trim().slice(0, 200);

/**
 * يقيّد تصحيحًا — ولا يقيّد موافقةً.
 *
 * فالموظف الذي قبِل الاقتراح لم يعلّمنا شيئًا جديدًا؛ والذي غيّره علّمنا. وقيدُ
 * الموافقات يُغرق الجدول بما لا يُسأل عنه.
 */
export function recordCorrection(db: Database, c: Correction): boolean {
  prepareLearning(db);
  const chosen = c.chosen.trim();
  if (!chosen || chosen === (c.suggested ?? '').trim()) return false;
  db.prepare('INSERT INTO corrections (kind, input, suggested, chosen) VALUES (?, ?, ?, ?)').run(
    c.kind,
    key(c.input),
    c.suggested?.trim() || null,
    chosen
  );
  return true;
}

export function recordCorrections(db: Database, list: Correction[]): number {
  prepareLearning(db);
  return db.transaction(() => list.filter((c) => recordCorrection(db, c)).length)();
}

/**
 * ما اعتاده المكتب لمدخلٍ بعينه.
 *
 * والثقةُ تنمو بالاتفاق وتنقص بالاختلاف: خمسُ مرّات على اسمٍ واحد أوثقُ من
 * خمسٍ موزّعةٍ على ثلاثة. ولا تبلغ اليقين أبدًا — فالموظف يحكم.
 */
export function learned(db: Database, kind: CorrectionKind, input: string): Suggestion<string> | null {
  prepareLearning(db);
  const rows = db
    .prepare(
      `SELECT chosen, COUNT(*) AS n FROM corrections
       WHERE kind = ? AND input = ?
       GROUP BY chosen ORDER BY n DESC, MAX(created_at) DESC`
    )
    .all(kind, key(input)) as { chosen: string; n: number }[];

  const top = rows[0];
  if (!top) return null;

  const total = rows.reduce((sum, r) => sum + r.n, 0);
  const agreement = top.n / total;

  /**
   * الثقة تبلغ عتبة التطبيق **عند العادة تمامًا** — لا قبلها.
   *
   * وكانت تبلغها عند اثنتين بينما تُعدّ العادةُ ثلاثًا، فعتبتان تختلفان: يُطبَّق
   * الاسم قبل أن يرسخ، فلا يرى الموظفُ الاسمَ الأول ليصحّحه ثالثةً — فيتوقّف
   * التعلّم عند اثنتين ولا يبلغ العادة أبدًا.
   */
  const ratio = Math.min(1, top.n / HABIT);
  const grown =
    ratio < 1
      ? APPLY_THRESHOLD - 0.3 + 0.29 * ratio
      : APPLY_THRESHOLD + 0.15 * Math.min(1, (top.n - HABIT) / (HABIT * 2));
  // تقترب من ٠٫٩٥ ولا تبلغ اليقين: عادةٌ راسخة، والموظف يحكم.
  const confidence = Math.min(0.95, grown * agreement);

  return {
    value: top.chosen,
    confidence,
    reason:
      top.n >= HABIT
        ? `اعتاده مكتبك: اختاره ${top.n} مرّات`
        : `اختاره مكتبك ${top.n === 1 ? 'مرّةً' : `${top.n} مرّات`}`
  };
}

/**
 * يرجّح بين قاعدةٍ وعادةِ مكتب.
 *
 * والعادةُ تسبق القاعدة حين ترسخ: القاعدة عامّةٌ تُخمّن من لفظ السطر، والعادةُ
 * شهادةٌ من هذا المكتب على هذا السطر بعينه. وكلتاهما تُعلَّل، فالموظف يرى **لماذا**.
 */
export function prefer<T extends string>(
  rule: Suggestion<T> | null,
  habit: Suggestion<string> | null
): Suggestion<string> | null {
  if (!habit) return rule;
  if (!rule) return habit;
  return habit.confidence >= rule.confidence ? habit : rule;
}

export type LearningStats = {
  total: number;
  byKind: { kind: CorrectionKind; count: number }[];
  /** ما رسخ: مدخلاتٌ بلغ اتفاقُها حدّ العادة — وهي ما يُقترح بلا تردّد. */
  habits: number;
};

/** ما تعلّمه البرنامج من هذا المكتب — يُعرض، فالتعلّم لا يكون صامتًا. */
export function learningStats(db: Database): LearningStats {
  prepareLearning(db);
  const total = (db.prepare('SELECT COUNT(*) AS n FROM corrections').get() as { n: number }).n;
  const byKind = db
    .prepare('SELECT kind, COUNT(*) AS count FROM corrections GROUP BY kind ORDER BY count DESC')
    .all() as { kind: CorrectionKind; count: number }[];
  const habits = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT kind, input FROM corrections GROUP BY kind, input, chosen HAVING COUNT(*) >= ?
         )`
      )
      .get(HABIT) as { n: number }
  ).n;
  return { total, byKind, habits };
}

/** كلماتٌ لا تدلّ على تصنيف — تتكرّر في عناوين كل الأبواب. */
const STOP = new Set(['من', 'الى', 'الي', 'في', 'على', 'علي', 'عن', 'مع', 'او', 'و', 'ال', 'بال', 'لل', 'كتاب', 'طلب', 'نموذج']);

function titleWords(title: string): string[] {
  return normalizeFold(title)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * تصنيف النموذج من عنوانه (FOUNDATION §١٦): «مصنّفٌ نصّي بسيط يتدرّب على ملفات المكتب
 * نفسه» — لا نموذج لغوي. النماذج المصنَّفة في المكتبة شواهد: كم نموذجًا في «تربية»
 * يشارك هذا العنوانَ كلمة؟ وما صحّحه الموظف لعنوانٍ بعينه عادةٌ تغلب حين ترسخ.
 */
export function suggestCategory(db: Database, title: string): Suggestion<string> | null {
  const words = new Set(titleWords(title));
  const habit = words.size ? learned(db, 'category', normalizeFold(title)) : null;
  if (!words.size) return habit;

  const rows = db
    .prepare(
      `SELECT title, category FROM templates
       WHERE is_active = 1 AND category IS NOT NULL AND TRIM(category) <> ''`
    )
    .all() as { title: string; category: string }[];
  const score = new Map<string, { hits: number; rows: number }>();
  for (const r of rows) {
    const shared = titleWords(r.title).filter((w) => words.has(w)).length;
    if (!shared) continue;
    const s = score.get(r.category) ?? { hits: 0, rows: 0 };
    s.hits += shared;
    s.rows += 1;
    score.set(r.category, s);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].hits - a[1].hits || b[1].rows - a[1].rows);
  const top = ranked[0];
  if (!top) return habit;
  const total = ranked.reduce((n, [, s]) => n + s.hits, 0);
  // شاهدٌ واحد اقتراحٌ خجول، وخمسةٌ متّفقة قريبةٌ من العادة — ولا تبلغها: الموظف يحكم.
  const confidence = Math.min(0.78, 0.45 + 0.06 * top[1].rows) * (top[1].hits / total);
  const rule: Suggestion<string> = {
    value: top[0],
    confidence,
    reason: `${top[1].rows === 1 ? 'نموذجٌ مثله' : `${top[1].rows} نماذج مثله`} في «${top[0]}»`
  };
  return prefer(rule, habit);
}
