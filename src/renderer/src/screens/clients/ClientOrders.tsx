/**
 * طلبات الجهة: ما سُجّل لها وحال كلٍّ منها وموعده (تقسيم شاشة الجهات بعد ١٫٧٫٠) — منقولٌ من `ClientsScreen` كما هو.
 */
import { dueLabel, statusOf, type Order, type Client } from '@shared/orders';

type Props = {
  orders: Order[];
  today: string;
  current: Client;
};

export default function ClientOrders({ orders, today, current }: Props) {
  return (
    <div className="space-y-space-sm">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">
        طلباتها {orders.length > 0 && <span className="text-on-surface-variant font-normal">({orders.length})</span>}
      </h2>
      {orders.length === 0 ? (
        <p className="font-label-md text-label-md text-on-surface-variant">لا طلبات لها بعد — تُسجَّل من شاشة «الطلبات».</p>
      ) : (
        <ul className="rounded-xl bg-surface-container-low divide-y divide-outline-variant/50">
          {orders.map((o) => (
            <li key={o.id} className="px-space-md py-space-sm flex items-center justify-between gap-space-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold">{o.title}</span>
              <span className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
                {o.status !== 'delivered' && o.status !== 'cancelled' && <span>{dueLabel(o.dueDate, today, o.status).text}</span>}
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high">{statusOf(o.status).label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        ترويساتها: {current.letterheads || 'لا شيء بعد'}
      </p>
    </div>
  );
}
