/**
 * الإعدادات — ما يغيّره صاحب المكتب، في مكانٍ واحد يُعرف من اسمه.
 *
 * كانت إعدادات المكتب والطابعة والمعايرة وحجم الخطّ داخل شاشة «الترويسات»، وزرٌّ
 * اسمه «تبديل الحساب أو خروج» يقود إليها — ولا حسابات في البرنامج. فصارت شاشةً
 * باسمها، ومعها سياسة الخصوصية (أين البيانات وما يُحفظ) والاختصارات الثابتة
 * ورقم الإصدار.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OfficeSettings, PrinterInfo } from '@shared/api';
import { measureFromOffset, offsetFromMeasure } from '@shared/calibration';
import { normalizeLayout } from '@shared/letterhead';
import { SHORTCUTS } from '@shared/shortcuts';
import { UI_SCALES } from '../shell/Onboarding';

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

const input =
  'w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

export default function SettingsScreen({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [dirty, setDirty] = useState(false);
  const [info, setInfo] = useState<{ version: string; dataDir: string } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void Promise.all([window.diwan.settings.get(), window.diwan.printers.list(), window.diwan.ui.info()]).then(
      ([s, p, i]) => {
        setSettings(s);
        setPrinters(p);
        setInfo(i);
      }
    );
  }, []);

  const say = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  };

  const patch = (next: Partial<OfficeSettings>) => {
    setSettings((cur) => (cur ? { ...cur, ...next } : cur));
    setDirty(true);
  };

  const save = () => {
    if (!settings) return;
    void window.diwan.settings.set(settings).then((saved) => {
      setSettings(saved);
      setDirty(false);
      onChanged?.();
      say('حُفظت إعدادات المكتب');
    });
  };

  const card = 'rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col gap-space-sm';
  const title = (icon: string, text: string) => (
    <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
      <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
      {text}
    </h2>
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-settings="">
      <div className="p-space-lg flex flex-col gap-space-md max-w-6xl">
        <header className="flex items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">الإعدادات</h1>
            <p className="font-label-md text-label-md text-on-surface-variant">
              ما يغيّره صاحب المكتب — وسياسة الخصوصية والاختصارات
            </p>
          </div>
          {info && (
            <span className="font-label-md text-label-md text-on-surface-variant" data-version="">
              ديوان — الإصدار {info.version}
            </span>
          )}
        </header>

        {settings && (
          <div className="grid lg:grid-cols-2 gap-space-md items-start">
            {/* ── المكتب ─────────────────────────────────────────────── */}
            <section className={card}>
              <div className="flex items-center justify-between">
                {title('storefront', 'المكتب')}
                {dirty && (
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                    غير محفوظة
                  </span>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">اسم المكتب</span>
                <input className={input} data-setting="officeName" value={settings.officeName} onChange={(e) => patch({ officeName: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">اسم المشغّل — يُقيَّد مع كل كتاب</span>
                <input className={input} data-setting="operatorName" value={settings.operatorName} onChange={(e) => patch({ operatorName: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  بادئة رقم القيد في أرشيف المكتب — والسنة سنة يوم الإصدار، والرقم لا يُطبع على الكتاب
                </span>
                <input className={input} data-setting="serialPrefix" value={settings.serialPrefix} onChange={(e) => patch({ serialPrefix: e.target.value })} />
              </label>
              <div className="flex items-center justify-between gap-space-sm" data-ui-scale="">
                <span className="font-label-sm text-label-sm text-on-surface-variant">حجم الخطّ في البرنامج</span>
                <div className="flex p-0.5 rounded-lg bg-surface-container-low">
                  {UI_SCALES.map((o) => (
                    <button
                      key={o.value}
                      className={`h-8 px-3 rounded-md font-label-md text-label-md ${
                        (settings.uiScale || 1) === o.value
                          ? 'bg-primary-container text-on-primary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                      data-scale={o.value}
                      type="button"
                      onClick={() => {
                        // يُطبَّق ويُحفظ فورًا — تغييرٌ يُرى لا يحتاج «حفظ».
                        window.diwan.ui.setZoom(o.value);
                        void window.diwan.settings.set({ uiScale: o.value }).then((next) =>
                          setSettings((cur) => (cur ? { ...cur, uiScale: next.uiScale } : next))
                        );
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── الطابعة ─────────────────────────────────────────────── */}
            <section className={card}>
              {title('print', 'الطابعة')}
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">الطابعة الافتراضية</span>
                <select
                  className={input}
                  data-setting="defaultPrinter"
                  value={settings.defaultPrinter ?? ''}
                  onChange={(e) => patch({ defaultPrinter: e.target.value || null })}
                >
                  <option value="">— يسأل النظام عند كل طباعة —</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}
                      {p.isDefault ? ' (طابعة النظام)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {printers.length === 0
                  ? 'لا طابعة مثبَّتة على هذا الجهاز'
                  : settings.defaultPrinter
                    ? 'الطباعة تخرج مباشرةً إلى هذه الطابعة بلا حوار'
                    : 'بلا طابعة محدَّدة يُفتح حوار الطباعة في النظام'}
              </p>
              <PrinterCalibration
                printer={settings.defaultPrinter}
                offsets={settings.printOffsets ?? {}}
                onSaved={(printOffsets) => setSettings((cur) => (cur ? { ...cur, printOffsets } : cur))}
                say={say}
              />
            </section>

            {/* ── الترويسات ───────────────────────────────────────────── */}
            <BasmalaSetting
              value={settings.basmala}
              card={card}
              title={title('format_quote', 'البسملة')}
              onChange={(basmala) => setSettings((cur) => (cur ? { ...cur, basmala } : cur))}
              say={say}
            />

            <div className="lg:col-span-2">
              <button
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold disabled:opacity-40"
                data-act="save-settings"
                disabled={!dirty}
                type="button"
                onClick={save}
              >
                حفظ إعدادات المكتب
              </button>
            </div>

            {/* ── الخصوصية ────────────────────────────────────────────── */}
            <section className={card} data-privacy="">
              {title('shield_lock', 'سياسة الخصوصية')}
              <ul className="font-body-sm text-body-sm text-on-surface flex flex-col gap-space-xs list-disc pr-5 leading-7">
                <li>
                  <b>البيانات كلّها على هذا الجهاز</b>، في مجلّد واحد:{' '}
                  <span className="font-mono text-label-sm break-all" dir="ltr">
                    {info?.dataDir ?? '…'}
                  </span>
                </li>
                <li>
                  <b>البرنامج لا يتّصل بالإنترنت أبدًا</b>: لا حساب، ولا خدمة، ولا تحديث تلقائي، ولا يُرسَل شيءٌ إلى
                  أحد.
                </li>
                <li>
                  يُحفظ فيه: النماذج والترويسات والكليشات، وسجلّ الكتب الصادرة، وسجلّ المواطنين ومستمسكاتهم الممسوحة،
                  والطلبات والجهات والتصاميم.
                </li>
                <li>
                  <b>الكتاب الصادر لا يُحذف</b>: هو قيدٌ في الأرشيف ببصمته. وحذف مواطنٍ يحذف مستمسكاته الممسوحة من
                  المخزن، وتبقى الكتب التي صدرت باسمه شاهدًا.
                </li>
                <li>
                  <b>النسخة الاحتياطية تحوي ذلك كلّه</b> — ومنه صور المستمسكات — وهي غير مشفّرة: احفظها في مكانٍ
                  آمن، ولا تتركها على ذاكرةٍ يتداولها الناس.
                </li>
                <li>من يستعمل هذا الجهاز يرى بياناته: احمِ حساب ويندوز بكلمة مرور، وأقفله حين تبتعد.</li>
              </ul>
            </section>

            {/* ── الاختصارات ──────────────────────────────────────────── */}
            <section className={card} data-shortcuts="">
              {title('keyboard', 'الاختصارات الثابتة')}
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                تعمل ولوحة المفاتيح عربيةٌ أو إنجليزية. ولكلّ اختصارٍ زرٌّ ظاهر يفعل الشيء نفسه.
              </p>
              <table className="w-full font-label-md text-label-md">
                <tbody>
                  {SHORTCUTS.map((s) => (
                    <tr key={s.id} className="border-t border-outline-variant/40">
                      <td className="py-1.5 pl-space-sm whitespace-nowrap">
                        <kbd className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-surface-container-high" dir="ltr">
                          {s.keys}
                        </kbd>
                      </td>
                      <td className="py-1.5 text-on-surface">{s.label}</td>
                      <td className="py-1.5 text-on-surface-variant font-label-sm text-label-sm">
                        {s.where} — {s.button}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-secondary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

/**
 * معايرة الطابعة: ورقةٌ تُطبع، وقياسان بالمسطرة يُكتبان كما هما.
 *
 * الطابعات تزيح الطباعة ملّمًا أو اثنين — فتقع الكتابة خارج خانات الاستمارة
 * المطبوعة سلفًا، ويُقصّ طرف الهويّة. والإزاحة لكل طابعة، وللطباعة الورقية وحدها.
 */
function PrinterCalibration({
  printer,
  offsets,
  onSaved,
  say
}: {
  printer: string | null;
  offsets: Record<string, { x: number; y: number }>;
  onSaved: (next: Record<string, { x: number; y: number }>) => void;
  say: (text: string, tone?: 'ok' | 'warn') => void;
}) {
  const current = offsets[printer ?? ''] ?? { x: 0, y: 0 };
  const seed = measureFromOffset(current);
  const [fromRight, setFromRight] = useState(String(seed.fromRight));
  const [fromTop, setFromTop] = useState(String(seed.fromTop));
  useEffect(() => {
    const m = measureFromOffset(offsets[printer ?? ''] ?? { x: 0, y: 0 });
    setFromRight(String(m.fromRight));
    setFromTop(String(m.fromTop));
  }, [printer, offsets]);

  const num = (v: string) => Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.'));
  const box =
    'w-20 h-9 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';

  if (!printer)
    return (
      <p className="font-label-sm text-label-sm text-on-surface-variant" data-calibration="">
        معايرة الطابعة: اختر الطابعة الافتراضية واحفظ، ثم عايرها من هنا.
      </p>
    );

  return (
    <div className="rounded-lg bg-surface-container-low p-space-sm space-y-space-xs" data-calibration="">
      <div className="flex items-center justify-between">
        <span className="font-label-md text-label-md text-on-surface font-semibold">معايرة الطابعة</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant tabular" data-calibration-offset="">
          {current.x || current.y ? `الإزاحة: ${current.x} يمينًا، ${current.y} نزولًا (ملم)` : 'بلا إزاحة'}
        </span>
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        اطبع الورقة، وقِس بُعد العلامة العليا عن حافّتي الورقة (الصحيح ٢٠ ملم)، واكتب القياسين كما هما.
      </p>
      <div className="flex flex-wrap items-center gap-space-sm">
        <button
          className="h-9 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
          data-act="print-calibration"
          type="button"
          onClick={() =>
            void window.diwan.output
              .printCalibration(printer)
              .then((r) => say(r.ok ? 'أُرسلت ورقة المعايرة' : r.reason || 'لم تُطبع', r.ok ? 'ok' : 'warn'))
          }
        >
          <span className="material-symbols-outlined text-[16px]">straighten</span>
          اطبع ورقة المعايرة
        </button>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          من اليمين
          <input className={box} data-measure-right="" inputMode="decimal" value={fromRight} onChange={(e) => setFromRight(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          من الأعلى
          <input className={box} data-measure-top="" inputMode="decimal" value={fromTop} onChange={(e) => setFromTop(e.target.value)} />
        </label>
        <button
          className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold"
          data-act="save-calibration"
          type="button"
          onClick={() => {
            const r = num(fromRight);
            const t = num(fromTop);
            if (!Number.isFinite(r) || !Number.isFinite(t) || r < 5 || r > 35 || t < 5 || t > 35) {
              say('القياس بين ٥ و٣٥ ملم — قِس ثانيةً', 'warn');
              return;
            }
            const next = { ...offsets, [printer]: offsetFromMeasure(r, t) };
            void window.diwan.settings.set({ printOffsets: next }).then((saved) => {
              onSaved(saved.printOffsets);
              say('حُفظت معايرة الطابعة');
            });
          }}
        >
          احفظ القياس
        </button>
      </div>
    </div>
  );
}

/**
 * البسملة تفضيلٌ للمكتب (FOUNDATION §٥): تُشعل وتُطفأ هنا، وبها تبدأ كل ترويسةٍ
 * جديدة. وما حُفظ من الترويسات لا يتغيّر وحده — فمن الجهات ما يكتب بها ومنها ما
 * لا يكتب — وإنما بزرٍّ صريح يذكر عددها قبل أن يُمسّ شيء.
 */
function BasmalaSetting({
  value,
  card,
  title,
  onChange,
  say
}: {
  value: boolean | null;
  card: string;
  title: ReactNode;
  onChange: (next: boolean) => void;
  say: (text: string, tone?: 'ok' | 'warn') => void;
}) {
  const on = value === true;
  /** الترويسات المحفوظة المخالفة للتفضيل — ورأسٌ فُصل من ورقة بسملته في كتله فلا يُعدّ. */
  const [differ, setDiffer] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  const differing = async (want: boolean) =>
    (await window.diwan.letterheads.list()).filter((l) => {
      const layout = normalizeLayout(l.layout);
      return !layout.sheet?.length && layout.basmala.show !== want;
    });

  useEffect(() => {
    setConfirm(false);
    void differing(on).then((list) => setDiffer(list.length));
  }, [on]);

  async function toggle(next: boolean) {
    const saved = await window.diwan.settings.set({ basmala: next });
    onChange(saved.basmala === true);
  }

  async function applyAll() {
    const list = await differing(on);
    for (const l of list) {
      const layout = normalizeLayout(l.layout);
      await window.diwan.letterheads.save({
        id: l.id,
        name: l.name,
        authorityId: l.authorityId ?? null,
        layout: { ...layout, basmala: { ...layout.basmala, show: on } },
        category: l.category ?? null
      });
    }
    setConfirm(false);
    setDiffer(0);
    say(on ? `أُضيفت البسملة إلى ${list.length} ترويسة` : `أُزيلت البسملة من ${list.length} ترويسة`);
  }

  return (
    <section className={card} data-basmala-setting="">
      {title}
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input
          checked={on}
          className="w-4 h-4 accent-secondary"
          data-setting="basmala"
          type="checkbox"
          onChange={(e) => void toggle(e.target.checked)}
        />
        كل ترويسةٍ جديدة تبدأ بـ«بسم الله الرحمن الرحيم»
      </label>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {value === null
          ? 'لم يختر المكتب بعد — وأوّل مرّةٍ تُشعلها في ترويسةٍ تصير تفضيله.'
          : 'وتبقى لكل ترويسةٍ بسملتها تُشعل وتُطفأ من شاشة الترويسات.'}
      </p>
      {differ !== null && differ > 0 && (
        <div className="flex items-center gap-space-xs flex-wrap">
          {confirm ? (
            <>
              <span className="font-label-sm text-label-sm text-on-surface">
                {on ? `تُضاف البسملة إلى ${differ} ترويسة محفوظة` : `تُزال البسملة من ${differ} ترويسة محفوظة`} — تأكيد؟
              </span>
              <button
                className="h-8 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                data-act="basmala-apply-confirm"
                type="button"
                onClick={() => void applyAll()}
              >
                نعم
              </button>
              <button
                className="h-8 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                type="button"
                onClick={() => setConfirm(false)}
              >
                تراجع
              </button>
            </>
          ) : (
            <button
              className="h-8 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              data-act="basmala-apply"
              type="button"
              onClick={() => setConfirm(true)}
            >
              {on ? `أضِفها إلى الترويسات المحفوظة (${differ})` : `أزِلها من الترويسات المحفوظة (${differ})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
