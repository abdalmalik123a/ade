/**
 * البرنامج يُغلق: يُفرَغ ما لم يُحفظ (مسودة المحرّر) ثم يمضي الإغلاق — ويأخذ نسخته التلقائية إن كانت، فيُقال ذلك لا يُترك
 * نافذةً لا تستجيب. كان في `App.tsx` حتى بلغ سقفه، فنُقل كما هو (محادثة «الشبّاك واليوم الأوّل»).
 */
import { useEffect, useState } from 'react';
import { flushBeforeClose } from '../lib/beforeClose';

export default function ClosingOverlay() {
  const [closing, setClosing] = useState(false);
  useEffect(
    () =>
      window.diwan.ui.onClosing(({ backup }) => {
        if (backup) setClosing(true);
        void flushBeforeClose().finally(() => window.diwan.ui.closeReady());
      }),
    []
  );
  if (!closing) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-scrim/50" data-closing="">
      <div className="rounded-2xl bg-surface-container-lowest px-space-lg py-space-md shadow-2xl flex items-center gap-space-sm font-label-lg text-label-lg text-on-surface">
        <span className="material-symbols-outlined animate-spin text-secondary">progress_activity</span>
        تُؤخذ النسخة التلقائية قبل الإغلاق…
      </div>
    </div>
  );
}
