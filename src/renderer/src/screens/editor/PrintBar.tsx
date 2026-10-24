/**
 * أسفل لوح المحرّر (تقسيمه بعد ١٫٧٫٠): رسائل الخطأ والنجاح، و«اطبع» بعدد أوراقه ظاهرًا أبدًا (البند ٤)، و«طباعة تجريبية» تحته،
 * وحال المسودة.
 */
import type { Dispatch, SetStateAction } from 'react';
import { countIn } from '@shared/arabic';

type Props = {
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  toast: string | null;
  busy: boolean;
  requestIssue: () => void;
  blocked: boolean;
  measure: { headRatio: number | null; pages: number | null };
  printDraftSheet: () => Promise<void>;
  saving: boolean;
  savedAt: Date | null;
  hasContent: boolean;
};

export default function PrintBar({
  error,
  setError,
  toast,
  busy,
  requestIssue,
  blocked,
  measure,
  printDraftSheet,
  saving,
  savedAt,
  hasContent
}: Props) {
  return (
    <div className="shrink-0 px-space-md pt-space-sm pb-space-md flex flex-col gap-space-xs border-t border-outline-variant/40" data-editor-print="">
      {error && (
        <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md" data-editor-error="">
          <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
          <span className="flex-1">{error}</span>
          <button className="material-symbols-outlined text-[16px]" type="button" onClick={() => setError(null)}>
            close
          </button>
        </div>
      )}
      {toast && (
        <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
          <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
          <span className="flex-1 break-all">{toast}</span>
        </div>
      )}
      <button
        className="h-11 btn-act font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
        data-act="issue"
        disabled={busy}
        type="button"
        onClick={requestIssue}
      >
        <span className="material-symbols-outlined text-[18px]">print</span>
        {/* لغة المكتب (ن٦): «اطبع» لا «أصدر» — والحفظ في السجلّ يجري وحده. وبعدد أوراقه كما في الشبّاك. */}
        {busy ? 'يُطبع الكتاب…' : blocked ? 'اطبع — بعد إكمال ما يمنع' : measure.pages ? `اطبع ${countIn(measure.pages, 'ورقة')}` : 'اطبع'}
      </button>
      <button
        className="self-start h-7 px-1 rounded font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface hover:underline flex items-center gap-1 disabled:opacity-40"
        data-act="print-trial"
        disabled={busy}
        title="ورقةٌ للمراجعة على الطابعة — لا رقم لها ولا أثر في السجلّ"
        type="button"
        onClick={() => void printDraftSheet()}
      >
        <span className="material-symbols-outlined text-[16px]">preview</span>
        طباعة تجريبية — لا تُحفظ في السجلّ
      </button>
      <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
        <span className={`material-symbols-outlined text-[16px] ${saving ? 'animate-spin' : 'text-secondary'}`}>
          {saving ? 'progress_activity' : savedAt ? 'cloud_done' : 'cloud_off'}
        </span>
        {saving
          ? 'تُحفظ المسودة…'
          : savedAt
            ? `حُفظت المسودة ${savedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })} في «قيد العمل»`
            : hasContent
              ? 'تُحفظ مسودةً تلقائيًّا بعد ثوانٍ من الكتابة'
              : 'لا مسودة'}
      </div>
    </div>
  );
}
