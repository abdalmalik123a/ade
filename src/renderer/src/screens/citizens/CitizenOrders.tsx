/** طلبات الشخص المرتبطة بمعرّفه، مع إهمال الرد بعد الانتقال إلى ملف آخر. */
import { useEffect, useState } from 'react';
import type { Order } from '@shared/orders';
import { localToday } from '@shared/dates';
import OrderList from '../../components/OrderList';
import { errorText } from '../../lib/errors';

export default function CitizenOrders({ citizenId }: { citizenId: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void window.diwan.orders.list({ citizenId }).then(
      (rows) => { if (active) setOrders(rows); },
      (e) => { if (active) setError(errorText(e, 'تعذّر عرض الطلبات')); }
    );
    return () => { active = false; };
  }, [citizenId, attempt]);
  return (
    <div className="space-y-space-sm" data-citizen-orders={citizenId}>
      <h4 className="font-body-md text-body-md text-on-surface font-semibold">
        طلباته {orders && orders.length > 0 && <span className="text-on-surface-variant font-normal">({orders.length})</span>}
      </h4>
      {error ? (
        <div role="alert" className="font-label-md text-label-md text-error flex items-center gap-space-sm">
          <span>{error}</span>
          <button type="button" className="px-space-sm h-8 rounded-btn bg-surface-container-high text-on-surface"
            onClick={() => { setError(null); setOrders(null); setAttempt((n) => n + 1); }}>
            حاول ثانيةً
          </button>
        </div>
      ) : orders === null ? (
        <p role="status" className="font-label-md text-label-md text-on-surface-variant">جارٍ عرض الطلبات…</p>
      ) : orders.length === 0 ? (
        <p className="font-label-md text-label-md text-on-surface-variant">لا طلبات مرتبطة بهذا الملف — تُسجَّل من شاشة «الطلبات» باختيار الزبون من السجلّ.</p>
      ) : <OrderList orders={orders} today={localToday()} />}
    </div>
  );
}
