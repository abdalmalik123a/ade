import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { normalizeFold } from '@shared/arabic';
import { qrSvg } from '@shared/qr';
import { FINGERPRINT_SLOT, QR_SLOT, SERIAL_SLOT } from '@shared/api';
import type {
  ArchiveStats,
  DocumentDetail,
  DocumentRow,
  IssueInput,
  PeriodStats
} from '@shared/api';

/**
 * سجل الصادر: الإصدار والبصمة وإعادة الطباعة والتقارير.
 *
 * التسلسل مستقلّ لكل سنة، و«الاطّلاع» لا يستهلك رقمًا — الاستهلاك عند الإصدار
 * وحده، وإلا احترقت أرقام كلما فتح الموظف شاشة المحرر. ولذلك يجري الإصدار كلّه
 * في نداء واحد: الرقم يُحجز، والبصمة تُحسب، والرمز يُرسم، ثم تُحقن الثلاثة في
 * علامات الورقة نفسها قبل حفظها — فلا نافذة زمنية يُحرق فيها رقم بلا كتاب.
 */

export function peekSerial(db: Database, prefix: string, year: number): string {
  const row = db
    .prepare("SELECT last_value AS v FROM counters WHERE scope = 'outgoing' AND year = ?")
    .get(year) as { v: number } | undefined;
  return `${prefix}/${year}/${(row?.v ?? 0) + 1}`;
}

export function reserveSerial(
  db: Database,
  prefix: string,
  year: number
): { serial: string; seq: number } {
  db.prepare(
    `INSERT INTO counters (scope, year, last_value) VALUES ('outgoing', ?, 0)
     ON CONFLICT(scope, year) DO NOTHING`
  ).run(year);
  db.prepare(
    "UPDATE counters SET last_value = last_value + 1 WHERE scope = 'outgoing' AND year = ?"
  ).run(year);
  const seq = (
    db
      .prepare("SELECT last_value AS v FROM counters WHERE scope = 'outgoing' AND year = ?")
      .get(year) as { v: number }
  ).v;
  return { serial: `${prefix}/${year}/${seq}`, seq };
}

/** البصمة تغطي المتن والرقم والتاريخ وصاحب العلاقة — أي تحريف لاحق يكسرها. */
export function fingerprint(input: {
  serial: string;
  bodyHtml: string;
  gregorianDate: string;
  citizenName: string;
  destination: string;
}): string {
  const NUL = String.fromCharCode(0);
  return createHash('sha256')
    .update(
      [input.serial, input.gregorianDate, input.citizenName, input.destination, input.bodyHtml].join(
        NUL
      ),
      'utf8'
    )
    .digest('hex');
}

export function shortFingerprint(hex: string): string {
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

/** نصّ الورقة بلا علامات — للبحث ولحساب حجم الوثيقة. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** عمود التطبيع يُضاف عند الحاجة — الترحيل هنا ليعمل على قواعد قائمة. */
export function ensureSearchColumn(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'search_fold')) {
    db.exec('ALTER TABLE documents ADD COLUMN search_fold TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS ix_docs_fold ON documents(search_fold)');
  }
}

/** الصورة المطبَّعة التي يجري عليها البحث — تُخزَّن مع السجل لا وقت الاستعلام. */
function searchFold(parts: (string | null | undefined)[]): string {
  return normalizeFold(parts.filter(Boolean).join(' '));
}

const ROW_COLUMNS = `d.id, d.serial,
  COALESCE(c.full_name, d.citizen_name, '') AS citizenName,
  COALESCE(c.national_id, d.citizen_nid) AS nationalId,
  d.doc_type AS docType,
  d.destination,
  strftime('%H:%M', d.issued_at, 'localtime') AS issuedTime,
  date(d.issued_at, 'localtime') AS issuedDate,
  d.copies, d.fee`;

/** أعمدة اسم المواطن ورقمه تُحفظ نصًّا أيضًا: الكتاب قد يصدر لمن لا ملفّ له. */
export function ensureCitizenSnapshot(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'citizen_name')) {
    db.exec('ALTER TABLE documents ADD COLUMN citizen_name TEXT');
    db.exec('ALTER TABLE documents ADD COLUMN citizen_nid TEXT');
  }
}

export function prepareDocuments(db: Database): void {
  ensureSearchColumn(db);
  ensureCitizenSnapshot(db);
}

export type IssueResult = {
  id: number;
  serial: string;
  sha256: string;
  sheetHtml: string;
};

/**
 * يصدر الكتاب: رقم صادر محجوز، وبصمة، ورمز تحقق، وقيد في السجل — كلها في
 * معاملة واحدة. يعيد علامات الورقة النهائية ليطبعها النداء أو يحفظها PDF.
 */
export function issueDocument(db: Database, input: IssueInput): IssueResult {
  const name = input.citizenName.trim();
  if (!name) throw new Error('لا يصدر كتاب بلا اسم صاحب العلاقة');
  if (!htmlToText(input.sheetHtml).trim()) throw new Error('لا يصدر كتاب بورقة فارغة');

  prepareDocuments(db);

  return db.transaction((): IssueResult => {
    const { serial, seq } = reserveSerial(db, input.serialPrefix, input.serialYear);

    // البصمة تُحسب على النصّ لا على العلامات: تغيّر خطّ أو صنف لا يكسر التوثيق،
    // وتغيّر كلمة واحدة في المنطوق يكسره.
    const bodyText = htmlToText(input.sheetHtml.split(QR_SLOT).join(' '));
    const sha256 = fingerprint({
      serial,
      bodyHtml: bodyText,
      gregorianDate: input.gregorianDate,
      citizenName: name,
      destination: input.destination ?? ''
    });

    const sheetHtml = input.sheetHtml
      .split(SERIAL_SLOT)
      .join(escapeHtml(serial))
      .split(FINGERPRINT_SLOT)
      .join(escapeHtml(shortFingerprint(sha256)))
      .split(QR_SLOT)
      .join(qrSvg(`${serial}\n${sha256}`, 64));

    const info = db
      .prepare(
        `INSERT INTO documents (
           serial, serial_year, serial_seq, template_id, citizen_id, authority_id,
           citizen_name, citizen_nid, doc_type, destination, purpose, values_json,
           body_html, copies, copy_kind, fee, gregorian_date, hijri_date, operator,
           sha256, status, search_fold
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'issued',?)`
      )
      .run(
        serial,
        input.serialYear,
        seq,
        input.templateId,
        input.citizenId,
        input.authorityId,
        name,
        input.nationalId,
        input.docType,
        input.destination,
        input.purpose,
        JSON.stringify(input.values ?? {}),
        sheetHtml,
        Math.max(1, input.copies),
        input.copyKind,
        Math.max(0, input.fee),
        input.gregorianDate,
        input.hijriDate,
        input.operator,
        sha256,
        searchFold([serial, name, input.nationalId, input.docType, input.destination, input.purpose, bodyText])
      );

    const id = Number(info.lastInsertRowid);

    db.prepare(
      `INSERT INTO document_prints (document_id, copies, printer, reason, operator)
       VALUES (?, ?, ?, 'إصدار أول', ?)`
    ).run(id, Math.max(1, input.copies), input.printer, input.operator);

    if (input.templateId !== null) {
      db.prepare('UPDATE templates SET print_count = print_count + 1 WHERE id = ?').run(
        input.templateId
      );
    }

    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('document', ?, 'issue', ?, ?)`
    ).run(id, `${serial} — ${name}`, input.operator);

    return { id, serial, sha256, sheetHtml };
  })();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** إعادة الطباعة تُقيَّد ولا تُنشئ رقمًا جديدًا — الكتاب واحد ونسخه تُعدّ. */
export function recordReprint(
  db: Database,
  id: number,
  opts: { copies: number; printer: string | null; operator: string | null }
): void {
  db.transaction(() => {
    db.prepare(
      `INSERT INTO document_prints (document_id, copies, printer, reason, operator)
       VALUES (?, ?, ?, 'إعادة طباعة طبق الأصل', ?)`
    ).run(id, Math.max(1, opts.copies), opts.printer, opts.operator);
    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('document', ?, 'reprint', ?, ?)`
    ).run(id, `${opts.copies} نسخة`, opts.operator);
  })();
}

export function getDocument(db: Database, id: number): DocumentDetail | null {
  prepareDocuments(db);
  const row = db
    .prepare(
      `SELECT d.id, d.serial, d.template_id AS templateId, d.citizen_id AS citizenId,
              COALESCE(c.full_name, d.citizen_name, '') AS citizenName,
              COALESCE(c.national_id, d.citizen_nid) AS nationalId,
              d.doc_type AS docType, d.destination, d.purpose,
              d.values_json AS valuesJson, d.body_html AS bodyHtml,
              d.copies, d.copy_kind AS copyKind, d.fee,
              d.gregorian_date AS gregorianDate, d.hijri_date AS hijriDate,
              d.issued_at AS issuedAt, d.operator, d.sha256, d.status,
              (SELECT COALESCE(SUM(p.copies), 0) FROM document_prints p WHERE p.document_id = d.id)
                AS printedCopies
       FROM documents d LEFT JOIN citizens c ON c.id = d.citizen_id
       WHERE d.id = ?`
    )
    .get(id) as DocumentDetail | undefined;
  return row ?? null;
}

export type ListOptions = {
  /** حدّا المدة بصيغة YYYY-MM-DD، شاملان. */
  from?: string | null;
  to?: string | null;
  query?: string;
  limit?: number;
};

export function listDocuments(db: Database, opts: ListOptions = {}): DocumentRow[] {
  prepareDocuments(db);
  const limit = opts.limit ?? 500;
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const q = (opts.query ?? '').trim();

  const where = [
    "(? IS NULL OR date(d.issued_at,'localtime') >= ?)",
    "(? IS NULL OR date(d.issued_at,'localtime') <= ?)"
  ];
  const args: unknown[] = [from, from, to, to];

  if (q) {
    where.push('(d.search_fold LIKE ? OR d.serial LIKE ?)');
    args.push(`%${normalizeFold(q)}%`, `%${q}%`);
  }

  args.push(limit);
  return db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM documents d LEFT JOIN citizens c ON c.id = d.citizen_id
       WHERE ${where.join(' AND ')}
       ORDER BY d.issued_at DESC, d.id DESC LIMIT ?`
    )
    .all(...args) as DocumentRow[];
}

export function archiveStats(db: Database): ArchiveStats {
  const count = (expr: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE ${expr}`).get() as { n: number }).n;

  const issuedToday = count("date(issued_at,'localtime') = date('now','localtime')");
  const issuedYesterday = count("date(issued_at,'localtime') = date('now','localtime','-1 day')");
  const revenue = db
    .prepare(
      `SELECT COALESCE(SUM(fee), 0) AS total FROM documents
       WHERE date(issued_at,'localtime') = date('now','localtime')`
    )
    .get() as { total: number };

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
    revenueToday: revenue.total,
    topTemplate: top
      ? { title: top.title, count: top.n, share: issuedToday ? top.n / issuedToday : 0 }
      : null
  };
}

/** مؤشرات مدة: الكتب والإيراد والمخدومون والنسخ المطبوعة فعلًا. */
export function periodStats(db: Database, opts: ListOptions = {}): PeriodStats {
  prepareDocuments(db);
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const range = [from, from, to, to];
  const window =
    "(? IS NULL OR date(d.issued_at,'localtime') >= ?) AND (? IS NULL OR date(d.issued_at,'localtime') <= ?)";

  const head = db
    .prepare(
      `SELECT COUNT(*) AS issued, COALESCE(SUM(d.fee),0) AS revenue,
              COUNT(DISTINCT COALESCE(CAST(d.citizen_id AS TEXT), d.citizen_name)) AS citizens
       FROM documents d WHERE ${window}`
    )
    .get(...range) as { issued: number; revenue: number; citizens: number };

  const printed = db
    .prepare(
      `SELECT COALESCE(SUM(p.copies),0) AS copies
       FROM document_prints p JOIN documents d ON d.id = p.document_id
       WHERE ${window}`
    )
    .get(...range) as { copies: number };

  const byType = db
    .prepare(
      `SELECT COALESCE(NULLIF(d.doc_type,''), 'بلا تصنيف') AS name, COUNT(*) AS count,
              COALESCE(SUM(d.fee),0) AS revenue
       FROM documents d WHERE ${window}
       GROUP BY name ORDER BY count DESC, name LIMIT 12`
    )
    .all(...range) as { name: string; count: number; revenue: number }[];

  const byDay = db
    .prepare(
      `SELECT date(d.issued_at,'localtime') AS day, COUNT(*) AS count,
              COALESCE(SUM(d.fee),0) AS revenue
       FROM documents d WHERE ${window}
       GROUP BY day ORDER BY day DESC LIMIT 31`
    )
    .all(...range) as { day: string; count: number; revenue: number }[];

  return {
    issued: head.issued,
    revenue: head.revenue,
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
