/** صفوف الطلبات في ملف الشخص والجهة؛ الحالات والمواعيد من تعريفها المشترك. */
import { dueLabel, statusOf, type Order } from '@shared/orders';

export default function OrderList({ orders, today }: { orders: Order[]; today: string }) {
  return (
        <ul className="rounded-card bg-surface-container-low divide-y divide-outline-variant/50">
          {orders.map((o) => (
            <li key={o.id} data-order-id={o.id} className="px-space-md py-space-sm flex items-center justify-between gap-space-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold">{o.title}</span>
              <span className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
                {o.status !== 'delivered' && o.status !== 'cancelled' && <span>{dueLabel(o.dueDate, today, o.status).text}</span>}
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high">{statusOf(o.status).label}</span>
              </span>
            </li>
          ))}
        </ul>
  );
}
