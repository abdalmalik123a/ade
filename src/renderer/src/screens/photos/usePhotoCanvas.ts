/**
 * رسم الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: الشخص بلونه المحسّن وشفافيّته، والمشهد في
 * الإطار بخلفيّته وقاطه وقصّه، وحصر المركز في الحالة. وتحت الذقن في فتحة القاط الجلد وحده (البند ٣٩، `@shared/portraitSkin`)،
 * وما قُصّ ولم يغطّه القاط يُكمَل: الرقبة جلدًا وباطن الياقة ظلَّ قماش (S45، D175، `@shared/neckFill`).
 */
import { useCallback, useRef, useEffect } from 'react';
import { keepAbove, neckLine, type Landmarks } from '@shared/portraitMask';
import { neckSkin, skinAt, skinSample, type SkinMask } from '@shared/portraitSkin';
import { faceFloor } from '@shared/portraitFace';
import { neckFill, type NeckFill } from '@shared/neckFill';
import { photoLook, type Look } from '@shared/suitLook';
import { type Scene, drawScene, setSuitLook, suitPixels, suitWithLook, type Work } from '../../lib/portraitCanvas';
import { applyEnhance, type Enhance } from '@shared/portraitEnhance';
import type { Size, Crop } from '@shared/photoSheet';
import type { Cut, Worn } from './photoShared';
import type { Dispatch, SetStateAction, MutableRefObject, RefObject } from 'react';

export function usePhotoCanvas(
  ctx: {
    work: MutableRefObject<Work | null>;
    toned: MutableRefObject<Uint8ClampedArray<ArrayBufferLike> | null>;
    subject: MutableRefObject<HTMLCanvasElement | null>;
    maskOn: MutableRefObject<boolean>;
    cut: MutableRefObject<Cut | null>;
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
    neckDepth?: number;
  }
) {
  const {
    work, toned, subject, maskOn, cut, line, feather, natural, crop, bgColor, worn, frame, view, enhance, cutVersion, useMask, lm, box,
    setCrop, neckDepth = 0
  } = ctx;

  /** قناع الجلد تحت الذقن (يُضرب في الشفافية والقاط ملبوس) — يُحسب مرّةً لكلّ قناعٍ ومعالم، لا مع كلّ سحبةٍ للقاط. */
  const skin = useRef<{ key: string; mask: SkinMask | null }>({ key: '', mask: null });
  /**
   * إكمال الرقبة: طبقةٌ لصورة العمل التي حُسبت لها، تُكتب في الشخص حيث قُصّ (شفافيّته دون النصف) — فتدخل الحفظ والطباعة كما
   * تُرى. وتُعاد بعد أن يستقرّ القاط أو القصّ أو اللون (`refill`)، والسابقة تبقى إلى حينها: لا وميض خلفيةٍ في الرقبة أثناء السحب.
   */
  const fill = useRef<{ work: Work; layer: NeckFill } | null>(null);
  const fillTimer = useRef(0);
  const fillFor = useRef<{ worn: Worn | null; lm: Landmarks | null; natural: Size | null }>({ worn: null, lm: null, natural: null });
  fillFor.current = { worn, lm, natural };
  /** مقياس الصورة للقاط (`@shared/suitLook`) لكلّ لونٍ للشخص، وآخر قاطٍ عُدّل به — فلا يُعاد ما لم يتغيّر. */
  const look = useRef<{ toned: Uint8ClampedArray<ArrayBufferLike>; look: Look } | null>(null);
  const suitLooked = useRef<{ key: string; of: Size | null; suit: Worn['suit'] | null }>({ key: '', of: null, suit: null });

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
    const fl = under && fill.current?.work === w ? fill.current.layer : null;
    const f = feather.current;
    for (let y = y0; y < y1; y++) {
      const plain = !under || y < under.lo - f;
      const fy = fl && y >= fl.y && y < fl.y + fl.h ? (y - fl.y) * fl.w - fl.x : -1;
      for (let x = x0; x < x1; x++) {
        const i = y * w.width + x;
        const o = ((y - y0) * rw + (x - x0)) * 4;
        d[o] = t[i * 4]!;
        d[o + 1] = t[i * 4 + 1]!;
        d[o + 2] = t[i * 4 + 2]!;
        d[o + 3] = a ? (plain ? a[i]! : a[i]! * keepAbove(under!.line, x, y, f) * skinAt(neck, x, y)) : 255;
        // إكمال الرقبة: ما قُصّ هنا (وما أعادته الفرشاة يبقى كما هو) يُملأ من الطبقة.
        if (fy >= 0 && d[o + 3]! < 128 && x >= fl!.x && x < fl!.x + fl!.w && fl!.data[(fy + x) * 4 + 3]) {
          const k = (fy + x) * 4;
          d[o] = fl!.data[k]!;
          d[o + 1] = fl!.data[k + 1]!;
          d[o + 2] = fl!.data[k + 2]!;
          d[o + 3] = 255;
        }
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

  /** يعيد طبقة الإكمال بعد أن يستقرّ ما تغيّر (٢٠٠ م.ث بلا تغيير) — مرّةً لا مع كلّ سحبةٍ أو منزلق — ثم يرسم مستطيلَي القديمة والجديدة. */
  const refill = useCallback(() => {
    window.clearTimeout(fillTimer.current);
    fillTimer.current = window.setTimeout(() => {
      const w = work.current;
      const t = toned.current;
      const c = cut.current;
      const l = line.current;
      const { worn: wr, lm: L } = fillFor.current;
      // لون القاط على قدر الصورة (D176) أوّلًا — فباطن الياقة يُقرأ من القاط بلونه (D177): يُقاس من الشخص كما يُرسم مرّةً لكلّ لون، ويُعدَّل القاط
      // مرّةً لكلّ (صورةٍ وقاطٍ ولونٍ ومقياس).
      let looked = false;
      const nat = fillFor.current.natural;
      if (wr && w && t && c && nat) {
        if (look.current?.toned !== t) look.current = { toned: t, look: photoLook(t, c.alpha, w.width, w.height) };
        const lk = look.current.look;
        const scale = Math.min(wr.at.scaleX ?? 1, wr.at.scaleY ?? 1) * wr.at.scale;
        const key = `${wr.suit.key}|${lk.gains.map((g) => g.toFixed(3)).join(',')}|${lk.grain.toFixed(2)}|${scale.toFixed(1)}`;
        if (suitLooked.current.key !== key || suitLooked.current.of !== nat || suitLooked.current.suit !== wr.suit) {
          suitLooked.current = { key, of: nat, suit: wr.suit };
          setSuitLook(wr.suit, nat, suitWithLook(wr.suit, lk, scale));
          looked = true;
        }
      }
      const model = w && t && c && l && wr && L && maskOn.current ? skinSample(t, c.alpha, w.width, w.height, L, c.face) : null;
      const layer =
        model &&
        neckFill(
          {
            width: w!.width, height: w!.height, pixels: t!, alpha: c!.alpha, line: l!.line, feather: feather.current, mask: skin.current.mask,
            lm: L!, face: c!.face, skin: model, at: wr!.at, anchor: wr!.suit.anchor, neck: { x: L!.neckCenterX, half: L!.neckWidth * 0.5 + 1 }
          },
          (r) => suitPixels(wr!.suit, wr!.at, r, nat ?? undefined)
        );
      const old = fill.current;
      fill.current = layer ? { work: w!, layer } : null;
      if (old) rebuildSubject(old.layer);
      if (layer) rebuildSubject(layer);
      if (old || layer || looked) draw();
    }, 200);
  }, [rebuildSubject, draw]);
  useEffect(() => () => window.clearTimeout(fillTimer.current), []);

  // التحسين يُعاد من الأصل كلّما تغيّر (بعد توقّف المنزلق قليلًا) — والأصل لا يُمسّ.
  useEffect(() => {
    const w = work.current;
    if (!w) return;
    const t = window.setTimeout(() => {
      toned.current = applyEnhance(cut.current?.pixels ?? w.pixels, w.width, w.height, enhance);
      rebuildSubject();
      draw();
      refill(); // الرقبة تُكمَل من الجلد بلونه الجديد
    }, 80);
    return () => window.clearTimeout(t);
  }, [enhance, cutVersion, rebuildSubject, draw, refill]);

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
      // وخارج الرقبة يُقصّ من أسفل الوجه لا من صفّ الذقن: كتفان يعلوان الذقن في صورةٍ قريبة لباسٌ يغطّيه القاط.
      const face = cut.current?.face;
      if (face && lm && neck) for (let x = 0; x < l.length; x++) if (Math.abs(x - neck.x) > neck.half) l[x] = Math.min(l[x]!, faceFloor(face, lm.chin, x));
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of l) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      line.current = { line: l, lo, hi };
      // الجلد وحده في الفتحة: عيّنته من الوجه، وإلى عمق الفتحة أيًّا كان موضع القاط (ضعفا الرقبة ونصف تحت الذقن).
      const key = lm && cut.current ? `${cutVersion}|${lm.chin}|${lm.neckCenterX}|${lm.neckWidth}|${neckDepth}` : '';
      if (skin.current.key !== key) {
        const c = cut.current;
        const model = c && lm ? skinSample(c.pixels, c.alpha, w.width, w.height, lm, c.face) : null;
        const neckOffset = lm ? (neckDepth * (lm.neckWidth || 100)) / 100 : 0;
        skin.current = { key, mask: model && lm && neck ? neckSkin(c!.pixels, w.width, w.height, lm, model, lm.chin + lm.neckWidth * 2.5, neck.half, c!.face, neckOffset) : null };
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
    refill();
  }, [useMask, worn, lm, cutVersion, neckDepth, rebuildSubject, draw, refill]);

  // حصر المركز يثبت في الحالة لا في الرسم وحده — وإلا بقي السحب «يدفع» حافّةً لا تتحرّك.
  useEffect(() => {
    if (box && (Math.abs(box.x - crop.x) > 1e-6 || Math.abs(box.y - crop.y) > 1e-6)) setCrop((c) => ({ ...c, x: box.x, y: box.y }));
  }, [box, crop.x, crop.y]);

  return { rebuildSubject, draw };
}
