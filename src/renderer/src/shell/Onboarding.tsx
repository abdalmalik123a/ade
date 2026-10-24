/**
 * معالج البداية — أول تشغيل.
 *
 * البرنامج يبدأ فارغًا من كل ما يخصّ الجهة (§٢)، فكانت أول شاشةٍ يراها صاحب
 * المكتب «المكتبة فارغة» في كل مكان. والمعالج أربع خطوات قصيرة: من أنتم، وأيّ
 * طابعة، وأيّ حجم خطٍّ يريح العين، و«ابدأ جاهزًا» (المرحلة ٥ — ن١٠): ما يقدّمه المكتب
 * فتظهر بطاقاته وحدها في الشبّاك، ثم ملفّات Word أو حزمةٌ جاهزة لجهةٍ أو مكتب — أو البدء
 * فارغًا. ولا ترويسة إلزامية قبل العمل. وكلّها تُتخطّى، وتُعدَّل لاحقًا.
 */
import { useEffect, useState } from 'react';
import type { BundledPackInfo, OfficeSettings, PrinterInfo } from '@shared/api';
import type { RouteKey } from '@shared/routes';
import { COUNTER_CARDS, type CounterCardId } from '@shared/counterCards';
import { isFilePrinter } from '@shared/printRoles';
import icon from '../assets/brand/diwan-icon.png';
import logo from '../assets/brand/madatech-logo.png';

/** ما يُفتح بعد المعالج في المكتبة: مجلّد ملفّات Word، أو حزمةٌ جاهزة. */
export type StartAction = 'folder' | 'pack';

export const UI_SCALES = [
  { value: 1, label: 'عادي' },
  { value: 1.15, label: 'كبير' },
  { value: 1.3, label: 'أكبر' }
] as const;

const STEPS = ['المكتب', 'الطابعة', 'حجم الخط', 'ابدأ جاهزًا'];

export default function Onboarding({
  settings,
  printers,
  onDone
}: {
  settings: OfficeSettings;
  printers: PrinterInfo[];
  onDone: (patch: Partial<OfficeSettings>, go?: RouteKey, action?: StartAction) => void;
}) {
  const [step, setStep] = useState(0);
  const [officeName, setOfficeName] = useState(settings.officeName);
  const [operatorName, setOperatorName] = useState(settings.operatorName);
  const [printer, setPrinter] = useState<string | null>(
    settings.defaultPrinter ?? printers.find((p) => p.isDefault)?.name ?? null
  );
  const [scale, setScale] = useState(settings.uiScale || 1);
  /** ما يقدّمه المكتب — بطاقات الشبّاك بترتيبها الثابت؛ وما لا يقدّمه لا يظهر (ن١). */
  const [cards, setCards] = useState<CounterCardId[]>(settings.counterCards?.length ? settings.counterCards : COUNTER_CARDS.map((c) => c.id));
  const [packPicker, setPackPicker] = useState(false);
  const [bundledPacks, setBundledPacks] = useState<BundledPackInfo[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [importingPacks, setImportingPacks] = useState(false);

  useEffect(() => {
    if (step === 3 && window.diwan?.content?.bundled) {
      window.diwan.content.bundled().then(setBundledPacks).catch(() => undefined);
    }
  }, [step]);

  const patch = (): Partial<OfficeSettings> => ({
    officeName: officeName.trim(),
    operatorName: operatorName.trim(),
    defaultPrinter: printer,
    uiScale: scale,
    counterCards: COUNTER_CARDS.map((c) => c.id).filter((id) => cards.includes(id)),
    onboarded: true
  });

  const input =
    'input-field w-full h-11 px-space-md font-body-md text-body-md text-on-surface';
  const option = (on: boolean) =>
    `w-full p-space-md rounded-card text-right flex items-center gap-space-md transition-colors ${
      on ? 'border-2 border-cyan bg-grad-sel shadow-sel' : 'border-2 border-transparent bg-surface-container-low hover:bg-surface-container-high'
    }`;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/40 backdrop-blur-sm p-space-lg" data-onboarding="">
      <div className="w-full max-w-2xl surface-panel overflow-hidden flex flex-col max-h-full">
        <div className="px-space-xl pt-space-lg pb-space-md flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            {/* شاشة البدء: أيقونة ديوان — والشعار كاملًا أسفل المعالج (المرحلة ٦). */}
            <img alt="ديوان" className="w-12 h-12 rounded-xl" src={icon} />
            <div>
              <div className="font-headline-sm text-headline-sm text-on-surface font-bold">أهلًا بك في ديوان</div>
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                أربع خطواتٍ قصيرة — وكلّها تُعدَّل لاحقًا
              </div>
            </div>
          </div>
          <button
            className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
            data-act="onboarding-skip"
            type="button"
            onClick={() => onDone({ onboarded: true })}
          >
            تخطَّ
          </button>
        </div>

        <ol className="px-space-xl flex items-center gap-space-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1 flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${i <= step ? 'bg-grad-act' : 'bg-surface-container-high'}`} />
              <span className={`font-label-sm text-label-sm ${i === step ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                {s}
              </span>
            </li>
          ))}
        </ol>

        <div className="px-space-xl py-space-lg overflow-auto space-y-space-md min-h-[18rem]">
          {step === 0 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-on-surface font-semibold">اسم المكتب</span>
                <input
                  autoFocus
                  className={input}
                  data-onboarding-office=""
                  placeholder="مثال: مكتب الرافدين للاستنساخ والطباعة"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-on-surface font-semibold">اسمك</span>
                <input
                  className={input}
                  placeholder="يُطبع أسفل الكتاب اسمًا للطابعي، ويُقيَّد مع كل ما يصدر"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
              </label>
            </>
          )}

          {step === 1 && (
            <div className="space-y-space-sm">
              <p className="font-body-md text-body-md text-on-surface-variant">
                الطابعة التي يُرسَل إليها كل شيء ما لم تختر غيرها عند الطبع.
              </p>
              {printers.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface">
                  لم تُعثر على طابعةٍ في هذا الجهاز. وصّلها ثم اخترها من «الإعدادات».
                </p>
              ) : (
                <>
                  {/* طابعات المكتب أوّلًا، وما يحفظ ملفًّا بعدها مكتوبٌ عليه ذلك؛ والمختارة بعلامةٍ وكلمة — كانت ظلًّا باهتًا وحده (البند ١١). */}
                  {[...printers]
                    .sort((a, b) => Number(isFilePrinter(a.name)) - Number(isFilePrinter(b.name)))
                    .map((p) => {
                      const on = printer === p.name;
                      const file = isFilePrinter(p.name);
                      return (
                        <button
                          key={p.name}
                          className={option(on)}
                          data-file-printer={file ? '' : undefined}
                          data-printer={p.name}
                          data-selected={on ? '' : undefined}
                          type="button"
                          onClick={() => setPrinter(p.name)}
                        >
                          <span className={`material-symbols-outlined ${on ? 'text-secondary' : 'text-on-surface-variant'}`}>{on ? 'check_circle' : file ? 'picture_as_pdf' : 'print'}</span>
                          <span className="flex-1 flex flex-col">
                            <span className="font-label-md text-label-md font-semibold text-on-surface">{p.displayName}</span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              {file ? 'تحفظ ملفًّا ولا تطبع على ورق' : p.isDefault ? 'طابعة النظام الافتراضية' : p.description || ' '}
                            </span>
                          </span>
                          {on && <span className="h-6 px-2 rounded-chip bg-primary-fixed text-primary font-label-sm text-label-sm font-bold flex items-center">المختارة</span>}
                        </button>
                      );
                    })}
                  {printer && isFilePrinter(printer) && printers.some((p) => !isFilePrinter(p.name)) && (
                    <p className="font-label-sm text-label-sm text-error" data-file-printer-warning="">
                      المختارة تحفظ ملفًّا ولا تطبع على ورق — اختر طابعة المكتب إن كانت موصولة.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-space-sm">
              <p className="font-body-md text-body-md text-on-surface-variant">
                يكبّر الواجهة كلّها ليريح العين في يومٍ طويل. ولا يمسّ ما يُطبع.
              </p>
              <div className="grid grid-cols-3 gap-space-sm">
                {UI_SCALES.map((s) => (
                  <button
                    key={s.value}
                    className={`${option(scale === s.value)} flex-col !items-center !text-center`}
                    data-scale={s.value}
                    type="button"
                    onClick={() => {
                      setScale(s.value);
                      window.diwan.ui.setZoom(s.value);
                    }}
                  >
                    <span className="text-on-surface font-semibold" style={{ fontSize: 14 * s.value }}>
                      أ ب ت
                    </span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-space-sm">
              <p className="font-body-md text-body-md text-on-surface-variant">ما يقدّمه مكتبك؟ يظهر في الشبّاك وحده — ويُغيَّر من الإعدادات.</p>
              <div className="flex flex-wrap gap-space-xs" data-onboarding-cards="">
                {COUNTER_CARDS.map((c) => {
                  const on = cards.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      aria-pressed={on}
                      className={`h-9 px-3 rounded-chip flex items-center gap-1 font-label-md text-label-md transition-colors ${
                        on ? 'bg-primary-fixed text-primary' : 'bg-surface-container-low text-on-surface-variant line-through'
                      }`}
                      data-onboarding-card={c.id}
                      type="button"
                      onClick={() => setCards((list) => (on ? list.filter((x) => x !== c.id) : [...list, c.id]))}
                    >
                      <span className="material-symbols-outlined text-[16px]">{on ? 'check' : c.icon}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant pt-space-xs">ثم من أين تبدأ؟ — ولا ترويسة مطلوبةٌ قبل العمل.</p>
              {packPicker ? (
                <div className="p-space-md rounded-card bg-surface-container-low border border-outline-variant space-y-space-sm" data-onboarding-pack-picker="">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-label-md text-label-md font-bold text-on-surface">حزم الجهات الجاهزة</h3>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">معاملات رسمية يطلبها الزبائن — اختر ما تحتاجه لمكتبك (لا شيء مختارٌ سلفًا):</p>
                    </div>
                    <button
                      className="text-label-sm font-semibold text-secondary hover:underline"
                      type="button"
                      onClick={() => setPackPicker(false)}
                    >
                      رجوع
                    </button>
                  </div>
                  <div className="space-y-space-xs max-h-48 overflow-y-auto">
                    {bundledPacks.length === 0 ? (
                      <p className="font-body-sm text-body-sm text-on-surface-variant py-2">لا حزم مشحونة في هذا الإصدار.</p>
                    ) : (
                      bundledPacks.map((p) => {
                        const checked = selectedPacks.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-space-sm p-space-sm rounded-card border transition-colors cursor-pointer ${
                              checked ? 'border-cyan bg-grad-sel shadow-sel' : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-high'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 w-4 h-4 rounded text-secondary focus:ring-secondary"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedPacks((prev) =>
                                  e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                );
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-space-xs">
                                <span className="font-label-md text-label-md font-bold text-on-surface">{p.title}</span>
                                <span className="font-label-sm text-label-sm text-on-surface-variant">
                                  {p.counts.templates} نماذج · {p.counts.clips} كليشات
                                </span>
                              </div>
                              <p className="font-body-xs text-body-xs text-on-surface-variant mt-0.5">{p.description}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="pt-space-xs flex items-center justify-between gap-space-sm">
                    <button
                      className="h-10 px-space-md rounded-btn border border-outline-variant shadow-low bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
                      data-act="onboarding-pack-file"
                      type="button"
                      onClick={() => onDone(patch(), 'templates', 'pack')}
                    >
                      من ملفّ حزمة…
                    </button>
                    <button
                      className="h-10 px-space-lg btn-act font-label-md text-label-md font-bold disabled:opacity-50"
                      data-act="onboarding-import-packs"
                      disabled={selectedPacks.length === 0 || importingPacks}
                      type="button"
                      onClick={async () => {
                        setImportingPacks(true);
                        try {
                          for (const packId of selectedPacks) {
                            await window.diwan.content.importBundled(packId);
                          }
                        } finally {
                          setImportingPacks(false);
                          onDone(patch(), 'templates');
                        }
                      }}
                    >
                      {importingPacks ? 'جارٍ الاستيراد...' : `استورد المختار (${selectedPacks.length}) وابدأ`}
                    </button>
                  </div>
                </div>
              ) : null}
              {(
                [
                  { key: 'word', go: 'templates', action: 'folder', icon: 'folder_open', title: 'عندي ملفات Word', hint: 'مجلّدها كلّه إلى المكتبة دفعةً واحدة — تُراجع قبل أن تُحفظ' },
                  { key: 'pack', go: 'templates', action: 'pack', icon: 'inventory_2', title: 'عندي حزمة جاهزة لجهةٍ أو مكتب', hint: 'ملفّ حزمة ديوان بنماذجها وترويساتها — ما ليس عندك يُضاف' },
                  { key: 'letterhead', go: 'letterhead', icon: 'image', title: 'عندي شعارات المدارس والدوائر', hint: 'ارفعها مرّة، فتخرج الترويسات والتصاميم بشعار كلّ جهة ولونها' },
                  { key: 'service', go: 'service', icon: 'storefront', title: 'أبدأ فارغًا — العمل الآن', hint: 'الشبّاك: ورقةٌ فارغة كما في Word، والصور وPDF والمستمسكات' }
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  className={option(false)}
                  data-onboarding-go={o.key}
                  type="button"
                  onClick={() => {
                    if (o.key === 'pack') {
                      setPackPicker((v) => !v);
                    } else {
                      onDone(patch(), o.go, 'action' in o ? o.action : undefined);
                    }
                  }}
                >
                  <span className="w-10 h-10 rounded-ico bg-surface-container-lowest flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary">{o.icon}</span>
                  </span>
                  <span className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">{o.title}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-space-xl py-space-md bg-surface-container-low flex items-center justify-between gap-space-md">
          <button
            className="h-10 px-space-md rounded-btn font-label-md text-label-md text-on-surface hover:bg-surface-container-high disabled:opacity-0"
            disabled={step === 0}
            type="button"
            onClick={() => setStep((s) => s - 1)}
          >
            السابق
          </button>
          {/* الشعار كاملًا — على كحليّ السكّة: حروفه البيضاء لا تُرى على فاتح. */}
          <span className="h-10 px-3 rounded-btn bg-inverse-surface flex items-center" data-brand-logo="">
            <img alt="MADA TECH" className="h-7 object-contain" src={logo} />
          </span>
          {step < STEPS.length - 1 && (
            <button
              className="h-10 px-space-lg btn-act font-label-md text-label-md font-semibold"
              data-act="onboarding-next"
              type="button"
              onClick={() => setStep((s) => s + 1)}
            >
              التالي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
