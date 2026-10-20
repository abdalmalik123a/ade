/**
 * إصدار الكتاب والمعاملة والدفعة: رقم الصادر والبصمة والسلسلة والقيد في معاملةٍ واحدة — نُقل من `documents.ts` (D81).
 */
import { normalizeFold } from '@shared/arabic';
import type { Database } from 'better-sqlite3';
import type { SheetStyle, IssueInput, TransactionInput, TransactionResult } from '@shared/api';
import { createHash } from 'node:crypto';
import { touchLetterhead } from './letterheads';
import { indexRow } from './searchIndex';
import { canonicalNationalId } from '@shared/idChecks';
import { reserveSerial, fingerprint, htmlToText, CHAIN_GENESIS, chainLink, prepareDocuments } from './documents';
import { isClockAnomalous } from '@shared/orders';

/** الصورة المطبَّعة التي يجري عليها البحث — تُخزَّن مع السجل لا وقت الاستعلام. */
function searchFold(parts: (string | null | undefined)[]): string {
  return normalizeFold(parts.filter(Boolean).join(' '));
}

/** يُحفظ النمط مرّةً لبصمته، ويعود ما يُشار به إليه. */
function keepStyle(db: Database, style: SheetStyle): string {
  const NUL = String.fromCharCode(0);
  const hash = createHash('sha256').update(`${style.bodyClass ?? ''}${NUL}${style.css}`, 'utf8').digest('hex');
  db.prepare('INSERT OR IGNORE INTO sheet_styles (hash, css, body_class) VALUES (?, ?, ?)').run(hash, style.css, style.bodyClass);
  return hash;
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
  for (const k of input.required ?? []) {
    if (!input.values?.[k]?.trim()) throw new Error(`الحقل الإلزامي «${k}» فارغ — لا يصدر الكتاب قبله`);
  }

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
    const styleHash = input.style ? keepStyle(db, input.style) : null;

    const info = db
      .prepare(
        `INSERT INTO documents (
           serial, serial_year, serial_seq, template_id, citizen_id, authority_id,
           citizen_name, citizen_nid, doc_type, destination, purpose, values_json,
           body_html, copies, copy_kind, gregorian_date, hijri_date, operator,
           sha256, status, search_fold, letterhead_id, transaction_id, chain, style_hash
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'issued',?,?,?,?,?)`
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
        input.gregorianDate,
        input.hijriDate,
        input.operator,
        sha256,
        searchFold([serial, name, nidOf(input.nationalId), input.docType, input.destination, input.purpose, bodyText]),
        input.letterheadId ?? null,
        input.transactionId ?? null,
        chain,
        styleHash
      );

    // آخر استعمال للترويسة — عليه يقوم ترتيب المكتبة، وهو في المعاملة نفسها.
    if (input.letterheadId) touchLetterhead(db, input.letterheadId);

    const id = Number(info.lastInsertRowid);

    if (input.templateId !== null) {
      db.prepare('UPDATE templates SET print_count = print_count + 1 WHERE id = ?').run(
        input.templateId
      );
    }

    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('document', ?, 'issue', ?, ?)`
    ).run(id, `${serial} — ${name}`, input.operator);

    if (isClockAnomalous(new Date(), { serialYear: input.serialYear })) {
      db.prepare(
        `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
         VALUES ('system', ?, 'clock-warning', 'ساعة الجهاز غير مضبوطة عند الإصدار', ?)`
      ).run(id, input.operator);
    }

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
    const tx = db
      .prepare(
        `INSERT INTO transactions (citizen_id, citizen_name, citizen_nid, sheets, operator)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(citizenId, name, nidOf(input.nationalId), input.sheets.length, input.operator);
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
        transactionId,
        style: input.style ?? null
      })
    );

    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('transaction', ?, 'issue', ?, ?)`
    ).run(transactionId, `${input.sheets.length} ورقة — ${name}`, input.operator);

    if (isClockAnomalous(new Date(), { serialYear: input.serialYear })) {
      db.prepare(
        `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
         VALUES ('system', ?, 'clock-warning', 'ساعة الجهاز غير مضبوطة عند الإصدار', ?)`
      ).run(transactionId, input.operator);
    }

    return { transactionId, citizenId, documents };
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
