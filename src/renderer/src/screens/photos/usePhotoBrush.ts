/**
 * السحب والفرشاة في الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: نقل الصورة والقاط وتكبيرهما،
 * و«أبقِ» و«امسح» بالفرشاة على القناع، وإعادته — و«امسح لونًا» (البند ٣٨، `lib/useColorErase.ts`): ضغطةٌ على لونٍ تزيله،
 * و«رمّم» (البند ٤٠، `lib/useRepair.ts`): ما يُمسح عليه تحت الذقن يُملأ من جواره — والوجه لا يُمسّ.
 */
import { useState, useRef, type Dispatch, type SetStateAction, type MutableRefObject, type RefObject } from 'react';
import { cropBox, type Size, type Crop } from '@shared/photoSheet';
import { type BrushMode, strokeAlpha, landmarks, type SuitTransform, type Landmarks } from '@shared/portraitMask';
import type { Work } from '../../lib/portraitCanvas';
import { getSuitBoxGeometry } from './SuitTransformOverlay';
import { useColorErase } from '../../lib/useColorErase';
import { useRepair } from '../../lib/useRepair';
import { withFace } from '@shared/portraitFace';
import type { Cut, Tool, Worn } from './photoShared';

export function usePhotoBrush(
  ctx: {
    frameEl: RefObject<HTMLDivElement>;
    frame: Size;
    natural: Size | null;
    crop: Crop;
    work: MutableRefObject<Work | null>;
    cut: MutableRefObject<Cut | null>;
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
    setCutVersion: Dispatch<SetStateAction<number>>;
    cutState: 'none' | 'running' | 'done';
    say: (text: string, warn?: boolean) => void;
    lm: Landmarks | null;
    hardness?: number;
    onPushHistory?: (desc?: string) => void;
  }
) {
  const {
    frameEl, frame, natural, crop, work, cut, brush, rebuildSubject, draw, drag, tool, worn, setCursor, box, setCrop, setWorn, setLm,
    setBrush, setCutVersion, cutState, say, lm, hardness = 0.6, onPushHistory
  } = ctx;

  const handleDrag = useRef<{
    handle: string;
    startX: number;
    startY: number;
    initAt: SuitTransform;
    suitW: number;
    suitH: number;
    k: number;
    pivot: { x: number; y: number };
    startAngle: number;
  } | null>(null);

  // «امسح لونًا»: ما تغيّر يعيد المعالم (جدارٌ بقي حول الكتف يوسّعها)، والحافّة تتغيّر ألوانها فيُعاد التحسين منها.
  const erase = useColorErase({
    target: () => (work.current && cut.current ? { pixels: cut.current.pixels, alpha: cut.current.alpha, width: work.current.width, height: work.current.height } : null),
    changed: () => {
      if (work.current && cut.current) setLm(withFace(landmarks(cut.current.alpha, work.current.width, work.current.height), cut.current.face));
      setCutVersion((v) => v + 1);
    },
    ready: cutState === 'done',
    active: tool === 'color',
    sides: 'portrait'
  });

  // «رمّم»: تحت الذقن وحده، ومن الشخص وحده (لا الخلفية القديمة) — والألوان تتغيّر فيُعاد التحسين وقناع الجلد منها.
  const repair = useRepair({
    target: () => (work.current && cut.current ? { pixels: cut.current.pixels, width: work.current.width, height: work.current.height } : null),
    changed: () => setCutVersion((v) => v + 1),
    allow: () => (cut.current ? Uint8Array.from(cut.current.alpha, (a) => (a >= 250 ? 1 : 0)) : undefined),
    minY: () => lm?.chin ?? Infinity
  });
  /** أثر الفرشاة على الإطار وهي تمرّ. */
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);

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
    const rect = strokeAlpha(c.alpha, w.width, w.height, from, to, brush / k, mode, hardness);
    rebuildSubject(rect);
    draw();
  }

  function onHandleDown(e: React.MouseEvent, handle: string) {
    if (!worn || !natural || !box) return;
    e.preventDefault();
    e.stopPropagation();
    onPushHistory?.('تعديل القاط');
    const k = box.width / natural.w;
    const g = getSuitBoxGeometry(worn, natural, box);
    const r = frameEl.current?.getBoundingClientRect();
    const pivot = { x: (r?.left ?? 0) + g.cx, y: (r?.top ?? 0) + g.cy };
    handleDrag.current = {
      pivot,
      startAngle: Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x),
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initAt: { ...worn.at },
      suitW: worn.suit.img.naturalWidth,
      suitH: worn.suit.img.naturalHeight,
      k
    };
  }

  function onDown(e: React.MouseEvent) {
    if (!natural) return;
    e.preventDefault();
    const p = at(e);
    const img = toImage(p);
    if (tool === 'color') {
      if (!cut.current) return;
      onPushHistory?.('مسح لون'); // اللقطة قبل التغيير لا بعده
      if (!erase.pick(img.x, img.y)) say('لا لون هنا يُمسح — اضغط على ما بقي من الخلفية في الصورة', true);
      return;
    }
    if (tool === 'repair') {
      if (!lm || !cut.current) return;
      onPushHistory?.('ترميم');
      repair.begin(img, brush / img.k);
      setStroke([p]);
    }
    if (tool === 'keep' || tool === 'remove') {
      onPushHistory?.(tool === 'keep' ? 'إبقاء' : 'مسح');
    }
    if (tool === 'suit') {
      onPushHistory?.('تحريك القاط');
    }
    drag.current = { tool, x: e.clientX, y: e.clientY, crop, at: worn?.at ?? null, last: img };
    if ((tool === 'keep' || tool === 'remove') && cut.current) paint(img, img, img.k, tool);
  }

  function onMove(e: React.MouseEvent) {
    if (tool === 'keep' || tool === 'remove' || tool === 'repair') setCursor(frameEl.current ? at(e) : null);
    
    // سحب مقابض القاط
    const hd = handleDrag.current;
    if (hd && worn && box && natural) {
      const dx = (e.clientX - hd.startX) / hd.k;
      const dy = (e.clientY - hd.startY) / hd.k;
      const { handle, initAt } = hd;

      if (handle === 'center') {
        setWorn((s) => s && { ...s, at: { ...s.at, x: initAt.x + dx, y: initAt.y + dy } });
      } else if (handle === 'rot') {
        // زاوية المؤشّر حول مركز القاط، مطروحًا منها زاويته عند بدء السحب.
        const now = Math.atan2(e.clientY - hd.pivot.y, e.clientX - hd.pivot.x);
        const deg = ((now - hd.startAngle) * 180) / Math.PI;
        const wrapped = deg > 180 ? deg - 360 : deg < -180 ? deg + 360 : deg;
        setWorn((s) => s && { ...s, at: { ...s.at, angle: Math.max(-45, Math.min(45, initAt.angle + wrapped)) } });
      } else if (handle === 'e' || handle === 'w') {
        const factor = handle === 'e' ? dx : -dx;
        const currentScaleX = initAt.scaleX ?? 1;
        const newScaleX = Math.max(0.4, Math.min(2.5, currentScaleX * (1 + factor / (hd.suitW * 0.4))));
        setWorn((s) => s && { ...s, at: { ...s.at, scaleX: newScaleX } });
      } else if (handle === 's') {
        const currentScaleY = initAt.scaleY ?? 1;
        const newScaleY = Math.max(0.4, Math.min(2.5, currentScaleY * (1 + dy / (hd.suitH * 0.4))));
        setWorn((s) => s && { ...s, at: { ...s.at, scaleY: newScaleY } });
      } else {
        // زوايا ne, nw, se, sw
        const diag = (handle === 'se' ? dx + dy : handle === 'sw' ? -dx + dy : handle === 'ne' ? dx - dy : -dx - dy) * 0.5;
        const newScale = Math.max(0.2, initAt.scale * (1 + diag / (hd.suitW * 0.5)));
        setWorn((s) => s && { ...s, at: { ...s.at, scale: newScale } });
      }
      return;
    }

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
    } else if (d.tool === 'repair' && repair.painting()) {
      const p = at(e);
      const img = toImage(p);
      repair.extend(img, brush / img.k);
      setStroke((s) => (s ? [...s, p] : [p]));
    } else if ((d.tool === 'keep' || d.tool === 'remove') && d.last) {
      const img = toImage(at(e));
      paint(d.last, img, img.k, d.tool);
      d.last = img;
    }
  }

  function onUp() {
    handleDrag.current = null;
    const d = drag.current;
    drag.current = null;
    if (d?.tool === 'repair' && repair.painting()) {
      setStroke(null);
      if (!repair.end()) say('«رمّم» تحت الذقن وحده — الوجه لا يُمسّ', true);
    }
    // بعد الفرشاة تُعاد المعالم: شعرةٌ أُبقيت أو ظلٌّ مُسح يغيّر قمّة الرأس أو الرقبة.
    if (d && (d.tool === 'keep' || d.tool === 'remove') && work.current && cut.current)
      setLm(withFace(landmarks(cut.current.alpha, work.current.width, work.current.height), cut.current.face));
  }

  function onWheel(e: React.WheelEvent) {
    if (tool === 'move') setCrop((c) => ({ ...c, zoom: Math.max(1, Math.min(6, c.zoom - e.deltaY * 0.0015)) }));
    else if (tool === 'suit') setWorn((s) => s && { ...s, at: { ...s.at, scale: Math.max(s.base.scale * 0.4, Math.min(s.base.scale * 2.5, s.at.scale * (1 - e.deltaY * 0.001))) } });
    else if (tool !== 'color') setBrush((b) => Math.max(3, Math.min(80, b - e.deltaY * 0.03)));
  }

  function resetMask() {
    const w = work.current;
    const c = cut.current;
    if (!w || !c) return;
    erase.reset();
    c.alpha.set(c.model);
    setLm(withFace(landmarks(c.alpha, w.width, w.height), c.face));
    rebuildSubject();
    draw();
    setCutVersion((v) => v + 1); // ألوان الحافّة كما خرجت من التفريغ — فيُعاد التحسين منها
  }

  /** حدّ «رمّم» على الإطار: الذقن. */
  const shown = natural ? cropBox(frame, natural, crop) : null;
  const lineY = lm && natural && shown ? shown.top + lm.chin * (shown.width / natural.w) : null;

  return { resetMask, onUp, onMove, onDown, onWheel, onHandleDown, erase, repair: { ...repair, stroke, lineY } };
}
