/**
 * «؟» في أعلى الصفحة: يشرحها وحدها — ماذا يُعمل هنا وأهمّ مفاتيحه (`shared/overview.ts`). بارزٌ حتى أوّل عملٍ يخرج من
 * المكتب، ثم يهدأ (`quiet`) زرًّا صغيرًا اسمه «مساعدة» ولا يختفي — فالموظف الذي يُعيَّن بعد شهرٍ يجده (البند ٨، الحلّ الوسط
 * بقرار المالك ١١ تشرين الأول ٢٠٢٦ بدل الاختفاء). والنظرة كلّها منه ومن «التنبيهات».
 */
import { useEffect, useRef, useState } from 'react';
import { PAGE_HELP } from '@shared/overview';
import type { RouteKey } from '@shared/routes';

export default function PageHelp({ route, quiet, onOverview }: { route: RouteKey; quiet: boolean; onOverview: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const help = PAGE_HELP[route];

  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        className={
          quiet
            ? 'h-10 px-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md flex items-center gap-1'
            : 'h-10 w-10 rounded-full bg-secondary-fixed text-on-surface hover:bg-surface-container-high font-headline-sm text-headline-sm font-bold flex items-center justify-center shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
        }
        data-act="page-help"
        data-quiet={quiet ? '1' : undefined}
        title="ما في هذه الصفحة"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        {quiet ? (
          <>
            <span className="material-symbols-outlined text-[18px]">help</span>
            مساعدة
          </>
        ) : (
          '؟'
        )}
      </button>
      {open && (
        <div className="absolute top-12 left-0 z-50 w-[340px] rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-xs" data-page-help={route}>
          <span className="font-label-lg text-label-lg text-on-surface font-semibold">{help.title}</span>
          <p className="font-body-md text-body-md text-on-surface-variant leading-7">{help.body}</p>
          <button
            className="self-start font-label-md text-label-md text-secondary hover:underline"
            data-act="page-help-overview"
            type="button"
            onClick={() => {
              setOpen(false);
              onOverview();
            }}
          >
            النظرة العامة كلّها
          </button>
        </div>
      )}
    </div>
  );
}
