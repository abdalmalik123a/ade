import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type {
  AuditEntry,
  DocumentDetail,
  SheetStyle,
} from '@shared/api';

/**
 * سجل الصادر: الإصدار والبصمة وإعادة الطباعة والتقارير.
 *
 * التسلسل مستقلّ لكل سنة، و«الاطّلاع» لا يستهلك رقمًا — الاستهلاك عند الإصدار
 * وحده، وإلا احترقت أرقام كلما فتح الموظف شاشة المحرر. ويجري الإصدار كلّه في
 * نداء واحد: الرقم يُحجز والبصمة تُحسب والقيد يُكتب معًا.
 *
 * **والرقم قيدٌ في أرشيف المكتب وحده** (§١): ديوان مُنشئ لا جهة رسمية، فلا يُطبع
 * رقمه في خانة «العدد:» على الكتاب — تلك تكتبها الجهة، أو يُكتب فيها ما أعطاه
 * الزبون. فالورقة تُحفظ كما طُبعت حرفًا بحرف، بلا مواضع تُملأ بعد.
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
function ensureDocumentSearchColumn(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'search_fold')) {
    db.exec('ALTER TABLE documents ADD COLUMN search_fold TEXT');
  }
  // بعد ضمان العمود لا قبله — والقاعدة الجديدة تصل هنا بعمودها من المخطط.
  db.exec('CREATE INDEX IF NOT EXISTS ix_docs_fold ON documents(search_fold)');
}

/** أعمدة اسم المواطن ورقمه تُحفظ نصًّا أيضًا: الكتاب قد يصدر لمن لا ملفّ له. */
export function ensureCitizenSnapshot(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'citizen_name')) {
    db.exec('ALTER TABLE documents ADD COLUMN citizen_name TEXT');
    db.exec('ALTER TABLE documents ADD COLUMN citizen_nid TEXT');
  }
}

/** من أي ترويسة جاء الكتاب — للسؤال ولترتيب المكتبة. والرسم من اللقطة لا منها. */
export function ensureLetterheadLink(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'letterhead_id')) {
    db.exec('ALTER TABLE documents ADD COLUMN letterhead_id INTEGER');
  }
}

/** المعاملة الواحدة: خمس أوراق لزبون واحد قيدٌ واحد في الأرشيف. */
export function ensureTransactionLink(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'transaction_id')) {
    db.exec('ALTER TABLE documents ADD COLUMN transaction_id INTEGER');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY,
    citizen_id   INTEGER,
    citizen_name TEXT,
    citizen_nid  TEXT,
    sheets       INTEGER NOT NULL DEFAULT 0,
    fee          INTEGER NOT NULL DEFAULT 0,
    operator     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS ix_docs_transaction ON documents(transaction_id)');
}

/** الإبطال: الكتاب يبقى برقمه وبصمته، ومعه سببُه ووقتُه ومن أبطله. */
export function ensureVoidColumns(db: Database): void {
  const cols = (db.prepare('PRAGMA table_info(documents)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('void_reason')) db.exec('ALTER TABLE documents ADD COLUMN void_reason TEXT');
  if (!cols.includes('voided_at')) db.exec('ALTER TABLE documents ADD COLUMN voided_at TEXT');
  if (!cols.includes('voided_by')) db.exec('ALTER TABLE documents ADD COLUMN voided_by TEXT');
}

/** أوّل حلقةٍ في السلسلة: لا كتاب قبلها. */
export const CHAIN_GENESIS = '0'.repeat(64);

/**
 * حلقة الكتاب في سلسلة البصمات: بصمةُ ما قبله وبصمتُه ورقمه معًا.
 *
 * فبصمة الكتاب تشهد على متنه، والسلسلة تشهد على الأرشيف كلّه: كتابٌ يُحذف من
 * وسطه أو يُقحَم أو تُبدَّل بصمته يكسر كلَّ حلقةٍ بعده.
 */
export function chainLink(prev: string, sha256: string, serial: string): string {
  return createHash('sha256').update(`${prev}|${sha256}|${serial}`, 'utf8').digest('hex');
}

/**
 * عمود السلسلة — وما صدر قبله يُسلسَل بترتيب صدوره، مرّةً واحدة.
 *
 * وما يُسلسَل هنا بصمته كما هي في القيد؛ فالأرشيف القائم يدخل السلسلة كما هو اليوم،
 * وما يُمسّ بعدها يُكشف.
 */
export function ensureChain(db: Database): void {
  const cols = (db.prepare('PRAGMA table_info(documents)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('chain')) db.exec('ALTER TABLE documents ADD COLUMN chain TEXT');
  // يُسأل عند كل إصدار (prepareDocuments): فهرسٌ جزئيّ يجعل «أبقي كتابٌ بلا حلقة؟»
  // سؤالًا واحدًا لا مسحًا لخمسين ألف كتاب.
  db.exec('CREATE INDEX IF NOT EXISTS ix_docs_unchained ON documents(id) WHERE chain IS NULL');
  if (!db.prepare('SELECT 1 FROM documents WHERE chain IS NULL LIMIT 1').get()) return;
  db.transaction(() => {
    const rows = db.prepare('SELECT id, serial, sha256, chain FROM documents ORDER BY id').all() as {
      id: number;
      serial: string;
      sha256: string;
      chain: string | null;
    }[];
    const set = db.prepare('UPDATE documents SET chain = ? WHERE id = ?');
    let prev = CHAIN_GENESIS;
    for (const r of rows) {
      const link = r.chain ?? chainLink(prev, r.sha256, r.serial);
      if (!r.chain) set.run(link, r.id);
      prev = link;
    }
  })();
}

/**
 * أنماط الورقة مع كلّ كتاب (خطة Production، ١٫٣).
 *
 * الورقة المؤرشفة علاماتٌ تعتمد على أنماط التطبيق، فتغيّرُ خطّ الواجهة يومًا (٢٩ أيلول ٢٠٢٦)
 * غيّر خطّ كتب الإصدار الأوّل عند إعادة طبعها — وقيس ذلك في PDF. فتُحفظ الأنماط التي رُسم بها
 * الكتاب مرّةً لكلّ بصمة، ويُشار إليها منه. ولا تدخل البصمة ولا السلسلة: هي صورة الكتاب لا متنه.
 */
export function ensureSheetStyles(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS sheet_styles (
    hash       TEXT PRIMARY KEY,
    css        TEXT NOT NULL,
    body_class TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const cols = (db.prepare('PRAGMA table_info(documents)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('style_hash')) db.exec('ALTER TABLE documents ADD COLUMN style_hash TEXT');
}

/** الأنماط ببصمتها — وما لا بصمة له (كتابٌ صدر قبلها) لا شيء: يُطبع بأنماط يومه كما كان. */
export function styleByHash(db: Database, hash: string | null | undefined): SheetStyle | null {
  if (!hash) return null;
  const row = db.prepare('SELECT css, body_class AS bodyClass FROM sheet_styles WHERE hash = ?').get(hash) as
    | { css: string; bodyClass: string | null }
    | undefined;
  return row ? { css: row.css, bodyClass: row.bodyClass } : null;
}

/** أنماط الكتاب يوم صدر — لإعادة طبعه وتصديره كما صدر (خطة Production، ٢٫٤). */
export function documentStyle(db: Database, id: number): SheetStyle | null {
  prepareDocuments(db);
  const row = db.prepare('SELECT style_hash AS h FROM documents WHERE id = ?').get(id) as { h: string | null } | undefined;
  return styleByHash(db, row?.h);
}

/** بصمة أنماط الكتاب — تُحفظ مع مهمّة الطباعة فيُستأنف بها بعد الانقطاع. */
export function documentStyleHash(db: Database, id: number): string | null {
  prepareDocuments(db);
  return (db.prepare('SELECT style_hash AS h FROM documents WHERE id = ?').get(id) as { h: string | null } | undefined)?.h ?? null;
}

export function prepareDocuments(db: Database): void {
  ensureDocumentSearchColumn(db);
  ensureCitizenSnapshot(db);
  ensureLetterheadLink(db);
  ensureTransactionLink(db);
  ensureVoidColumns(db);
  ensureChain(db);
  ensureSheetStyles(db);
}

export type RepeatSource =
  | { kind: 'editor' }
  | { kind: 'counter'; serial: string; templateIds: number[]; values: Record<string, string> };

/**
 * «كرّره»: كتابٌ صدر يُفتح نسخةً جديدة من حيث كُتب.
 *
 * ما صدر من المحرّر يحمل لقطة ترويسته وحقوله (`__letterhead` و`__fields`) فيعود
 * إليه. وما صدر من الشبّاك قيمٌ بمفاتيح حقول نماذجه — فيعود إلى الشبّاك بنماذج
 * معاملته كلّها وقيمها، ويبدّل الموظف ما يلزم. وكان يُفتح في المحرّر فيجد قيمًا
 * لا يعرف مفاتيحها، فيفتح فارغًا.
 */
export function repeatSource(db: Database, id: number): RepeatSource | null {
  prepareDocuments(db);
  const doc = db
    .prepare('SELECT serial, template_id AS templateId, transaction_id AS tx, values_json AS v FROM documents WHERE id = ?')
    .get(id) as { serial: string; templateId: number | null; tx: number | null; v: string } | undefined;
  if (!doc) return null;
  const parse = (raw: string): Record<string, unknown> => {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  if ('__letterhead' in parse(doc.v)) return { kind: 'editor' };

  const rows = doc.tx
    ? (db
        .prepare('SELECT template_id AS templateId, values_json AS v FROM documents WHERE transaction_id = ? ORDER BY id')
        .all(doc.tx) as { templateId: number | null; v: string }[])
    : [{ templateId: doc.templateId, v: doc.v }];
  const templateIds = [...new Set(rows.map((r) => r.templateId).filter((t): t is number => t !== null))];
  const values: Record<string, string> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(parse(r.v))) {
      if (!k.startsWith('__') && typeof v === 'string') values[k] = v;
    }
  }
  return { kind: 'counter', serial: doc.serial, templateIds, values };
}

/**
 * إبطال كتابٍ صادر (د٣): يبقى في الأرشيف برقمه وبصمته — فالرقم لا يُثقب ولا يُعاد —
 * ومعه سببُه ووقتُه ومن أبطله، ويُقيَّد في سجلّ التدقيق. والإبطال لا يمسّ المتن ولا
 * البصمة ولا السلسلة: هو حكمٌ على الكتاب لا تعديلٌ فيه.
 */
export function voidDocument(db: Database, id: number, reason: string, operator: string | null): DocumentDetail {
  prepareDocuments(db);
  const why = reason.trim();
  if (!why) throw new Error('اذكر سبب الإبطال — يُقيَّد مع الكتاب');
  return db.transaction(() => {
    const row = db.prepare('SELECT serial, status FROM documents WHERE id = ?').get(id) as
      | { serial: string; status: string }
      | undefined;
    if (!row) throw new Error('الكتاب غير موجود');
    if (row.status === 'void') throw new Error(`الكتاب ${row.serial} مُبطَلٌ من قبل`);
    db.prepare(
      "UPDATE documents SET status = 'void', void_reason = ?, voided_at = datetime('now'), voided_by = ? WHERE id = ?"
    ).run(why, operator, id);
    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator) VALUES ('document', ?, 'void', ?, ?)`
    ).run(id, `${row.serial} — ${why}`, operator);
    return getDocument(db, id)!;
  })();
}

/** سجلّ التدقيق (د٤): الأحدث أولًا، ولقيد الكتاب رقمُ صادره. */
export function listAudit(
  db: Database,
  opts: { entity?: string | null; documentId?: number | null; query?: string; limit?: number } = {}
): AuditEntry[] {
  prepareDocuments(db);
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.entity) {
    where.push('a.entity = ?');
    args.push(opts.entity);
  }
  if (opts.documentId) {
    where.push("a.entity = 'document' AND a.entity_id = ?");
    args.push(opts.documentId);
  }
  const q = (opts.query ?? '').trim();
  if (q) {
    where.push('(a.detail LIKE ? OR a.operator LIKE ? OR d.serial LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  args.push(opts.limit ?? 300);
  return db
    .prepare(
      `SELECT a.id, a.entity, a.entity_id AS entityId, a.action, a.detail, a.operator, a.at,
              CASE WHEN a.entity = 'document' THEN d.serial END AS serial
       FROM audit_log a LEFT JOIN documents d ON a.entity = 'document' AND d.id = a.entity_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.id DESC LIMIT ?`
    )
    .all(...args) as AuditEntry[];
}

/** قيدٌ في سجلّ التدقيق لما ليس كتابًا: النسخة الاحتياطية واسترجاعها. */
export function logAudit(
  db: Database,
  entity: string,
  action: string,
  detail: string | null,
  operator: string | null = null
): void {
  db.prepare('INSERT INTO audit_log (entity, entity_id, action, detail, operator) VALUES (?, NULL, ?, ?, ?)').run(
    entity,
    action,
    detail,
    operator
  );
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
              d.copies, d.copy_kind AS copyKind,
              d.gregorian_date AS gregorianDate, d.hijri_date AS hijriDate,
              d.issued_at AS issuedAt, d.operator, d.sha256, d.status,
              (SELECT COALESCE(SUM(p.copies), 0) FROM document_prints p WHERE p.document_id = d.id)
                AS printedCopies,
              d.void_reason AS voidReason, d.voided_at AS voidedAt, d.voided_by AS voidedBy
       FROM documents d LEFT JOIN citizens c ON c.id = d.citizen_id
       WHERE d.id = ?`
    )
    .get(id) as DocumentDetail | undefined;
  return row ?? null;
}

