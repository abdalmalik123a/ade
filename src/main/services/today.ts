/**
 * «التنبيهات» في الشريط العلوي (د٧ — وكانت نافذةً عند الإقلاع كلّ صباح، فصارت جرسًا برقمه بقرار المالك ٦ تشرين الأول:
 * لا يُقاطَع الموظف، والجرس يدلّه).
 *
 * ما موعده اليوم من الطلبات وما تأخّر، وما جهز ينتظر صاحبه، ومسوداتٌ لم تصدر ومعاملاتٌ عُلّقت، وطباعةٌ انقطعت أمس،
 * ونسخةٌ احتياطية طال عهدها، وملخّص الأسبوع. كلّها من القاعدة ولا شيء يُخمَّن.
 */
import type { Database } from 'better-sqlite3';
import type { TodayAgenda, WeekSummary, WorkCounts } from '@shared/api';
import { isOrderOverdue, type Order } from '@shared/orders';
import { normalizeFold } from '@shared/arabic';
import { BACKUP_REMIND_DAYS, daysSince, isoDate, weekStart, localToday } from '@shared/dates';
import { listOrders } from './orders';
import { listDrafts } from './templates';
import { workBetween } from './workLog';

/** المعاملات المعلّقة في الشبّاك — مخزونةٌ في الإعدادات، وما فسد منها لا شيء. */
export function parkedCount(db: Database): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'parkedTransactions'").get() as { value: string } | undefined;
  try {
    const list = JSON.parse(row?.value ?? '[]') as unknown;
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** بداية يومٍ محلّي بصيغة أوقات القاعدة (UTC) — فيُقارَن بالفهرس، لا بدالّةٍ على كلّ صفّ في أرشيفٍ كبير. */
const dbStamp = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** الزبائن في مدّة: أسماء الكتب الصادرة (لا المُبطَلة) والطلبات المسلّمة — والاسم الواحد مرّة وإن تكرّر. */
function customersBetween(db: Database, from: Date, to: Date): number {
  const names = new Set<string>();
  const add = (rows: unknown[]) => {
    for (const r of rows as { name: string | null }[]) {
      const key = normalizeFold(r.name ?? '');
      if (key) names.add(key);
    }
  };
  add(db.prepare("SELECT citizen_name AS name FROM documents WHERE status != 'void' AND issued_at >= ? AND issued_at < ?").all(dbStamp(from), dbStamp(to)));
  add(
    db
      .prepare(
        `SELECT COALESCE(a.name, o.customer) AS name FROM orders o LEFT JOIN authorities a ON a.id = o.authority_id
         WHERE o.status = 'delivered' AND o.delivered_at >= ? AND o.delivered_at < ?`
      )
      .all(dbStamp(from), dbStamp(to))
  );
  return names.size;
}

const countsBetween = (db: Database, from: Date, to: Date): WorkCounts => ({
  customers: customersBetween(db, from, to),
  ...workBetween(db, isoDate(from), isoDate(to))
});

/**
 * الملخّص الأسبوعي (الموجة ٢): هذا الأسبوع من السبت، والذي قبله للمقارنة. ونقطةٌ على الجرس حين يبدأ أسبوعٌ وفي الذي قبله
 * عمل، حتى يُفتح الجرس فيه (`markWeekSeen`) — فمكتبٌ جديدٌ لا شيء عنده لا يُدعى إلى ملخّصٍ فارغ.
 */
export function weekSummary(db: Database, now: Date = new Date()): WeekSummary {
  const start = weekStart(now);
  const lastWeek = countsBetween(db, addDays(start, -7), start);
  const from = isoDate(start);
  const seen = (db.prepare("SELECT value FROM settings WHERE key = 'weekSeen'").get() as { value: string } | undefined)?.value;
  return {
    from,
    thisWeek: countsBetween(db, start, addDays(start, 7)),
    lastWeek,
    unseen: lastWeek.customers + lastWeek.sheets + lastWeek.files > 0 && seen !== from
  };
}

/** فُتح الجرس: رُئي ملخّص هذا الأسبوع. */
export function markWeekSeen(db: Database, now: Date = new Date()): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('weekSeen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(isoDate(weekStart(now)));
}

export function todayAgenda(
  db: Database,
  pendingPrints: { id: string; label: string; sent: number; total: number }[],
  now: Date = new Date(),
  /** النسخة التلقائية: حالها في ملفٍّ بجانب القاعدة لا فيها (ipc/backup.ts). */
  auto: { lastAt: string | null; lastError: string | null } = { lastAt: null, lastError: null }
): TodayAgenda {
  const today = localToday(now);
  const open = listOrders(db, { status: 'open' });
  const byDue = (a: Order, b: Order) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  const overdue = open.filter((o) => isOrderOverdue(o, today)).sort(byDue);
  const dueToday = open.filter((o) => o.status !== 'ready' && o.dueDate === today);
  const ready = open.filter((o) => o.status === 'ready');

  const documents = (db.prepare('SELECT COUNT(*) AS n FROM documents').get() as { n: number }).n;
  const last = db.prepare("SELECT value FROM settings WHERE key = 'lastBackupAt'").get() as { value: string } | undefined;
  const manual = last?.value ?? null;
  const lastBackupAt = auto.lastAt && (!manual || auto.lastAt > manual) ? auto.lastAt : manual;
  // لا يُذكَّر بنسخةٍ مكتبٌ لا شيء فيه بعد — ولا من أخذ نسخته هذا الأسبوع.
  const backupDue = documents > 0 && (!lastBackupAt || daysSince(lastBackupAt, now) >= BACKUP_REMIND_DAYS);

  const pick = (o: Order) => ({ id: o.id, customer: o.customer, title: o.title, dueDate: o.dueDate, phone: o.phone });
  return {
    overdue: overdue.map(pick),
    dueToday: dueToday.map(pick),
    ready: ready.map(pick),
    drafts: listDrafts(db).length,
    parked: parkedCount(db),
    pendingPrints: pendingPrints.map((p) => ({ id: p.id, label: p.label, sent: p.sent, total: p.total })),
    lastBackupAt,
    backupDue,
    autoBackupError: auto.lastError,
    week: weekSummary(db, now)
  };
}
