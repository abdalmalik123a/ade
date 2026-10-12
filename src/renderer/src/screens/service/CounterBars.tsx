/**
 * أشرطة الشبّاك الصغيرة (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولةٌ من `ServiceScreen` كما هي: الخطوات الثلاث في أعلاه، و«نسخة عن …»
 * (د٤)، وتقدّم الطباعة (خطة Production، ٢٫٣)، والرسالة العابرة (د١٠). عرضٌ وحده: الحال كلّها في الشاشة.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count } from '@shared/arabic';
import type { Toast } from '../../kit/useToast';
import type { PrintRun, RepeatOf, Step } from './types';

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: 'pick', label: 'اختر', hint: 'ما يطلبه الزبون' },
  { key: 'fill', label: 'املأ', hint: 'مرّةً واحدة للجميع' },
  { key: 'review', label: 'راجع', hint: 'ثم اطبع' }
];

/** الخطوات الثلاث، وعدد المختار. */
export function StepsHeader({ step, picked }: { step: Step; picked: number[] }) {
  return (
    <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-md">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-space-xs">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center font-label-md text-label-md font-bold ${
              step === s.key
                ? 'bg-primary-container text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {i + 1}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-label-lg text-label-lg text-on-surface">{s.label}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{s.hint}</span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="material-symbols-outlined text-[18px] text-outline-variant mx-space-xs">
              chevron_left
            </span>
          )}
        </div>
      ))}
      <span className="flex-1" />
      {picked.length > 0 && (
        <span className="font-label-md text-label-md text-on-surface">
          المختار: {count(picked.length, 'ورقة')}
        </span>
      )}
    </div>
  );
}

/** «نسخة عن …» (د٤): والأصل يبقى كما خرج — إلا أن يُختار إبطاله بسببه. */
export function RepeatOfBar({ repeatOf, setRepeatOf }: { repeatOf: RepeatOf; setRepeatOf: Dispatch<SetStateAction<RepeatOf | null>> }) {
  return (
    <div
      className="shrink-0 px-space-lg py-space-xs bg-tertiary-container text-on-tertiary-container flex flex-wrap items-center gap-space-sm font-label-md text-label-md"
      data-repeat-of={repeatOf.serial}
    >
      <span className="material-symbols-outlined text-[18px]">content_copy</span>
      <span>
        نسخة عن <b className="tabular">{repeatOf.serial}</b> برقمٍ جديد — والأصل يبقى في السجلّ كما خرج.
      </span>
      <label className="flex items-center gap-1 cursor-pointer" title="بعد أن تصدر هذه النسخة يُبطَل الأصل بسببه — ولا يُحذف ولا يُعاد طبعه">
        <input
          checked={repeatOf.voidIt}
          className="w-4 h-4 accent-secondary"
          data-act="void-original"
          type="checkbox"
          onChange={(e) => setRepeatOf({ ...repeatOf, voidIt: e.target.checked })}
        />
        وأبطل الأصل لأنّه صدر خطأً
      </label>
      {repeatOf.voidIt && (
        <input
          aria-label="سبب الإبطال"
          className="h-8 w-56 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
          data-void-reason=""
          placeholder="سبب الإبطال"
          value={repeatOf.reason}
          onChange={(e) => setRepeatOf({ ...repeatOf, reason: e.target.value })}
        />
      )}
    </div>
  );
}

/** الطباعة جاريةً «يُطبع… ٣ من ٥»، أو متوقّفةً بسببها و«أكمل الطباعة» و«اتركها». */
export function PrintRunBar({ printRun, resumePrint, dropPrint }: { printRun: PrintRun; resumePrint: () => Promise<void>; dropPrint: () => Promise<void> }) {
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-space-sm px-space-md py-space-sm rounded-xl shadow-lg bg-surface-container-highest text-on-surface font-label-md text-label-md"
      data-print-run={printRun.running ? 'running' : 'stopped'}
      data-print-sent={printRun.sent}
      data-print-total={printRun.total}
    >
      <span className={`material-symbols-outlined text-[20px] ${printRun.running ? 'animate-spin text-secondary' : 'text-error'}`}>
        {printRun.running ? 'progress_activity' : 'print_error'}
      </span>
      {printRun.running ? (
        <span>
          يُطبع… {printRun.sent} من {printRun.total}
        </span>
      ) : (
        <>
          <span>
            توقّفت الطباعة: طُبعت {printRun.sent} من {printRun.total}
            {printRun.reason ? ` — ${printRun.reason}` : ''}
          </span>
          {printRun.id && (
            <button
              className="h-8 px-space-md rounded-lg bg-secondary text-on-secondary font-bold"
              data-act="print-resume"
              type="button"
              onClick={() => void resumePrint()}
            >
              أكمل الطباعة
            </button>
          )}
          <button
            className="h-8 px-space-sm rounded-lg hover:bg-surface-container-high"
            data-act="print-drop"
            type="button"
            onClick={() => void dropPrint()}
          >
            اتركها
          </button>
        </>
      )}
    </div>
  );
}

/** الرسالة العابرة — بزرّها («تراجع»، «افتح التفعيل») وبـ✕ إن بقيت حتى تُغلق. */
export function CounterToast({ toast, dismiss }: { toast: Toast; dismiss: () => void }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[min(90vw,48rem)] px-space-md py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
        toast.tone === 'warn'
          ? 'bg-error-container text-on-error-container'
          : 'bg-primary-container text-on-primary'
      }`}
    >
      {toast.text}
      {toast.action && (
        <button
          className="mr-space-md underline font-bold"
          data-act="toast-action"
          type="button"
          onClick={toast.action.run}
        >
          {toast.action.label}
        </button>
      )}
      {toast.sticky && (
        <button
          aria-label="أغلق الرسالة"
          className="mr-space-sm align-middle w-7 h-7 rounded-full hover:bg-black/10 inline-flex items-center justify-center"
          data-act="toast-close"
          title="أغلق"
          type="button"
          onClick={dismiss}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  );
}
