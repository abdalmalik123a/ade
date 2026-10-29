/** نافذة لوحة تبقى مركّبة عند إغلاقها، لحفظ نص الدفعة وحالة الربط. */
import { useEffect, useRef, type ReactNode } from 'react';
import { useEscape } from '../../kit/useEscape';
import { trapTab } from '../../kit/trapTab';

export default function EditorPanelDialog({ open, title, name, close, children }: {
  open: boolean; title: string; name: string; close: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(close, open);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('[data-close-panel]')?.focus();
    const onKey = (e: KeyboardEvent) => trapTab(e, ref.current, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (before?.isConnected) before.focus(); };
  }, [open]);
  return (
    <div hidden={!open} className={open ? 'fixed inset-0 z-40 bg-scrim/40 flex items-center justify-center p-space-md' : 'hidden'}
      role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label={title} data-editor-panel={name} dir="rtl">
      <div ref={ref} className="surface-panel w-[min(820px,94vw)] max-h-[86vh] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center justify-between gap-space-sm px-space-md py-space-sm bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <button type="button" data-close-panel className="h-8 px-space-md rounded-btn bg-surface-container-high text-on-surface" onClick={close}>أغلق</button>
        </header>
        <div className="overflow-auto p-space-md space-y-space-md">{children}</div>
      </div>
    </div>
  );
}
