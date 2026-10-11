/** شريحة التصنيف وزرّ الأيقونة في «الأشخاص» — نُقلا من `CitizensScreen.tsx` (سقف حجمه). */
import type { ReactNode } from 'react';

export function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={
        active
          ? 'px-space-sm py-1 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shrink-0'
          : 'px-space-sm py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm shrink-0'
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  tone
}: {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'error';
}) {
  return (
    <button
      className={
        tone === 'error'
          ? 'w-7 h-7 rounded text-error hover:bg-error-container transition-colors flex items-center justify-center disabled:opacity-30'
          : 'w-7 h-7 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center disabled:opacity-30'
      }
      title={title}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}
