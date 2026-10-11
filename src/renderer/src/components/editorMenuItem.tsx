/** زرّ في قائمة «أدرج» بالمحرّر — نُقل من `editorKit.tsx` (سقف حجمه). */
export default function MenuItem({
  act,
  icon,
  label,
  wide,
  onClick
}: {
  act: string;
  icon: string;
  label: string;
  /** يملأ الصفّ — فلا يبقى زرٌّ وحده في نصفه. */
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-2 ${wide ? 'col-span-2' : ''}`}
      data-act={act}
      type="button"
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
      {label}
    </button>
  );
}
