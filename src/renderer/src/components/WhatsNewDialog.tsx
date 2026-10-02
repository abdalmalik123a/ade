/**
 * «ما الجديد» بعد التحديث (خطة Production، ٧٫١): أوّل إقلاعٍ لإصدارٍ رحّل بيانات أقدم يعرض ما تغيّر بين
 * الإصدارين — من CHANGELOG.md المحزوم مع البرنامج — مرّةً واحدة.
 */
import { useEffect } from 'react';
import changelog from '../../../../CHANGELOG.md?raw';
import { changesBetween, parseChangelog } from '@shared/changelog';

/** نصّ القسم: أسطرٌ، والبنود (`- `) نقاطٌ، و`**…**` عريض. */
export function ChangelogBody({ body }: { body: string }) {
  const items: string[] = [];
  for (const line of body.split('\n')) {
    if (/^\s*- /.test(line)) items.push(line.replace(/^\s*- /, ''));
    else if (items.length && line.trim()) items[items.length - 1] += ` ${line.trim()}`;
    else if (line.trim()) items.push(line.trim());
  }
  return (
    <ul className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface list-disc pr-5 leading-6">
      {items.map((t, i) => (
        <li key={i}>
          {t.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}
        </li>
      ))}
    </ul>
  );
}

export default function WhatsNewDialog({ from, to, onClose }: { from: string; to: string; onClose: () => void }) {
  const entries = changesBetween(parseChangelog(changelog), from, to);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/50 p-space-md" data-whats-new="">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[28px]">new_releases</span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">ما الجديد في ديوان {to}</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              حُدِّث البرنامج من {from} — وأُخذت نسخةٌ من بيانات المكتب قبل أن تُرحَّل.
            </p>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface">تحسيناتٌ وإصلاحات.</p>
        ) : (
          entries.map((e) => (
            <div key={e.version} className="flex flex-col gap-space-xs">
              <span className="font-label-lg text-label-lg font-semibold text-on-surface">{e.title}</span>
              <ChangelogBody body={e.body} />
            </div>
          ))
        )}
        <button
          className="self-start h-10 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold"
          data-act="whats-new-close"
          type="button"
          onClick={onClose}
        >
          حسنًا
        </button>
      </div>
    </div>
  );
}
