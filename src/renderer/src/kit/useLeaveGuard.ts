/**
 * شاشةٌ فيها عملٌ يضيع بالمغادرة ولا تحرسه مسودّةٌ (ج١) — الأسئلة، والترويسة، وجلسة PDF، والمصمّم.
 *
 * تُسجَّل ما دامت مركّبة، فيسأل «اترك بلا حفظ؟» عند الانتقال في الشريط وعند إغلاق البرنامج
 * (السجلّ في `leaveGuard.ts`). والدالّة المُعادة تُنادى قبل ما يستبدل العملَ داخل الشاشة نفسها
 * («ورقة جديدة»، «افتح محفوظة»): `if (!(await leave())) return;`.
 *
 * وما تحرسه مسودّةٌ أو معلّقة (المحرّر، والشبّاك) لا يستعمل هذا — فلا يُسأل عمّا هو محفوظ.
 */
import { useCallback, useEffect, useRef } from 'react';
import { addGuard, confirmLeave, touchGuards, type LeaveGuard } from './leaveGuard';

export function useLeaveGuard(options: { label: string; dirty: boolean; save?: () => Promise<boolean> }): () => Promise<boolean> {
  const latest = useRef(options);
  latest.current = options;

  // حارسٌ واحد ثابت الهوية يقرأ آخر قيمٍ — فلا يُعاد تسجيله مع كلّ حرف.
  const guard = useRef<LeaveGuard>({
    get label() {
      return latest.current.label;
    },
    isDirty: () => latest.current.dirty,
    get save() {
      return latest.current.save;
    }
  });

  useEffect(() => addGuard(guard.current), []);
  useEffect(() => {
    touchGuards();
  }, [options.dirty, options.label]);

  return useCallback(() => confirmLeave(guard.current), []);
}
