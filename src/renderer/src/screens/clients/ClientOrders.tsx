/**
 * طلبات الجهة: ما سُجّل لها وحال كلٍّ منها وموعده (تقسيم شاشة الجهات بعد ١٫٧٫٠) — منقولٌ من `ClientsScreen` كما هو.
 */
import { type Order, type Client } from '@shared/orders';
import OrderList from '../../components/OrderList';

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
        <OrderList orders={orders} today={today} />
      )}
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        ترويساتها: {current.letterheads || 'لا شيء بعد'}
      </p>
    </div>
  );
}
