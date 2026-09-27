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

/** الصفوف كما تُفهرس — مطبَّعةً — من جدولها. `id` المعطى يقصرها على صفّ. */
const SOURCE: Record<IndexName, (db: Database, id?: number) => { id: number; cols: (string | null)[] }[]> = {
  documents: (db, id) =>
    (
      db
        .prepare(
          `SELECT id, serial, doc_type AS docType, destination, purpose,
                  TRIM(COALESCE(citizen_name, '') || ' ' || COALESCE(citizen_nid, '')) AS name, body_html AS body
           FROM documents ${id === undefined ? '' : 'WHERE id = ?'}`
        )
        .all(...(id === undefined ? [] : [id])) as {
        id: number;
        serial: string;
        docType: string | null;
        destination: string | null;
        purpose: string | null;
        name: string;
        body: string;
      }[]
    ).map((r) => ({ id: r.id, cols: [r.serial, r.docType, r.destination, r.purpose, r.name, htmlToText(r.body)] })),
  citizens: (db, id) =>
    (
      db
        .prepare(
          `SELECT id, full_name, national_id, job_title, workplace, employee_code, phone FROM citizens
           ${id === undefined ? '' : 'WHERE id = ?'}`
        )
        .all(...(id === undefined ? [] : [id])) as Record<string, string | null>[]
    ).map((r) => ({
      id: Number(r.id),
      cols: [r.full_name, r.national_id, r.job_title, r.workplace, r.employee_code, r.phone].map((v) => v ?? null)
    })),
  templates: (db, id) =>
    (
      db
        .prepare(
          `SELECT id, code, title, subtitle, category, body_html FROM templates
           WHERE is_active = 1 ${id === undefined ? '' : 'AND id = ?'}`
        )
        .all(...(id === undefined ? [] : [id])) as Record<string, string | null>[]
    ).map((r) => ({
      id: Number(r.id),
      cols: [r.code, r.title, r.subtitle, r.category, htmlToText(r.body_html ?? '')]
    })),
  attachments: (db, id) =>
    (
      db
        .prepare(`SELECT id, doc_type, ocr_text FROM attachments ${id === undefined ? '' : 'WHERE id = ?'}`)
        .all(...(id === undefined ? [] : [id])) as { id: number; doc_type: string; ocr_text: string | null }[]
    ).map((r) => ({ id: r.id, cols: [r.doc_type, r.ocr_text] }))
};

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

export function rebuildIndex(db: Database, name: IndexName): void {
  db.transaction(() => {
    db.exec(`DELETE FROM ${fts(name)}`);
    const insert = insertStmt(db, name);
    for (const r of SOURCE[name](db)) insert.run(r.id, ...r.cols.map(fold));
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
    const rows = SOURCE[name](db, id);
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
 * بلا ترتيب: الجدول الأصلي يرتّب بما يعنيه (تاريخ الإصدار، آخر استعمال).
 */
export function matchIds(db: Database, name: IndexName, raw: string, limit = 2000): number[] | null {
  const q = toFtsQuery(raw);
  if (!q) return [];
  if (!prepareSearch(db)) return null;
  try {
    return (
      db.prepare(`SELECT rowid AS id FROM ${fts(name)} WHERE ${fts(name)} MATCH ? LIMIT ?`).all(q, limit) as {
        id: number;
      }[]
    ).map((r) => r.id);
  } catch {
    return null;
  }
}

/** أفي السؤال أرقام؟ — فيُمسح معها ما لا تجده الفهارس: وسطُ رقمٍ وطني أو هاتف. */
export const digitsOf = (raw: string): string => normalizeFold(raw).replace(/[^\d]/g, '');
