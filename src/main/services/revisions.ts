/**
 * الهويّة الثابتة والنسخ — للنماذج والترويسات والكليشات (FOUNDATION §٣).
 *
 * **المعرّف** (`uuid`) لا يتغيّر مهما تغيّر الاسم أو رقم الصفّ: به تُعرف القطعة
 * نفسها إن نُقلت مكتبةٌ من جهازٍ إلى جهاز. و**رقم النسخة** (`revision`) يزيد مع
 * كل حفظٍ غيّر شيئًا — وقبل أن يُكتب الجديد تُحفظ الحالة السابقة في `revisions`،
 * فيعود المكتب إلى «نسخة أمس» ولا يضيع شيء: الاسترجاع نفسه حفظٌ جديد.
 *
 * وأُضيفا الآن لأن §٣ نفسه يقول: إضافتهما بعد انتشار البرنامج ترحيلُ بيانات كل مكتب.
 */
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Revision, RevisionKind } from '@shared/api';

const TABLE: Record<RevisionKind, string> = {
  template: 'templates',
  letterhead: 'letterheads',
  clip: 'clips'
};

/** سجلّ النسخ، وعمودا الهويّة في جدول القطعة — ومن لا معرّف له يُعطى واحدًا. */
export function prepareIdentity(db: Database, kind: RevisionKind): void {
  const table = TABLE[kind];
  db.exec(`CREATE TABLE IF NOT EXISTS revisions (
    id         INTEGER PRIMARY KEY,
    kind       TEXT NOT NULL,
    item_uuid  TEXT NOT NULL,
    revision   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, item_uuid, revision)
  )`);
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('uuid')) db.exec(`ALTER TABLE ${table} ADD COLUMN uuid TEXT`);
  if (!cols.includes('revision')) db.exec(`ALTER TABLE ${table} ADD COLUMN revision INTEGER NOT NULL DEFAULT 1`);
  // الفهرس بعد ضمان العمود لا قبله، وإلا سقط الإقلاع على قاعدة مكتبٍ قائمة.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_${table}_uuid ON ${table}(uuid)`);
  stampMissing(db, kind);
}

/** ما أُدرج بلا معرّف (قاعدة قديمة، أو نسخةٌ مكرَّرة) يُعطى معرّفه. */
export function stampMissing(db: Database, kind: RevisionKind): void {
  const table = TABLE[kind];
  const rows = db.prepare(`SELECT id FROM ${table} WHERE uuid IS NULL`).all() as { id: number }[];
  const set = db.prepare(`UPDATE ${table} SET uuid = ? WHERE id = ?`);
  for (const r of rows) set.run(randomUUID(), r.id);
}

type Identity = { uuid: string; revision: number };

function identityOf(db: Database, kind: RevisionKind, id: number): Identity | null {
  return (
    (db.prepare(`SELECT uuid, revision FROM ${TABLE[kind]} WHERE id = ?`).get(id) as Identity | undefined) ?? null
  );
}

/**
 * قبل كتابة الجديد: تُحفظ الحالة الجارية نسخةً، ويزيد رقم النسخة — إن تغيّر شيء.
 *
 * `before` هي الحالة المحفوظة الآن و`after` ما سيُكتب؛ فحفظٌ لم يغيّر شيئًا لا
 * يُنشئ نسخةً فارغة المعنى. و`comparable` يردّ القطعة إلى ما يُقارَن منها (بلا
 * المعرّفات الداخلية التي تتولّد عند كل قراءة). ويُستدعى داخل معاملة الحفظ نفسها.
 */
export function recordRevision<T>(
  db: Database,
  kind: RevisionKind,
  id: number,
  before: T,
  after: T,
  comparable: (x: T) => unknown = (x) => x
): void {
  const prev = JSON.stringify(before);
  if (JSON.stringify(comparable(before)) === JSON.stringify(comparable(after))) return;
  const who = identityOf(db, kind, id);
  if (!who) return;
  db.prepare('INSERT OR IGNORE INTO revisions (kind, item_uuid, revision, payload) VALUES (?, ?, ?, ?)').run(
    kind,
    who.uuid,
    who.revision,
    prev
  );
  db.prepare(`UPDATE ${TABLE[kind]} SET revision = revision + 1 WHERE id = ?`).run(id);
}

/** النسخ السابقة لقطعة، الأحدث أولًا — بلا حمولتها. */
export function listRevisions(db: Database, kind: RevisionKind, id: number): Revision[] {
  prepareIdentity(db, kind);
  const who = identityOf(db, kind, id);
  if (!who) return [];
  return db
    .prepare(
      `SELECT revision, created_at AS createdAt FROM revisions
       WHERE kind = ? AND item_uuid = ? ORDER BY revision DESC`
    )
    .all(kind, who.uuid) as Revision[];
}

/** حمولة نسخةٍ سابقة كما حُفظت — أو عدم. */
export function revisionPayload<T>(db: Database, kind: RevisionKind, id: number, revision: number): T | null {
  prepareIdentity(db, kind);
  const who = identityOf(db, kind, id);
  if (!who) return null;
  const row = db
    .prepare('SELECT payload FROM revisions WHERE kind = ? AND item_uuid = ? AND revision = ?')
    .get(kind, who.uuid, revision) as { payload: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

/** حذف القطعة يحذف نسخها — فالمحذوف لا يبقى منه أثرٌ مخفيّ. يُستدعى قبل حذف الصفّ. */
export function forgetRevisions(db: Database, kind: RevisionKind, id: number): void {
  const who = identityOf(db, kind, id);
  if (who) db.prepare('DELETE FROM revisions WHERE kind = ? AND item_uuid = ?').run(kind, who.uuid);
}

/**
 * الوثيقة بلا معرّفاتها الداخلية: كتلةٌ وحقلٌ يُعطيان معرّفًا جديدًا كلما رُحِّل
 * متنٌ قديم إلى وثيقة — والمتن واحد. فتُقارن الوثيقتان بما يُرى لا بما يُولَّد.
 */
export function withoutIds(json: string | null): unknown {
  if (!json) return null;
  const strip = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(strip)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, strip(x)]))
        : v;
  try {
    return strip(JSON.parse(json));
  } catch {
    return json;
  }
}

/** معرّفٌ جديد لصفٍّ أُدرج للتوّ. */
export function stampNew(db: Database, kind: RevisionKind, id: number): void {
  db.prepare(`UPDATE ${TABLE[kind]} SET uuid = COALESCE(uuid, ?) WHERE id = ?`).run(randomUUID(), id);
}
