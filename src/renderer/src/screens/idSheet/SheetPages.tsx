/**
 * أوراق «ورقة المستمسكات» مكانَ العمل (S47): كلّ ورقةٍ بمقاسها الحقيقي بالملّم مصغّرةً كلّها، والمواضع من `layoutDocs` نفسها
 * التي تُطبع — فما يُرى هو ما يخرج. والخانة الفارغة إطارٌ متقطّع يُملأ بالنقر، والنقر على مستمسكٍ يحدّده ويفتح لوحته.
 */
import { faceLabel, type DocPlacement, type Face, type SheetDoc } from '@shared/idDocSheet';
import { tiledWatermark, type WatermarkOptions } from '@shared/watermark';
import { toIndic } from '@shared/arabic';

/** عرض الورقة في الشاشة بالبكسل، و210 ملم = 793٫7 بكسل في CSS. */
const PAGE_PX = 380;
const SCALE = PAGE_PX / ((210 * 96) / 25.4);

export type SheetLook = {
  filter: string;
  cutMarks: boolean;
  rounded: boolean;
  shadow: boolean;
  labels: boolean;
  fold: boolean;
  watermark: WatermarkOptions | null;
};

type Props = {
  docs: SheetDoc[];
  placements: DocPlacement[];
  pages: number;
  duplex: boolean;
  selected: string | null;
  look: SheetLook;
  resolveUrl: (src: string) => string;
  onSelect: (id: string | null) => void;
  onEmpty: (docId: string, face: Face) => void;
  onAdd: () => void;
};

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

export default function SheetPages({ docs, placements, pages, duplex, selected, look, resolveUrl, onSelect, onEmpty, onAdd }: Props) {
  const twoSided = duplex && docs.some((d) => d.faces === 2);
  return (
    <div className="flex-1 min-w-0 overflow-auto bg-neutral-800 p-space-lg flex flex-wrap items-start justify-center gap-space-lg" onClick={() => onSelect(null)}>
      {Array.from({ length: Math.max(1, pages) }, (_, p) => (
        <div key={p} className="flex flex-col items-center gap-1" data-sheet-page={p}>
          <span className="text-white/70 font-label-sm text-label-sm">
            ورقة {toIndic(twoSided ? Math.floor(p / 2) + 1 : p + 1)}
            {twoSided ? (p % 2 ? ' — ظهرها' : ' — الوجوه') : ''}
          </span>
          <div className="relative bg-white shadow-card overflow-hidden" style={{ width: `${PAGE_PX}px`, height: `${(PAGE_PX * 297) / 210}px` }}>
            <div className="absolute top-0 right-0" style={{ width: '210mm', height: '297mm', transform: `scale(${SCALE})`, transformOrigin: 'top right' }}>
              {look.fold && placements.some((pl) => pl.page === p && pl.fold) && (
                <div className="absolute border-t border-dashed border-neutral-300" style={{ left: '10mm', right: '10mm', top: mm(297 / 2) }} />
              )}
              {placements.map((pl, i) => {
                if (pl.page !== p) return null;
                const doc = docs[pl.doc]!;
                const src = pl.face === 'front' ? doc.front : doc.back;
                const on = selected === doc.id;
                return (
                  <div key={i}>
                    <button
                      className={`absolute block p-0 overflow-hidden ${src ? 'bg-white' : 'bg-primary-fixed/40 border-dashed border-secondary'}`}
                      data-doc={doc.id}
                      data-face={pl.face}
                      data-sheet-card={src ? i : undefined}
                      data-sheet-empty={src ? undefined : ''}
                      style={{
                        left: mm(pl.x),
                        top: mm(pl.y),
                        width: mm(pl.w),
                        height: mm(pl.h),
                        borderWidth: src ? 0 : '0.6mm',
                        outline: on ? '1.2mm solid #0872A3' : src && look.cutMarks ? '0.15mm solid #bbb' : 'none',
                        outlineOffset: on ? '0.6mm' : 0,
                        borderRadius: look.rounded ? '3mm' : 0,
                        boxShadow: look.shadow && src ? '0 0.6mm 1.6mm rgba(0,0,0,0.35)' : 'none'
                      }}
                      title={src ? `${faceLabel(doc, pl.face)} — انقر لأدواته` : `${faceLabel(doc, pl.face)} — انقر لتملأه`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(doc.id);
                        if (!src) onEmpty(doc.id, pl.face);
                      }}
                    >
                      {src ? (
                        <>
                          <img alt="" className="w-full h-full block object-contain" src={resolveUrl(src)} style={{ filter: look.filter }} />
                          {look.watermark && (
                            <span className="absolute inset-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: tiledWatermark(look.watermark) }} />
                          )}
                        </>
                      ) : (
                        <span className="w-full h-full flex flex-col items-center justify-center text-secondary" style={{ fontSize: '4mm', gap: '1mm' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '9mm' }}>
                            add_photo_alternate
                          </span>
                          {faceLabel(doc, pl.face)}
                        </span>
                      )}
                    </button>
                    {look.labels && src && (
                      <span
                        className="absolute text-center text-neutral-500"
                        style={{ left: mm(pl.x), top: mm(pl.y + pl.h + 0.8), width: mm(pl.w), fontSize: '2.4mm' }}
                      >
                        {faceLabel(doc, pl.face)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <button
        className="self-center flex flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-white/40 text-white/80 hover:bg-white/10"
        data-act="sheet-add"
        style={{ width: '9rem', height: '9rem' }}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
      >
        <span className="material-symbols-outlined text-[36px]">add</span>
        <span className="font-label-md text-label-md">مستمسك</span>
      </button>
    </div>
  );
}
