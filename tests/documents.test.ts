import { describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from './helpers';
import {
  archiveStats,
  documentCount,
  fingerprint,
  getDocument,
  htmlToText,
  issueDocument,
  listDocuments,
  peekSerial,
  periodStats,
  prepareDocuments,
  recordReprint,
  reserveSerial
} from '../src/main/services/documents';
import { FINGERPRINT_SLOT, QR_SLOT, SERIAL_SLOT } from '../src/shared/api';
import type { IssueInput } from '../src/shared/api';

const SHEET =
  `<div class="a4-sheet"><div>العدد: <span data-slot="serial">${SERIAL_SLOT}</span></div>` +
  `<div>إلى / مصرف الرشيد</div><div>نؤيد لكم أن السيد أحمد عبد الله يعمل لدينا.</div>` +
  `<div data-slot="qr">${QR_SLOT}</div><span data-slot="fingerprint">${FINGERPRINT_SLOT}</span></div>`;

function input(patch: Partial<IssueInput> = {}): IssueInput {
  return {
    sheetHtml: SHEET,
    templateId: null,
    citizenId: null,
    authorityId: null,
    citizenName: 'أحمد عبد الله الجبوري',
    nationalId: '199912345678',
    docType: 'تأييد استمرار بالخدمة',
    destination: 'مصرف الرشيد',
    purpose: 'ترويج معاملة سلفة',
    values: { name: 'أحمد عبد الله الجبوري' },
    copies: 1,
    copyKind: 'نسخة أصلية',
    fee: 1000,
    gregorianDate: '17 أيلول 2026',
    hijriDate: '5 ربيع الأول 1448',
    operator: 'مشغّل 01',
    printer: null,
    serialPrefix: 'م',
    serialYear: 2026,
    ...patch
  };
}

/** كتاب بتاريخ إصدار محدَّد — للتقارير والمدد. */
function backdate(db: Database, id: number, day: string): void {
  db.prepare("UPDATE documents SET issued_at = ? || ' 09:00:00' WHERE id = ?").run(day, id);
  db.prepare("UPDATE document_prints SET printed_at = ? || ' 09:00:00' WHERE document_id = ?").run(
    day,
    id
  );
}

describe('أرقام الصادر', () => {
  it('الاطّلاع لا يستهلك رقمًا مهما تكرّر', () => {
    const db = freshDb();
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/1');
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/1');
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/1');
  });

  it('الحجز يستهلك ويتسلسل، ولكل سنة عدّادها', () => {
    const db = freshDb();
    expect(reserveSerial(db, 'م', 2026).serial).toBe('م/2026/1');
    expect(reserveSerial(db, 'م', 2026).serial).toBe('م/2026/2');
    expect(reserveSerial(db, 'م', 2027).serial).toBe('م/2027/1');
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/3');
  });

  it('الإصدار وحده يحرّك العدّاد', () => {
    const db = freshDb();
    peekSerial(db, 'م', 2026);
    issueDocument(db, input());
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/2');
  });
});

describe('إصدار الكتاب', () => {
  it('يملأ المواضع المحجوزة: الرقم والبصمة ورمز التحقق', () => {
    const db = freshDb();
    const result = issueDocument(db, input());

    expect(result.serial).toBe('م/2026/1');
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.sheetHtml).not.toContain(SERIAL_SLOT);
    expect(result.sheetHtml).not.toContain(QR_SLOT);
    expect(result.sheetHtml).not.toContain(FINGERPRINT_SLOT);
    expect(result.sheetHtml).toContain('م/2026/1');
    expect(result.sheetHtml).toContain('<svg'); // الرمز مرسوم داخل الورقة
    expect(result.sheetHtml).toContain(result.sha256.slice(0, 6));
  });

  it('المتن المحفوظ هو ما طُبع بالضبط — فإعادة الطباعة طبق الأصل', () => {
    const db = freshDb();
    const result = issueDocument(db, input());
    expect(getDocument(db, result.id)?.bodyHtml).toBe(result.sheetHtml);
  });

  it('لا يصدر كتاب بلا اسم ولا بورقة فارغة، ولا يُستهلك رقم عند الرفض', () => {
    const db = freshDb();
    expect(() => issueDocument(db, input({ citizenName: '   ' }))).toThrow(/اسم صاحب العلاقة/);
    expect(() => issueDocument(db, input({ sheetHtml: '<div>   </div>' }))).toThrow(/فارغة/);
    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/1');
  });

  it('يقيّد الإصدار الأول في سجل الطباعة وفي سجل التدقيق', () => {
    const db = freshDb();
    const result = issueDocument(db, input({ copies: 3 }));

    const prints = db
      .prepare('SELECT reason, copies FROM document_prints WHERE document_id = ?')
      .all(result.id) as { reason: string; copies: number }[];
    expect(prints).toEqual([{ reason: 'إصدار أول', copies: 3 }]);

    const audit = db.prepare("SELECT action FROM audit_log WHERE entity = 'document'").all();
    expect(audit).toHaveLength(1);
  });

  it('يزيد عدّاد طباعة النموذج الذي صدر عنه', () => {
    const db = freshDb();
    const tpl = db
      .prepare("INSERT INTO templates (title, body_html) VALUES ('تأييد', 'متن')")
      .run();
    const id = Number(tpl.lastInsertRowid);
    issueDocument(db, input({ templateId: id }));
    issueDocument(db, input({ templateId: id }));
    expect(
      (db.prepare('SELECT print_count AS n FROM templates WHERE id = ?').get(id) as { n: number }).n
    ).toBe(2);
    expect(documentCount(db, 'template', id)).toBe(2);
  });

  it('اسم المواطن يبقى في الكتاب ولو حُذف ملفّه من السجل', () => {
    const db = freshDb();
    const citizen = db
      .prepare("INSERT INTO citizens (full_name, national_id) VALUES ('سالم كريم', '123')")
      .run();
    const citizenId = Number(citizen.lastInsertRowid);
    const result = issueDocument(db, input({ citizenId, citizenName: 'سالم كريم' }));

    db.prepare('DELETE FROM citizens WHERE id = ?').run(citizenId);

    const row = listDocuments(db)[0]!;
    expect(row.citizenName).toBe('سالم كريم');
    expect(getDocument(db, result.id)?.citizenName).toBe('سالم كريم');
  });
});

describe('البصمة', () => {
  it('تتغيّر بتغيّر المتن وتثبت على النصّ نفسه', () => {
    const base = {
      serial: 'م/2026/1',
      gregorianDate: '17 أيلول 2026',
      citizenName: 'أحمد',
      destination: 'مصرف'
    };
    const a = fingerprint({ ...base, bodyHtml: 'نؤيد لكم' });
    const b = fingerprint({ ...base, bodyHtml: 'نؤيد لكم' });
    const c = fingerprint({ ...base, bodyHtml: 'نؤيد لكمْ' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('كتابان بالمتن نفسه يختلفان لاختلاف رقم الصادر', () => {
    const db = freshDb();
    const one = issueDocument(db, input());
    const two = issueDocument(db, input());
    expect(one.sha256).not.toBe(two.sha256);
  });

  it('تُحسب على النصّ لا على العلامات — تغيّر صنف لا يكسر التوثيق', () => {
    const plain = htmlToText('<div class="a"><b>نؤيد</b> لكم</div>');
    const styled = htmlToText('<div class="b" style="color:red"><span>نؤيد</span> لكم</div>');
    expect(plain).toBe(styled);
  });
});

describe('إعادة الطباعة', () => {
  it('تُقيَّد ولا تُنشئ رقمًا جديدًا', () => {
    const db = freshDb();
    const result = issueDocument(db, input({ copies: 1 }));
    recordReprint(db, result.id, { copies: 2, printer: 'HP', operator: 'مشغّل 01' });

    expect(peekSerial(db, 'م', 2026)).toBe('م/2026/2'); // رقم واحد استُهلك فقط
    expect(getDocument(db, result.id)?.printedCopies).toBe(3);
    const reasons = (
      db
        .prepare('SELECT reason FROM document_prints WHERE document_id = ? ORDER BY id')
        .all(result.id) as { reason: string }[]
    ).map((r) => r.reason);
    expect(reasons).toEqual(['إصدار أول', 'إعادة طباعة طبق الأصل']);
  });
});

describe('البحث في السجل', () => {
  it('متساهل مع الهمزة، ويجد بالرقم الوطني وبرقم الصادر وبكلمة من المتن', () => {
    const db = freshDb();
    issueDocument(db, input({ citizenName: 'أحمد عبد الله الجبوري' }));
    issueDocument(
      db,
      input({
        citizenName: 'مصطفى صالح',
        nationalId: '200055556666',
        // متن مستقلّ: وإلا وجد البحثُ الاسمَ الأول في متن الكتاب الثاني.
        sheetHtml: SHEET.replace('أحمد عبد الله', 'مصطفى صالح')
      })
    );

    expect(listDocuments(db, { query: 'احمد' })).toHaveLength(1);
    expect(listDocuments(db, { query: 'مصطفي' })).toHaveLength(1);
    expect(listDocuments(db, { query: '200055556666' })).toHaveLength(1);
    expect(listDocuments(db, { query: 'م/2026/1' })).toHaveLength(1);
    expect(listDocuments(db, { query: 'الرشيد' })).toHaveLength(2); // الجهة في المتن
    expect(listDocuments(db, { query: 'لا وجود له' })).toHaveLength(0);
  });

  it('يحصر النتائج في حدود المدة', () => {
    const db = freshDb();
    const old = issueDocument(db, input());
    backdate(db, old.id, '2026-01-05');
    issueDocument(db, input());

    expect(listDocuments(db, { from: '2026-01-01', to: '2026-01-31' })).toHaveLength(1);
    expect(listDocuments(db, { from: '2026-01-01' })).toHaveLength(2);
    expect(listDocuments(db, { to: '2026-01-31' })).toHaveLength(1);
  });
});

describe('المؤشرات والتقارير', () => {
  it('تعدّ الكتب والإيراد والمخدومين والنسخ المطبوعة فعلًا', () => {
    const db = freshDb();
    const a = issueDocument(db, input({ citizenName: 'أحمد', fee: 1000, copies: 2 }));
    issueDocument(db, input({ citizenName: 'أحمد', fee: 500 }));
    issueDocument(db, input({ citizenName: 'زينب', fee: 250 }));
    recordReprint(db, a.id, { copies: 4, printer: null, operator: null });

    const stats = periodStats(db);
    expect(stats.issued).toBe(3);
    expect(stats.revenue).toBe(1750);
    expect(stats.citizens).toBe(2); // أحمد مرّتان يُعدّ مرّة
    expect(stats.printedCopies).toBe(2 + 1 + 1 + 4);
    expect(stats.byType[0]).toEqual({
      name: 'تأييد استمرار بالخدمة',
      count: 3,
      revenue: 1750
    });
    expect(stats.byDay).toHaveLength(1);
  });

  it('مؤشرات اليوم تقارن بالأمس وتبقى صامتة بلا رصيد', () => {
    const db = freshDb();
    prepareDocuments(db);
    expect(archiveStats(db)).toEqual({
      issuedToday: 0,
      issuedYesterday: 0,
      revenueToday: 0,
      topTemplate: null
    });

    const tpl = db.prepare("INSERT INTO templates (title, body_html) VALUES ('تأييد سكن', '')").run();
    issueDocument(db, input({ templateId: Number(tpl.lastInsertRowid), fee: 750 }));

    const stats = archiveStats(db);
    expect(stats.issuedToday).toBe(1);
    expect(stats.revenueToday).toBe(750);
    expect(stats.topTemplate).toEqual({ title: 'تأييد سكن', count: 1, share: 1 });
  });

  it('المدة تُقصي ما خرج عنها من التقرير', () => {
    const db = freshDb();
    const old = issueDocument(db, input({ fee: 9000 }));
    backdate(db, old.id, '2025-12-31');
    issueDocument(db, input({ fee: 1000 }));

    const stats = periodStats(db, { from: '2026-01-01' });
    expect(stats.issued).toBe(1);
    expect(stats.revenue).toBe(1000);
    expect(stats.printedCopies).toBe(1);
  });
});
