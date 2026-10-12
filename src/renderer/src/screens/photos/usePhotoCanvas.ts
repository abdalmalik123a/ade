/**
 * رسم الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: الشخص بلونه المحسّن وشفافيّته، والمشهد في
 * الإطار بخلفيّته وقاطه وقصّه، وحصر المركز في الحالة. وتحت الذقن في فتحة القاط الجلد وحده (البند ٣٩، `@shared/portraitSkin`).
 */
import { useCallback, useRef, useEffect } from 'react';
import { keepAbove, neckLine, type Landmarks } from '@shared/portraitMask';
import { neckSkin, skinAt, skinSample, type SkinMask } from '@shared/portraitSkin';
import { type Scene, drawScene, type Work } from '../../lib/portraitCanvas';
import { applyEnhance, type Enhance } from '@shared/portraitEnhance';
import type { Size, Crop } from '@shared/photoSheet';
import type { Worn } from './photoShared';
import type { Dispatch, SetStateAction, MutableRefObject, RefObject } from 'react';

export function usePhotoCanvas(
  ctx: {
    work: MutableRefObject<Work | null>;
    toned: MutableRefObject<Uint8ClampedArray<ArrayBufferLike> | null>;
    subject: MutableRefObject<HTMLCanvasElement | null>;
    maskOn: MutableRefObject<boolean>;
    cut: MutableRefObject<{ alpha: Uint8Array; model: Uint8Array; pixels: Uint8ClampedArray; } | null>;
    line: MutableRefObject<{ line: Float32Array; lo: number; hi: number; } | null>;
    feather: MutableRefObject<number>;
    natural: Size | null;
    crop: Crop;
    bgColor: string;
    worn: Worn | null;
    frame: Size;
    view: RefObject<HTMLCanvasElement>;
    enhance: Enhance;
    cutVersion: number;
    useMask: boolean;
    lm: Landmarks | null;
    box: { left: number; top: number; width: number; height: number; x: number; y: number; } | null;
    setCrop: Dispatch<SetStateAction<Crop>>;
  }
) {
  const {
    work, toned, subject, maskOn, cut, line, feather, natural, crop, bgColor, worn, frame, view, enhance, cutVersion, useMask, lm, box,
    setCrop
  } = ctx;

  /** قناع الجلد تحت الذقن (يُضرب في الشفافية والقاط ملبوس) — يُحسب مرّةً لكلّ قناعٍ ومعالم، لا مع كلّ سحبةٍ للقاط. */
  const skin = useRef<{ key: string; mask: SkinMask | null }>({ key: '', mask: null });

  /** الشخص بلونه المحسّن وشفافيّته في لوحة العمل — كلّها أو مستطيلٌ منها (أثر الفرشاة). */
  const rebuildSubject = useCallback((rect?: { x: number; y: number; w: number; h: number }) => {
    const w = work.current;
    const t = toned.current;
    if (!w || !t) return;
    let c = subject.current;
    if (!c) c = subject.current = document.createElement('canvas');
    if (c.width !== w.width || c.height !== w.height) {
      c.width = w.width;
      c.height = w.height;
      rect = undefined;
    }
    const x0 = rect ? Math.max(0, Math.floor(rect.x)) : 0;
    const y0 = rect ? Math.max(0, Math.floor(rect.y)) : 0;
    const x1 = rect ? Math.min(w.width, Math.ceil(rect.x + rect.w)) : w.width;
    const y1 = rect ? Math.min(w.height, Math.ceil(rect.y + rect.h)) : w.height;
    if (x1 <= x0 || y1 <= y0) return;
    const rw = x1 - x0;
    const img = new ImageData(rw, y1 - y0);
    const d = img.data;
    const a = maskOn.current && cut.current ? cut.current.alpha : null;
    const under = a ? line.current : null;
    const neck = under ? skin.current.mask : null;
    const f = feather.current;
    for (let y = y0; y < y1; y++) {
      const plain = !under || y < under.lo - f;
      for (let x = x0; x < x1; x++) {
        const i = y * w.width + x;
        const o = ((y - y0) * rw + (x - x0)) * 4;
        d[o] = t[i * 4]!;
        d[o + 1] = t[i * 4 + 1]!;
        d[o + 2] = t[i * 4 + 2]!;
        d[o + 3] = a ? (plain ? a[i]! : a[i]! * keepAbove(under!.line, x, y, f) * skinAt(neck, x, y)) : 255;
      }
    }
    c.getContext('2d')!.putImageData(img, x0, y0);
  }, []);

  const sceneRef = useRef<Omit<Scene, 'subject'> | null>(null);
  sceneRef.current = natural ? { natural, crop, background: bgColor, suit: worn && { suit: worn.suit, at: worn.at } } : null;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const draw = useCallback(() => {
    const c = view.current;
    const s = sceneRef.current;
    const sub = subject.current;
    if (!c || !s || !sub) return;
    const f = frameRef.current;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(f.w * dpr);
    const bh = Math.round(f.h * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, f, { ...s, subject: sub });
  }, []);

  useEffect(draw, [draw, natural, crop, bgColor, worn, frame.w, frame.h]);

  // التحسين يُعاد من الأصل كلّما تغيّر (بعد توقّف المنزلق قليلًا) — والأصل لا يُمسّ.
  useEffect(() => {
    const w = work.current;
    if (!w) return;
    const t = window.setTimeout(() => {
      toned.current = applyEnhance(cut.current?.pixels ?? w.pixels, w.width, w.height, enhance);
      rebuildSubject();
      draw();
    }, 80);
    return () => window.clearTimeout(t);
  }, [enhance, cutVersion, rebuildSubject, draw]);

  // الشفافية: القناع إن أُزيلت الخلفية، وقصٌّ على حدّ القاط إن لُبس — وما تغيّر من الصفوف وحده يُعاد.
  useEffect(() => {
    const w = work.current;
    if (!w) return;
    const before = line.current;
    const whole = maskOn.current !== useMask || !before || !worn;
    maskOn.current = useMask;
    feather.current = Math.max(3, Math.round(w.height / 500));
    if (useMask && worn) {
      // الرقبة بعرضها المقيس (أضيقها) — وما جاوزها ولو قليلًا ياقة الزبون ولباسه.
      const neck = lm ? { x: lm.neckCenterX, half: lm.neckWidth * 0.5 + 1, from: lm.chin } : undefined;
      const l = neckLine(worn.suit.tops, worn.suit.anchor, worn.at, w.width, feather.current + 1, neck);
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of l) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      line.current = { line: l, lo, hi };
      // الجلد وحده في الفتحة: عيّنته من الوجه، وإلى عمق الفتحة أيًّا كان موضع القاط (ضعفا الرقبة ونصف تحت الذقن).
      const key = lm && cut.current ? `${cutVersion}|${lm.chin}|${lm.neckCenterX}|${lm.neckWidth}` : '';
      if (skin.current.key !== key) {
        const c = cut.current;
        const model = c && lm ? skinSample(c.pixels, c.alpha, w.width, w.height, lm) : null;
        skin.current = { key, mask: model && lm && neck ? neckSkin(c!.pixels, w.width, w.height, lm, model, lm.chin + lm.neckWidth * 2.5, neck.half) : null };
      }
    } else line.current = null;
    const now = line.current;
    if (whole || !now) rebuildSubject();
    else {
      const top = Math.floor(Math.min(before.lo, now.lo)) - feather.current - 2;
      const bottom = Math.ceil(Math.max(before.hi, now.hi)) + 2;
      rebuildSubject({ x: 0, y: top, w: w.width, h: bottom - top });
    }
    draw();
  }, [useMask, worn, lm, cutVersion, rebuildSubject, draw]);

  // حصر المركز يثبت في الحالة لا في الرسم وحده — وإلا بقي السحب «يدفع» حافّةً لا تتحرّك.
  useEffect(() => {
    if (box && (Math.abs(box.x - crop.x) > 1e-6 || Math.abs(box.y - crop.y) > 1e-6)) setCrop((c) => ({ ...c, x: box.x, y: box.y }));
  }, [box, crop.x, crop.y]);

  return { rebuildSubject, draw };
}
