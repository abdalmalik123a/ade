/**
 * نافذة الطلب: الجهة أو الشخص، وما يُطلب وكمّيته وموعده وما تُرك، ووصل الاستلام، والتصميم (تقسيم شاشة الطلبات بعد ١٫٧٫٠) — منقولةٌ
 * من `OrdersScreen` كما هي.
 */
import { type Order, type Client, type OrderStatus, type OrderInput, STATUSES } from '@shared/orders';
import { useEscape } from '../../kit/useEscape';
import { useState, useEffect } from 'react';
import type { TemplateSummary } from '@shared/api';
import { errorText } from '../../lib/errors';
import { COMMON, addDays } from './shared';
import { count } from '@shared/arabic';
import CitizenMultiPicker from '../../components/CitizenMultiPicker';

export function OrderDialog({
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
    // مرّةً عند فتح الحوار
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 backdrop-blur-[2px] p-space-lg" data-order-dialog="">
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
