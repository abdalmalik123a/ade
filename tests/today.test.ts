/**
 * «ما ينتظرك اليوم» (د٧)، ورسالة «طلبكم جاهز» (د٨).
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { prepareClients } from '../src/main/services/clients';
import { saveOrder, setOrderStatus } from '../src/main/services/orders';
import { issueDocument, prepareDocuments } from '../src/main/services/documents';
import { saveDraft } from '../src/main/services/templates';
import { todayAgenda } from '../src/main/services/today';
import { agendaHasItems, readyMessage } from '../src/shared/agenda';
import { daysSince, sinceText } from '../src/shared/dates';

const NOW = new Date(2026, 8, 27, 9, 0); // ٢٧ أيلول ٢٠٢٦ صباحًا

function office() {
  const db = freshDb();
  prepareClients(db);
  prepareDocuments(db);
  return db;
}

describe('ما ينتظرك اليوم', () => {
  it('مكتبٌ لا شيء فيه: لا لوحة', () => {
    const a = todayAgenda(office(), [], NOW);
    expect(a).toMatchObject({ overdue: [], dueToday: [], ready: [], drafts: 0, backupDue: false });
    expect(agendaHasItems(a)).toBe(false);
  });

  it('المتأخّر أوّلًا بموعده، وما موعده اليوم، وما جهز', () => {
    const db = office();
    saveOrder(db, { id: null, clientId: null, customer: 'مدرسة النور', title: 'هويّات', dueDate: '2026-09-25' });
    saveOrder(db, { id: null, clientId: null, customer: 'أبو علي', title: 'شهادات', dueDate: '2026-09-20' });
    saveOrder(db, { id: null, clientId: null, customer: 'زينب', title: 'صور', dueDate: '2026-09-27' });
    const r = saveOrder(db, { id: null, clientId: null, customer: 'حسن', title: 'ملصق', dueDate: '2026-09-26', phone: '0770' });
    setOrderStatus(db, r.id, 'ready');
    const d = saveOrder(db, { id: null, clientId: null, customer: 'سجاد', title: 'دعوات', dueDate: '2026-09-01' });
    setOrderStatus(db, d.id, 'delivered');

    const a = todayAgenda(db, [], NOW);
    expect(a.overdue.map((o) => o.title)).toEqual(['شهادات', 'هويّات']);
    expect(a.dueToday.map((o) => o.title)).toEqual(['صور']);
    // الجاهز ليس «متأخّرًا» ولو فات موعده: هو ينتظر صاحبه لا المكتب
    expect(a.ready).toEqual([{ id: r.id, customer: 'حسن', title: 'ملصق', dueDate: '2026-09-26', phone: '0770' }]);
    expect(agendaHasItems(a)).toBe(true);
  });

  it('والمسودات، والنسخة الاحتياطية إن طال عهدها وفي الأرشيف كتب', () => {
    const db = office();
    saveDraft(db, { id: null, templateId: null, citizenId: null, title: 'كتاب', values: {}, bodyHtml: '<p>x</p>' });
    expect(todayAgenda(db, [], NOW).drafts).toBe(1);
    expect(todayAgenda(db, [], NOW).backupDue).toBe(false); // لا كتب بعد

    issueDocument(db, {
      sheetHtml: '<p>نؤيد</p>', templateId: null, citizenId: null, authorityId: null, citizenName: 'أحمد', nationalId: null,
      docType: null, destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
      gregorianDate: '27 أيلول 2026', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null
    });
    expect(todayAgenda(db, [], NOW).backupDue).toBe(true); // لم تُؤخذ قطّ
    const set = (iso: string) =>
      db.prepare("INSERT INTO settings (key, value) VALUES ('lastBackupAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(iso);
    set(new Date(2026, 8, 24).toISOString());
    expect(todayAgenda(db, [], NOW).backupDue).toBe(false); // قبل ثلاثة أيام
    set(new Date(2026, 8, 18).toISOString());
    expect(todayAgenda(db, [], NOW).backupDue).toBe(true); // قبل تسعة
  });

  it('والطباعة المنقطعة لها حوارها — لا تفتح اللوحة وحدها', () => {
    const a = todayAgenda(office(), [{ id: 'job-1', label: 'شهادات', sent: 12, total: 30 }], NOW);
    expect(a.pendingPrints).toHaveLength(1);
    expect(agendaHasItems(a)).toBe(false);
  });
});

describe('منذ متى', () => {
  it('بالتقويم لا بالساعات', () => {
    expect(daysSince(new Date(2026, 8, 26, 23, 50).toISOString(), NOW)).toBe(1);
    expect(sinceText(null, NOW)).toBe('لم يحدث بعد');
    expect(sinceText(new Date(2026, 8, 27, 7).toISOString(), NOW)).toBe('اليوم');
    expect(sinceText(new Date(2026, 8, 26).toISOString(), NOW)).toBe('أمس');
    expect(sinceText(new Date(2026, 8, 25).toISOString(), NOW)).toBe('منذ يومين');
    expect(sinceText(new Date(2026, 8, 22).toISOString(), NOW)).toBe('منذ 5 أيام');
    expect(sinceText(new Date(2026, 7, 1).toISOString(), NOW)).toBe('منذ 57 يومًا');
  });
});

describe('رسالة «طلبكم جاهز»', () => {
  it('باسم الزبون والطلب والمكتب — تُنسخ ولا تُرسل', () => {
    expect(readyMessage({ customer: 'مدرسة النور', title: 'هويّات الطلبة' }, 'مكتب الرافدين')).toBe(
      'السلام عليكم مدرسة النور، طلبكم «هويّات الطلبة» جاهز للتسليم في مكتب الرافدين. نتشرّف بزيارتكم.'
    );
    expect(readyMessage({ customer: '', title: 'صور' }, '')).toBe('السلام عليكم طلبكم «صور» جاهز للتسليم. نتشرّف بزيارتكم.');
  });
});
