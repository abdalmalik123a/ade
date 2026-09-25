import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import { isOrderStatus, localToday, type Order, type OrderCounts, type OrderInput, type OrderStatus } from '@shared/orders';
import { prepareClients } from './clients';

/**
 * الطلبات — ما يُطلب اليوم ويُسلَّم لاحقًا، بحالته وموعده.
 *
 * بلا مبالغ عمدًا (قرار المالك). والقائمة تُحفظ مع الطلب كما أُلصقت، فيُطبع منها
 * التصميم دفعةً ولو بعد أيام — ولا يُعاد طلبها من المدرسة.
 */

type Row = {
  id: number;
  authority_id: number | null;
  client_name: string | null;
  client_logo: string | null;
  customer: string | null;
  phone: string | null;
  client_phone: string | null;
  title: string;
  quantity: number | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  template_id: number | null;
  template_title: string | null;
  batch_text: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
};

const SELECT = `
  SELECT o.*, a.name AS client_name, a.phone AS client_phone, t.title AS template_title,
    (SELECT s.image_path FROM seals s WHERE s.authority_id = o.authority_id AND s.kind = 'شعار'
      AND s.image_path IS NOT NULL ORDER BY s.id DESC LIMIT 1) AS client_logo
  FROM orders o
  LEFT JOIN authorities a ON a.id = o.authority_id
  LEFT JOIN templates t ON t.id = o.template_id`;

function toOrder(r: Row): Order {
  return {
    id: r.id,
    clientId: r.authority_id,
    customer: r.client_name ?? r.customer ?? 'زبون',
    clientLogo: r.client_logo,
    phone: r.phone ?? r.client_phone,
    title: r.title,
    quantity: r.quantity,
    dueDate: r.due_date,
    status: isOrderStatus(r.status) ? r.status : 'new',
    notes: r.notes,
    templateId: r.template_id,
    templateTitle: r.template_title,
    batchText: r.batch_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deliveredAt: r.delivered_at
  };
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export type OrderFilter = { status?: 'open' | OrderStatus; clientId?: number; query?: string };

/**
 * المفتوحة بموعدها الأقرب أولًا — والمتأخّر فوق الكل، وما لا موعد له في آخرها.
 * والمسلَّمة الأحدثُ تسليمًا أولًا.
 */
export function listOrders(db: Database, filter: OrderFilter = {}): Order[] {
  prepareClients(db);
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.status === 'open') where.push(`o.status IN ('new','waiting','working','ready')`);
  else if (filter.status) {
    where.push('o.status = ?');
    args.push(filter.status);
  }
  if (filter.clientId) {
    where.push('o.authority_id = ?');
    args.push(filter.clientId);
  }
  const order =
    filter.status === 'delivered' || filter.status === 'cancelled'
      ? 'ORDER BY COALESCE(o.delivered_at, o.updated_at) DESC'
      : 'ORDER BY o.due_date IS NULL, o.due_date, o.id';
  const rows = db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${order}`).all(...args) as Row[];
  const q = normalizeFold((filter.query ?? '').trim());
  const out = rows.map(toOrder);
  return q ? out.filter((o) => normalizeFold(`${o.title} ${o.customer} ${o.notes ?? ''}`).includes(q)) : out;
}

export function getOrder(db: Database, id: number): Order | null {
  const row = db.prepare(`${SELECT} WHERE o.id = ?`).get(id) as Row | undefined;
  return row ? toOrder(row) : null;
}

export function saveOrder(db: Database, input: OrderInput): Order {
  prepareClients(db);
  const title = input.title.trim();
  if (!title) throw new Error('اكتب ما طُلب — مثال: ٤٠٠ هويّة للصفّ الخامس');
  if (!input.clientId && !clean(input.customer)) throw new Error('لمن الطلب؟ اختر جهةً أو اكتب اسم الزبون');
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error('موعد التسليم غير مفهوم');
  const quantity = input.quantity && input.quantity > 0 ? Math.round(input.quantity) : null;
  const status: OrderStatus = input.status && isOrderStatus(input.status) ? input.status : 'new';

  const values = [
    input.clientId ?? null,
    input.clientId ? null : clean(input.customer),
    clean(input.phone),
    title,
    quantity,
    input.dueDate || null,
    clean(input.notes),
    input.templateId ?? null,
    clean(input.batchText)
  ];
  if (input.id) {
    db.prepare(
      `UPDATE orders SET authority_id = ?, customer = ?, phone = ?, title = ?, quantity = ?, due_date = ?,
         notes = ?, template_id = ?, batch_text = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(...values, input.id);
    if (input.status) setOrderStatus(db, input.id, status);
    return getOrder(db, input.id)!;
  }
  const id = Number(
    db
      .prepare(
        `INSERT INTO orders (authority_id, customer, phone, title, quantity, due_date, notes, template_id, batch_text, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values, status).lastInsertRowid
  );
  return getOrder(db, id)!;
}

/** نقل الحالة — والتسليم يُختم بوقته، والرجوع عنه يمحو الختم. */
export function setOrderStatus(db: Database, id: number, status: OrderStatus): Order {
  if (!isOrderStatus(status)) throw new Error('حالةٌ غير معروفة');
  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now'),
       delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, datetime('now')) ELSE NULL END
     WHERE id = ?`
  ).run(status, status, id);
  const order = getOrder(db, id);
  if (!order) throw new Error('الطلب غير موجود');
  return order;
}

export function deleteOrder(db: Database, id: number): void {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

/** ما يُعرض على الشريط: المفتوح، وما موعده اليوم، والمتأخّر. */
export function orderCounts(db: Database, today = localToday()): OrderCounts {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS open,
         SUM(CASE WHEN due_date = ? THEN 1 ELSE 0 END) AS dueToday,
         SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END) AS overdue
       FROM orders WHERE status IN ('new','waiting','working','ready')`
    )
    .get(today, today) as { open: number; dueToday: number | null; overdue: number | null };
  return { open: r.open, dueToday: r.dueToday ?? 0, overdue: r.overdue ?? 0 };
}
