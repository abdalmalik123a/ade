/**
 * السحب والفرشاة في الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: نقل الصورة والقاط وتكبيرهما،
 * و«أبقِ» و«امسح» بالفرشاة على القناع، وإعادته.
 */
import type { Dispatch, SetStateAction, MutableRefObject, RefObject } from 'react';
import { cropBox, type Size, type Crop } from '@shared/photoSheet';
import { type BrushMode, strokeAlpha, landmarks, type SuitTransform, type Landmarks } from '@shared/portraitMask';
import type { Work } from '../../lib/portraitCanvas';
import type { Tool, Worn } from './photoShared';

export function usePhotoBrush(
  ctx: {
    frameEl: RefObject<HTMLDivElement>;
    frame: Size;
    natural: Size | null;
    crop: Crop;
    work: MutableRefObject<Work | null>;
    cut: MutableRefObject<{ alpha: Uint8Array; model: Uint8Array; pixels: Uint8ClampedArray; } | null>;
    brush: number;
    rebuildSubject: (rect?: { x: number; y: number; w: number; h: number; }) => void;
    draw: () => void;
    drag: MutableRefObject<{ tool: Tool; x: number; y: number; crop: Crop; at: SuitTransform | null; last: { x: number; y: number; } | null; } | null>;
    tool: Tool;
    worn: Worn | null;
    setCursor: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
    box: { left: number; top: number; width: number; height: number; x: number; y: number; } | null;
    setCrop: Dispatch<SetStateAction<Crop>>;
    setWorn: Dispatch<SetStateAction<Worn | null>>;
    setLm: Dispatch<SetStateAction<Landmarks | null>>;
    setBrush: Dispatch<SetStateAction<number>>;
  }
) {
  const {
    frameEl, frame, natural, crop, work, cut, brush, rebuildSubject, draw, drag, tool, worn, setCursor, box, setCrop, setWorn, setLm,
    setBrush
  } = ctx;

  const at = (e: React.MouseEvent) => {
    const r = frameEl.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toImage = (p: { x: number; y: number }) => {
    const b = cropBox(frame, natural!, crop);
    const k = b.width / natural!.w;
    return { x: (p.x - b.left) / k, y: (p.y - b.top) / k, k };
  };

  function paint(from: { x: number; y: number }, to: { x: number; y: number }, k: number, mode: BrushMode) {
    const w = work.current;
    const c = cut.current;
    if (!w || !c) return;
    const rect = strokeAlpha(c.alpha, w.width, w.height, from, to, brush / k, mode);
    rebuildSubject(rect);
    draw();
  }

  function onDown(e: React.MouseEvent) {
    if (!natural) return;
    e.preventDefault();
    const p = at(e);
    const img = toImage(p);
    drag.current = { tool, x: e.clientX, y: e.clientY, crop, at: worn?.at ?? null, last: img };
    if ((tool === 'keep' || tool === 'remove') && cut.current) paint(img, img, img.k, tool);
  }

  function onMove(e: React.MouseEvent) {
    if (tool === 'keep' || tool === 'remove') setCursor(frameEl.current ? at(e) : null);
    const d = drag.current;
    if (!d || !box || !natural) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.tool === 'move') {
      // سحب الصورة يمينًا يعني أن الإطار يرى ما على يسارها: المركز ينقص.
      setCrop({ ...d.crop, x: d.crop.x - dx / box.width, y: d.crop.y - dy / box.height });
    } else if (d.tool === 'suit' && d.at) {
      const k = box.width / natural.w;
      const from = d.at;
      setWorn((s) => s && { ...s, at: { ...from, x: from.x + dx / k, y: from.y + dy / k } });
    } else if ((d.tool === 'keep' || d.tool === 'remove') && d.last) {
      const img = toImage(at(e));
      paint(d.last, img, img.k, d.tool);
      d.last = img;
    }
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    // بعد الفرشاة تُعاد المعالم: شعرةٌ أُبقيت أو ظلٌّ مُسح يغيّر قمّة الرأس أو الرقبة.
    if (d && (d.tool === 'keep' || d.tool === 'remove') && work.current && cut.current)
      setLm(landmarks(cut.current.alpha, work.current.width, work.current.height));
  }

  function onWheel(e: React.WheelEvent) {
    if (tool === 'move') setCrop((c) => ({ ...c, zoom: Math.max(1, Math.min(6, c.zoom - e.deltaY * 0.0015)) }));
    else if (tool === 'suit') setWorn((s) => s && { ...s, at: { ...s.at, scale: Math.max(s.base.scale * 0.4, Math.min(s.base.scale * 2.5, s.at.scale * (1 - e.deltaY * 0.001))) } });
    else setBrush((b) => Math.max(3, Math.min(80, b - e.deltaY * 0.03)));
  }

  function resetMask() {
    const w = work.current;
    const c = cut.current;
    if (!w || !c) return;
    c.alpha.set(c.model);
    setLm(landmarks(c.alpha, w.width, w.height));
    rebuildSubject();
    draw();
  }

  return { resetMask, onUp, onMove, onDown, onWheel };
}
