/**
 * الجهات — المدارس والدوائر والشركات التي يعمل لها المكتب.
 *
 * ملفٌّ لكل جهة: شعارها ولونها وهاتفها وعنوانها، وطلباتها. يُبنى مرّةً فيخدم
 * كل شيء بعده: التصاميم تخرج بشعارها ولونها بضغطة («صمّم لها»)، والطلب يُسجَّل
 * لها باسمها لا بكتابته كل مرّة.
 */
import { useCallback, useEffect, useState } from 'react';
import { dominantColor, paletteFrom } from '@shared/designKit';
import { dueLabel, localToday, statusOf, type Client, type Order } from '@shared/orders';
import { errorText } from '../lib/errors';

const KINDS = ['مدرسة', 'روضة', 'إعدادية', 'ثانوية', 'دائرة', 'مديرية', 'شركة', 'جامعة', 'مركز'];

async function logoColor(path: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `diwan://store/${path}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 64, 64);
  return dominantColor(ctx.getImageData(0, 0, 64, 64).data);
}

export type ClientsScreenProps = {
  /** «صمّم لها»: المعرض بشعار الجهة ولونها واسمها. */
  onDesignFor: (client: Client) => void;
  onChanged?: () => void;
};

type Draft = { name: string; kind: string; phone: string; address: string; color: string; notes: string };
const EMPTY: Draft = { name: '', kind: '', phone: '', address: '', color: '', notes: '' };

export default function ClientsScreen({ onDesignFor, onChanged }: ClientsScreenProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = typeof selected === 'number' ? (clients.find((c) => c.id === selected) ?? null) : null;

  const reload = useCallback(async () => setClients(await window.diwan.clients.list(query)), [query]);
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setError(null);
    setConfirmDelete(false);
    if (current)
      setDraft({
        name: current.name,
        kind: current.kind ?? '',
        phone: current.phone ?? '',
        address: current.address ?? '',
        color: current.color ?? '',
        notes: current.notes ?? ''
      });
    else if (selected === 'new') setDraft(EMPTY);
    if (typeof selected === 'number') void window.diwan.orders.list({ clientId: selected }).then(setOrders);
    else setOrders([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current?.id]);

  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 3000);
  };

  async function save() {
    setError(null);
    try {
      const saved = await window.diwan.clients.save({ id: current?.id ?? null, ...draft });
      await reload();
      setSelected(saved.id);
      onChanged?.();
      say(current ? 'حُفظت الجهة' : `أُضيفت ${saved.name}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
    }
  }

  async function pickLogo() {
    if (!current) return;
    const path = await window.diwan.files.pickImage('seals');
    if (!path) return;
    await window.diwan.clients.setLogo(current.id, path);
    // اللون من الشعار ما لم يختر المكتب لونًا بنفسه.
    if (!draft.color) {
      const hex = await logoColor(path).catch(() => null);
      if (hex) {
        const primary = paletteFrom(hex).primary;
        setDraft((d) => ({ ...d, color: primary }));
        await window.diwan.clients.save({ id: current.id, ...draft, color: primary });
      }
    }
    await reload();
    say('وُضع الشعار');
  }

  const input =
    'h-10 px-3 rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface w-full';
  const today = localToday();

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="w-[340px] shrink-0 border-l border-outline-variant bg-surface-container-low flex flex-col">
          <div className="p-space-md space-y-space-sm">
            <div className="flex items-center justify-between">
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">الجهات</h1>
              <button
                className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1"
                data-act="new-client"
                type="button"
                onClick={() => setSelected('new')}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                جهة جديدة
              </button>
            </div>
            <input
              className={input}
              placeholder="بحث بالاسم أو الهاتف…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-auto px-space-sm pb-space-md space-y-1">
            {clients.map((c) => (
              <button
                key={c.id}
                className={`w-full p-space-sm rounded-lg text-right flex items-center gap-space-sm ${selected === c.id ? 'bg-primary-container text-on-primary' : 'hover:bg-surface-container-high text-on-surface'}`}
                data-client={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
              >
                <span className="w-9 h-9 rounded-lg bg-white shrink-0 flex items-center justify-center overflow-hidden" style={c.color ? { boxShadow: `inset 0 -3px 0 ${c.color}` } : undefined}>
                  {c.logo ? (
                    <img alt="" className="w-full h-full object-contain" src={`diwan://store/${c.logo}`} />
                  ) : (
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">domain</span>
                  )}
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-md text-label-md font-semibold truncate">{c.name}</span>
                  <span className={`font-label-sm text-label-sm truncate ${selected === c.id ? 'opacity-80' : 'text-on-surface-variant'}`}>
                    {[c.kind, c.openOrders ? `${c.openOrders} طلب مفتوح` : null].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
              </button>
            ))}
            {clients.length === 0 && (
              <p className="p-space-md text-center font-label-md text-label-md text-on-surface-variant">
                {query ? 'لا جهة بهذا الاسم' : 'أضف المدارس والدوائر التي تعمل لها — مرّةً واحدة'}
              </p>
            )}
          </div>
        </aside>

        <section className="flex-1 overflow-auto p-space-xl">
          {selected === null ? (
            <div className="h-full flex flex-col items-center justify-center gap-space-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px]">domain</span>
              <p className="font-body-md text-body-md text-center max-w-md">
                لكل جهةٍ ملفٌّ واحد: شعارها ولونها وهاتفها وطلباتها. فتخرج تصاميمها بشعارها بضغطة، وتُسجَّل طلباتها باسمها.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-space-lg" data-client-file="">
              <div className="flex items-start gap-space-lg">
                <button
                  className="w-28 h-28 shrink-0 rounded-2xl bg-white border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center gap-1 overflow-hidden disabled:opacity-50"
                  data-act="client-logo"
                  disabled={!current}
                  title={current ? 'اختر شعار الجهة' : 'احفظ الجهة أولًا ثم ضع شعارها'}
                  type="button"
                  onClick={() => void pickLogo()}
                >
                  {current?.logo ? (
                    <img alt="" className="w-full h-full object-contain p-2" src={`diwan://store/${current.logo}`} />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">add_photo_alternate</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">الشعار</span>
                    </>
                  )}
                </button>
                <div className="flex-1 space-y-space-sm">
                  <input
                    className="w-full h-12 px-3 rounded-lg bg-surface-container-low border border-outline-variant font-headline-sm text-headline-sm text-on-surface"
                    data-client-name=""
                    placeholder="اسم الجهة كما يُطبع — مثال: مدرسة الرافدين الابتدائية"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-1">
                    {KINDS.map((k) => (
                      <button
                        key={k}
                        className={`h-8 px-3 rounded-full font-label-sm text-label-sm ${draft.kind === k ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
                        type="button"
                        onClick={() => setDraft({ ...draft, kind: draft.kind === k ? '' : k })}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">الهاتف</span>
                  <input className={input} data-client-phone="" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">اللون</span>
                  <span className="flex items-center gap-space-sm">
                    <input
                      className="w-12 h-10 rounded-lg border border-outline-variant bg-surface-container-low"
                      type="color"
                      value={draft.color || '#1f3a8a'}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    />
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {draft.color ? 'لون تصاميمها وترويساتها' : 'يُستخرج من الشعار حين يُوضع'}
                    </span>
                  </span>
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">العنوان</span>
                  <input className={input} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">ملاحظات</span>
                  <input
                    className={input}
                    placeholder="مثال: المدير أ. سعاد — تفضّل الأزرق، والهويّات بظهرٍ فيه التعليمات"
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  />
                </label>
              </div>

              {error && <p className="font-label-md text-label-md text-error">{error}</p>}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <button
                    className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                    data-act="save-client"
                    type="button"
                    onClick={() => void save()}
                  >
                    {current ? 'حفظ' : 'أضف الجهة'}
                  </button>
                  {current && (
                    <button
                      className="h-10 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5"
                      data-act="design-for"
                      type="button"
                      onClick={() => onDesignFor(current)}
                    >
                      <span className="material-symbols-outlined text-[18px]">draw</span>
                      صمّم لها
                    </button>
                  )}
                </div>
                {current &&
                  (confirmDelete ? (
                    <span className="flex items-center gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">تُحذف الجهة وتبقى طلباتها باسمها</span>
                      <button
                        className="h-9 px-3 rounded-lg bg-error text-on-error font-label-md text-label-md"
                        type="button"
                        onClick={() =>
                          void window.diwan.clients.delete(current.id).then(async () => {
                            setSelected(null);
                            await reload();
                            onChanged?.();
                          })
                        }
                      >
                        احذف
                      </button>
                      <button className="h-9 px-3 rounded-lg font-label-md text-label-md" type="button" onClick={() => setConfirmDelete(false)}>
                        تراجع
                      </button>
                    </span>
                  ) : (
                    <button className="h-9 px-3 rounded-lg text-error hover:bg-error-container font-label-md text-label-md" type="button" onClick={() => setConfirmDelete(true)}>
                      حذف الجهة
                    </button>
                  ))}
              </div>

              {current && (
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
                            {o.status !== 'delivered' && o.status !== 'cancelled' && <span>{dueLabel(o.dueDate, today).text}</span>}
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
              )}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg bg-secondary text-on-primary font-label-md text-label-md">
          {toast}
        </div>
      )}
    </main>
  );
}
