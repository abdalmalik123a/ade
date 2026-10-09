/**
 * تصاميمك المحفوظة — في صدارة المعرض لسهولة العودة إليها وتعديلها (DESIGNS.md ٠٫٩).
 */
import type { TemplateSummary } from '@shared/api';
import { toIndic } from '@shared/arabic';
import { SavedThumb } from './Thumbs';

export default function SavedDesigns({
  saved,
  onOpenSaved,
  onDeleteSaved
}: {
  saved: TemplateSummary[];
  onOpenSaved: (id: number) => void;
  onDeleteSaved?: (id: number) => void;
}) {
  if (saved.length === 0) return null;
  return (
    <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-sm" data-saved-section="">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-secondary text-[22px]">folder_special</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            تصاميمك المحفوظة ({toIndic(saved.length)})
          </h2>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          اضغط على أي تصميم لفتحه وتعديله، أو طباعة دفعة منه
        </span>
      </div>

      <div className="grid gap-space-sm" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {saved.map((d) => (
          <div
            key={d.id}
            className="group p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-secondary/50 hover:shadow-md transition-all flex flex-col justify-between gap-space-xs"
          >
            <button
              className="h-28 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden"
              data-saved-thumb={d.id}
              title="فتح وتعديل"
              type="button"
              onClick={() => onOpenSaved(d.id)}
            >
              <SavedThumb id={d.id} width={236} height={104} />
            </button>
            <div className="flex items-start justify-between gap-space-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-secondary">draw</span>
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface font-bold truncate max-w-[170px]" title={d.title}>
                    {d.title}
                  </span>
                  {d.subtitle && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant tabular">
                      {d.subtitle}
                    </span>
                  )}
                </div>
              </div>
              {onDeleteSaved && (
                <button
                  className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف هذا التصميم"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`هل أنت متأكد من حذف «${d.title}»؟`)) {
                      onDeleteSaved(d.id);
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}
            </div>
            <button
              className="w-full h-8 mt-1 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors"
              data-saved={d.id}
              type="button"
              onClick={() => onOpenSaved(d.id)}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              فتح وتعديل
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
