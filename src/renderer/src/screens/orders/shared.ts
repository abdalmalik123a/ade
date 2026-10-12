/**
 * ما تشترك فيه شاشة الطلبات ونافذة الطلب (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو.
 */
import { localToday } from '@shared/dates';

/** ما يُطلب عادةً — يُختار بضغطة ثم يُكمَّل: «هويّات طلاب» ← «هويّات طلاب الصفّ الخامس». */
export const COMMON = ['هويّات طلاب', 'هويّات موظفين', 'شهادات شكر وتقدير', 'بطاقات امتحانية', 'ملصقات دفاتر', 'أسئلة امتحان', 'بطاقات دعوة', 'كتاب رسمي'];

export function addDays(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localToday(d);
}
