/**
 * قوائم الأرشيف والبحث فيه ومؤشّراته — نُقل من `documents.ts` (D81).
 */
import type { Database } from 'better-sqlite3';
import type { DocumentRow, ArchiveStats, PeriodStats } from '@shared/api';
import { LIST_LIMITS } from '@shared/limits';
import { normalizeFold } from '@shared/arabic';
import { matchSql, digitsOf } from './searchIndex';

const ROW_COLUMNS = `d.id, d.serial,
  COALESCE(c.full_name, d.citizen_name, '') AS citizenName,
  COALESCE(c.national_id, d.citizen_nid) AS nationalId,
  d.doc_type AS docType,
  d.destination,
  strftime('%H:%M', d.issued_at, 'localtime') AS issuedTime,
  date(d.issued_at, 'localtime') AS issuedDate,
  d.copies, d.status, d.void_reason AS voidReason`;

/** أوراق معاملة واحدة — لإعادة طباعتها معًا أو مراجعتها. */
export function transactionSheets(db: Database, transactionId: number): DocumentRow[] {
  return db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM documents d
       LEFT JOIN citizens c ON c.id = d.citizen_id
       WHERE d.transaction_id = ? ORDER BY d.id`
    )
    .all(transactionId) as DocumentRow[];
}

export type ListOptions = {
  /** حدّا المدة بصيغة YYYY-MM-DD، شاملان. */
  from?: string | null;
  to?: string | null;
  query?: string;
  limit?: number;
};

export function listDocuments(db: Database, opts: ListOptions = {}): DocumentRow[] {
  const limit = opts.limit ?? LIST_LIMITS.documents;
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const q = (opts.query ?? '').trim();

  const where = [
    "(? IS NULL OR date(d.issued_at,'localtime') >= ?)",
    "(? IS NULL OR date(d.issued_at,'localtime') <= ?)"
  ];
  const args: unknown[] = [from, from, to, to];

  // رقم الصادر («م/2026/14») يُسأل عنه عمودُه ببدايته: كلماته في الفهرس «م» و«2026»
  // و«14»، و«2» بادئةً تطابق «2026» في كل كتاب. والمطابق تمامًا أوّلًا.
  const serialQuery = q.includes('/') ? normalizeFold(q).replace(/\s+/g, '') : null;
  if (serialQuery) {
    where.push('d.serial LIKE ?');
    args.push(`${serialQuery}%`);
  } else if (q) {
    // الفهرس أولًا (بدايات الكلمات في المتن والاسم والجهة)، ورقم الصادر ووسطُ الرقم
    // الوطني مسحًا في أعمدتهما القصيرة. وإن تعذّر الفهرس فالمسح القديم كلّه.
    // والمطابقة استعلامٌ فرعيّ بلا حدّ (البند ٢٢): يرتّب هذا الاستعلام ويقصر، فلا يسقط الأحدث ولا ما في التاريخ المحصور.
    const match = matchSql(db, 'documents', q);
    if (match === null) {
      where.push('(d.search_fold LIKE ? OR d.serial LIKE ?)');
      args.push(`%${normalizeFold(q)}%`, `%${q}%`);
    } else {
      const digits = digitsOf(q);
      where.push(`(d.id IN (${match.sql}) OR d.serial LIKE ? OR (? IS NOT NULL AND d.citizen_nid LIKE ?))`);
      const nid = digits.length >= 3 ? `%${digits}%` : null;
      args.push(...match.args, `%${q}%`, nid, nid);
    }
  }

  args.push(serialQuery, limit);
  return db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM documents d LEFT JOIN citizens c ON c.id = d.citizen_id
       WHERE ${where.join(' AND ')}
       ORDER BY (d.serial = ?) DESC, d.issued_at DESC, d.id DESC LIMIT ?`
    )
    .all(...args) as DocumentRow[];
}

export function archiveStats(db: Database): ArchiveStats {
  const count = (expr: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE ${expr}`).get() as { n: number }).n;

  const issuedToday = count("date(issued_at,'localtime') = date('now','localtime')");
  const issuedYesterday = count("date(issued_at,'localtime') = date('now','localtime','-1 day')");
  const top = db
    .prepare(
      `SELECT t.title AS title, COUNT(*) AS n
       FROM documents d JOIN templates t ON t.id = d.template_id
       WHERE date(d.issued_at,'localtime') = date('now','localtime')
       GROUP BY d.template_id ORDER BY n DESC LIMIT 1`
    )
    .get() as { title: string; n: number } | undefined;

  return {
    issuedToday,
    issuedYesterday,
    topTemplate: top
      ? { title: top.title, count: top.n, share: issuedToday ? top.n / issuedToday : 0 }
      : null
  };
}

/** مؤشرات مدة: الكتب والمخدومون والنسخ المطبوعة فعلًا — والمال صامت (قرار المالك). */
export function periodStats(db: Database, opts: ListOptions = {}): PeriodStats {
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const range = [from, from, to, to];
  const window =
    "(? IS NULL OR date(d.issued_at,'localtime') >= ?) AND (? IS NULL OR date(d.issued_at,'localtime') <= ?)";

  const head = db
    .prepare(
      `SELECT COUNT(*) AS issued,
              COUNT(DISTINCT COALESCE(CAST(d.citizen_id AS TEXT), d.citizen_name)) AS citizens
       FROM documents d WHERE ${window}`
    )
    .get(...range) as { issued: number; citizens: number };

  const printed = db
    .prepare(
      `SELECT COALESCE(SUM(p.copies),0) AS copies
       FROM document_prints p JOIN documents d ON d.id = p.document_id
       WHERE ${window}`
    )
    .get(...range) as { copies: number };

  const byType = db
    .prepare(
      `SELECT COALESCE(NULLIF(d.doc_type,''), 'بلا تصنيف') AS name, COUNT(*) AS count
       FROM documents d WHERE ${window}
       GROUP BY name ORDER BY count DESC, name LIMIT 12`
    )
    .all(...range) as { name: string; count: number }[];

  const byDay = db
    .prepare(
      `SELECT date(d.issued_at,'localtime') AS day, COUNT(*) AS count
       FROM documents d WHERE ${window}
       GROUP BY day ORDER BY day DESC LIMIT 31`
    )
    .all(...range) as { day: string; count: number }[];

  return {
    issued: head.issued,
    citizens: head.citizens,
    printedCopies: printed.copies,
    byType,
    byDay
  };
}

/** كم كتابًا صدر عن نموذج أو لمواطن — يُعرض قبل الحذف. */
export function documentCount(db: Database, where: 'template' | 'citizen', id: number): number {
  const column = where === 'template' ? 'template_id' : 'citizen_id';
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE ${column} = ?`).get(id) as { n: number }
  ).n;
}
