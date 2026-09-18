import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { QR_SLOT, type TransactionInput, type TransactionSheet } from '../src/shared/api';
import {
  issueTransaction,
  prepareDocuments,
  transactionSheets
} from '../src/main/services/documents';
import { docFromLegacy, emptyDoc, makeField, mergeFields } from '../src/shared/doc';

const sheet = (patch: Partial<TransactionSheet> = {}): TransactionSheet => ({
  sheetHtml: `<div class="a4-sheet">نؤيد لكم أن السيد أحمد يعمل لدينا.<div data-slot="qr">${QR_SLOT}</div></div>`,
  templateId: null,
  letterheadId: null,
  authorityId: null,
  docType: 'تأييد استمرار بالخدمة',
  destination: 'مصرف الرشيد',
  purpose: 'سلفة',
  values: {},
  copies: 1,
  copyKind: 'نسخة أصلية',
  fee: 1000,
  ...patch
});

const input = (patch: Partial<TransactionInput> = {}): TransactionInput => ({
  citizenId: null,
  citizenName: 'أحمد عادل كريم',
  nationalId: '198421098312',
  operator: 'مشغّل 01',
  printer: null,
  serialPrefix: 'م',
  serialYear: 2026,
  gregorianDate: '19 أيلول 2026',
  hijriDate: null,
  sheets: [sheet()],
  ...patch
});

describe('اتحاد الحقول — قلب ورقة الإدخال الواحدة', () => {
  it('الاسم يُكتب مرّة ويملأ الخمس', () => {
    const a = docFromLegacy('نؤيد أن {الاسم} ورقمه {الرقم_الوطني}');
    const b = docFromLegacy('يشهد أن {الاسم} مقيم في {العنوان}');
    const c = docFromLegacy('{الاسم}');

    expect(mergeFields([a, b, c]).map((f) => f.key)).toEqual([
      'الاسم',
      'الرقم_الوطني',
      'العنوان'
    ]);
  });

  it('والترتيب ترتيبُ أوّل ظهور — فلا تقفز الحقول بين اختيار واختيار', () => {
    const a = docFromLegacy('{ب} ثم {أ}');
    const b = docFromLegacy('{أ} ثم {ج}');
    expect(mergeFields([a, b]).map((f) => f.key)).toEqual(['ب', 'أ', 'ج']);
  });

  it('الإلزام إن ألزمته واحدة، والعرض أوسعهما، والمصدر إن عرفه أحدهما', () => {
    const a = emptyDoc();
    a.fields = [makeField({ key: 'الاسم', width: 10 })];
    const b = emptyDoc();
    b.fields = [makeField({ key: 'الاسم', width: 40, required: true, source: 'full_name' })];

    const [merged] = mergeFields([a, b]);
    expect(merged).toMatchObject({ width: 40, required: true, source: 'full_name' });
  });

  it('وبلا وثائق لا حقول', () => {
    expect(mergeFields([])).toEqual([]);
  });
});

describe('المعاملة الواحدة', () => {
  it('خمس أوراق قيدٌ واحد، ولكل ورقة رقم صادرها وبصمتها', () => {
    const db = freshDb();
    const out = issueTransaction(
      db,
      input({ sheets: [sheet(), sheet({ docType: 'براءة ذمة' }), sheet({ docType: 'تأييد سكن' })] })
    );

    expect(out.documents).toHaveLength(3);
    const serials = out.documents.map((d) => d.serial);
    expect(new Set(serials).size).toBe(3);
    expect(serials).toEqual(['م/2026/1', 'م/2026/2', 'م/2026/3']);
    expect(new Set(out.documents.map((d) => d.sha256)).size).toBe(3);

    // وكلّها تحت معاملة واحدة.
    const rows = transactionSheets(db, out.transactionId);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.docType)).toEqual([
      'تأييد استمرار بالخدمة',
      'براءة ذمة',
      'تأييد سكن'
    ]);
  });

  it('وأجرتها مجموع أوراقها', () => {
    const db = freshDb();
    const out = issueTransaction(
      db,
      input({ sheets: [sheet({ fee: 1000 }), sheet({ fee: 500 }), sheet({ fee: 250 })] })
    );

    expect(out.fee).toBe(1750);
    const tx = db
      .prepare('SELECT sheets, fee, citizen_name AS name FROM transactions WHERE id = ?')
      .get(out.transactionId) as { sheets: number; fee: number; name: string };
    expect(tx).toMatchObject({ sheets: 3, fee: 1750, name: 'أحمد عادل كريم' });
  });

  it('الكل أو لا شيء — ورقةٌ تسقط تردّ ما قبلها ولا تحرق رقمًا', () => {
    const db = freshDb();
    prepareDocuments(db);

    expect(() =>
      issueTransaction(
        db,
        input({ sheets: [sheet(), sheet({ sheetHtml: '<div>   </div>' }), sheet()] })
      )
    ).toThrow(/فارغة/);

    // لا كتاب، ولا معاملة، ولا رقم محروق.
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    expect(count('SELECT COUNT(*) AS n FROM documents')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM transactions')).toBe(0);
    expect(count("SELECT COALESCE(MAX(last_value),0) AS n FROM counters")).toBe(0);
  });

  it('ولا تصدر معاملة بلا اسم ولا بلا ورقة', () => {
    const db = freshDb();
    expect(() => issueTransaction(db, input({ citizenName: '   ' }))).toThrow(/اسم صاحب العلاقة/);
    expect(() => issueTransaction(db, input({ sheets: [] }))).toThrow(/ورقة واحدة/);
  });

  it('وتُدوَّن في سجل التدقيق مرّةً باسمها وعدد أوراقها', () => {
    const db = freshDb();
    const out = issueTransaction(db, input({ sheets: [sheet(), sheet()] }));

    const row = db
      .prepare("SELECT detail FROM audit_log WHERE entity = 'transaction' AND entity_id = ?")
      .get(out.transactionId) as { detail: string } | undefined;
    expect(row?.detail).toBe('2 ورقة — أحمد عادل كريم');
  });

  it('وكل ورقة تحمل رقم معاملتها في القاعدة', () => {
    const db = freshDb();
    const out = issueTransaction(db, input({ sheets: [sheet(), sheet()] }));

    const ids = db
      .prepare('SELECT transaction_id AS tx FROM documents')
      .all() as { tx: number }[];
    expect(ids.map((r) => r.tx)).toEqual([out.transactionId, out.transactionId]);
  });

  it('وورقةٌ واحدة معاملةٌ أيضًا — فالطريق واحد', () => {
    const db = freshDb();
    const out = issueTransaction(db, input());
    expect(out.documents).toHaveLength(1);
    expect(transactionSheets(db, out.transactionId)).toHaveLength(1);
  });

  it('ومعاملتان لا تختلط أوراقهما', () => {
    const db = freshDb();
    const first = issueTransaction(db, input({ sheets: [sheet(), sheet()] }));
    const second = issueTransaction(db, input({ citizenName: 'سالم كريم', sheets: [sheet()] }));

    expect(transactionSheets(db, first.transactionId)).toHaveLength(2);
    expect(transactionSheets(db, second.transactionId)).toHaveLength(1);
    expect(transactionSheets(db, second.transactionId)[0]!.citizenName).toBe('سالم كريم');
  });
});

describe('ترحيل قاعدة المكتب القائمة', () => {
  it('قاعدة بلا جدول المعاملات تُرقّى بلا سقوط، والتكرار لا يضرّ', () => {
    const db = freshDb();
    db.exec('DROP TABLE transactions');
    db.exec('ALTER TABLE documents DROP COLUMN transaction_id');

    prepareDocuments(db);
    prepareDocuments(db);

    const out = issueTransaction(db, input());
    expect(out.documents).toHaveLength(1);
  });
});
