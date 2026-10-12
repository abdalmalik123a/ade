/**
 * فهارس البحث العربي (FTS5) — §١٥: «SQLite بفهرسٍ يجيب في أجزاء من الثانية».
 *
 * كانت الفهارس الأربعة معرّفةً في `search.sql` ولا يُكتب فيها شيء، والبحث يمسح
 * الجداول كلّها بـ`LIKE '%…%'`: خمسون ألف كتابٍ بمتونها تُقرأ عند كل حرف. وهنا
 * تُملأ وتُستعمل:
 *
 * - **النصّ المفهرَس مطبَّعٌ سلفًا** (`normalizeFold`): «احمد» تجد «أحمد» بلا
 *   تطبيعٍ وقت السؤال — والسؤال يُطبَّع بالقاعدة نفسها.
 * - **بلا نسخةٍ ثانية من النصّ** (`content=''`)، والحذف يعمل (`contentless_delete`)
 *   فيُحدَّث المواطن ويُحذف النموذج ولا يبقى في الفهرس أثره.
 * - **ترحيلٌ آمن**: الجدول القديم (بلا حذف) يُبنى من جديد، والفهرس يُطابَق بعدده
 *   عند الإقلاع فيُعاد بناؤه إن نقص (قاعدةٌ سبقت الفهرس، أو كتابٌ صدر بإصدارٍ قديم).
 * - **وبديلٌ إن فشل**: إن تعذّر FTS5 لأي سبب يعود البحث إلى المسح القديم — أبطأ
 *   لكنه صحيح. فالفهرس تسريعٌ لا شرط.
 *
 * والأرقام وسط الكلمة (آخر أربعة من رقمٍ وطني) لا تجدها الفهارس — تجد البدايات —
 * فتُسأل عنها الأعمدة الرقمية مسحًا، وهي قصيرة.
 */
import type { Database } from 'better-sqlite3';
import { normalizeFold, toFtsQuery } from '@shared/arabic';
import { htmlToText } from './documents';

export type IndexName = 'documents' | 'citizens' | 'templates' | 'attachments';

const COLUMNS: Record<IndexName, string[]> = {
  documents: ['serial', 'doc_type', 'destination', 'purpose', 'citizen_name', 'body_text'],
  citizens: ['full_name', 'national_id', 'job_title', 'workplace', 'employee_code', 'phone'],
  templates: ['code', 'title', 'subtitle', 'category', 'body_text'],
  attachments: ['doc_type', 'ocr_text']
};

type Row = Record<string, string | null>;

/** الصفوف كما تُفهرس من جدولها: استعلامها، وشرطٌ دائم (النماذج النشطة وحدها)، وأعمدتها بترتيب `COLUMNS`. */
const SOURCE: Record<IndexName, { sql: string; where?: string; cols: (r: Row) => (string | null)[] }> = {
  documents: {
    sql: `SELECT id, serial, doc_type AS docType, destination, purpose,
                 TRIM(COALESCE(citizen_name, '') || ' ' || COALESCE(citizen_nid, '')) AS name, body_html AS body
          FROM documents`,
    cols: (r) => [r.serial, r.docType, r.destination, r.purpose, r.name, htmlToText(r.body ?? '')]
  },
  citizens: {
    sql: 'SELECT id, full_name, national_id, job_title, workplace, employee_code, phone FROM citizens',
    cols: (r) => [r.full_name, r.national_id, r.job_title, r.workplace, r.employee_code, r.phone].map((v) => v ?? null)
  },
  templates: {
    sql: 'SELECT id, code, title, subtitle, category, body_html FROM templates',
    where: 'is_active = 1',
    cols: (r) => [r.code, r.title, r.subtitle, r.category, htmlToText(r.body_html ?? '')]
  },
  attachments: { sql: 'SELECT id, doc_type, ocr_text FROM attachments', cols: (r) => [r.doc_type, r.ocr_text] }
};

/** صفوف الفهرس بشرط: صفٌّ واحد (`id = ?`)، أو دفعةٌ بعد معرّف (`id > ?` مرتّبةً ومحدودة). */
function sourceRows(db: Database, name: IndexName, cond: string, args: unknown[], tail = '') {
  const src = SOURCE[name];
  const where = [src.where, cond].filter(Boolean).join(' AND ');
  return (db.prepare(`${src.sql} WHERE ${where}${tail}`).all(...args) as Row[]).map((r) => ({
    id: Number(r.id),
    cols: src.cols(r)
  }));
}

const TABLE: Record<IndexName, string> = {
  documents: 'documents',
  citizens: 'citizens',
  templates: 'templates',
  attachments: 'attachments'
};

/**
 * أيعمل FTS5 في هذه القاعدة؟ — يُسأل مرّةً لكل اتصال. و`false` يعني المسح القديم.
 * (خريطةٌ ضعيفة المفاتيح: اتصالات الاختبار في الذاكرة كثيرة، ولكلٍّ جوابه.)
 */
const ready = new WeakMap<Database, boolean>();

function fts(name: IndexName): string {
  return `${name}_fts`;
}

function createSql(name: IndexName): string {
  return (
    `CREATE VIRTUAL TABLE ${fts(name)} USING fts5(${COLUMNS[name].join(', ')}, ` +
    `content='', contentless_delete=1, prefix='2 3 4', detail='none')`
  );
}

/**
 * الفهارس جاهزةً ومطابِقة — يُستدعى عند الإقلاع وقبل أوّل بحث.
 *
 * الجدول القديم (من `search.sql` بلا `contentless_delete`) لا يُحذف منه صفّ، فيُسقط
 * ويُبنى — وهو فارغٌ في كل مكتب، إذ لم يُكتب فيه قطّ. ثم يُطابَق عدد كل فهرسٍ بعدد
 * جدوله، وما نقص يُعاد بناؤه كلّه في معاملة.
 */
export function prepareSearch(db: Database): boolean {
  const known = ready.get(db);
  if (known !== undefined) return known;
  try {
    for (const name of Object.keys(COLUMNS) as IndexName[]) {
      const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(fts(name)) as
        | { sql: string }
        | undefined;
      if (!row || !/contentless_delete\s*=\s*1/i.test(row.sql)) {
        db.exec(`DROP TABLE IF EXISTS ${fts(name)}`);
        db.exec(createSql(name));
      }
    }
    syncIndexes(db);
    ready.set(db, true);
    return true;
  } catch {
    // FTS5 غائبٌ أو فهرسٌ تالف: البحث يعود إلى المسح — أبطأ لكنه صحيح.
    ready.set(db, false);
    return false;
  }
}

/** كم صفًّا في الجدول مقابل الفهرس — والمختلف يُعاد بناؤه. يعيد ما أُعيد بناؤه. */
export function syncIndexes(db: Database): IndexName[] {
  const rebuilt: IndexName[] = [];
  for (const name of Object.keys(COLUMNS) as IndexName[]) {
    const where = name === 'templates' ? ' WHERE is_active = 1' : '';
    const rows = (db.prepare(`SELECT COUNT(*) AS n FROM ${TABLE[name]}${where}`).get() as { n: number }).n;
    const indexed = (db.prepare(`SELECT COUNT(*) AS n FROM ${fts(name)}`).get() as { n: number }).n;
    if (rows !== indexed) {
      rebuildIndex(db, name);
      rebuilt.push(name);
    }
  }
  return rebuilt;
}

/** صفوف إعادة البناء في كلّ دفعة — فلا يُحمَّل الجدول كلّه بمتونه في الذاكرة معًا (البند ٢٣: خمسون ألف كتاب). */
export const REBUILD_BATCH = 500;

export function rebuildIndex(db: Database, name: IndexName): void {
  db.transaction(() => {
    db.exec(`DELETE FROM ${fts(name)}`);
    const insert = insertStmt(db, name);
    // دفعاتٌ بالمعرّف لا بـ`OFFSET`: كلّ دفعةٍ تبدأ بعد آخر صفٍّ في سابقتها، فلا يُعاد مسح ما قبلها.
    for (let after = Number.MIN_SAFE_INTEGER; ; ) {
      const rows = sourceRows(db, name, 'id > ?', [after, REBUILD_BATCH], ' ORDER BY id LIMIT ?');
      for (const r of rows) insert.run(r.id, ...r.cols.map(fold));
      if (rows.length < REBUILD_BATCH) break;
      after = rows[rows.length - 1]!.id;
    }
  })();
}

const fold = (v: string | null) => (v ? normalizeFold(v) : null);

function insertStmt(db: Database, name: IndexName) {
  const cols = COLUMNS[name];
  return db.prepare(
    `INSERT OR REPLACE INTO ${fts(name)} (rowid, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`
  );
}

/**
 * يُفهرس صفًّا بعد كتابته — أو يُخرجه إن لم يعد موجودًا (أو صار نموذجًا غير نشط).
 * يُستدعى داخل معاملة الكتابة نفسها، ولا يُسقطها إن تعذّر الفهرس: الكتاب يصدر،
 * والمطابقة عند الإقلاع التالي تُكمل ما فات.
 */
export function indexRow(db: Database, name: IndexName, id: number): void {
  if (!prepareSearch(db)) return;
  try {
    const rows = sourceRows(db, name, 'id = ?', [id]);
    if (rows.length === 0) {
      db.prepare(`DELETE FROM ${fts(name)} WHERE rowid = ?`).run(id);
      return;
    }
    insertStmt(db, name).run(id, ...rows[0]!.cols.map(fold));
  } catch {
    // يُكمَل عند الإقلاع التالي بالمطابقة.
  }
}

export function unindexRow(db: Database, name: IndexName, id: number): void {
  if (!prepareSearch(db)) return;
  try {
    db.prepare(`DELETE FROM ${fts(name)} WHERE rowid = ?`).run(id);
  } catch {
    // يُكمَل عند الإقلاع التالي بالمطابقة.
  }
}

/**
 * معرّفات ما يطابق السؤال في فهرس — أو `null` إن لم يُستطع (فيُمسح بالطريق القديم).
 * الجدول الأصلي يرتّب بما يعنيه (تاريخ الإصدار، آخر استعمال)؛ وإن زادت المطابقات على الحدّ
 * بقي **الأحدث** (البند ٢٢) — وكانت تُؤخذ بلا ترتيب فقد يسقط أحدثها.
 */
export function matchIds(db: Database, name: IndexName, raw: string, limit = 2000): number[] | null {
  const q = toFtsQuery(raw);
  if (!q) return [];
  if (!prepareSearch(db)) return null;
  try {
    return (
      db
        .prepare(`SELECT rowid AS id FROM ${fts(name)} WHERE ${fts(name)} MATCH ? ORDER BY rowid DESC LIMIT ?`)
        .all(q, limit) as { id: number }[]
    ).map((r) => r.id);
  } catch {
    return null;
  }
}

/**
 * المطابقة استعلامًا فرعيًّا بلا حدّ (البند ٢٢) — لسجلّ الصادر: يُضمّ إلى استعلامه فيرتّب ويقصر
 * هو، فلا تسقط مطابقةٌ وإن كثرت ولا مع حصر التاريخ. و`null` إن لم يُستطع (فيُمسح بالطريق القديم).
 */
export function matchSql(db: Database, name: IndexName, raw: string): { sql: string; args: string[] } | null {
  const q = toFtsQuery(raw);
  if (!q) return { sql: 'SELECT NULL WHERE 0', args: [] };
  if (!prepareSearch(db)) return null;
  const sql = `SELECT rowid FROM ${fts(name)} WHERE ${fts(name)} MATCH ?`;
  try {
    // يُجرَّب السؤال هنا: سؤالٌ لا يقبله FTS5 يُسقط الاستعلام كلّه إن ضُمّ إليه.
    db.prepare(`${sql} LIMIT 1`).all(q);
    return { sql, args: [q] };
  } catch {
    return null;
  }
}

/** أفي السؤال أرقام؟ — فيُمسح معها ما لا تجده الفهارس: وسطُ رقمٍ وطني أو هاتف. */
export const digitsOf = (raw: string): string => normalizeFold(raw).replace(/[^\d]/g, '');
