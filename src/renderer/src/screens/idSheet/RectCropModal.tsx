/**
 * «قصٌّ مستطيل» في «ورقة المستمسكات» (S47، ر182) — الخيار الثاني بجانب «الأركان الأربعة» (التسوية): الصورة كاملةً ومستطيلٌ فوقها
 * بثمانية مقابض يُسحب، ومن وسطه يُنقل، وبالأسهم ملّيمترًا. يبدأ بـ«الحوافّ آليًّا» (البطاقة التي يكشفها الماسح متعدّد البطاقات)
 * وبنسبة المستمسك مقفولةً، و«اعتمد» يقصّ بدقّة الأصل.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { autoRect, dragHandle, fitAspect, type Handle, type Rect } from '@shared/cropRect';
import { detectCards } from '@shared/multiCard';
import { useEscape } from '../../kit/useEscape';
import { cropTo, loadImage, pixelsOf } from './imageOps';

type Props = {
  imageSrc: string;
  aspect: { w: number; h: number; label: string };
  onApply: (dataUrl: string) => void;
  onClose: () => void;
};

const BOX = { w: 820, h: 560 };
const HANDLES: { key: Handle; x: number; y: number; cursor: string }[] = [
  { key: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { key: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { key: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { key: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { key: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { key: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { key: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { key: 'w', x: 0, y: 0.5, cursor: 'ew-resize' }
];

export default function RectCropModal({ imageSrc, aspect, onApply, onClose }: Props) {
  useEscape(onClose);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [auto, setAuto] = useState<Rect | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ handle: Handle; x0: number; y0: number; start: Rect } | null>(null);
  const ratio = aspect.w / aspect.h;

  useEffect(() => {
    let live = true;
    loadImage(imageSrc)
      .then((loaded) => {
        if (!live) return;
        const bounds = { w: loaded.naturalWidth, h: loaded.naturalHeight };
        const found = autoRect(detectCards(pixelsOf(loaded)), bounds);
        setImg(loaded);
        setAuto(found);
        setRect(fitAspect(found, ratio));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'تعذّر فتح الصورة'));
    return () => {
      live = false;
    };
  }, [imageSrc, ratio]);

  const bounds = img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: 1, h: 1 };
  const k = Math.min(BOX.w / bounds.w, BOX.h / bounds.h);
  const move = (handle: Handle, dx: number, dy: number, from: Rect) =>
    setRect(dragHandle(from, handle, dx, dy, { bounds, aspect: locked ? ratio : undefined, min: 16 }));

  const start = (handle: Handle) => (e: ReactPointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, x0: e.clientX, y0: e.clientY, start: rect };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (d) move(d.handle, (e.clientX - d.x0) / k, (e.clientY - d.y0) / k, d.start);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" data-rect-crop="">
      <div className="surface-panel flex flex-col overflow-hidden max-w-[95vw]">
        <header className="px-space-lg py-space-sm flex items-center justify-between bg-surface-container-low">
          <div>
            <h3 className="font-title-md text-title-md text-on-surface">قصٌّ مستطيل — {aspect.label}</h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant">اسحب المقابض أو الوسط، والأسهم تنقله ملّيمترًا.</p>
          </div>
          <button className="w-9 h-9 rounded-btn hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="p-space-md bg-neutral-800 flex items-center justify-center" style={{ minWidth: `${BOX.w / 2}px`, minHeight: `${BOX.h / 2}px` }}>
          {error && <span className="text-white/80 font-label-md text-label-md">{error}</span>}
          {img && rect && (
            <div
              className="relative overflow-hidden outline-none select-none"
              data-natural={`${bounds.w}x${bounds.h}`}
              dir="ltr"
              style={{ width: `${bounds.w * k}px`, height: `${bounds.h * k}px` }}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = rect.w / aspect.w;
                const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
                if (!dir) return;
                e.preventDefault();
                move('move', dir[0]! * step, dir[1]! * step, rect);
              }}
              onPointerMove={onMove}
              onPointerUp={() => (drag.current = null)}
            >
              <img alt="" className="block w-full h-full" draggable={false} src={imageSrc} />
              <div
                className="absolute border-2 border-white cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                data-rect={[rect.x, rect.y, rect.w, rect.h].map((v) => Math.round(v)).join(',')}
                style={{ left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k }}
                onPointerDown={start('move')}
              >
                {HANDLES.map((h) => (
                  <span
                    key={h.key}
                    className="absolute w-3 h-3 bg-white border border-neutral-700"
                    data-handle={h.key}
                    style={{ left: `calc(${h.x * 100}% - 6px)`, top: `calc(${h.y * 100}% - 6px)`, cursor: h.cursor }}
                    onPointerDown={start(h.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <footer className="px-space-lg py-space-sm flex flex-wrap items-center gap-space-sm bg-surface-container-low font-label-md text-label-md">
          <button className="h-9 px-space-sm rounded-btn border border-outline-variant hover:bg-surface-container-high" data-act="rect-auto" disabled={!auto} type="button" onClick={() => auto && setRect(locked ? fitAspect(auto, ratio) : auto)}>
            الحوافّ آليًّا
          </button>
          <label className="flex items-center gap-space-xs text-on-surface">
            <input
              checked={locked}
              data-act="rect-lock"
              type="checkbox"
              onChange={(e) => {
                setLocked(e.target.checked);
                if (e.target.checked && rect) setRect(fitAspect(rect, ratio));
              }}
            />
            بنسبة المستمسك
          </label>
          <span className="flex-1" />
          <button className="h-9 px-space-md rounded-btn hover:bg-surface-container-high" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button className="h-9 px-space-lg btn-act font-semibold disabled:opacity-40" data-act="rect-apply" disabled={!img || !rect} type="button" onClick={() => img && rect && onApply(cropTo(img, rect))}>
            اعتمد
          </button>
        </footer>
      </div>
    </div>
  );
}
