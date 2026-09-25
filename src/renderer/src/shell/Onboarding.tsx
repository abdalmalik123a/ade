/**
 * معالج البداية — أول تشغيل.
 *
 * البرنامج يبدأ فارغًا من كل ما يخصّ الجهة (§٢)، فكانت أول شاشةٍ يراها صاحب
 * المكتب «المكتبة فارغة» في كل مكان. والمعالج أربع خطوات قصيرة: من أنتم، وأيّ
 * طابعة، وأيّ حجم خطٍّ يريح العين، ومن أين تبدأون. وكلّها تُتخطّى — لا شيء
 * فيها إلزاميّ، وتُعدَّل كلّها لاحقًا من «الترويسات والشعارات».
 */
import { useState } from 'react';
import type { OfficeSettings, PrinterInfo } from '@shared/api';
import type { RouteKey } from '@shared/routes';

export const UI_SCALES = [
  { value: 1, label: 'عادي' },
  { value: 1.15, label: 'كبير' },
  { value: 1.3, label: 'أكبر' }
] as const;

const STEPS = ['المكتب', 'الطابعة', 'حجم الخط', 'البداية'];

export default function Onboarding({
  settings,
  printers,
  onDone
}: {
  settings: OfficeSettings;
  printers: PrinterInfo[];
  onDone: (patch: Partial<OfficeSettings>, go?: RouteKey) => void;
}) {
  const [step, setStep] = useState(0);
  const [officeName, setOfficeName] = useState(settings.officeName);
  const [operatorName, setOperatorName] = useState(settings.operatorName);
  const [printer, setPrinter] = useState<string | null>(
    settings.defaultPrinter ?? printers.find((p) => p.isDefault)?.name ?? null
  );
  const [scale, setScale] = useState(settings.uiScale || 1);

  const patch = (): Partial<OfficeSettings> => ({
    officeName: officeName.trim(),
    operatorName: operatorName.trim(),
    defaultPrinter: printer,
    uiScale: scale,
    onboarded: true
  });

  const input =
    'w-full h-11 px-space-md rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary';
  const option = (on: boolean) =>
    `w-full p-space-md rounded-xl text-right flex items-center gap-space-md transition-colors ${
      on ? 'bg-secondary-fixed ring-2 ring-secondary' : 'bg-surface-container-low hover:bg-surface-container-high'
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary-container/55 backdrop-blur-sm p-space-lg" data-onboarding="">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-container-lowest shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div className="px-space-xl pt-space-lg pb-space-md flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined">account_balance</span>
            </span>
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
              <span className={`h-1.5 rounded-full ${i <= step ? 'bg-primary-container' : 'bg-surface-container-high'}`} />
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
                  لم تُعثر على طابعةٍ في هذا الجهاز. وصّلها ثم اخترها من «الترويسات والشعارات».
                </p>
              ) : (
                printers.map((p) => (
                  <button key={p.name} className={option(printer === p.name)} type="button" onClick={() => setPrinter(p.name)}>
                    <span className="material-symbols-outlined text-secondary">print</span>
                    <span className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">{p.displayName}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {p.isDefault ? 'طابعة النظام الافتراضية' : p.description || ' '}
                      </span>
                    </span>
                  </button>
                ))
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
              <p className="font-body-md text-body-md text-on-surface-variant">من أين تبدأ؟</p>
              {(
                [
                  { go: 'templates', icon: 'folder_open', title: 'عندي ملفات Word', hint: 'استوردها من «مكتبة النماذج» — مجلّدًا كاملًا دفعةً واحدة' },
                  { go: 'letterhead', icon: 'image', title: 'عندي شعارات المدارس والدوائر', hint: 'ارفعها مرّة، فتخرج الترويسات والتصاميم بشعار كلّ جهة ولونها' },
                  { go: 'service', icon: 'storefront', title: 'أبدأ العمل الآن', hint: 'الشبّاك: اختر ما يطلبه الزبون واملأه واطبع' }
                ] as const
              ).map((o) => (
                <button
                  key={o.go}
                  className={option(false)}
                  data-onboarding-go={o.go}
                  type="button"
                  onClick={() => onDone(patch(), o.go)}
                >
                  <span className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shrink-0">
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

        <div className="px-space-xl py-space-md bg-surface-container-low flex items-center justify-between">
          <button
            className="h-10 px-space-md rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-high disabled:opacity-0"
            disabled={step === 0}
            type="button"
            onClick={() => setStep((s) => s - 1)}
          >
            السابق
          </button>
          {step < STEPS.length - 1 && (
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
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
