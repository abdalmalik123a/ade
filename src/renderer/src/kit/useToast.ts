/**
 * رسالةٌ تُعرض ثوانيَ ثم تختفي (ج١) — وقد يلحقها زرٌّ («تراجع») فتبقى أطول (ج٢).
 *
 * ويُلغى مؤقّت السابقة أولًا — وإلا محا مؤقّتٌ قديم رسالةً جديدة بعد لحظةٍ من ظهورها، فيظنّ الموظف أنّ
 * العملية لم تقل شيئًا. وكانت هذه الدالّة منسوخةً في أربع عشرة شاشة، وثلاثٌ منها (العملاء، والطلبات،
 * وحوار نسخ الهوية) بلا إلغاء. ويُلغى المؤقّت أيضًا مع الشاشة فلا يكتب في شاشةٍ فُكّت.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastAction = { label: string; run: () => void };

export type Toast = { text: string; tone: 'ok' | 'warn'; action?: ToastAction };

/** رسالةٌ فيها زرّ تبقى هذه المدّة على الأقل — ثوانيَ يتسع لها قرار الموظف. */
const ACTION_MS = 8000;

export function useToast(ms = 3200): {
  toast: Toast | null;
  say: (text: string, tone?: Toast['tone'], action?: ToastAction) => void;
  dismiss: () => void;
} {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const say = useCallback(
    (text: string, tone: Toast['tone'] = 'ok', action?: ToastAction) => {
      clear();
      setToast({ text, tone, action });
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, action ? Math.max(ms, ACTION_MS) : ms);
    },
    [ms, clear]
  );

  const dismiss = useCallback(() => {
    clear();
    setToast(null);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { toast, say, dismiss };
}
