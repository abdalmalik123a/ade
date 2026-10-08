/**
 * رسالةٌ تُعرض ثوانيَ ثم تختفي (ج١).
 *
 * ويُلغى مؤقّت السابقة أولًا — وإلا محا مؤقّتٌ قديم رسالةً جديدة بعد لحظةٍ من ظهورها، فيظنّ الموظف أنّ
 * العملية لم تقل شيئًا. وكانت هذه الدالّة منسوخةً في أربع عشرة شاشة، وثلاثٌ منها (العملاء، والطلبات،
 * وحوار نسخ الهوية) بلا إلغاء. ويُلغى المؤقّت أيضًا مع الشاشة فلا يكتب في شاشةٍ فُكّت.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Toast = { text: string; tone: 'ok' | 'warn' };

export function useToast(ms = 3200): { toast: Toast | null; say: (text: string, tone?: Toast['tone']) => void } {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);

  const say = useCallback(
    (text: string, tone: Toast['tone'] = 'ok') => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      setToast({ text, tone });
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, ms);
    },
    [ms]
  );

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  return { toast, say };
}
