/** نتائج البحث الشامل في «الصادر»: قائمةٌ بعنوانها، وزرٌّ لكلّ نتيجة — نُقلا من `ArchiveScreen.tsx` (سقف حجمه). */
import type { ReactNode } from 'react';

export function HitList({ title, icon, empty, children }: { title: string; icon: string; empty: string; children: ReactNode[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col gap-1 min-w-0">
      <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
        {title} ({children.length})
      </span>
      {children.length ? children : <span className="font-label-sm text-label-sm text-on-surface-variant py-1">{empty}</span>}
    </div>
  );
}

export function HitButton({ act, title, sub, onClick }: { act: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      className="text-right p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col min-w-0"
      data-act={act}
      type="button"
      onClick={onClick}
    >
      <span className="font-label-md text-label-md text-on-surface truncate">{title}</span>
      {sub && <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{sub}</span>}
    </button>
  );
}
