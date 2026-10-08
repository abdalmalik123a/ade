/**
 * قيد العمل (خطّة الترقية، المرحلة ٣ — ن١٤): ما لم يكتمل في مكانٍ واحد، بثلاثة أعمدةٍ بالخطوة
 * التالية — «عليك أن تكمله» و«ينتظر الزبون» و«جاهز للتسليم» — ولكلّ بطاقةٍ زرٌّ واحد. ويمتلئ وحده:
 * مسودة كتابٍ لم يُطبع، ومعاملةٌ عُلّقت في الشبّاك (أو تُركت حين أُغلق البرنامج)، وطلبٌ يُسلَّم لاحقًا.
 * وكانت ثلاث قوائم لشيءٍ واحد: المعلّقات في الشبّاك، والمسودات في المكتبة، والطلبات هنا.
 *
 * والطلبات — لوحةٌ بحالاتها: جديد، بانتظار الزبون، قيد العمل، جاهز.
 *
 * «مدرسة الرافدين: ٤٠٠ هويّة، الخميس» كانت ورقةً ملصقة على الشاشة أو في ذاكرة
 * صاحب المكتب. والآن بطاقةٌ تعرف موعدها («متأخّر يومين» بالأحمر)، وتصميمها،
 * وقائمة أسمائها — فتُفتح في التصاميم دفعةً جاهزة بضغطة.
 *
 * **ولا مبالغ فيها** عمدًا: ديوان أداة إنتاج لا دفتر حسابات (قرار المالك).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DraftRow, TemplateSummary } from '@shared/api';
import { localStamp } from '@shared/dates';
import type { Parked } from './ServiceScreen';
import { readyMessage } from '@shared/agenda';
import {
  OPEN_STATUSES,
  STATUSES,
  dueLabel,
  localToday,
  statusOf,
  type Client,
  type Order,
  type OrderInput,
  type OrderStatus
} from '@shared/orders';
import { errorText } from '../lib/errors';
import { useToast } from '../kit/useToast';
import { choosePrinter } from '../lib/printChoice';
import { receiptSheet, type ReceiptOffice } from '@shared/receipt';

const toIndic = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

const TONE: Record<string, string> = {
  late: 'bg-error text-on-error',
  today: 'bg-tertiary-fixed text-on-tertiary-fixed',
  soon: 'bg-secondary-fixed text-on-secondary-fixed',
  later: 'bg-surface-container-high text-on-surface-variant',
  none: 'bg-surface-container-high text-on-surface-variant'
};

/** ما يُطلب عادةً — يُختار بضغطة ثم يُكمَّل: «هويّات طلاب» ← «هويّات طلاب الصفّ الخامس». */
const COMMON = ['هويّات طلاب', 'هويّات موظفين', 'شهادات شكر وتقدير', 'بطاقات امتحانية', 'ملصقات دفاتر', 'أسئلة امتحان', 'بطاقات دعوة', 'كتاب رسمي'];

function addDays(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localToday(d);
}

/** الأعمدة الثلاثة بالخطوة التالية (ن١٤) — وحالات الطلب الستّ تقع فيها. */
const COLUMNS: { key: 'yours' | 'customer' | 'ready'; label: string; hint: string; statuses: OrderStatus[] }[] = [
  { key: 'yours', label: 'عليك أن تكمله', hint: 'مسوداتٌ وطلباتٌ تنتظر عملك', statuses: ['new', 'working'] },
  { key: 'customer', label: 'ينتظر الزبون', hint: 'معاملاتٌ معلّقة، وطلباتٌ تنقصها صورٌ أو قائمة', statuses: ['waiting'] },
  { key: 'ready', label: 'جاهز للتسليم', hint: 'مطبوعٌ ينتظر صاحبه', statuses: ['ready'] }
];

export type OrdersScreenProps = {
  /** يفتح تصميم الطلب في التصاميم، وقائمتُه في الدفعة. */
  onOpenDesign: (order: Order) => void;
  onChanged?: () => void;
  /** «أكمله»: مسودة كتابٍ تُفتح في المحرّر. */
  onOpenDraft?: (draftId: number) => void;
  /** «استأنف»: معاملةٌ معلّقة تُفتح في الشبّاك من حيث تُركت. */
  onResumeParked?: (parkedKey: number) => void;
};

export default function OrdersScreen({ onOpenDesign, onChanged, onOpenDraft, onResumeParked }: OrdersScreenProps) {
  /** اسم المكتب — في رسالة «طلبكم جاهز» (د٨)؛ ووصل الاستلام إن شغّله المكتب، بهاتفه وعنوانه (الموجة ٢). */
  const [office, setOffice] = useState<ReceiptOffice & { receipt: boolean }>({ receipt: false, name: '', phone: '', address: '' });
  useEffect(() => {
    void window.diwan.settings
      .get()
      .then((s) => setOffice({ receipt: s.receiptSlip, name: s.officeName ?? '', phone: s.officePhone ?? '', address: s.officeAddress ?? '' }));
  }, []);
  const [tab, setTab] = useState<'open' | 'delivered'>('open');
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const { toast, say } = useToast(3000);
  const today = localToday();

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [parked, setParked] = useState<Parked[]>([]);
  const reload = useCallback(async () => {
    setOrders(await window.diwan.orders.list({ status: tab === 'open' ? 'open' : 'delivered', query }));
    // ما لم يكتمل من غير الطلبات — يصل وحده، ويُصفّى بالبحث نفسه.
    const [d, p] = await Promise.all([window.diwan.drafts.list(), window.diwan.service.parked()]);
    const q = query.trim();
    setDrafts(d.filter((x) => !q || `${x.title} ${x.citizenName ?? ''} ${x.templateTitle ?? ''}`.includes(q)));
    setParked((p as Parked[]).filter((x) => !q || x.label.includes(q)));
  }, [tab, query]);

  // وعدّاد السكّة يتبع ما قُرئ هنا: مسودةٌ حُفظت لحظة مغادرة المحرّر تُعدّ.
  useEffect(() => {
    void reload().then(() => onChanged?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  /** وصل الاستلام على طابعة «الكتب والمعاملات»: نسختان على ورقة — للزبون وللمكتب (`shared/receipt.ts`). */
  async function printReceipt(order: Order) {
    const pick = await choosePrinter('documents', { allowSystem: true });
    if (!pick) return;
    try {
      const out = await window.diwan.output.print({ sheetHtml: receiptSheet(order, office), printer: pick.printer, copies: 1, silent: !pick.system });
      say(out.ok ? `طُبع وصل الاستلام رقم ${order.id} — نسختان: للزبون وللمكتب` : `لم يُطبع الوصل${out.reason && out.reason !== 'cancelled' ? `: ${out.reason}` : ''}`);
    } catch (e) {
      say(errorText(e, 'تعذّرت طباعة الوصل'));
    }
  }

  async function move(order: Order, status: OrderStatus) {
    await window.diwan.orders.setStatus(order.id, status);
    await reload();
    onChanged?.();
    say(`${order.title} — ${statusOf(status).label}`);
  }

  const counts = useMemo(() => {
    const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
    return {
      late: open.filter((o) => dueLabel(o.dueDate, today).tone === 'late').length,
      today: open.filter((o) => dueLabel(o.dueDate, today).tone === 'today').length,
      open: open.length
    };
  }, [orders, today]);

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div>
              <h1 className="font-headline-md text-headline-md text-on-surface font-bold">قيد العمل</h1>
              <p className="font-label-md text-label-md text-on-surface-variant">ما لم يكتمل — يصل وحده: المعلّقات والمسودات والطلبات</p>
            </div>
            {tab === 'open' && (
              <div className="flex items-center gap-space-xs" data-orders-summary="">
                {counts.late > 0 && <span className={`px-3 py-1 rounded-full font-label-md text-label-md font-semibold ${TONE.late}`}>متأخّر {toIndic(counts.late)}</span>}
                {counts.today > 0 && <span className={`px-3 py-1 rounded-full font-label-md text-label-md font-semibold ${TONE.today}`}>اليوم {toIndic(counts.today)}</span>}
                <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${TONE.later}`}>مفتوح {toIndic(counts.open + drafts.length + parked.length)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="flex p-1 rounded-xl bg-surface-container-low">
              {(
                [
                  ['open', 'ما لم يكتمل'],
                  ['delivered', 'سُلِّمت']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`h-9 px-4 rounded-lg font-label-md text-label-md ${tab === key ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                  data-tab={key}
                  type="button"
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className="h-10 w-56 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface"
              data-orders-search=""
              placeholder="بحث في الطلبات…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5"
              data-act="new-order"
              type="button"
              onClick={() => setEditing('new')}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              طلب جديد
            </button>
          </div>
        </header>

        {tab === 'open' ? (
          <div className="flex-1 min-h-0 grid grid-cols-3 gap-space-md">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => col.statuses.includes(o.status));
              const extra = col.key === 'yours' ? drafts.length : col.key === 'customer' ? parked.length : 0;
              return (
                <section key={col.key} className="min-h-0 flex flex-col rounded-xl bg-surface-container-low" data-column={col.key}>
                  <div className="px-space-md pt-space-md pb-space-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-body-md text-body-md text-on-surface font-semibold">{col.label}</span>
                      <span className="font-label-md text-label-md text-on-surface-variant tabular">{toIndic(list.length + extra)}</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{col.hint}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto px-space-sm pb-space-sm space-y-space-sm">
                    {col.key === 'yours' &&
                      drafts.map((d) => (
                        <PendingCard
                          key={`d${d.id}`}
                          action="أكمله"
                          act="resume-draft"
                          icon="edit_document"
                          kind="مسودة كتاب"
                          sub={[d.citizenName, d.templateTitle].filter(Boolean).join(' · ')}
                          title={d.title || 'كتابٌ بلا عنوان'}
                          when={localStamp(d.updatedAt)}
                          onRun={() => onOpenDraft?.(d.id)}
                        />
                      ))}
                    {col.key === 'customer' &&
                      parked.map((p) => (
                        <PendingCard
                          key={`p${p.key}`}
                          action="استأنف"
                          act="resume-parked"
                          icon="pending_actions"
                          kind="معاملة معلّقة في الشبّاك"
                          sub={p.step === 'review' ? 'عند المراجعة' : 'عند الملء'}
                          title={p.label}
                          when={localStamp(new Date(p.key).toISOString())}
                          onRun={() => onResumeParked?.(p.key)}
                        />
                      ))}
                    {list.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        today={today}
                        onEdit={() => setEditing(o)}
                        onMove={(s) => void move(o, s)}
                        onOpenDesign={() => onOpenDesign(o)}
                        onCopyReady={() => {
                          void window.diwan.ui.copyText(readyMessage(o, office.name));
                          say(`نُسخت رسالة «طلبكم جاهز» لـ${o.customer} — الصقها في محادثته`);
                        }}
                        onReceipt={office.receipt ? () => void printReceipt(o) : undefined}
                      />
                    ))}
                    {list.length + extra === 0 && (
                      <p className="px-space-sm py-space-lg text-center font-label-sm text-label-sm text-on-surface-variant">
                        {col.key === 'yours' && orders.length + drafts.length + parked.length === 0
                          ? 'لا شيء ينتظر — ما يُترك قبل أن يكتمل يصل هنا وحده، و«طلب جديد» لما يُسلَّم لاحقًا'
                          : '—'}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <section className="rounded-xl bg-surface-container-lowest overflow-auto">
            {orders.length === 0 ? (
              <p className="p-space-xl text-center font-body-md text-body-md text-on-surface-variant">لم يُسلَّم شيء بعد</p>
            ) : (
              <table className="w-full text-right">
                <thead className="bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                  <tr>
                    <th className="p-space-sm">الطلب</th>
                    <th className="p-space-sm">لمن</th>
                    <th className="p-space-sm">العدد</th>
                    <th className="p-space-sm">سُلِّم</th>
                    <th className="p-space-sm" />
                  </tr>
                </thead>
                <tbody className="font-label-md text-label-md text-on-surface">
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-outline-variant/50" data-delivered={o.id}>
                      <td className="p-space-sm font-semibold">{o.title}</td>
                      <td className="p-space-sm">{o.customer}</td>
                      <td className="p-space-sm tabular">{o.quantity ? toIndic(o.quantity) : '—'}</td>
                      <td className="p-space-sm tabular">{o.deliveredAt ? toIndic(o.deliveredAt.slice(0, 10)) : '—'}</td>
                      <td className="p-space-sm text-left">
                        <button
                          className="h-8 px-3 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
                          type="button"
                          onClick={() => void move(o, 'ready')}
                        >
                          أعِده إلى «جاهز»
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>

      {editing && (
        <OrderDialog
          order={editing === 'new' ? null : editing}
          today={today}
          receipt={office.receipt}
          onClose={() => setEditing(null)}
          onSaved={(saved, created, receipt) => {
            setEditing(null);
            void reload();
            onChanged?.();
            say(created ? `سُجّل الطلب: ${saved.title}` : 'حُفظ الطلب');
            if (receipt) void printReceipt(saved);
          }}
          onDeleted={() => {
            setEditing(null);
            void reload();
            onChanged?.();
            say('حُذف الطلب');
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg bg-secondary text-on-secondary font-label-md text-label-md">
          {toast.text}
        </div>
      )}
    </main>
  );
}

/** بطاقة ما لم يكتمل من غير الطلبات: مسودةٌ أو معاملةٌ معلّقة — بزرٍّ واحد. */
function PendingCard({
  kind,
  icon,
  title,
  sub,
  when,
  action,
  act,
  onRun
}: {
  kind: string;
  icon: string;
  title: string;
  sub: string;
  when: string;
  action: string;
  act: string;
  onRun: () => void;
}) {
  return (
    <article className="rounded-lg bg-surface-container-lowest p-space-sm space-y-space-xs shadow-[0_1px_3px_rgba(15,23,42,0.08)]" data-pending={act}>
      <div className="flex items-center justify-between gap-2 font-label-sm text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-secondary">{icon}</span>
          <span className="truncate">{kind}</span>
        </span>
        <span className="shrink-0 tabular">{when}</span>
      </div>
      <div className="font-body-md text-body-md text-on-surface font-semibold truncate">{title}</div>
      {sub && <div className="font-label-sm text-label-sm text-on-surface-variant truncate">{sub}</div>}
      <button className="w-full h-8 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold" data-act={act} type="button" onClick={onRun}>
        {action}
      </button>
    </article>
  );
}

function OrderCard({
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
  const due = dueLabel(order.dueDate, today);
  const info = statusOf(order.status);
  return (
    <article
      className={`rounded-lg bg-surface-container-lowest p-space-sm space-y-space-xs shadow-[0_1px_3px_rgba(15,23,42,0.08)] ${due.tone === 'late' ? 'ring-2 ring-error/60' : ''}`}
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
            className="flex-1 h-8 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
            data-act="advance"
            type="button"
            onClick={() => onMove(info.next!)}
          >
            {info.verb}
          </button>
        )}
        {order.templateId && (
          <button
            className="h-8 px-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
            data-act="open-design"
            title={`افتح «${order.templateTitle ?? 'التصميم'}»${order.batchText ? ' وقائمته في الدفعة' : ''}`}
            type="button"
            onClick={onOpenDesign}
          >
            <span className="material-symbols-outlined text-[16px]">draw</span>
            التصميم
          </button>
        )}
        {order.status === 'ready' && (
          <button
            className="h-8 px-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-sm text-label-sm flex items-center gap-1"
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
            className="h-8 w-8 rounded-lg hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center"
            data-act="print-receipt"
            title="اطبع وصل الاستلام — نسختان: للزبون وللمكتب"
            type="button"
            onClick={onReceipt}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          </button>
        )}
        {order.status !== 'waiting' && order.status !== 'ready' && (
          <button
            className="h-8 w-8 rounded-lg hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center"
            data-act="wait"
            title="بانتظار الزبون — تنقص صورٌ أو قائمة"
            type="button"
            onClick={() => onMove('waiting')}
          >
            <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
          </button>
        )}
      </div>
    </article>
  );
}

function OrderDialog({
  order,
  today,
  receipt,
  onClose,
  onSaved,
  onDeleted
}: {
  order: Order | null;
  today: string;
  /** المكتب شغّل وصل الاستلام: خانة «ما تركه الزبون عندنا» و«واطبع الوصل». */
  receipt: boolean;
  onClose: () => void;
  onSaved: (o: Order, created: boolean, receipt: boolean) => void;
  onDeleted: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);
  const [who, setWho] = useState<'client' | 'person'>(order && !order.clientId ? 'person' : 'client');
  const [clientId, setClientId] = useState<number | null>(order?.clientId ?? null);
  const [newClient, setNewClient] = useState('');
  const [customer, setCustomer] = useState(order && !order.clientId ? order.customer : '');
  const [phone, setPhone] = useState(order?.phone ?? '');
  const [title, setTitle] = useState(order?.title ?? '');
  const [quantity, setQuantity] = useState(order?.quantity ? String(order.quantity) : '');
  const [dueDate, setDueDate] = useState(order?.dueDate ?? '');
  const [received, setReceived] = useState(order?.received ?? '');
  const [templateId, setTemplateId] = useState<number | null>(order?.templateId ?? null);
  const [batchText, setBatchText] = useState(order?.batchText ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'new');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void window.diwan.clients.list().then(setClients);
    void window.diwan.templates.list('تصاميم', 'print-only').then(setDesigns).catch(() => setDesigns([]));
  }, []);

  const rows = batchText.split(/\r?\n/).filter((l) => l.trim()).length;

  async function save(printReceipt = false) {
    setError(null);
    try {
      let cid = who === 'client' ? clientId : null;
      // جهةٌ جديدة تُكتب هنا فتُنشأ — لا يُترك الطلب ليُذهب إلى شاشةٍ أخرى أولًا.
      if (who === 'client' && !cid && newClient.trim()) cid = (await window.diwan.clients.save({ id: null, name: newClient })).id;
      const input: OrderInput = {
        id: order?.id ?? null,
        clientId: cid,
        customer: who === 'person' ? customer : null,
        phone,
        title,
        quantity: quantity ? Number(quantity.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) : null,
        dueDate: dueDate || null,
        templateId,
        batchText,
        notes,
        // وما لم يُعرض لا يُرسل: مكتبٌ أطفأ الوصل لا يمحو ما كُتب قبل.
        received: receipt ? received : undefined,
        status: order ? status : undefined
      };
      onSaved(await window.diwan.orders.save(input), !order, printReceipt);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الطلب'));
    }
  }

  const input =
    'h-10 px-3 rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface w-full';
  const chip = (on: boolean) =>
    `h-8 px-3 rounded-full font-label-sm text-label-sm transition-colors ${on ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 backdrop-blur-[2px] p-space-lg" data-order-dialog="">
      <div className="w-full max-w-2xl max-h-full overflow-auto rounded-2xl bg-surface-container-lowest shadow-2xl">
        <div className="px-space-lg py-space-md flex items-center justify-between bg-surface-container-low">
          <span className="font-headline-sm text-headline-sm text-on-surface">{order ? 'الطلب' : 'طلب جديد'}</span>
          <button className="w-9 h-9 rounded-lg hover:bg-surface-container-high flex items-center justify-center" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-space-lg space-y-space-md">
          <div className="space-y-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold w-24">لمن؟</span>
              <button className={chip(who === 'client')} type="button" onClick={() => setWho('client')}>
                جهة
              </button>
              <button className={chip(who === 'person')} data-who="person" type="button" onClick={() => setWho('person')}>
                زبونٌ فرد
              </button>
            </div>
            {who === 'client' ? (
              <div className="grid grid-cols-2 gap-space-sm">
                <select
                  className={input}
                  data-order-client=""
                  value={clientId ?? ''}
                  onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— اختر جهة —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!clientId && (
                  <input
                    className={input}
                    data-order-new-client=""
                    placeholder="أو اكتب اسم جهةٍ جديدة"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-space-sm">
                <input className={input} data-order-customer="" placeholder="اسم الزبون" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                <input className={input} placeholder="هاتفه" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-space-xs">
            <span className="font-label-md text-label-md text-on-surface font-semibold">ما المطلوب؟</span>
            <input
              className={input}
              data-order-title=""
              placeholder="مثال: هويّات طلاب الصفّ الخامس"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {COMMON.map((c) => (
                <button key={c} className={chip(false)} type="button" onClick={() => setTitle(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface font-semibold">العدد</span>
              <input className={input} data-order-quantity="" inputMode="numeric" placeholder="اختياري" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface font-semibold">موعد التسليم</span>
              <input className={input} data-order-due="" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['اليوم', 0],
                    ['غدًا', 1],
                    ['بعد ٣ أيام', 3],
                    ['بعد أسبوع', 7]
                  ] as const
                ).map(([label, n]) => (
                  <button key={label} className={chip(dueDate === addDays(today, n))} type="button" onClick={() => setDueDate(addDays(today, n))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface font-semibold">التصميم</span>
            <select className={input} data-order-design="" value={templateId ?? ''} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— بلا تصميم (أو يُصمَّم لاحقًا) —</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>

          {receipt && (
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface font-semibold">ما تركه الزبون عندنا</span>
              <input
                className={input}
                data-order-received=""
                placeholder="مثال: هوية موحّدة و٤ صور — يُكتب في وصل الاستلام"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                قائمة الأسماء {rows > 0 && <span className="text-on-surface-variant font-normal">— {toIndic(rows)} سطرًا</span>}
              </span>
              <button
                className="h-8 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void window.diwan.files.readSheet().then((out) => out && setBatchText(out.text));
                }}
              >
                <span className="material-symbols-outlined text-[16px]">table_view</span>
                من ملف Excel
              </button>
            </span>
            <textarea
              className="h-24 p-3 rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface resize-y"
              data-order-batch=""
              placeholder="الصقها من Excel كما وصلت — تُفتح بها الدفعة في التصاميم"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface font-semibold">ملاحظات</span>
            <input className={input} placeholder="مثال: الصور تصل الأربعاء، الشعار بالأزرق" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {order && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-label-md text-label-md text-on-surface font-semibold w-24">الحالة</span>
              {STATUSES.map((s) => (
                <button key={s.key} className={chip(status === s.key)} type="button" onClick={() => setStatus(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="font-label-md text-label-md text-error">{error}</p>}
        </div>

        <div className="px-space-lg py-space-md flex items-center justify-between bg-surface-container-low">
          <div>
            {order &&
              (confirmDelete ? (
                <span className="flex items-center gap-1">
                  <span className="font-label-sm text-label-sm text-error">يُحذف نهائيًّا؟</span>
                  <button
                    className="h-9 px-3 rounded-lg bg-error text-on-error font-label-md text-label-md"
                    type="button"
                    onClick={() => void window.diwan.orders.delete(order.id).then(onDeleted)}
                  >
                    نعم، احذف
                  </button>
                  <button className="h-9 px-3 rounded-lg font-label-md text-label-md" type="button" onClick={() => setConfirmDelete(false)}>
                    تراجع
                  </button>
                </span>
              ) : (
                <button className="h-9 px-3 rounded-lg text-error hover:bg-error-container font-label-md text-label-md" type="button" onClick={() => setConfirmDelete(true)}>
                  حذف الطلب
                </button>
              ))}
          </div>
          <div className="flex items-center gap-space-sm">
            <button className="h-10 px-space-md rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-high" type="button" onClick={onClose}>
              إلغاء
            </button>
            {receipt && (
              <button
                className="h-10 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold flex items-center gap-1"
                data-act="save-order-receipt"
                type="button"
                onClick={() => void save(true)}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                {order ? 'احفظ واطبع الوصل' : 'سجّل واطبع الوصل'}
              </button>
            )}
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
              data-act="save-order"
              type="button"
              onClick={() => void save()}
            >
              {order ? 'حفظ' : 'سجّل الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
