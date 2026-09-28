/**
 * «ما ينتظرك اليوم» — عند الإقلاع، مرّةً في اليوم، وإن كان فيه ما يُقال (د٧).
 *
 * الطلبات المتأخّرة وما موعده اليوم، وما جهز ينتظر صاحبه (ومعه «انسخ رسالة: طلبكم
 * جاهز»، د٨)، والمسودات التي لم تصدر، والنسخة الاحتياطية إن طال عهدها. كلُّ سطرٍ
 * يقود إلى شاشته، و«ابدأ العمل» يغلقها.
 */
import { useState } from 'react';
import type { AgendaOrder, TodayAgenda } from '@shared/api';
import { readyMessage } from '@shared/agenda';
import { sinceText } from '@shared/dates';
import type { RouteKey } from '@shared/routes';

export default function TodayPanel({
  agenda,
  officeName,
  onNavigate,
  onClose
}: {
  agenda: TodayAgenda;
  officeName: string;
  onNavigate: (route: RouteKey) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const go = (route: RouteKey) => {
    onClose();
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

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-scrim/40 p-space-md" data-today="">
      <div className="w-full max-w-xl max-h-[88vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[26px]">wb_sunny</span>
          <div className="flex flex-col">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">ما ينتظرك اليوم</h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant">مرّةً في اليوم عند فتح البرنامج</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-md">
          {(agenda.overdue.length > 0 || agenda.dueToday.length > 0) && (
            <section className="flex flex-col gap-space-xs" data-today-orders="">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  {agenda.overdue.length > 0 && <span className="text-error">{agenda.overdue.length} متأخّرة</span>}
                  {agenda.overdue.length > 0 && agenda.dueToday.length > 0 && ' · '}
                  {agenda.dueToday.length > 0 && `${agenda.dueToday.length} موعدها اليوم`}
                </span>
                <button className="text-secondary font-label-md text-label-md hover:underline" type="button" onClick={() => go('orders')}>
                  الطلبات
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {agenda.overdue.slice(0, 6).map((o) => orderLine(o, true))}
                {agenda.dueToday.slice(0, 6).map((o) => orderLine(o, false))}
              </ul>
            </section>
          )}

          {agenda.ready.length > 0 && (
            <section className="flex flex-col gap-space-xs" data-today-ready="">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  {agenda.ready.length} جاهزة تنتظر أصحابها
                </span>
                <button className="text-secondary font-label-md text-label-md hover:underline" type="button" onClick={() => go('orders')}>
                  الطلبات
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {agenda.ready.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center gap-space-xs font-label-md text-label-md">
                    <span className="flex-1 truncate text-on-surface">
                      {o.customer} — {o.title}
                      {o.phone && <span className="font-mono text-label-sm text-on-surface-variant"> · {o.phone}</span>}
                    </span>
                    <button
                      className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high text-secondary font-label-sm text-label-sm"
                      data-act="copy-ready"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(readyMessage(o, officeName));
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

          {agenda.drafts > 0 && (
            <button
              className="flex items-center gap-space-xs text-right font-label-lg text-label-lg text-on-surface hover:text-secondary"
              data-today-drafts=""
              type="button"
              onClick={() => go('templates')}
            >
              <span className="material-symbols-outlined text-[20px] text-secondary">draft</span>
              {agenda.drafts === 1 ? 'مسودةٌ لم تصدر' : `${agenda.drafts} مسودات لم تصدر`} — في المكتبة
            </button>
          )}

          {agenda.backupDue && (
            <button
              className="flex items-center gap-space-xs text-right font-label-lg text-label-lg text-error hover:underline"
              data-today-backup=""
              type="button"
              onClick={() => go('settings')}
            >
              <span className="material-symbols-outlined text-[20px]">backup</span>
              آخر نسخة احتياطية: {sinceText(agenda.lastBackupAt)} — خذ نسخةً واحفظها خارج الجهاز
            </button>
          )}

          {agenda.autoBackupError && (
            <button
              className="flex items-start gap-space-xs text-right font-label-lg text-label-lg text-error hover:underline"
              data-today-auto-backup=""
              type="button"
              onClick={() => go('settings')}
            >
              <span className="material-symbols-outlined text-[20px]">sync_problem</span>
              لم تُؤخذ النسخة التلقائية عند الإغلاق الأخير: {agenda.autoBackupError}
            </button>
          )}
        </div>

        <div className="p-space-md bg-surface-container-low flex justify-end">
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
            data-act="today-close"
            type="button"
            onClick={onClose}
          >
            ابدأ العمل
          </button>
        </div>
      </div>
    </div>
  );
}
