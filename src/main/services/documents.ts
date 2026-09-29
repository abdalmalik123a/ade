import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { normalizeFold } from '@shared/arabic';
import { canonicalNationalId } from '@shared/idChecks';
import { touchLetterhead } from './letterheads';
import { digitsOf, indexRow, matchIds } from './searchIndex';
import type {
  ArchiveCheck,
  ArchiveStats,
  AuditEntry,
  DocumentDetail,
  DocumentRow,
  IssueInput,
  PeriodStats,
  TransactionInput,
  TransactionResult
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
  d.copies, d.fee, d.status, d.void_reason AS voidReason`;

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

export function prepareDocuments(db: Database): void {
  ensureDocumentSearchColumn(db);
  ensureCitizenSnapshot(db);
  ensureLetterheadLink(db);
  ensureTransactionLink(db);
  ensureVoidColumns(db);
  ensureChain(db);
}

export type IssueResult = {
  id: number;
  serial: string;
  sha256: string;
  sheetHtml: string;
};

/**
 * يصدر الكتاب: رقم قيدٍ محجوز، وبصمة، وقيد في السجل — كلها في معاملة واحدة.
 * يعيد علامات الورقة ليطبعها النداء أو يحفظها PDF — وهي ما أُرسل بلا تغيير.
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
    const bodyText = htmlToText(input.sheetHtml);
    const sha256 = fingerprint({
      serial,
      bodyHtml: bodyText,
      gregorianDate: input.gregorianDate,
      citizenName: name,
      destination: input.destination ?? ''
    });

    const sheetHtml = input.sheetHtml;
    const prev = db.prepare('SELECT chain FROM documents ORDER BY id DESC LIMIT 1').get() as
      | { chain: string | null }
      | undefined;
    const chain = chainLink(prev?.chain ?? CHAIN_GENESIS, sha256, serial);

    const info = db
      .prepare(
        `INSERT INTO documents (
           serial, serial_year, serial_seq, template_id, citizen_id, authority_id,
           citizen_name, citizen_nid, doc_type, destination, purpose, values_json,
           body_html, copies, copy_kind, fee, gregorian_date, hijri_date, operator,
           sha256, status, search_fold, letterhead_id, transaction_id, chain
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'issued',?,?,?,?)`
      )
      .run(
        serial,
        input.serialYear,
        seq,
        input.templateId,
        input.citizenId,
        input.authorityId,
        name,
        nidOf(input.nationalId),
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
        searchFold([serial, name, nidOf(input.nationalId), input.docType, input.destination, input.purpose, bodyText]),
        input.letterheadId ?? null,
        input.transactionId ?? null,
        chain
      );

    // آخر استعمال للترويسة — عليه يقوم ترتيب المكتبة، وهو في المعاملة نفسها.
    if (input.letterheadId) touchLetterhead(db, input.letterheadId);

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

    indexRow(db, 'documents', id);

    return { id, serial, sha256, sheetHtml };
  })();
}

/**
 * معاملة الزبون الواحد: خمس أوراق تُقيَّد قيدًا واحدًا.
 *
 * ولكل ورقة رقم صادرها وبصمتها — المعاملة تجمعها ولا تُلغي استقلالها.
 *
 * **والكل أو لا شيء.** إن سقطت الورقة الثالثة رُدّت الأولى والثانية معها، فلا
 * يُحرق رقم صادر على كتاب لم يخرج، ولا تبقى في الأرشيف نصفُ معاملة.
 */
/**
 * ملف المواطن بالرقم الوطني وحده — لا بالاسم.
 *
 * الكتاب الذي كُتب اسم صاحبه باليد ولم يُختر من السجل كان يصدر بلا ربط، فيقول
 * ملفُّه «لم يصدر أي كتاب» والأرشيف فيه كتبه. والرقم الوطني يعيّن صاحبه يقينًا؛
 * أمّا الاسم فيتشابه، والربط به تخمين (المبدأ ٥).
 */
/** الرقم الوطني كما يُقيَّد مع الكتاب: بصورته الموحّدة إن كانت له — والورقة تبقى كما طُبعت. */
const nidOf = (nid: string | null | undefined): string | null => canonicalNationalId(nid) ?? (nid?.trim() || null);

export function citizenByNationalId(db: Database, nationalId: string | null | undefined): number | null {
  // بالصورة الموحّدة: «١٩٩٩…» المكتوب في الشبّاك يجد «1999…» المحفوظ في السجلّ.
  const nid = canonicalNationalId(nationalId) ?? nationalId?.trim();
  if (!nid) return null;
  const row = db.prepare('SELECT id FROM citizens WHERE national_id = ? LIMIT 1').get(nid) as { id: number } | undefined;
  return row?.id ?? null;
}

/**
 * يُربط كتابُ معاملةٍ بملف مواطن بعد صدوره — حين يُحفظ الزبون الجديد في السجل.
 * والمتن والبصمة لا يُمسّان: الربط عمودٌ في القيد، لا تعديلٌ في الكتاب.
 */
export function linkTransactionCitizen(db: Database, transactionId: number, citizenId: number): number {
  return db.transaction(() => {
    const changed = db
      .prepare('UPDATE documents SET citizen_id = ? WHERE transaction_id = ? AND citizen_id IS NULL')
      .run(citizenId, transactionId).changes;
    db.prepare('UPDATE transactions SET citizen_id = ? WHERE id = ? AND citizen_id IS NULL').run(citizenId, transactionId);
    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail) VALUES ('transaction', ?, 'link-citizen', ?)`
    ).run(transactionId, `ملف المواطن ${citizenId}`);
    return changed;
  })();
}

export function issueTransaction(db: Database, input: TransactionInput): TransactionResult {
  const name = input.citizenName.trim();
  if (!name) throw new Error('لا تصدر معاملة بلا اسم صاحب العلاقة');
  if (input.sheets.length === 0) throw new Error('لا تصدر معاملة بلا ورقة واحدة');

  prepareDocuments(db);
  const citizenId = input.citizenId ?? citizenByNationalId(db, input.nationalId);

  return db.transaction((): TransactionResult => {
    const fee = input.sheets.reduce((sum, s) => sum + Math.max(0, s.fee), 0);
    const tx = db
      .prepare(
        `INSERT INTO transactions (citizen_id, citizen_name, citizen_nid, sheets, fee, operator)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(citizenId, name, nidOf(input.nationalId), input.sheets.length, fee, input.operator);
    const transactionId = Number(tx.lastInsertRowid);

    const documents = input.sheets.map((sheet) =>
      issueDocument(db, {
        ...sheet,
        citizenId,
        citizenName: name,
        nationalId: input.nationalId,
        operator: input.operator,
        printer: input.printer,
        serialPrefix: input.serialPrefix,
        serialYear: input.serialYear,
        gregorianDate: input.gregorianDate,
        hijriDate: input.hijriDate,
        transactionId
      })
    );

    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('transaction', ?, 'issue', ?, ?)`
    ).run(transactionId, `${input.sheets.length} ورقة — ${name}`, input.operator);

    return { transactionId, fee, citizenId, documents };
  })();
}

/**
 * الدمج: معاملةٌ لكل اسم في القائمة.
 *
 * ثلاثون تأييدًا لصفٍّ كامل بضغطة، لكلّ صاحبٍ معاملتُه وأوراقُه وأرقامُه — لا
 * معاملةً واحدة لثلاثين، فكلٌّ يمضي بورقته وحده.
 *
 * **والدفعة كلّها أو لا شيء**: اسمٌ يسقط في آخر القائمة يردّ ما قبله، فلا يخرج
 * المكتب بنصف صفّ مطبوع ونصفه محروق الأرقام.
 */
/**
 * الدفعة كلّها قيدٌ واحد: تصدر كلّها أو لا يصدر منها شيء — ولو انقطعت الكهرباء في
 * منتصفها. و`afterEach` لفحص ذلك وحده: يُبطئ القيد ليُقتل البرنامج في منتصفه.
 */
export function issueBatch(db: Database, inputs: TransactionInput[], afterEach?: () => void): TransactionResult[] {
  if (inputs.length === 0) throw new Error('لا تصدر دفعة بلا اسم واحد');
  prepareDocuments(db);
  return db.transaction(() =>
    inputs.map((one) => {
      const out = issueTransaction(db, one);
      afterEach?.();
      return out;
    })
  )();
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

/** كتابٌ مُبطَل لا يُعاد طبعه ولا يُخرَج PDF: ورقته لو خرجت لم يعرف حاملُها أنها باطلة. */
export function assertNotVoid(db: Database, id: number): void {
  prepareDocuments(db);
  const row = db.prepare('SELECT serial, status FROM documents WHERE id = ?').get(id) as
    | { serial: string; status: string }
    | undefined;
  if (row?.status === 'void') throw new Error(`الكتاب ${row.serial} مُبطَل — لا يُعاد طبعه`);
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

/**
 * «تحقّق من سلامة الأرشيف» (د٥): كل بصمةٍ تُعاد من متن كتابها، والسلسلة من أوّلها،
 * وأرقام كل سنةٍ تُعدّ فلا يغيب منها رقم.
 *
 * والبصمة تُحسب بـ`htmlToText` نفسها التي صدر بها الكتاب — فهي لا تُغيَّر: أيّ تغييرٍ
 * فيها يجعل كتب الأمس «معدَّلة» وهي لم تُمسّ.
 */
/**
 * كتب الإصدار الأوّل (قبل التطوير ١) طُبع عليها رقم المكتب وبصمته ورمز QR في مواضع
 * (`data-slot`)، وحُسبت بصمتها **والمواضع فارغةٌ بعلاماتها** ثم مُلئت. فالنصّ المحفوظ
 * غير النصّ المبصوم — ويُعاد هنا كما بُصم: تُردّ المواضع إلى علاماتها. وما في المواضع
 * لم يدخل البصمة يومها أصلًا، فلا يضعف التحقّق: الرقم نفسه في البصمة وفي السلسلة.
 *
 * وبغير هذا كان كلّ كتابٍ قديمٍ يُعلَن «تغيّر بعد صدوره» عند أوّل تحديثٍ للبرنامج.
 */
const LEGACY_SLOTS: [string, string][] = [
  ['serial', '{{DIWAN_SERIAL}}'],
  ['fingerprint', '{{DIWAN_FINGERPRINT}}'],
  ['qr', ' ']
];
function legacySlots(html: string): string {
  let out = html;
  for (const [slot, mark] of LEGACY_SLOTS) {
    out = out.replace(new RegExp(String.raw`(<([a-z]+)[^>]*data-slot="${slot}"[^>]*>)[\s\S]*?(</\2>)`, 'g'), `$1${mark}$3`);
  }
  return out;
}

export function verifyArchive(db: Database): ArchiveCheck {
  prepareDocuments(db);
  const rows = db
    .prepare(
      `SELECT id, serial, serial_year AS year, serial_seq AS seq, body_html AS body, gregorian_date AS date,
              citizen_name AS name, destination, sha256, chain
       FROM documents ORDER BY id`
    )
    .all() as {
    id: number;
    serial: string;
    year: number;
    seq: number;
    body: string;
    date: string;
    name: string | null;
    destination: string | null;
    sha256: string;
    chain: string | null;
  }[];

  const problems: ArchiveCheck['problems'] = [];
  let prev = CHAIN_GENESIS;
  for (const r of rows) {
    const hash = (body: string) =>
      fingerprint({
        serial: r.serial,
        bodyHtml: htmlToText(body),
        gregorianDate: r.date,
        citizenName: r.name ?? '',
        destination: r.destination ?? ''
      });
    if (hash(r.body) !== r.sha256 && hash(legacySlots(r.body)) !== r.sha256) {
      problems.push({ id: r.id, serial: r.serial, kind: 'content', text: 'متنه أو بياناته تغيّرت بعد صدوره — بصمته لا تطابقه' });
    }
    const link = chainLink(prev, r.sha256, r.serial);
    if (r.chain !== link) {
      problems.push({
        id: r.id,
        serial: r.serial,
        kind: 'chain',
        text: 'السلسلة مكسورة عنده: كتابٌ قبله حُذف أو أُقحم، أو بُدّلت بصمته'
      });
    }
    // ما بعد الكسر يُقاس بحلقته المقيَّدة — فيُذكر موضع الكسر مرّةً لا في كل كتابٍ بعده.
    prev = r.chain ?? link;
  }

  // الأرقام: لكل سنةٍ من ١ إلى أكبرها، بلا ثقب.
  const years = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!years.has(r.year)) years.set(r.year, new Set());
    years.get(r.year)!.add(r.seq);
  }
  const prefix = (year: number) => rows.find((r) => r.year === year)?.serial.split('/')[0] ?? '';
  for (const [year, seqs] of years) {
    // بحلقةٍ لا بـ`Math.max(...)`: النشر يضع كلّ رقمٍ وسيطًا على المكدّس، فيفيض فوق
    // نحو ١٢٥ ألف كتابٍ في السنة (التدقيق المستقل).
    let top = 0;
    for (const n of seqs) if (n > top) top = n;
    for (let n = 1; n <= top; n++) {
      if (!seqs.has(n)) {
        problems.push({ id: null, serial: `${prefix(year)}/${year}/${n}`, kind: 'gap', text: 'رقمٌ غائب من سجلّ الصادر' });
      }
    }
  }

  return { checked: rows.length, problems, head: rows.length ? (rows[rows.length - 1]!.chain ?? null) : null };
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

/** إعادة الطباعة تُقيَّد ولا تُنشئ رقمًا جديدًا — الكتاب واحد ونسخه تُعدّ. */
export function recordReprint(
  db: Database,
  id: number,
  opts: { copies: number; printer: string | null; operator: string | null }
): void {
  assertNotVoid(db, id);
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
                AS printedCopies,
              d.void_reason AS voidReason, d.voided_at AS voidedAt, d.voided_by AS voidedBy
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

  // رقم الصادر («م/2026/14») يُسأل عنه عمودُه ببدايته: كلماته في الفهرس «م» و«2026»
  // و«14»، و«2» بادئةً تطابق «2026» في كل كتاب. والمطابق تمامًا أوّلًا.
  const serialQuery = q.includes('/') ? normalizeFold(q).replace(/\s+/g, '') : null;
  if (serialQuery) {
    where.push('d.serial LIKE ?');
    args.push(`${serialQuery}%`);
  } else if (q) {
    // الفهرس أولًا (بدايات الكلمات في المتن والاسم والجهة)، ورقم الصادر ووسطُ الرقم
    // الوطني مسحًا في أعمدتهما القصيرة. وإن تعذّر الفهرس فالمسح القديم كلّه.
    const ids = matchIds(db, 'documents', q);
    if (ids === null) {
      where.push('(d.search_fold LIKE ? OR d.serial LIKE ?)');
      args.push(`%${normalizeFold(q)}%`, `%${q}%`);
    } else {
      const digits = digitsOf(q);
      where.push(
        `(d.id IN (SELECT value FROM json_each(?)) OR d.serial LIKE ? OR (? IS NOT NULL AND d.citizen_nid LIKE ?))`
      );
      const nid = digits.length >= 3 ? `%${digits}%` : null;
      args.push(JSON.stringify(ids), `%${q}%`, nid, nid);
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
  prepareDocuments(db);
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
