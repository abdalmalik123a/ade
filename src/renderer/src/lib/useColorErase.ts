/**
 * «امسح لونًا» في الواجهة (البند ٣٨) — خطّافٌ واحد لـ«الصور الشخصية» و«أزل الخلفية» في التصاميم: الضغطة تمسح لونها
 * (`@shared/colorErase`)، والمنزلقات تعيد آخر ضغطةٍ بخياراتها الجديدة والأداة مختارة — فما يُرى هو المعاينة — و«تراجع»
 * يعيد ما قبلها. وبعد التفريغ يُقترح وحده إن بقيت حوافّ الصورة لونًا واحدًا.
 *
 * يكتب في قناع الشاشة وألوانها مكانهما (`target`) ثم يقول ما تغيّر (`changed`)؛ والسجلّ يخصّ الصورة التي بدأ عليها —
 * صورةٌ أخرى أو تفريغٌ جديد يبدأ سجلًّا جديدًا. و`reset` قبل «أعِد القناع»: يتراجع عن خطواته وحدها — فلا يمحو ترميمًا جاء بعدها.
 */
import { useEffect, useRef, useState } from 'react';
import { ERASE_DEFAULTS, eraseColor, leftoverBorder, sampleColor, undoErase, type EraseOptions, type EraseUndo, type Rect, type Rgb } from '@shared/colorErase';

export type EraseTarget = { pixels: Uint8ClampedArray; alpha: Uint8Array; width: number; height: number };
type Step = { undo: EraseUndo; seeds: number[]; color: Rgb };
/** آخر ضغطة — تبقى حيّةً ولو لم تمسح شيئًا، فرفع السماحية بعدها يمسح. */
type Live = { seeds: number[]; color: Rgb; step: Step | null };
/** أقصى ما يُتراجع عنه. */
const DEPTH = 24;

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export function useColorErase(o: {
  target: () => EraseTarget | null;
  changed: (rect: Rect) => void;
  /** التفريغ تمّ — فيُفحص الاقتراح. */
  ready: boolean;
  /** الأداة مختارة — وإلا فالمنزلقات لا تعيد آخر ضغطة (قد تكون الفرشاة مرّت بعدها). */
  active: boolean;
  /** `portrait`: الصدر يلامس أسفل الصورة الشخصية — فالاقتراح من الأعلى والجانبين. */
  sides: 'all' | 'portrait';
}) {
  const [opts, setOpts] = useState<EraseOptions>(ERASE_DEFAULTS);
  const [steps, setSteps] = useState(0);
  const [hint, setHint] = useState<{ color: Rgb; seeds: number[] } | null>(null);
  const ref = useRef(o);
  ref.current = o;
  const optsRef = useRef(opts);
  const stack = useRef<Step[]>([]);
  const live = useRef<Live | null>(null);
  const owner = useRef<Uint8ClampedArray | null>(null);
  const frame = useRef(0);

  /** الصورة الحاليّة — وإن تبدّلت فالسجلّ القديم لا يخصّها. */
  const current = (): EraseTarget | null => {
    const t = ref.current.target();
    if (t && t.pixels !== owner.current) {
      owner.current = t.pixels;
      stack.current = [];
      live.current = null;
      setSteps(0);
    }
    return t;
  };

  const apply = (t: EraseTarget, seeds: number[], color: Rgb): Step | null => {
    const undo = eraseColor(t.pixels, t.alpha, t.width, t.height, seeds, color, optsRef.current);
    return undo && { undo, seeds, color };
  };

  const push = (s: Step) => {
    stack.current.push(s);
    if (stack.current.length > DEPTH) stack.current.shift();
    setSteps(stack.current.length);
    setHint(null);
    ref.current.changed(s.undo.rect);
  };

  /** الضغطة بإحداثيّات الصورة العاملة — و`false` إن وقعت على ما لا يُرى. */
  const pick = (x: number, y: number): boolean => {
    const t = current();
    if (!t) return false;
    const color = sampleColor(t.pixels, t.alpha, t.width, t.height, x, y);
    if (!color) return false;
    const seeds = [Math.round(y) * t.width + Math.round(x)];
    const s = apply(t, seeds, color);
    live.current = { seeds, color, step: s };
    if (s) push(s);
    return true;
  };

  /** آخر ضغطةٍ بالخيارات الجديدة: يُعاد ما مسحته ثم تُمسح ثانيةً — مرّةً في كلّ إطارٍ مهما أسرع المنزلق. */
  const reapply = () => {
    frame.current = 0;
    const t = current();
    const l = live.current;
    if (!t || !l) return;
    const old = l.step;
    if (old) {
      // لا يُعاد ما لم يعد آخرَ ما في السجلّ (تُراجع عنه، أو جاءت بعده ضغطة).
      if (stack.current[stack.current.length - 1] !== old) return;
      undoErase(t.pixels, t.alpha, old.undo);
      stack.current.pop();
    }
    const next = apply(t, l.seeds, l.color);
    l.step = next;
    if (next) stack.current.push(next);
    setSteps(stack.current.length);
    const rect = old && next ? union(old.undo.rect, next.undo.rect) : (next ?? old)?.undo.rect;
    if (rect) ref.current.changed(rect);
  };

  const update = (patch: Partial<EraseOptions>) => {
    const next = { ...optsRef.current, ...patch };
    optsRef.current = next;
    setOpts(next);
    if (live.current && !frame.current) frame.current = requestAnimationFrame(reapply);
  };

  const undo = () => {
    const t = current();
    const s = stack.current.pop();
    if (!t || !s) return;
    undoErase(t.pixels, t.alpha, s.undo);
    if (live.current?.step === s) live.current = null;
    setSteps(stack.current.length);
    ref.current.changed(s.undo.rect);
  };

  /** قبل «أعِد القناع»: كلّ ما في السجلّ يُتراجع عنه من آخره (ألوان الحافّة كما كانت)، والسجلّ فارغ. */
  const reset = () => {
    const t = ref.current.target();
    if (t && owner.current === t.pixels) for (let i = stack.current.length - 1; i >= 0; i--) undoErase(t.pixels, t.alpha, stack.current[i]!.undo);
    stack.current = [];
    live.current = null;
    setSteps(0);
  };

  const acceptHint = () => {
    const t = current();
    const s = t && hint && apply(t, hint.seeds, hint.color);
    if (s) {
      live.current = { seeds: hint.seeds, color: hint.color, step: s };
      push(s);
    } else setHint(null);
  };

  useEffect(() => {
    if (!o.active) live.current = null;
  }, [o.active]);

  useEffect(() => {
    const t = o.ready ? current() : null;
    setHint(t && leftoverBorder(t.pixels, t.alpha, t.width, t.height, o.sides, optsRef.current.tolerance));
  }, [o.ready]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { opts, update, pick, undo, canUndo: steps > 0, reset, hint: hint && hint.color, acceptHint, dismissHint: () => setHint(null) };
}

export type ColorErase = ReturnType<typeof useColorErase>;
