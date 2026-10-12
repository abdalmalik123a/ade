/**
 * خطأ الشبّاك (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: يُقال بالعربية ويبقى حتى يغلقه الموظف، ومعه «افتح التفعيل» إن انتهت المدّة.
 */
import { useCallback } from 'react';
import { errorText } from '../../lib/errors';
import type { Toast, ToastAction } from '../../kit/useToast';

export function useCounterError(
  ctx: {
    say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
    onOpenActivation: (() => void) | undefined;
    dismiss: () => void;
  }
) {
  const { say, onOpenActivation, dismiss } = ctx;

  /**
   * خطأٌ يُقال بالعربية ويبقى حتى يغلقه الموظف (د١٠): كانت رسالة الإصدار تُعرض خامًا (قد تبدأ بـ«Error invoking
   * remote method») وتختفي بعد ثلاث ثوانٍ — ورسالة انتهاء المدّة طويلة. ومعها «افتح التفعيل».
   */
  const sayError = useCallback(
    (e: unknown, fallback: string) => {
      const text = errorText(e, fallback);
      const expired = text.includes('الإعدادات ← التفعيل');
      say(
        text,
        'warn',
        expired && onOpenActivation
          ? {
              label: 'افتح التفعيل',
              run: () => {
                dismiss();
                onOpenActivation();
              }
            }
          : undefined,
        { sticky: true }
      );
    },
    [say, dismiss, onOpenActivation]
  );

  return { sayError };
}
