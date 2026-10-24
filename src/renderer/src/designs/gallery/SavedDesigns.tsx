/**
 * تصاميمك المحفوظة — في صدارة المعرض لسهولة العودة إليها وتعديلها (DESIGNS.md ٠٫٩). و«حزمة» (٣٫٦): النقر يختار التصاميم
 * بدل أن يفتحها، ثمّ «احفظ الحزمة» ملفًّا واحدًا.
 */
import type { TemplateSummary } from '@shared/api';
import { toIndic } from '@shared/arabic';
import { SavedThumb } from './Thumbs';
import type { DesignPacks } from './useDesignPacks';

const TOOL = 'h-8 px-space-sm rounded-btn font-label-sm text-label-sm font-semibold flex items-center gap-1 disabled:opacity-40';

export default function SavedDesigns({
  saved,
  packs,
  onOpenSaved,
  onDeleteSaved
}: {
  saved: TemplateSummary[];
  packs: DesignPacks;
  onOpenSaved: (id: number) => void;
  onDeleteSaved?: (id: number) => void;
}) {
  if (saved.length === 0) return null;
  const open = (id: number) => (packs.picking ? packs.toggle(id) : onOpenSaved(id));
  return (
    <section className="rounded-card bg-surface-container-low p-space-md space-y-space-sm" data-saved-section="">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-secondary text-[22px]">folder_special</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            تصاميمك المحفوظة ({toIndic(saved.length)})
          </h2>
        </div>
        {packs.picking ? (
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant">اختر التصاميم التي تُحزم</span>
            <button className={`${TOOL} btn-act`} data-act="pack-save" disabled={!packs.picked.length || packs.busy} type="button" onClick={() => void packs.save()}>
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              احفظ الحزمة ({toIndic(packs.picked.length)})
            </button>
            <button className={`${TOOL} bg-surface-container-high text-on-surface`} type="button" onClick={packs.cancel}>
              إلغاء
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant">اضغط على أي تصميم لفتحه وتعديله، أو طباعة دفعة منه</span>
            <button
              className={`${TOOL} bg-surface-container-high text-on-surface`}
              data-act="pack-mode"
              title="تصاميمُ مختارة في ملفٍّ واحد — لمكتبٍ آخر أو لجهازٍ ثانٍ"
              type="button"
              onClick={() => packs.setPicking(true)}
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              حزمة
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-space-sm" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {saved.map((d) => (
          <div
            key={d.id}
            className={`group relative p-space-sm rounded-card bg-surface-container-lowest border hover:shadow-soft transition-all flex flex-col justify-between gap-space-xs ${
              packs.picked.includes(d.id) ? 'border-primary ring-2 ring-primary/40' : 'border-outline-variant/60 hover:border-secondary/50'
            }`}
          >
            {packs.picking && (
              <input
                aria-label={`في الحزمة: ${d.title}`}
                checked={packs.picked.includes(d.id)}
                className="absolute top-3 right-3 z-10 w-5 h-5 accent-primary"
                data-pack-pick={d.id}
                type="checkbox"
                onChange={() => packs.toggle(d.id)}
              />
            )}
            <button
              className="h-28 rounded-btn bg-surface-container flex items-center justify-center overflow-hidden"
              data-saved-thumb={d.id}
              title={packs.picking ? 'اختره للحزمة' : 'فتح وتعديل'}
              type="button"
              onClick={() => open(d.id)}
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
                  className="w-7 h-7 rounded-btn text-on-surface-variant hover:text-error hover:bg-error-container/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
              className="w-full h-8 mt-1 rounded-btn bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors"
              data-saved={d.id}
              type="button"
              onClick={() => open(d.id)}
            >
              <span className="material-symbols-outlined text-[16px]">{packs.picking ? 'check' : 'edit'}</span>
              {packs.picking ? (packs.picked.includes(d.id) ? 'في الحزمة' : 'اختره') : 'فتح وتعديل'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
