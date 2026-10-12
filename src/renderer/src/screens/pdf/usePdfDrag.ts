/**
 * السحب والقصّ في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: نقل العنصر وتكبيره، وصندوق القصّ وتطبيقه
 * على الصفحة أو المحدَّد.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { Drag } from './pdfPages';
import type { FracBox, TextOverlay, ImageOverlay, PageRef } from '@shared/pdfEdit';

export function usePdfDrag(
  ctx: {
    drag: MutableRefObject<Drag | null>;
    setActive: Dispatch<SetStateAction<string | null>>;
    view: { url: string; w: number; h: number; } | null;
    setCrop: Dispatch<SetStateAction<FracBox | null>>;
    patch: (id: string, p: Partial<TextOverlay> | Partial<ImageOverlay>) => void;
    currentRef: PageRef | null;
    crop: FracBox | null;
    targets: string[];
    setPages: Dispatch<SetStateAction<PageRef[]>>;
  }
) {
  const { drag, setActive, view, setCrop, patch, currentRef, crop, targets, setPages } = ctx;

  function startDrag(e: React.PointerEvent, target: Drag['target'], id: string, mode: Drag['mode'], box: FracBox) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id, mode, x: e.clientX, y: e.clientY, box, target };
    if (target === 'overlay') setActive(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !view) return;
    const dx = (e.clientX - d.x) / view.w;
    const dy = (e.clientY - d.y) / view.h;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    let box: FracBox;
    if (d.mode === 'move') {
      box = { ...d.box, x: clamp(d.box.x + dx, -d.box.w + 0.02, 0.98), y: clamp(d.box.y + dy, -d.box.h + 0.02, 0.98) };
    } else {
      box = { ...d.box, w: clamp(d.box.w + dx, 0.03, 1.5), h: clamp(d.box.h + dy, 0.02, 1.5) };
    }
    if (d.target === 'crop') {
      box = { x: clamp(box.x, 0, 0.95), y: clamp(box.y, 0, 0.95), w: clamp(box.w, 0.05, 1 - clamp(box.x, 0, 0.95)), h: clamp(box.h, 0.05, 1 - clamp(box.y, 0, 0.95)) };
      setCrop(box);
    } else patch(d.id, { box });
  }

  // ── القصّ ────────────────────────────────────────────────────────────
  function startCrop() {
    if (!currentRef) return;
    setActive(null);
    setCrop(currentRef.crop ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  }

  function applyCrop(scope: 'page' | 'targets' | 'clear') {
    if (!currentRef) return;
    const value = scope === 'clear' ? undefined : crop ?? undefined;
    const ids = scope === 'targets' ? targets : [currentRef.id];
    setPages((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, crop: value } : p)));
    setCrop(null);
  }

  return { startCrop, onPointerMove, startDrag, applyCrop };
}
