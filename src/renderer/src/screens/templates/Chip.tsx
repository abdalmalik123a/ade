/**
 * شريحة التصنيف في مكتبة النماذج (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */

export function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={
        active
          ? 'px-space-md py-1.5 btn-act font-label-md text-label-md font-semibold shrink-0 transition-colors'
          : 'px-space-md py-1.5 rounded-btn bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors'
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
