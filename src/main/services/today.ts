/**
 * «ما ينتظرك اليوم» عند الإقلاع (د٧).
 *
 * صاحب المكتب يفتح البرنامج صباحًا: ما موعده اليوم من الطلبات وما تأخّر، وما جهز
 * ينتظر صاحبه، ومسوداتٌ لم تصدر، وطباعةٌ انقطعت أمس، ونسخةٌ احتياطية طال عهدها.
 * كلّها من القاعدة ولا شيء يُخمَّن — وما لا شيء فيه لا يُعرض.
 */
import type { Database } from 'better-sqlite3';
import type { TodayAgenda } from '@shared/api';
import type { Order } from '@shared/orders';
import { BACKUP_REMIND_DAYS, daysSince } from '@shared/dates';
import { listOrders } from './orders';
import { listDrafts } from './templates';

const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function todayAgenda(
  db: Database,
  pendingPrints: { id: string; label: string; sent: number; total: number }[],
  now: Date = new Date()
): TodayAgenda {
  const today = localToday(now);
  const open = listOrders(db, { status: 'open' });
  const byDue = (a: Order, b: Order) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  const overdue = open.filter((o) => o.status !== 'ready' && o.dueDate && o.dueDate < today).sort(byDue);
  const dueToday = open.filter((o) => o.status !== 'ready' && o.dueDate === today);
  const ready = open.filter((o) => o.status === 'ready');

  const documents = (db.prepare('SELECT COUNT(*) AS n FROM documents').get() as { n: number }).n;
  const last = db.prepare("SELECT value FROM settings WHERE key = 'lastBackupAt'").get() as { value: string } | undefined;
  const lastBackupAt = last?.value ?? null;
  // لا يُذكَّر بنسخةٍ مكتبٌ لا شيء فيه بعد — ولا من أخذ نسخته هذا الأسبوع.
  const backupDue = documents > 0 && (!lastBackupAt || daysSince(lastBackupAt, now) >= BACKUP_REMIND_DAYS);

  const pick = (o: Order) => ({ id: o.id, customer: o.customer, title: o.title, dueDate: o.dueDate, phone: o.phone });
  return {
    overdue: overdue.map(pick),
    dueToday: dueToday.map(pick),
    ready: ready.map(pick),
    drafts: listDrafts(db).length,
    pendingPrints: pendingPrints.map((p) => ({ id: p.id, label: p.label, sent: p.sent, total: p.total })),
    lastBackupAt,
    backupDue
  };
}
