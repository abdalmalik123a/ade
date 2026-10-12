/**
 * الجهات — المدارس والدوائر والشركات التي يعمل لها المكتب.
 *
 * ملفٌّ لكل جهة: شعارها ولونها وهاتفها وعنوانها، وطلباتها. يُبنى مرّةً فيخدم
 * كل شيء بعده: التصاميم تخرج بشعارها ولونها بضغطة («صمّم لها»)، والطلب يُسجَّل
 * لها باسمها لا بكتابته كل مرّة.
 */
import { useCallback, useEffect, useState } from 'react';
import { paletteFrom } from '@shared/design/kit';
import { type Client, type Order } from '@shared/orders';
import { SCHOOL_KINDS } from '@shared/schoolFile';
import { errorText } from '../lib/errors';
import { useToast } from '../kit/useToast';
import { localToday } from '@shared/dates';
import ClientBrandFields from '../components/ClientBrandFields';
import { type Draft, EMPTY, logoColor, KINDS } from './clients/shared';
import ClientsList from './clients/ClientsList';
import ClientSchoolFile from './clients/ClientSchoolFile';
import ClientOrders from './clients/ClientOrders';

export type ClientsScreenProps = {
  /** «صمّم لها»: المعرض بشعار الجهة ولونها واسمها. */
  onDesignFor: (client: Client) => void;
  onChanged?: () => void;
};

export default function ClientsScreen({ onDesignFor, onChanged }: ClientsScreenProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast, say } = useToast(3000);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** «ملفّ المدارس» مفعّلٌ في الإعدادات — فيُعرض للمدرسة ملفّها. */
  const [schoolFiles, setSchoolFiles] = useState(false);

  const current = typeof selected === 'number' ? (clients.find((c) => c.id === selected) ?? null) : null;

  const reload = useCallback(async () => setClients(await window.diwan.clients.list(query)), [query]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    void window.diwan.settings.get().then((s) => setSchoolFiles(s.schoolFiles));
  }, []);

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
        notes: current.notes ?? '',
        schoolGender: current.schoolGender ?? '',
        governorate: current.governorate ?? '',
        principal: current.principal ?? '',
        font: current.font ?? ''
      });
    else if (selected === 'new') setDraft(EMPTY);
    if (typeof selected === 'number') void window.diwan.orders.list({ clientId: selected }).then(setOrders);
    else setOrders([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current?.id]);

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
        <ClientsList
          setSelected={setSelected}
          input={input}
          query={query}
          setQuery={setQuery}
          clients={clients}
          selected={selected}
        />

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
                <ClientBrandFields color={draft.color} font={draft.font} onChange={(patch) => setDraft({ ...draft, ...patch })} />
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

              {/* ملفّ المدرسة (الموجة ٢): خيارٌ من الإعدادات — يُكتب مرّةً ويملأ كتبها في الشبّاك. */}
              {schoolFiles && (SCHOOL_KINDS.includes(draft.kind) || draft.schoolGender || draft.governorate || draft.principal) && (
                <ClientSchoolFile
                  input={input}
                  draft={draft}
                  setDraft={setDraft}
                />
              )}

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
                <ClientOrders
                  orders={orders}
                  today={today}
                  current={current}
                />
              )}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg bg-secondary text-on-secondary font-label-md text-label-md">
          {toast.text}
        </div>
      )}
    </main>
  );
}
