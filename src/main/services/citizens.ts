import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import type { CitizenSummary, CitizenStats } from '@shared/api';

/** منطق سجل المواطنين. البحث يمرّ على الصورة المطبَّعة لا على النص الخام. */

const SUMMARY_COLS = `c.id, c.full_name AS fullName, c.national_id AS nationalId,
  c.job_title AS jobTitle, c.workplace, c.category, c.photo_path AS photoPath,
  c.verified,
  (SELECT COUNT(*) FROM attachments a WHERE a.citizen_id = c.id) AS attachmentCount,
  (SELECT MAX(d.issued_at) FROM documents d WHERE d.citizen_id = c.id) AS lastIssuedAt`;

export function listCitizens(
  db: Database,
  opts: { query?: string; category?: string | null; limit?: number } = {}
): CitizenSummary[] {
  const limit = opts.limit ?? 200;
  const q = (opts.query ?? '').trim();

  if (q) {
    // بحث متساهل: الاسم والرقم الوطني ومكان العمل، مع تطبيع الهمزة.
    const folded = normalizeFold(q);
    const like = `%${folded}%`;
    return db
      .prepare(
        `SELECT ${SUMMARY_COLS} FROM citizens c
         WHERE (c.category = COALESCE(?, c.category) OR ? IS NULL)
           AND (
             replace(replace(replace(replace(replace(lower(c.full_name),'أ','ا'),'إ','ا'),'آ','ا'),'ة','ه'),'ى','ي') LIKE ?
             OR c.national_id LIKE ?
             OR c.employee_code LIKE ?
             OR c.phone LIKE ?
           )
         ORDER BY c.full_name LIMIT ?`
      )
      .all(opts.category ?? null, opts.category ?? null, like, like, like, like, limit) as CitizenSummary[];
  }

  return db
    .prepare(
      `SELECT ${SUMMARY_COLS} FROM citizens c
       WHERE (? IS NULL OR c.category = ?)
       ORDER BY c.updated_at DESC LIMIT ?`
    )
    .all(opts.category ?? null, opts.category ?? null, limit) as CitizenSummary[];
}

/** التصنيفات تُشتقّ مما أدخله المكتب — لا قائمة مبرمَجة. */
export function listCitizenCategories(db: Database): { name: string; count: number }[] {
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
  const attachments = one('SELECT COUNT(*) AS n FROM attachments');
  const scanned = db
    .prepare('SELECT AVG(ocr_accuracy) AS a FROM attachments WHERE ocr_accuracy IS NOT NULL')
    .get() as { a: number | null };
  return {
    activeFiles: one('SELECT COUNT(*) AS n FROM citizens'),
    verifiedFiles: one('SELECT COUNT(*) AS n FROM citizens WHERE verified = 1'),
    attachments,
    ocrAccuracy: scanned.a,
    issuedThisMonth: one(
      `SELECT COUNT(*) AS n FROM documents
       WHERE strftime('%Y-%m', issued_at) = strftime('%Y-%m','now','localtime')`
    )
  };
}

export function getCitizen(db: Database, id: number): Record<string, unknown> | null {
  const row = db.prepare('SELECT * FROM citizens WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const attachments = db
    .prepare(
      `SELECT id, doc_type AS docType, file_path AS filePath, file_format AS fileFormat,
              dpi, ocr_accuracy AS ocrAccuracy, scanned_at AS scannedAt
       FROM attachments WHERE citizen_id = ? ORDER BY id`
    )
    .all(id);
  return { ...row, attachments };
}
