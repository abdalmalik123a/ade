/**
 * شريط الأخطاء (المرحلة ٧ — «لا خطأ يُبلع»).
 *
 * `ErrorBoundary` يلتقط ما ينكسر في الرسم؛ أمّا فعلٌ فشل بعد نقرة (وعدٌ رُفض ولم
 * يلتقطه أحد) فكان يذهب إلى وحدة التحكّم وحدها: الموظف ينقر فلا يحدث شيء. فكلّ فشلٍ
 * لم يُلتقط — في الواجهة أو في العملية الرئيسة — يُقال هنا بسببه، ويُسجَّل.
 *
 * ولا يُمنع التبليغ الأصلي (`preventDefault`): المِقْود يعدّه خطأً ويُفشل السيناريو،
 * فالشريط للموظف لا ستارٌ على العطل.
 */
import { useEffect, useState } from 'react';
import { cleanError } from '../lib/errors';

const ARABIC = /[ء-ي]/;

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export default function ErrorBar() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const push = (m: string) => {
      const clean = cleanError(m) || m;
      setErrors((list) => [...list.slice(-4), clean]);
    };
    const onRejection = (e: PromiseRejectionEvent) => push(messageOf(e.reason));
    const onError = (e: ErrorEvent) => push(e.message || messageOf(e.error));
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    const off = window.diwan.ui.onError(push);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
      off();
    };
  }, []);

  if (!errors.length) return null;
  const last = errors[errors.length - 1]!;
  const readable = ARABIC.test(last);
  return (
    <div
      className="fixed bottom-space-md left-1/2 -translate-x-1/2 z-[80] max-w-2xl w-[calc(100%-2rem)] rounded-xl bg-error-container text-on-error-container shadow-2xl p-space-sm flex items-start gap-space-sm"
      data-error-bar=""
      role="alert"
    >
      <span className="material-symbols-outlined text-[22px] mt-0.5">error</span>
      <div className="flex-1 min-w-0">
        <p className="font-label-md text-label-md font-bold">
          تعذّر إتمام العملية{errors.length > 1 ? ` (${errors.length})` : ''}
        </p>
        <p className="font-body-md text-body-md" data-error-message="">
          {readable ? last : 'خطأٌ داخلي — سُجّل في سجلّ الأخطاء. أعد المحاولة، وإن تكرّر فأخبرنا به.'}
        </p>
        {!readable && (
          <p className="font-mono text-[11px] opacity-80 truncate" dir="ltr" title={last}>
            {last}
          </p>
        )}
      </div>
      <button className="w-8 h-8 rounded-lg hover:bg-on-error-container/10 flex items-center justify-center" title="إغلاق" type="button" onClick={() => setErrors([])}>
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
