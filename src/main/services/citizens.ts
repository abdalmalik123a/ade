import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import { ADDED_COLUMNS, CITIZEN_FIELDS } from '@shared/citizenSchema';
import { canonicalNationalId } from '@shared/idChecks';
import { digitsOf, indexRow, matchIds, unindexRow } from './searchIndex';
import type {
  Attachment,
  CitizenDetail,
  CitizenInput,
  CitizenStats,
  CitizenSummary,
  CitizenDocumentRow
} from '@shared/api';

/**
 * منطق سجل المواطنين.
 *
 * البحث يجري على صورة مطبَّعة تُخزَّن مع كل سجلّ (`name_fold`)، لا على النصّ
 * الخام ولا بتطبيع وقت الاستعلام — فيجد الموظفُ «أحمد» بكتابة «احمد» بسرعة.
 */

const SUMMARY = `c.id, c.full_name AS fullName, c.national_id AS nationalId,
  c.job_title AS jobTitle, c.workplace, c.category, c.photo_path AS photoPath,
  c.verified,
  (SELECT COUNT(*) FROM attachments a WHERE a.citizen_id = c.id) AS attachmentCount,
  (SELECT MAX(d.issued_at) FROM documents d WHERE d.citizen_id = c.id) AS lastIssuedAt`;

/** خانات الاستمارات الحكومية (أيلول ٢٠٢٦) تُضاف إلى قاعدة المكتب القائمة — فارغةً. */
export function ensureCitizenColumns(db: Database): void {
  const cols = (db.prepare('PRAGMA table_info(citizens)').all() as { name: string }[]).map((c) => c.name);
  for (const name of ADDED_COLUMNS) {
    if (!cols.includes(name)) db.exec(`ALTER TABLE citizens ADD COLUMN ${name} TEXT`);
  }
}

/** عمود التطبيع يُضاف عند الحاجة — الترحيل هنا ليعمل على قواعد قائمة. */
export function ensureSearchColumn(db: Database): void {
  ensureCitizenColumns(db);
  const cols = db.prepare('PRAGMA table_info(citizens)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'name_fold')) {
    db.exec('ALTER TABLE citizens ADD COLUMN name_fold TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS ix_citizens_fold ON citizens(name_fold)');
    const rows = db.prepare('SELECT id, full_name FROM citizens').all() as {
      id: number;
      full_name: string;
    }[];
    const update = db.prepare('UPDATE citizens SET name_fold = ? WHERE id = ?');
    db.transaction(() => {
      for (const r of rows) update.run(normalizeFold(r.full_name), r.id);
    })();
  }
  canonicalizeNationalIds(db);
}

/**
 * الأرقام الوطنية المحفوظة قبل التوحيد تُوحَّد مرّةً (أرقامٌ لاتينية بلا شوائب) — وما فيه
 * غير الأرقام وحدها يُمرّ عليه، فالإقلاع لا يمسح السجلّ كلّه كلّ مرّة.
 *
 * وما صار بعد توحيده رقمَ مواطنٍ آخر يُترك كما هو: مكرّرٌ كان مخفيًّا، يدمجه المكتب
 * بيده — لا يُدمج صامتًا، ولا يُقفل تعديله بخطأ «مسجَّل لمواطن آخر».
 */
export function canonicalizeNationalIds(db: Database): { changed: number; clashes: number } {
  const rows = db
    .prepare("SELECT id, national_id AS nid FROM citizens WHERE national_id IS NOT NULL AND national_id GLOB '*[^0-9]*'")
    .all() as { id: number; nid: string }[];
  let changed = 0;
  let clashes = 0;
  const update = db.prepare('UPDATE citizens SET national_id = ? WHERE id = ?');
  db.transaction(() => {
    for (const r of rows) {
      const canon = canonicalNationalId(r.nid);
      if (!canon || canon === r.nid) continue;
      if (isNationalIdTaken(db, canon, r.id)) {
        clashes++;
        continue;
      }
      update.run(canon, r.id);
      changed++;
    }
  })();
  return { changed, clashes };
}

export function listCitizens(
  db: Database,
  opts: { query?: string; category?: string | null; limit?: number } = {}
): CitizenSummary[] {
  const limit = opts.limit ?? 300;
  const category = opts.category ?? null;
  const q = (opts.query ?? '').trim();

  if (!q) {
    return db
      .prepare(
        `SELECT ${SUMMARY} FROM citizens c
         WHERE (? IS NULL OR c.category = ?)
         ORDER BY c.updated_at DESC LIMIT ?`
      )
      .all(category, category, limit) as CitizenSummary[];
  }

  // الفهرس أولًا: بدايات الكلمات في الاسم والوظيفة والرقم. ووسطُ رقمٍ (آخر أربعةٍ
  // من الوطني أو الهاتف) يُمسح في أعمدته القصيرة.
  const ids = matchIds(db, 'citizens', q);
  if (ids !== null) {
    const digits = digitsOf(q);
    const numeric = digits.length >= 3 ? `%${digits}%` : null;
    return db
      .prepare(
        `SELECT ${SUMMARY} FROM citizens c
         WHERE (? IS NULL OR c.category = ?)
           AND (c.id IN (SELECT value FROM json_each(?))
                OR (? IS NOT NULL AND (c.national_id LIKE ? OR c.phone LIKE ? OR c.housing_card_no LIKE ?
                                       OR c.employee_code LIKE ?)))
         ORDER BY c.full_name LIMIT ?`
      )
      .all(category, category, JSON.stringify(ids), numeric, numeric, numeric, numeric, numeric, limit) as CitizenSummary[];
  }

  const like = `%${normalizeFold(q)}%`;
  const raw = `%${q}%`;
  return db
    .prepare(
      `SELECT ${SUMMARY} FROM citizens c
       WHERE (? IS NULL OR c.category = ?)
         AND (c.name_fold LIKE ?
              OR c.national_id LIKE ?
              OR c.employee_code LIKE ?
              OR c.phone LIKE ?
              OR c.housing_card_no LIKE ?)
       ORDER BY c.full_name LIMIT ?`
    )
    .all(category, category, like, raw, raw, raw, raw, limit) as CitizenSummary[];
}

/** التصنيفات تُشتقّ مما أدخله المكتب — لا قائمة مبرمَجة. */
export function listCategories(db: Database): { name: string; count: number }[] {
  return db
    .prepare(
      `SELECT category AS name, COUNT(*) AS count FROM citizens
       WHERE category IS NOT NULL AND category <> ''
       GROUP BY category ORDER BY count DESC, category`
    )
    .all() as { name: string; count: number }[];
}

export function citizenStats(db: Database): CitizenStats {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const acc = db
    .prepare('SELECT AVG(ocr_accuracy) AS a FROM attachments WHERE ocr_accuracy IS NOT NULL')
    .get() as { a: number | null };
  return {
    activeFiles: one('SELECT COUNT(*) AS n FROM citizens'),
    verifiedFiles: one('SELECT COUNT(*) AS n FROM citizens WHERE verified = 1'),
    attachments: one('SELECT COUNT(*) AS n FROM attachments'),
    ocrAccuracy: acc.a,
    issuedThisMonth: one(
      `SELECT COUNT(*) AS n FROM documents
       WHERE strftime('%Y-%m', issued_at, 'localtime') = strftime('%Y-%m','now','localtime')`
    )
  };
}

const FIELDS = [...CITIZEN_FIELDS.map((f) => f.column), 'photo_path', 'category', 'notes'];

/**
 * ملفّات عدّة مواطنين بخاناتها كلّها — بلا مستمسكاتهم (د١٥): هويّات الموظفين من السجل،
 * وقائمة الدمج منه. بترتيب المعرّفات المعطاة، وما لم يُوجد يُسقط.
 */
export function getCitizenRecords(db: Database, ids: number[]): Omit<CitizenDetail, 'attachments'>[] {
  const out: Omit<CitizenDetail, 'attachments'>[] = [];
  for (const id of ids) {
    const c = getCitizen(db, Number(id));
    if (!c) continue;
    const { attachments: _drop, ...rest } = c;
    void _drop;
    out.push(rest);
  }
  return out;
}

export function getCitizen(db: Database, id: number): CitizenDetail | null {
  const row = db.prepare('SELECT * FROM citizens WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const text = Object.fromEntries(CITIZEN_FIELDS.map((f) => [f.key, (row[f.column] as string | null | undefined) ?? null])) as Record<
    (typeof CITIZEN_FIELDS)[number]['key'],
    string | null
  >;
  return {
    ...text,
    id: row.id as number,
    fullName: (row.full_name as string) ?? '',
    photoPath: (row.photo_path as string) ?? null,
    category: (row.category as string) ?? null,
    notes: (row.notes as string) ?? null,
    verified: (row.verified as number) === 1,
    attachments: listAttachments(db, id),
    documents: listCitizenDocuments(db, id)
  };
}

/** الرقم الوطني فريد — تكراره يعني ملفّين لشخص واحد، وهو خطأ يفسد الأرشيف. */
export function isNationalIdTaken(
  db: Database,
  nationalId: string,
  exceptId: number | null
): boolean {
  const row = db
    .prepare(
      'SELECT id FROM citizens WHERE national_id = ? AND (? IS NULL OR id <> ?) LIMIT 1'
    )
    .get(nationalId, exceptId, exceptId) as { id: number } | undefined;
  return Boolean(row);
}

export function saveCitizen(db: Database, input: CitizenInput): CitizenDetail {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('اسم المواطن مطلوب');

  // أرقامٌ لاتينية بلا شوائب — وما فيه حرفٌ يُحفظ كما كُتب (وتنبيهه في الخانة).
  const nationalId = canonicalNationalId(input.nationalId) ?? (input.nationalId?.trim() || null);
  if (nationalId && isNationalIdTaken(db, nationalId, input.id)) {
    throw new Error(`الرقم الوطني «${nationalId}» مسجَّل لمواطن آخر`);
  }

  // الخانة الغائبة عن الطلب تبقى كما هي، والفارغة تُمحى: فما يحفظ الملف بخاناته القديمة
  // وحدها (من قبل أيلول ٢٠٢٦) لا يمحو ما لا يعرفه.
  const current =
    input.id === null ? undefined : (db.prepare('SELECT * FROM citizens WHERE id = ?').get(input.id) as Record<string, unknown> | undefined);
  const text = (f: (typeof CITIZEN_FIELDS)[number]) => {
    const v = input[f.key] as string | null | undefined;
    return v === undefined && current ? (current[f.column] ?? null) : v?.trim() || null;
  };
  const values: Record<string, unknown> = {
    ...Object.fromEntries(CITIZEN_FIELDS.map((f) => [f.column, text(f)])),
    full_name: fullName,
    national_id: nationalId,
    photo_path: input.photoPath ?? null,
    category: input.category?.trim() || null,
    notes: input.notes?.trim() || null
  };

  const id = db.transaction(() => {
    if (input.id === null) {
      const cols = [...FIELDS, 'verified', 'name_fold'];
      const info = db
        .prepare(
          `INSERT INTO citizens (${cols.join(', ')})
           VALUES (${cols.map(() => '?').join(', ')})`
        )
        .run(
          ...FIELDS.map((f) => values[f] ?? null),
          input.verified ? 1 : 0,
          normalizeFold(fullName)
        );
      return Number(info.lastInsertRowid);
    }
    db.prepare(
      `UPDATE citizens SET ${FIELDS.map((f) => `${f} = ?`).join(', ')},
                           verified = ?, name_fold = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      ...FIELDS.map((f) => values[f] ?? null),
      input.verified ? 1 : 0,
      normalizeFold(fullName),
      input.id
    );
    return input.id;
  })();

  indexRow(db, 'citizens', id);
  return getCitizen(db, id)!;
}

export function deleteCitizen(db: Database, id: number): string[] {
  // مسارات المستمسكات تُعاد ليحذفها المستدعي من القرص.
  const paths = (
    db.prepare('SELECT file_path AS p FROM attachments WHERE citizen_id = ?').all(id) as {
      p: string;
    }[]
  ).map((r) => r.p);
  const photo = db.prepare('SELECT photo_path AS p FROM citizens WHERE id = ?').get(id) as
    | { p: string | null }
    | undefined;
  if (photo?.p) paths.push(photo.p);
  // المستمسكات تُحذف معه (ON DELETE CASCADE) — وفهارسها معها.
  const attachments = (db.prepare('SELECT id FROM attachments WHERE citizen_id = ?').all(id) as { id: number }[]).map(
    (r) => r.id
  );
  db.prepare('DELETE FROM citizens WHERE id = ?').run(id);
  unindexRow(db, 'citizens', id);
  for (const a of attachments) unindexRow(db, 'attachments', a);
  return paths;
}

/** كم كتابًا صدر باسم هذا المواطن — يُسأل قبل الحذف. */
export function citizenUsage(db: Database, id: number): number {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM documents WHERE citizen_id = ?').get(id) as { n: number }
  ).n;
}

// ── المستمسكات ───────────────────────────────────────────────────────
export function listAttachments(db: Database, citizenId: number): Attachment[] {
  return db
    .prepare(
      `SELECT id, citizen_id AS citizenId, doc_type AS docType, file_path AS filePath,
              file_format AS fileFormat, dpi, ocr_text AS ocrText,
              ocr_accuracy AS ocrAccuracy, scanned_at AS scannedAt, sha256
       FROM attachments WHERE citizen_id = ? ORDER BY id`
    )
    .all(citizenId) as Attachment[];
}

export function addAttachment(
  db: Database,
  input: {
    citizenId: number;
    docType: string;
    filePath: string;
    fileFormat: string | null;
    dpi: number | null;
    sha256: string | null;
  }
): Attachment {
  const info = db
    .prepare(
      `INSERT INTO attachments (citizen_id, doc_type, file_path, file_format, dpi, sha256, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      input.citizenId,
      input.docType,
      input.filePath,
      input.fileFormat,
      input.dpi,
      input.sha256
    );
  indexRow(db, 'attachments', Number(info.lastInsertRowid));
  return db
    .prepare(
      `SELECT id, citizen_id AS citizenId, doc_type AS docType, file_path AS filePath,
              file_format AS fileFormat, dpi, ocr_text AS ocrText,
              ocr_accuracy AS ocrAccuracy, scanned_at AS scannedAt, sha256
       FROM attachments WHERE id = ?`
    )
    .get(Number(info.lastInsertRowid)) as Attachment;
}

export function renameAttachment(db: Database, id: number, docType: string): void {
  db.prepare('UPDATE attachments SET doc_type = ? WHERE id = ?').run(docType, id);
  indexRow(db, 'attachments', id);
}

export function setAttachmentOcr(
  db: Database,
  id: number,
  text: string,
  accuracy: number
): void {
  db.prepare('UPDATE attachments SET ocr_text = ?, ocr_accuracy = ? WHERE id = ?').run(
    text,
    accuracy,
    id
  );
  indexRow(db, 'attachments', id);
}

export function deleteAttachment(db: Database, id: number): string | null {
  const row = db.prepare('SELECT file_path AS p FROM attachments WHERE id = ?').get(id) as
    | { p: string }
    | undefined;
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  unindexRow(db, 'attachments', id);
  return row?.p ?? null;
}

// ── كتب المواطن الصادرة ──────────────────────────────────────────────
export function listCitizenDocuments(db: Database, citizenId: number): CitizenDocumentRow[] {
  return db
    .prepare(
      `SELECT d.id, d.serial, d.doc_type AS docType, d.destination, d.purpose,
              d.template_id AS templateId, d.copies, d.fee,
              date(d.issued_at, 'localtime') AS issuedDate, d.status
       FROM documents d WHERE d.citizen_id = ? ORDER BY d.issued_at DESC`
    )
    .all(citizenId) as CitizenDocumentRow[];
}
