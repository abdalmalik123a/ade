/**
 * الملخّص الأسبوعي في «التنبيهات» (الموجة ٢): ما خرج من المكتب يُعدّ حين يخرج فعلًا، والأسبوع من السبت، والزبون مرّة.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { prepareClients, saveClient } from '../src/main/services/clients';
import { saveOrder, setOrderStatus } from '../src/main/services/orders';
import { issueDocument, prepareDocuments, voidDocument } from '../src/main/services/documents';
import { markWeekSeen, weekSummary } from '../src/main/services/today';
import { recordWork, workBetween, workOf } from '../src/main/services/workLog';
import { isoDate, weekStart } from '../src/shared/dates';

const NOW = new Date(2026, 9, 7, 10, 0); // الأربعاء ٧ تشرين الأول ٢٠٢٦ — والأسبوع من السبت ٣ تشرين الأول
/** وقتٌ محلّي بصيغة القاعدة (UTC) — كما تكتبه `datetime('now')`. */
const stamp = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

function office() {
  const db = freshDb();
  prepareClients(db);
  prepareDocuments(db);
  return db;
}

function issue(db: ReturnType<typeof office>, name: string, at: Date) {
  const doc = issueDocument(db, {
    sheetHtml: '<p>نؤيد</p>', templateId: null, citizenId: null, authorityId: null, citizenName: name, nationalId: null,
    docType: null, destination: null, purpose: null, values: {}, copies: 1, copyKind: null,
    gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null
  });
  db.prepare('UPDATE documents SET issued_at = ? WHERE id = ?').run(stamp(at), doc.id);
  return doc;
}

describe('أوّل الأسبوع', () => {
  it('السبت — كما في «السجلّ»', () => {
    expect(isoDate(weekStart(NOW))).toBe('2026-10-03');
    expect(isoDate(weekStart(new Date(2026, 9, 3, 0, 5)))).toBe('2026-10-03'); // السبت نفسه
    expect(isoDate(weekStart(new Date(2026, 9, 2, 23, 59)))).toBe('2026-09-26'); // الجمعة من الأسبوع الذي قبله
    expect(isoDate(weekStart(new Date(2026, 9, 4)))).toBe('2026-10-03'); // الأحد
  });
});

describe('ما خرج من نداء قناة إنتاج', () => {
  it('الطباعة: ما أُرسل فعلًا — بنسخه، ومن الدفعة ما أُرسل ولو انقطعت', () => {
    expect(workOf('documents:issue', [{ copies: 2 }, true], { printed: 'ok' })).toEqual({ sheets: 2, files: 0 });
    expect(workOf('documents:issue', [{ copies: 2 }, false], { printed: 'skipped' })).toEqual({ sheets: 0, files: 0 }); // احفظ بلا طباعة
    expect(workOf('documents:issue', [{ copies: 1 }, true], { printed: 'failed' })).toEqual({ sheets: 0, files: 0 });
    expect(workOf('documents:reprint', [[1, 2, 3], 2, null], { printed: 2, failed: 1, voided: 0 })).toEqual({ sheets: 4, files: 0 });
    expect(workOf('documents:printIssued', [{ ids: [1] }], { ok: true, sent: 5, total: 5 })).toEqual({ sheets: 5, files: 0 });
    expect(workOf('output:printJob', [{}], { ok: false, sent: 12, total: 30, reason: 'نفد الورق' })).toEqual({ sheets: 12, files: 0 });
    expect(workOf('output:resumeJob', ['job-1', 12], { ok: true, sent: 30, total: 30 })).toEqual({ sheets: 18, files: 0 });
    expect(workOf('output:print', [{ copies: 4 }], { ok: true })).toEqual({ sheets: 4, files: 0 });
    expect(workOf('output:print', [{ copies: 4 }], { ok: false, reason: 'cancelled' })).toEqual({ sheets: 0, files: 0 });
    expect(workOf('attachments:print', [7, null], true)).toEqual({ sheets: 1, files: 0 });
    expect(workOf('attachments:print', [7, null], false)).toEqual({ sheets: 0, files: 0 });
  });

  it('والملفّات: ما حُفظ — وحوارٌ أُغلق لا شيء', () => {
    expect(workOf('output:savePdf', [{}], 'C:\\كتب\\كتاب.pdf')).toEqual({ sheets: 0, files: 1 });
    expect(workOf('output:saveDocx', [{}], null)).toEqual({ sheets: 0, files: 0 });
    expect(workOf('pdf:save', [new Uint8Array(), 'a.pdf'], 'C:\\a.pdf')).toEqual({ sheets: 0, files: 1 });
    expect(workOf('pdf:saveMany', [[{}, {}, {}]], { folder: 'C:\\out', files: ['1.pdf', '2.pdf', '3.pdf'] })).toEqual({ sheets: 0, files: 3 });
    expect(workOf('pdf:saveImages', [[{}]], null)).toEqual({ sheets: 0, files: 0 });
    // والإصدار وحده لا ورقة ولا ملفّ: الكتاب في السجلّ، وزبونه يُعدّ منه.
    expect(workOf('documents:issueTransaction', [{}], { transactionId: 1 })).toEqual({ sheets: 0, files: 0 });
  });

  it('يُجمع لكلّ يوم — والمدّة من أوّل يومٍ إلى ما قبل آخرها', () => {
    const db = office();
    recordWork(db, '2026-10-02', { sheets: 3, files: 0 });
    recordWork(db, '2026-10-03', { sheets: 2, files: 1 });
    recordWork(db, '2026-10-03', { sheets: 5, files: 0 });
    recordWork(db, '2026-10-03', { sheets: 0, files: 0 });
    expect(workBetween(db, '2026-10-03', '2026-10-10')).toEqual({ sheets: 7, files: 1 });
    expect(workBetween(db, '2026-09-26', '2026-10-03')).toEqual({ sheets: 3, files: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM work_days').get()).toEqual({ n: 3 });
  });
});

describe('الملخّص الأسبوعي', () => {
  it('مكتبٌ لا شيء فيه: أصفار، ولا نقطة على الجرس', () => {
    const w = weekSummary(office(), NOW);
    expect(w).toEqual({
      from: '2026-10-03',
      thisWeek: { customers: 0, sheets: 0, files: 0 },
      lastWeek: { customers: 0, sheets: 0, files: 0 },
      unseen: false
    });
  });

  it('الزبائن من الكتب والطلبات المسلّمة — والاسم مرّةً وإن تكرّر أو اختلف تشكيله، والمُبطَل لا يُعدّ', () => {
    const db = office();
    issue(db, 'سالم حسن', new Date(2026, 9, 4, 9));
    issue(db, 'سالم حسن', new Date(2026, 9, 5, 9));
    issue(db, 'سالِم  حسن', new Date(2026, 9, 6, 9));
    const voided = issue(db, 'كريم علي', new Date(2026, 9, 6, 11));
    voidDocument(db, voided.id, 'خطأ في الاسم', null);
    issue(db, 'زينب كاظم', new Date(2026, 9, 1, 9)); // الأسبوع الماضي

    const school = saveClient(db, { id: null, name: 'مدرسة النور', kind: 'مدرسة' });
    const a = saveOrder(db, { id: null, clientId: school.id, customer: '', title: 'هويّات', dueDate: null });
    setOrderStatus(db, a.id, 'delivered');
    const b = saveOrder(db, { id: null, clientId: null, customer: 'سالم حسن', title: 'صور', dueDate: null });
    setOrderStatus(db, b.id, 'delivered');
    db.prepare('UPDATE orders SET delivered_at = ?').run(stamp(new Date(2026, 9, 5, 13)));
    // والطلب الذي لم يُسلَّم بعد لا يُعدّ
    saveOrder(db, { id: null, clientId: null, customer: 'حسين', title: 'ملصق', dueDate: null });

    const w = weekSummary(db, NOW);
    expect(w.thisWeek.customers).toBe(2); // سالم حسن، ومدرسة النور
    expect(w.lastWeek.customers).toBe(1); // زينب
  });

  it('الأوراق والملفّات من عدّاد اليوم، والأسبوع الماضي للمقارنة', () => {
    const db = office();
    recordWork(db, '2026-10-02', { sheets: 30, files: 2 }); // الجمعة
    recordWork(db, '2026-10-03', { sheets: 12, files: 1 }); // السبت
    recordWork(db, '2026-10-07', { sheets: 4, files: 0 });
    const w = weekSummary(db, NOW);
    expect(w.thisWeek).toEqual({ customers: 0, sheets: 16, files: 1 });
    expect(w.lastWeek).toEqual({ customers: 0, sheets: 30, files: 2 });
  });

  it('نقطةٌ على الجرس حين يبدأ أسبوعٌ وفي الذي قبله عمل — حتى يُفتح، ثم في الأسبوع القادم', () => {
    const db = office();
    recordWork(db, '2026-10-01', { sheets: 5, files: 0 });
    expect(weekSummary(db, NOW).unseen).toBe(true);
    markWeekSeen(db, NOW);
    expect(weekSummary(db, NOW).unseen).toBe(false);
    expect(weekSummary(db, new Date(2026, 9, 9, 18)).unseen).toBe(false); // الجمعة من الأسبوع نفسه
    // الأسبوع القادم: هذا الأسبوع صار «الماضي» — وفيه عمل؟
    expect(weekSummary(db, new Date(2026, 9, 10, 9)).unseen).toBe(false); // لا عمل في أسبوع ٣ تشرين الأول
    recordWork(db, '2026-10-06', { sheets: 1, files: 0 });
    expect(weekSummary(db, new Date(2026, 9, 10, 9)).unseen).toBe(true);
  });
});
