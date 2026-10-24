/**
 * مضيف الكلمة العابرة (`notice.ts`): أسفل النافذة ثوانيَ، ومعها زرٌّ إن كان («افتحه») فتبقى أطول، و✕ يغلقها.
 */
import { useEffect } from 'react';
import { mountNoticeHost } from './notice';
import { useToast } from './useToast';

export default function NoticeHost() {
  const { toast, say, dismiss } = useToast(6000);
  useEffect(() => mountNoticeHost((text, action) => say(text, 'ok', action)), [say]);
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-space-md left-1/2 -translate-x-1/2 z-[70] max-w-xl w-[calc(100%-2rem)] rounded-card bg-inverse-surface text-inverse-on-surface shadow-card px-space-md py-space-sm flex items-center gap-space-sm"
      data-notice=""
      role="status"
    >
      <span className="material-symbols-outlined text-[20px] shrink-0">cloud_done</span>
      <span className="flex-1 min-w-0 font-label-md text-label-md">{toast.text}</span>
      {toast.action && (
        <button
          className="h-8 px-3 rounded-btn bg-inverse-primary text-on-primary-fixed font-label-md text-label-md font-bold shrink-0"
          data-act="notice-action"
          type="button"
          onClick={() => {
            toast.action?.run();
            dismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="w-8 h-8 rounded-btn hover:bg-white/10 shrink-0" aria-label="أغلق" type="button" onClick={dismiss}>
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
