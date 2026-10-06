/**
 * «نظرة عامة على ديوان» (الموجة ٢، بقرار المالك): مرّةً بعد التنصيب تمرّ على الصفحات صفحةً صفحة — تُعتّم الشاشة إلا ما
 * يُشرح، وبجانبه بطاقةٌ صغيرة: ما يُعمل هنا وأهمّ مفاتيحه (`shared/overview.ts`). شرحٌ لا مهمّة: لا تطلب عملًا ولا تغيّر
 * شيئًا، و«تخطَّ» ظاهرٌ دائمًا وEsc يُغلقها — «لا يشعر أنّه يُساق». وتُعاد من «التنبيهات» و«؟» متى أُريدت — في مكانها
 * بلا `onNavigate`: لا تغادر صفحة الموظف (`overviewSteps`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OverviewStep } from '@shared/overview';
import type { RouteKey } from '@shared/routes';

const indic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const CARD_W = 360;
/** أوّل ما يطابق ظاهرًا بحجمه — لا نسخةٌ مخفيّة منه. */
const visible = (selector: string) =>
  [...document.querySelectorAll(selector)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
const MARGIN = 16;
const GAP = 12;

export default function Overview({
  steps,
  onNavigate,
  onClose
}: {
  steps: OverviewStep[];
  /** يعرض صفحة الخطوة — وبغيره تبقى الصفحة المعروضة كما هي. */
  onNavigate?: (route: RouteKey) => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  // كلّ خطوةٍ صفحتها: تُعرض، ويُنتظر ما يُضاء فيها حتى يُرسم ظاهرًا — فالشبّاك يبقى مرسومًا مخفيًّا خلف غيره، وما فيه
  // بلا حجمٍ حتى يُعرض. وإن لم يوجد شُرح وسط الشاشة.
  useEffect(() => {
    onNavigate?.(step.route);
    setRect(null);
    let tries = 0;
    const find = () => {
      const el = step.target ? visible(step.target) : null;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        setRect(el.getBoundingClientRect());
        return true;
      }
      return ++tries > 20;
    };
    if (find()) return;
    const timer = window.setInterval(() => find() && window.clearInterval(timer), 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // والنظرة تحجب ما تحتها عن لوحة المفاتيح أيضًا: لا يُكتب في حقلٍ خلفها، ولا يعمل اختصار صفحةٍ (Ctrl+F، F4، Enter…).
  // Esc يُغلقها، وEnter والأسهم تتنقّل بين خطواتها — والسهم الأيسر «التالي» في العربية.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      // زرٌّ فيها بلغه Tab يُضغط بـEnter كعادته.
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement && root.current?.contains(e.target)) return;
      if (e.key !== 'Tab') e.preventDefault();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' || e.key === 'ArrowLeft') {
        if (last) onClose();
        else setI((n) => n + 1);
      } else if (e.key === 'ArrowRight') setI((n) => Math.max(0, n - 1));
    };
    const onResize = () => {
      const el = step.target ? visible(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    };
  }, [step, last, onClose]);

  // البطاقة بجانب ما يُضاء: تحته إن اتّسع، وإلا فوقه — وبجانب السكّة لعناصرها — ولا تخرج من الشاشة.
  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = card.current?.offsetHeight ?? 200;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    if (!rect) {
      setPos({ top: (vh - h) / 2, left: (vw - CARD_W) / 2 });
      return;
    }
    if (rect.left > vw - 140) {
      setPos({ top: clamp(rect.top, MARGIN, vh - h - MARGIN), left: rect.left - CARD_W - GAP });
      return;
    }
    const left = clamp(rect.right - CARD_W, MARGIN, vw - CARD_W - MARGIN);
    const below = rect.bottom + GAP;
    setPos({ top: below + h + MARGIN <= vh ? below : Math.max(MARGIN, rect.top - GAP - h), left });
  }, [rect, i]);

  const pad = 6;
  return (
    <div
      ref={root}
      className={`fixed inset-0 z-[80] ${rect ? '' : 'bg-scrim/55'}`}
      data-overview=""
      data-overview-route={step.route}
      data-overview-step={i}
      data-overview-total={steps.length}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {rect && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          data-overview-spot=""
          // الإطار والتعتيم ظلٌّ واحد (حلقة Tailwind ظلٌّ أيضًا فيمحوها هذا): أبيضُ ثم أزرقُ — يُرى على الصفحة الفاتحة
          // وعلى السكّة الداكنة.
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 2px rgb(255 255 255), 0 0 0 4px rgb(var(--c-secondary)), 0 0 0 9999px rgb(var(--c-scrim) / 0.55)'
          }}
        />
      )}
      <div
        ref={card}
        className="absolute rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-xs"
        style={{ width: CARD_W, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      >
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-label-sm text-label-sm text-on-surface-variant tabular">
            {indic(i + 1)} من {indic(steps.length)}
          </span>
          <button className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" data-act="overview-skip" type="button" onClick={onClose}>
            تخطَّ
          </button>
        </div>
        <span className="font-headline-sm text-headline-sm text-on-surface font-bold" data-overview-title="">
          {step.title}
        </span>
        <p className="font-body-md text-body-md text-on-surface-variant leading-7">{step.body}</p>
        <div className="flex items-center justify-between gap-space-sm pt-space-xs">
          <button
            className="h-9 px-space-md rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-high disabled:opacity-0"
            data-act="overview-prev"
            disabled={i === 0}
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
          >
            السابق
          </button>
          <button
            className="h-9 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
            data-act="overview-next"
            type="button"
            onClick={() => (last ? onClose() : setI((n) => n + 1))}
          >
            {last ? 'ابدأ العمل' : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  );
}
