import type { TodayAgenda } from './api';

/**
 * رقم «التنبيهات» في الشريط العلوي: ما ينتظر عملًا — الطلبات المتأخّرة وما موعده اليوم وما جهز، والنسخة الاحتياطية إن
 * طال عهدها أو لم تُؤخذ التلقائية. والمسودات والمعلّقات تُعرض فيها ولا تُعدّ: عملٌ جارٍ لا تذكيرٌ يُلحّ — وإلا بقي الرقم
 * قائمًا أبدًا فلا يُنظر إليه.
 */
export function agendaCount(a: TodayAgenda | null): number {
  if (!a) return 0;
  return a.overdue.length + a.dueToday.length + a.ready.length + (a.backupDue ? 1 : 0) + (a.autoBackupError ? 1 : 0);
}

/**
 * «طلبكم جاهز» — رسالةٌ تُنسخ فيلصقها الموظف في واتساب الزبون (د٨). ولا تُرسل من
 * البرنامج: لا شبكة فيه (المبدأ ٣)، والرسالة بيد الموظف يراجعها قبل أن يرسلها.
 */
export function readyMessage(order: { customer: string; title: string }, officeName: string): string {
  const who = order.customer.trim() ? `${order.customer.trim()}، ` : '';
  const office = officeName.trim() ? ` في ${officeName.trim()}` : '';
  return `السلام عليكم ${who}طلبكم «${order.title.trim()}» جاهز للتسليم${office}. نتشرّف بزيارتكم.`;
}
