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
import { localStamp, localToday } from '@shared/dates';
import type { Parked } from './ServiceScreen';
import { readyMessage } from '@shared/agenda';
import {
  OPEN_STATUSES,
  STATUSES,
  dueLabel,
  statusOf,
  type Client,
  type Order,
  type OrderInput,
  type OrderStatus
} from '@shared/orders';
import { errorText } from '../lib/errors';
import { useToast } from '../kit/useToast';
import { confirmAction } from '../kit/ask';
import { choosePrinter } from '../lib/printChoice';
import { receiptSheet, type ReceiptOffice } from '@shared/receipt';
import CitizenMultiPicker from '../components/CitizenMultiPicker';
import { toIndic, count } from '@shared/arabic';
import { isDesignDraft } from '@shared/design/draft';
import { DraftCard, PendingCard } from '../components/PendingCard';
import { useEscape } from '../kit/useEscape';
import OrderCard, { TONE } from './OrderCard';

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
    setParked((p as Parked[]).filter((x) => !q || x.label.includes(q)));
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

function OrderDialog({
  order,
  initialCitizenId = null,
  today,
  receipt,
  onClose,
  onSaved,
  onDeleted
}: {
  order: Order | null;
  /** طلبٌ جديد لزبونٍ من السجلّ (من الشبّاك). */
  initialCitizenId?: number | null;
  today: string;
  /** المكتب شغّل وصل الاستلام: خانة «ما تركه الزبون عندنا» و«واطبع الوصل». */
  receipt: boolean;
  onClose: () => void;
  onSaved: (o: Order, created: boolean, receipt: boolean) => void;
  onDeleted: () => void;
}) {
  useEscape(onClose);
  const [clients, setClients] = useState<Client[]>([]);
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);
  const [who, setWho] = useState<'client' | 'person'>((order && !order.clientId) || (!order && initialCitizenId) ? 'person' : 'client');
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
  /** ملفّ الزبون الفرد في السجلّ (د٨): اسمه وهاتفه يُملآن منه ويبقيان قابلين للتعديل. بلا مال. */
  const [citizenId, setCitizenId] = useState<number | null>(order?.citizenId ?? initialCitizenId ?? null);
  const [citizenName, setCitizenName] = useState('');
  const [picking, setPicking] = useState(false);

  /** يُملأ الاسم والهاتف من الملفّ — وما كُتب باليد في الهاتف لا يُمحى بملفٍّ بلا هاتف. */
  async function linkCitizen(id: number, fill: boolean) {
    const c = await window.diwan.citizens.get(id);
    if (!c) return;
    setCitizenId(id);
    setCitizenName(c.fullName);
    if (fill) {
      setWho('person');
      setCustomer(c.fullName);
      if (c.phone) setPhone(c.phone);
    }
  }
  useEffect(() => {
    // طلبٌ جديد لزبون الشبّاك: يُملأ منه؛ وطلبٌ قائمٌ مربوط: يُقال اسم ملفّه وحده.
    if (!order && initialCitizenId) void linkCitizen(initialCitizenId, true);
    else if (order?.citizenId) void linkCitizen(order.citizenId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        citizenId: who === 'person' ? citizenId : null,
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
              <div className="space-y-space-xs">
                <div className="grid grid-cols-2 gap-space-sm">
                  <input className={input} data-order-customer="" placeholder="اسم الزبون" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                  <input className={input} data-order-phone="" placeholder="هاتفه" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                {citizenId ? (
                  <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant" data-order-citizen={citizenId}>
                    <span className="material-symbols-outlined text-[16px] text-secondary">badge</span>
                    مربوطٌ بملفّ <span className="font-semibold text-on-surface">{citizenName || '…'}</span> في الزبائن
                    <button
                      className="ms-1 h-7 px-2 rounded-lg hover:bg-surface-container-high"
                      data-act="order-unlink-citizen"
                      title="فكّ الربط — ويبقى الاسم والهاتف كما كُتبا"
                      type="button"
                      onClick={() => setCitizenId(null)}
                    >
                      فكّ الربط
                    </button>
                  </div>
                ) : (
                  <button
                    className="h-8 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm text-on-surface flex items-center gap-1"
                    data-act="order-pick-citizen"
                    title="يملأ الاسم والهاتف من ملفّه، ويبقيان قابلين للتعديل"
                    type="button"
                    onClick={() => setPicking(true)}
                  >
                    <span className="material-symbols-outlined text-[16px]">person_search</span>
                    من الزبائن
                  </button>
                )}
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
                قائمة الأسماء {rows > 0 && <span className="text-on-surface-variant font-normal">— {count(rows, 'سطر')}</span>}
              </span>
              <button
                className="h-8 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  // وملفٌّ لا يُقرأ (`.xls` القديم) يُقال سببه — كان يسكت (هـ١).
                  void window.diwan.files
                    .readSheet()
                    .then((out) => out && setBatchText(out.text))
                    .catch((err: unknown) => setError(errorText(err, 'تعذّرت قراءة الملف')));
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
      {picking && (
        <CitizenMultiPicker
          single
          confirmLabel="اربطه بالطلب"
          title="لمن الطلب؟"
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            if (ids[0]) void linkCitizen(ids[0], true);
          }}
        />
      )}
    </div>
  );
}
