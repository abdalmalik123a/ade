/**
 * «التنبيهات» في الشريط العلوي (د٧): ما ينتظر المكتب — الطلبات المتأخّرة وما موعده اليوم وما جهز ينتظر صاحبه (ومعه «انسخ
 * رسالة: طلبكم جاهز»، د٨)، والمسودات والمعاملات المعلّقة، والنسخة الاحتياطية إن طال عهدها. وكانت نافذةً تُقاطع الموظف كلّ
 * صباح عند الإقلاع؛ فصارت جرسًا برقمه يُفتح متى شاء (بقرار المالك ٦ تشرين الأول). وكلّ سطرٍ يقود إلى مكانه، وفي أسفله
 * «نظرة عامة على ديوان».
 */
import { useEffect, useRef, useState } from 'react';
import type { AgendaOrder, TodayAgenda } from '@shared/api';
import { agendaCount, readyMessage } from '@shared/agenda';
import { sinceText } from '@shared/dates';
import type { RouteKey } from '@shared/routes';

export default function NotificationsBell({
  agenda,
  officeName,
  onNavigate,
  onOverview
}: {
  agenda: TodayAgenda | null;
  officeName: string;
  onNavigate: (route: RouteKey) => void;
  onOverview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const count = agendaCount(agenda);

  // يُغلق بالنقر خارجه وبـEsc — كقائمة «قنواتنا».
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

  const go = (route: RouteKey) => {
    setOpen(false);
    onNavigate(route);
  };

  const orderLine = (o: AgendaOrder, late: boolean) => (
    <li key={o.id} className="flex items-center gap-space-xs font-label-md text-label-md">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${late ? 'bg-error' : 'bg-secondary'}`} />
      <span className="flex-1 truncate text-on-surface">
        {o.customer} — {o.title}
      </span>
      {o.dueDate && <span className={`font-mono text-label-sm ${late ? 'text-error' : 'text-on-surface-variant'}`}>{o.dueDate}</span>}
    </li>
  );

  const a = agenda;
  const waiting = (a?.drafts ?? 0) + (a?.parked ?? 0);
  const empty = !a || (a.overdue.length + a.dueToday.length + a.ready.length + waiting === 0 && !a.backupDue && !a.autoBackupError);

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        className="relative h-10 w-10 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface flex items-center justify-center shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
        data-act="notifications"
        data-count={count}
        title="التنبيهات — ما ينتظرك"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {/* كشارة «قيد العمل» في السكّة: بحجمها وأرقامها. */}
        {count > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold flex items-center justify-center" data-badge="">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-12 left-0 z-50 w-[380px] max-h-[75vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden"
          data-notifications=""
        >
          <div className="px-space-md py-space-sm bg-surface-container-low flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[20px]">notifications</span>
            <span className="font-label-lg text-label-lg text-on-surface font-semibold">التنبيهات</span>
          </div>

          <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-md">
            {empty && <span className="font-label-md text-label-md text-on-surface-variant">لا شيء ينتظرك — كلّ شيءٍ في وقته.</span>}

            {a && (a.overdue.length > 0 || a.dueToday.length > 0) && (
              <section className="flex flex-col gap-space-xs" data-today-orders="">
                <div className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                    {a.overdue.length > 0 && <span className="text-error">{a.overdue.length} متأخّرة</span>}
                    {a.overdue.length > 0 && a.dueToday.length > 0 && ' · '}
                    {a.dueToday.length > 0 && `${a.dueToday.length} موعدها اليوم`}
                  </span>
                  <button className="text-secondary font-label-md text-label-md hover:underline" type="button" onClick={() => go('orders')}>
                    الطلبات
                  </button>
                </div>
                <ul className="flex flex-col gap-1">
                  {a.overdue.slice(0, 5).map((o) => orderLine(o, true))}
                  {a.dueToday.slice(0, 5).map((o) => orderLine(o, false))}
                </ul>
              </section>
            )}

            {a && a.ready.length > 0 && (
              <section className="flex flex-col gap-space-xs" data-today-ready="">
                <div className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold">{a.ready.length} جاهزة تنتظر أصحابها</span>
                  <button className="text-secondary font-label-md text-label-md hover:underline" type="button" onClick={() => go('orders')}>
                    الطلبات
                  </button>
                </div>
                <ul className="flex flex-col gap-1">
                  {a.ready.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex items-center gap-space-xs font-label-md text-label-md">
                      <span className="flex-1 truncate text-on-surface">
                        {o.customer} — {o.title}
                        {o.phone && <span className="font-mono text-label-sm text-on-surface-variant"> · {o.phone}</span>}
                      </span>
                      <button
                        className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high text-secondary font-label-sm text-label-sm shrink-0"
                        data-act="copy-ready"
                        type="button"
                        onClick={() => {
                          void window.diwan.ui.copyText(readyMessage(o, officeName));
                          setCopied(o.id);
                        }}
                      >
                        {copied === o.id ? 'نُسخت' : 'انسخ رسالة: طلبكم جاهز'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {waiting > 0 && (
              <button
                className="flex items-center gap-space-xs text-right font-label-lg text-label-lg text-on-surface hover:text-secondary"
                data-today-waiting=""
                type="button"
                onClick={() => go('orders')}
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">pending_actions</span>
                {[a?.drafts ? (a.drafts === 1 ? 'مسودةٌ لم تصدر' : `${a.drafts} مسودات لم تصدر`) : null, a?.parked ? (a.parked === 1 ? 'معاملةٌ معلّقة' : `${a.parked} معاملات معلّقة`) : null]
                  .filter(Boolean)
                  .join(' و')}{' '}
                — في قيد العمل
              </button>
            )}

            {a?.backupDue && (
              <button
                className="flex items-center gap-space-xs text-right font-label-lg text-label-lg text-error hover:underline"
                data-today-backup=""
                type="button"
                onClick={() => go('settings')}
              >
                <span className="material-symbols-outlined text-[20px]">backup</span>
                آخر نسخة احتياطية: {sinceText(a.lastBackupAt)} — خذ نسخةً واحفظها خارج الجهاز
              </button>
            )}

            {a?.autoBackupError && (
              <button
                className="flex items-start gap-space-xs text-right font-label-lg text-label-lg text-error hover:underline"
                data-today-auto-backup=""
                type="button"
                onClick={() => go('settings')}
              >
                <span className="material-symbols-outlined text-[20px]">sync_problem</span>
                لم تُؤخذ النسخة التلقائية عند الإغلاق الأخير: {a.autoBackupError}
              </button>
            )}
          </div>

          <button
            className="px-space-md py-space-sm bg-surface-container-low hover:bg-surface-container-high text-right flex items-center gap-space-xs font-label-md text-label-md text-on-surface"
            data-act="replay-overview"
            type="button"
            onClick={() => {
              setOpen(false);
              onOverview();
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">tour</span>
            نظرة عامة على ديوان — ما في كلّ صفحة
          </button>
        </div>
      )}
    </div>
  );
}
