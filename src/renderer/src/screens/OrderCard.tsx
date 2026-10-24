/** بطاقة الطلب في «قيد العمل» ولون موعده — نُقلا من `OrdersScreen.tsx` (سقف حجمه). */
import { dueLabel, statusOf, type Order, type OrderStatus } from '@shared/orders';
import { toIndic } from '@shared/arabic';

export const TONE: Record<string, string> = {
  late: 'bg-error text-on-error',
  today: 'bg-tertiary-fixed text-on-tertiary-fixed',
  soon: 'bg-secondary-fixed text-on-secondary-fixed',
  later: 'bg-surface-container-high text-on-surface-variant',
  none: 'bg-surface-container-high text-on-surface-variant'
};

export default function OrderCard({
  order,
  today,
  onEdit,
  onMove,
  onOpenDesign,
  onCopyReady,
  onReceipt
}: {
  order: Order;
  today: string;
  onEdit: () => void;
  onMove: (s: OrderStatus) => void;
  onOpenDesign: () => void;
  /** رسالة «طلبكم جاهز» تُنسخ ليلصقها الموظف في واتساب الزبون — لا تُرسل من البرنامج. */
  onCopyReady: () => void;
  /** وصل الاستلام — لمكتبٍ شغّله من الإعدادات. */
  onReceipt?: () => void;
}) {
  const due = dueLabel(order.dueDate, today, order.status);
  const info = statusOf(order.status);
  return (
    <article
      className={`rounded-card bg-surface-container-lowest border border-outline-variant p-space-sm space-y-space-xs shadow-soft ${due.tone === 'late' ? 'ring-2 ring-error/60' : ''}`}
      data-order={order.id}
      data-status={order.status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0 font-label-sm text-label-sm text-on-surface-variant">
          {order.clientLogo ? (
            <img alt="" className="w-5 h-5 object-contain rounded bg-white" src={`diwan://store/${order.clientLogo}`} />
          ) : (
            <span className="material-symbols-outlined text-[16px]">{order.clientId ? 'domain' : 'person'}</span>
          )}
          <span className="truncate">{order.customer}</span>
        </span>
        <span className={`shrink-0 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${TONE[due.tone]}`} data-due={due.tone}>
          {due.text}
        </span>
      </div>
      <button className="block w-full text-right font-body-md text-body-md text-on-surface font-semibold hover:underline" type="button" onClick={onEdit}>
        {order.title}
      </button>
      <div className="flex flex-wrap items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
        {order.quantity && <span className="tabular">العدد {toIndic(order.quantity)}</span>}
        {order.batchText && <span>· القائمة مرفقة</span>}
        {order.phone && <span className="tabular">· {order.phone}</span>}
      </div>
      {order.notes && <p className="font-label-sm text-label-sm text-on-surface-variant line-clamp-2">{order.notes}</p>}
      <div className="flex items-center gap-1 pt-1">
        {info.next && (
          <button
            className="flex-1 h-8 btn-act font-label-md text-label-md font-semibold"
            data-act="advance"
            type="button"
            onClick={() => onMove(info.next!)}
          >
            {info.verb}
          </button>
        )}
        {(order.templateId || order.clientId) && (
          <button
            className="h-8 px-2 rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
            data-act="open-design"
            title={`${order.templateId ? `افتح «${order.templateTitle ?? 'التصميم'}»` : `صمّم لـ«${order.customer}» من المعرض`}${order.batchText ? ' وقائمته في الدفعة' : ''} — وملفّ الجهة يملأ حقوله`}
            type="button"
            onClick={onOpenDesign}
          >
            <span className="material-symbols-outlined text-[16px]">draw</span>
            {order.templateId ? 'التصميم' : 'صمّم'}
          </button>
        )}
        {order.status === 'ready' && (
          <button
            className="h-8 px-2 rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-sm text-label-sm flex items-center gap-1"
            data-act="copy-ready"
            title="انسخ رسالةً للزبون: طلبكم جاهز — والصقها في محادثته"
            type="button"
            onClick={onCopyReady}
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            انسخ رسالة: طلبكم جاهز
          </button>
        )}
        {onReceipt && (
          <button
            className="h-8 w-8 rounded-btn hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center"
            data-act="print-receipt"
            title="اطبع وصل الاستلام — نسختان: للزبون وللمكتب"
            type="button"
            onClick={onReceipt}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          </button>
        )}
        {order.status !== 'waiting' && order.status !== 'ready' && (
          // فعلٌ لا حال (البند ١٩): كانت ساعةً رملية وحدها فلا يُعرف أتقول «ينتظر» أم تنقله — وكلمتها تقابل «وصل ما ينقص».
          <button
            className="h-8 px-2 rounded-btn hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1 whitespace-nowrap"
            data-act="wait"
            title="انقله إلى «ينتظر الزبون» — تنقص صورٌ أو قائمة أو تأكيد"
            type="button"
            onClick={() => onMove('waiting')}
          >
            <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
            ينقصه شيء
          </button>
        )}
      </div>
    </article>
  );
}
