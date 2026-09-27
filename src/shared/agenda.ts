/**
 * أفي «ما ينتظرك اليوم» ما يُقال؟ — وإلا فلا لوحة: المكتب يبدأ عمله بلا حاجز (د٧).
 *
 * والطباعة المنقطعة لا تُعدّ هنا: لها حوارها عند الإقلاع («أتستأنف؟»)، فلا تُقال مرّتين.
 */
import type { TodayAgenda } from './api';

export function agendaHasItems(a: TodayAgenda): boolean {
  return a.overdue.length + a.dueToday.length + a.ready.length + a.drafts > 0 || a.backupDue;
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
