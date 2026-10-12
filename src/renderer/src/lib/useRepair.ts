/**
 * فرشاة «رمّم» (البند ٤٠) — خطّافٌ واحد لـ«الصور الشخصية» و«حسّن الصورة» في التصاميم: ما تمرّ عليه الفرشاة قناعٌ بحافّةٍ
 * ناعمة (`strokeAlpha`)، وعند رفع الفأرة يُملأ من جواره (`@shared/inpaint`) في ألوان الصورة مكانها، و«تراجع» يعيد ما كان
 * تحته. و`minY` حدٌّ أعلى لما يُرمَّم ويُؤخذ منه (الذقن في الصورة الشخصية — الوجه لا يُمسّ)، و`allow` ما يجوز الأخذ منه.
 */
import { useRef, useState } from 'react';
import { inpaint, type Rect } from '@shared/inpaint';
import { strokeAlpha } from '@shared/portraitMask';

export type RepairTarget = { pixels: Uint8ClampedArray; width: number; height: number };
type Step = { rect: Rect; before: Uint8ClampedArray; pixels: Uint8ClampedArray };
const DEPTH = 12;

export function useRepair(o: {
  target: () => RepairTarget | null;
  changed: (rect: Rect) => void;
  /** ما يجوز الأخذ منه (١) بمقاس الصورة. */
  allow?: (t: RepairTarget) => Uint8Array | undefined;
  /** أعلى صفٍّ يُرمَّم ويُؤخذ منه. */
  minY?: () => number;
}) {
  const ref = useRef(o);
  ref.current = o;
  const mask = useRef<{ data: Uint8Array; last: { x: number; y: number }; pixels: Uint8ClampedArray } | null>(null);
  const stack = useRef<Step[]>([]);
  const [steps, setSteps] = useState(0);
  /** ما رُمّم ولم يُتراجع عنه — ولو خرج من سجلّ التراجع (فالصورة تبقى «معدَّلة»). */
  const [applied, setApplied] = useState(0);

  /** أوّل الخطّ — بإحداثيّات الصورة ونصف قطر الفرشاة بها. */
  const begin = (p: { x: number; y: number }, radius: number) => {
    const t = ref.current.target();
    if (!t) return;
    // صورةٌ أخرى أو تفريغٌ جديد: سجلّ التراجع القديم لا يخصّها.
    if (stack.current.length && stack.current[0]!.pixels !== t.pixels) clear();
    mask.current = { data: new Uint8Array(t.width * t.height), last: p, pixels: t.pixels };
    strokeAlpha(mask.current.data, t.width, t.height, p, p, radius, 'keep');
  };

  const extend = (p: { x: number; y: number }, radius: number) => {
    const m = mask.current;
    const t = ref.current.target();
    if (!m || !t || t.pixels !== m.pixels) return;
    strokeAlpha(m.data, t.width, t.height, m.last, p, radius, 'keep');
    m.last = p;
  };

  /** رفع الفأرة: ما مُسح عليه يُملأ — و`false` إن لم يكن فيه ما يُرمَّم (فوق الحدّ كلّه). */
  const end = (): boolean => {
    const m = mask.current;
    mask.current = null;
    const t = ref.current.target();
    if (!m || !t || t.pixels !== m.pixels) return false;
    const minY = Math.max(0, Math.ceil(ref.current.minY?.() ?? 0));
    m.data.fill(0, 0, Math.min(m.data.length, minY * t.width));
    let allow = ref.current.allow?.(t);
    if (minY > 0) {
      allow = allow ? Uint8Array.from(allow) : new Uint8Array(t.width * t.height).fill(1);
      allow.fill(0, 0, Math.min(allow.length, minY * t.width));
    }
    // ما تحت مستطيل القناع وحده يُحفظ للتراجع — والملء لا يمسّ غيره.
    let x0 = t.width;
    let y0 = t.height;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < m.data.length; i++) {
      if (!m.data[i]) continue;
      const x = i % t.width;
      const y = (i - x) / t.width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < 0) return false;
    const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    const keep = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) keep.set(t.pixels.subarray(((box.y + y) * t.width + box.x) * 4, ((box.y + y) * t.width + box.x + box.w) * 4), y * box.w * 4);
    const rect = inpaint(t.pixels, t.width, t.height, m.data, { allow });
    if (!rect) return false;
    stack.current.push({ rect: box, before: keep, pixels: t.pixels });
    if (stack.current.length > DEPTH) stack.current.shift();
    setSteps(stack.current.length);
    setApplied((a) => a + 1);
    ref.current.changed(rect);
    return true;
  };

  const undo = () => {
    const t = ref.current.target();
    const s = stack.current.pop();
    setSteps(stack.current.length);
    if (!t || !s || s.pixels !== t.pixels) return;
    for (let y = 0; y < s.rect.h; y++) t.pixels.set(s.before.subarray(y * s.rect.w * 4, (y + 1) * s.rect.w * 4), ((s.rect.y + y) * t.width + s.rect.x) * 4);
    setApplied((a) => Math.max(0, a - 1));
    ref.current.changed(s.rect);
  };

  /** «أعِد الكلّ»: كلّ ما في السجلّ يُتراجع عنه من آخره. */
  const undoAll = () => {
    while (stack.current.length) undo();
  };

  /** صورةٌ أخرى: سجلٌّ جديد. */
  const clear = () => {
    stack.current = [];
    mask.current = null;
    setSteps(0);
  };

  return { begin, extend, end, undo, undoAll, clear, canUndo: steps > 0, applied, painting: () => mask.current !== null };
}

export type Repair = ReturnType<typeof useRepair>;
