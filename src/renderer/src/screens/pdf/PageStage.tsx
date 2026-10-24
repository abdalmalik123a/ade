/**
 * الصفحة الحالية في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `PdfScreen` كما هي: العناصر فوقها تُسحب وتُكبَّر، وصندوق القصّ.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { pageTokens, type PageRef, type FracBox, type Overlay } from '@shared/pdfEdit';
import type { Drag } from './pdfPages';

type Props = {
  stage: MutableRefObject<HTMLDivElement | null>;
  setActive: Dispatch<SetStateAction<string | null>>;
  onPointerMove: (e: React.PointerEvent) => void;
  drag: MutableRefObject<Drag | null>;
  view: { url: string; w: number; h: number; } | null;
  currentRef: PageRef | null;
  crop: FracBox | null;
  pageOverlays: Overlay[];
  active: string | null;
  startDrag: (e: React.PointerEvent, target: Drag['target'], id: string, mode: Drag['mode'], box: FracBox) => void;
  pxPerPt: number;
  currentIndex: number;
  pages: PageRef[];
};

export default function PageStage({ stage, setActive, onPointerMove, drag, view, currentRef, crop, pageOverlays, active, startDrag, pxPerPt, currentIndex, pages }: Props) {
  return (
    <section
      ref={stage}
      className="flex-1 min-w-0 overflow-auto bg-surface-dim/40 flex items-start justify-center p-space-md"
      onPointerDown={() => setActive(null)}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
    >
      {view && currentRef && (
        <div className="relative shadow-soft bg-white" data-pdf-view="" style={{ width: view.w, height: view.h }}>
          <img alt="" className="absolute inset-0 w-full h-full select-none" draggable={false} src={view.url} />
          {!crop &&
            pageOverlays.map((o) => (
              <div
                key={o.id}
                className={`absolute cursor-move ${
                  o.id === active
                    ? 'outline outline-2 outline-secondary'
                    : o.kind === 'text' && !o.text.trim()
                      ? 'outline outline-1 outline-dashed outline-secondary/60 bg-secondary/5'
                      : 'hover:outline hover:outline-1 hover:outline-secondary/60'
                }`}
                data-pdf-overlay={o.kind}
                style={{ left: `${o.box.x * 100}%`, top: `${o.box.y * 100}%`, width: `${o.box.w * 100}%`, height: `${o.box.h * 100}%` }}
                onPointerDown={(e) => startDrag(e, 'overlay', o.id, 'move', o.box)}
              >
                <div
                  className="w-full h-full flex items-center"
                  dir="auto"
                  style={{
                    opacity: o.opacity,
                    transform: `rotate(${o.angle}deg)`,
                    justifyContent: o.kind === 'text' ? (o.align === 'center' ? 'center' : o.align === 'left' ? 'flex-end' : 'flex-start') : 'center'
                  }}
                >
                  {o.kind === 'text' ? (
                    <span
                      style={{
                        width: '100%',
                        fontFamily: `'${o.font}', Arial, sans-serif`,
                        fontSize: o.size * pxPerPt,
                        fontWeight: o.bold ? 700 : 400,
                        color: o.color,
                        textAlign: o.align,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.3
                      }}
                    >
                      {pageTokens(o.text, currentIndex + 1, pages.length)}
                    </span>
                  ) : (
                    <img alt="" className="w-full h-full object-contain pointer-events-none" src={`diwan://store/${o.src}`} />
                  )}
                </div>
                {o.id === active && (
                  <span
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-sm bg-secondary cursor-nwse-resize"
                    data-pdf-resize=""
                    onPointerDown={(e) => startDrag(e, 'overlay', o.id, 'resize', o.box)}
                  />
                )}
              </div>
            ))}
          {crop && (
            <div className="absolute inset-0 bg-black/40" data-pdf-crop="">
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] cursor-move"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                onPointerDown={(e) => startDrag(e, 'crop', 'crop', 'move', crop)}
              >
                <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-sm bg-white cursor-nwse-resize" onPointerDown={(e) => startDrag(e, 'crop', 'crop', 'resize', crop)} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
