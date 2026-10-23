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
import type { DraftRow } from '@shared/api';
import { localStamp, localToday } from '@shared/dates';
import type { Parked } from './ServiceScreen';
import { readyMessage } from '@shared/agenda';
import {
  OPEN_STATUSES,
  dueLabel,
  isOrderOverdue,
  statusOf,
  type Order,
  type OrderStatus
} from '@shared/orders';
import { errorText } from '../lib/errors';
import { useToast } from '../kit/useToast';
import { confirmAction } from '../kit/ask';
import { choosePrinter } from '../lib/printChoice';
import { receiptSheet, type ReceiptOffice } from '@shared/receipt';
import { toIndic, count } from '@shared/arabic';
import { isDesignDraft } from '@shared/design/draft';
import { DraftCard, PendingCard } from '../components/PendingCard';
import OrderCard, { TONE } from './OrderCard';
import { OrderDialog } from './orders/OrderDialog';

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
  /** «أكمله»: مسودّة تصميمٍ لم يُحفظ تُفتح في التصاميم (DESIGNS.md ٠٫٦). */
  onOpenDesignDraft?: (draftId: number) => void;
  /** «استأنف»: معاملةٌ معلّقة تُفتح في الشبّاك من حيث تُركت. */
  onResumeParked?: (parkedKey: number) => void;
  /**
   * بطاقة «طلبٌ يُسلَّم لاحقًا» في الشبّاك (د٨): طلبٌ جديد يُفتح مباشرةً — لا القائمة — ومعه زبون الشبّاك إن كان.
   * ويُنفَّذ مرّةً بمفتاحه: الشاشة تُركَّب من جديد كلّما فُتحت.
   */
  request?: { key: number; citizenId: number | null } | null;
};

/** الطلب الجديد من الشبّاك يُفتح مرّةً لا كلّ رجوع. */
let orderRequestSeen = 0;

export default function OrdersScreen({ onOpenDesign, onChanged, onOpenDraft, onOpenDesignDraft, onResumeParked, request = null }: OrdersScreenProps) {
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
  /** زبون الشبّاك للطلب الجديد (د٨) — اسمه وهاتفه من ملفّه. */
  const [newFor, setNewFor] = useState<number | null>(null);
  useEffect(() => {
    if (!request || request.key === orderRequestSeen) return;
    orderRequestSeen = request.key;
    setNewFor(request.citizenId);
    setEditing('new');
  }, [request?.key]);
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
    // والمعاملة الجارية في الشبّاك (`autosave`) مسودّتُه تُستعاد فيه، لا معلّقةٌ تُستأنف هنا ولا تُعدّ في «مفتوح» (D134).
    setParked((p as (Parked & { autosave?: boolean })[]).filter((x) => !x.autosave && (!q || x.label.includes(q))));
  }, [tab, query]);

  /**
   * مسودّةٌ تُحذف بسؤال (د٢): كلّ جلسة محرّرٍ لا تنتهي بـ«اطبع» (طباعة تجريبية، PDF، Word) تترك مسودّةً دائمة —
   * فتُحذف هنا بما فيها. والمعلّقة لا تُحذف من هنا: يستأنفها الشبّاك أو يلغيها.
   */
  const deleteDraft = async (d: DraftRow) => {
    const design = isDesignDraft(d.valuesJson);
    const ok = await confirmAction({
      title: 'أتحذف المسودّة؟',
      message: design
        ? `«${d.title || 'تصميمٌ بلا اسم'}» — يضيع ما لم يُحفظ منه، ولا يُمسّ التصميم المحفوظ.`
        : `«${d.title || 'كتابٌ بلا عنوان'}» — يضيع ما كُتب فيها، ولا يُمسّ ما صدر.`,
      confirm: 'احذفها',
      danger: true
    });
    if (!ok) return;
    try {
      await window.diwan.drafts.delete(d.id);
      await reload();
      onChanged?.();
      say('حُذفت المسودّة');
    } catch (e) {
      say(errorText(e, 'تعذّر حذف المسودّة'), 'warn');
    }
  };

  // وعدّاد السكّة يتبع ما قُرئ هنا: معاملةٌ عُلّقت لحظة مغادرة الشبّاك تُعدّ.
  useEffect(() => {
    void reload().then(() => onChanged?.());
    // `onChanged` تتجدّد كلّ رسم — فإعادته معها تقرأ القاعدة بلا سبب
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
      // «متأخّر» كما يعدّه الشريط والجرس: الجاهز للتسليم ليس منه (S05، D138).
      late: open.filter((o) => isOrderOverdue(o, today)).length,
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
                {/* «مفتوح» ما تعدّه شارة السكّة نفسه: الطلبات والمعلّقات — والمسودّات بجانبه لا فيه (قرار المالك د٢؛ البند ١٩). */}
                <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${TONE.later}`} data-open-count={counts.open + parked.length} title="الطلبات المفتوحة والمعاملات المعلّقة — العدد على «قيد العمل» في السكّة">
                  مفتوح {toIndic(counts.open + parked.length)}
                </span>
                {drafts.length > 0 && (
                  <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${TONE.later}`} data-draft-count={drafts.length} title="المسودّات تُكمَل من هنا — ولا تُعدّ في السكّة">
                    {count(drafts.length, 'مسودة')}
                  </span>
                )}
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
              onClick={() => {
            setNewFor(null);
            setEditing('new');
          }}
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
                        <DraftCard key={`d${d.id}`} draft={d} onOpen={onOpenDraft} onOpenDesign={onOpenDesignDraft} onDelete={() => void deleteDraft(d)} />
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
          initialCitizenId={editing === 'new' ? newFor : null}
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

