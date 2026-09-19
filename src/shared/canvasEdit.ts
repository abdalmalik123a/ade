/**
 * تحرير اللوحة — عملياتٌ خالصة، لا تمسّ DOM ولا React.
 *
 * وهذا شرطُ أن تُقاس: «التصق عند حافّة الشقيق» و«وزّع أفقيًّا بتساوٍ» قواعدُ
 * هندسية تُختبر بالأرقام، لا سلوكُ فأرةٍ يُجرَّب بالعين. والشاشة تنادي هذه
 * الدوال ولا تحسب بنفسها.
 *
 * والوحدة في كل ما هنا **نسبةٌ من مقاس التصميم (٠..١)**، فما يصحّ على هويةٍ
 * يصحّ على لوحة شرف بلا تحويل.
 */
import { clampBox, type Box, type Canvas, type CanvasElement } from './canvas';

/** أقلّ ما يُقبل من عرضٍ أو ارتفاع — فلا يختفي عنصرٌ بسحبة مقبض. */
export const MIN_SIDE = 0.01;

/** مدى الالتصاق نسبةً — نحو ٦ بكسلات على شاشةٍ عادية. */
export const SNAP = 0.012;

export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ── حسابُ الصناديق ───────────────────────────────────────────────────

export const right = (box: Box): number => box.x + box.w;
export const bottom = (box: Box): number => box.y + box.h;
export const centerX = (box: Box): number => box.x + box.w / 2;
export const centerY = (box: Box): number => box.y + box.h / 2;

/** أصغرُ صندوقٍ يضمّ ما أُعطي — وهو مرجع المحاذاة في التحديد المتعدد. */
export function hull(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map(right)) - x,
    h: Math.max(...boxes.map(bottom)) - y
  };
}

// ── الالتصاق وخطوط الإرشاد ───────────────────────────────────────────

export type Guide = { axis: 'x' | 'y'; at: number };

/**
 * يُلصق صندوقًا بما حوله: حوافُّ الورقة ومنتصفاها، وحوافُّ الأشقّاء ومنتصفاتهم.
 *
 * ويُرجع الصندوق بعد الإزاحة **والخطوط التي التصق بها** — فالخطّ يُرى، وبغيره
 * يبدو الالتصاق سحرًا لا يفهمه المستعمل.
 */
export function snapBox(box: Box, siblings: Box[], range = SNAP): { box: Box; guides: Guide[] } {
  const xs = [0, 0.5, 1];
  const ys = [0, 0.5, 1];
  for (const s of siblings) {
    xs.push(s.x, centerX(s), right(s));
    ys.push(s.y, centerY(s), bottom(s));
  }

  const guides: Guide[] = [];
  let { x, y } = box;

  // ثلاثةُ مواضعَ لكل محور: الحافّة القريبة والمنتصف والحافّة البعيدة.
  const fit = (
    candidates: number[],
    points: { at: number; shift: number }[]
  ): { value: number; guide: number } | null => {
    let best: { value: number; guide: number; gap: number } | null = null;
    for (const point of points) {
      for (const c of candidates) {
        const gap = Math.abs(point.at - c);
        if (gap <= range && (!best || gap < best.gap)) {
          best = { value: c - point.shift, guide: c, gap };
        }
      }
    }
    return best ? { value: best.value, guide: best.guide } : null;
  };

  const hitX = fit(xs, [
    { at: box.x, shift: 0 },
    { at: centerX(box), shift: box.w / 2 },
    { at: right(box), shift: box.w }
  ]);
  if (hitX) {
    x = hitX.value;
    guides.push({ axis: 'x', at: hitX.guide });
  }

  const hitY = fit(ys, [
    { at: box.y, shift: 0 },
    { at: centerY(box), shift: box.h / 2 },
    { at: bottom(box), shift: box.h }
  ]);
  if (hitY) {
    y = hitY.value;
    guides.push({ axis: 'y', at: hitY.guide });
  }

  return { box: clampBox({ ...box, x, y }), guides };
}

// ── المقابض ──────────────────────────────────────────────────────────

/**
 * تغيير الحجم بمقبض.
 *
 * والحافّة المقابلة **ثابتة**: من سحب المقبض الأيسر لم يُرِد أن تتحرّك الحافّة
 * اليمنى. و`ratio` يحفظ النسبة (Shift) — فالصورة لا تتشوّه.
 */
export function resizeBox(
  box: Box,
  edge: Edge,
  delta: { dx: number; dy: number },
  ratio = false
): Box {
  let { x, y, w, h } = box;

  // المحور الأفقي في صفحةٍ عربية يُقاس من اليمين: `x` بداية، و`e` حافّة اليمين.
  if (edge.includes('e')) {
    const next = Math.max(MIN_SIDE, w - delta.dx);
    x = x + (w - next);
    w = next;
  }
  if (edge.includes('w')) w = Math.max(MIN_SIDE, w + delta.dx);
  if (edge.includes('n')) {
    const next = Math.max(MIN_SIDE, h - delta.dy);
    y = y + (h - next);
    h = next;
  }
  if (edge.includes('s')) h = Math.max(MIN_SIDE, h + delta.dy);

  if (ratio && box.w > 0 && box.h > 0) {
    const scale = Math.max(w / box.w, h / box.h);
    const nw = box.w * scale;
    const nh = box.h * scale;
    if (edge.includes('e')) x = x + (w - nw);
    if (edge.includes('n')) y = y + (h - nh);
    w = nw;
    h = nh;
  }

  return clampBox({ x, y, w, h });
}

/** الأسهم: بكسلٌ واحد، ومع Shift عشرة — نِسَبًا من الورقة. */
export function nudge(box: Box, dx: number, dy: number, step: number): Box {
  return clampBox({ ...box, x: box.x + dx * step, y: box.y + dy * step });
}

// ── المحاذاة والتوزيع ────────────────────────────────────────────────

export type AlignMode = 'right' | 'hCenter' | 'left' | 'top' | 'vCenter' | 'bottom';

/**
 * يحاذي المحدَّد إلى صندوقٍ مرجع.
 *
 * والمرجع هو ما يضمّ المحدَّد إن كان أكثر من واحد، والورقةُ كلُّها إن كان واحدًا —
 * فمحاذاةُ عنصرٍ وحده تعني توسيطه في الورقة، وهو ما يتوقّعه المستعمل.
 */
export function alignBoxes(boxes: Box[], mode: AlignMode, page?: Box): Box[] {
  const ref = (boxes.length > 1 ? hull(boxes) : null) ?? page ?? { x: 0, y: 0, w: 1, h: 1 };
  return boxes.map((b) => {
    switch (mode) {
      case 'right':
        return clampBox({ ...b, x: ref.x });
      case 'left':
        return clampBox({ ...b, x: right(ref) - b.w });
      case 'hCenter':
        return clampBox({ ...b, x: centerX(ref) - b.w / 2 });
      case 'top':
        return clampBox({ ...b, y: ref.y });
      case 'bottom':
        return clampBox({ ...b, y: bottom(ref) - b.h });
      case 'vCenter':
        return clampBox({ ...b, y: centerY(ref) - b.h / 2 });
    }
  });
}

/**
 * يوزّع ثلاثةً فأكثر بفجواتٍ متساوية بين الأول والأخير.
 *
 * والطرفان لا يتحرّكان — فهما ما اختاره المستعمل، والتوزيع يمسّ ما بينهما.
 */
export function distribute(boxes: Box[], axis: 'x' | 'y'): Box[] {
  if (boxes.length < 3) return boxes;
  const key = axis;
  const side = axis === 'x' ? 'w' : 'h';
  const order = boxes.map((b, i) => ({ b, i })).sort((a, c) => a.b[key] - c.b[key]);

  const first = order[0]!.b;
  const last = order[order.length - 1]!.b;
  const span = last[key] + last[side] - first[key];
  const used = order.reduce((sum, o) => sum + o.b[side], 0);
  const gap = (span - used) / (order.length - 1);

  const out = [...boxes];
  let at = first[key];
  for (const o of order) {
    out[o.i] = clampBox({ ...o.b, [key]: at } as Box);
    at += o.b[side] + gap;
  }
  return out;
}

// ── الطبقات ──────────────────────────────────────────────────────────

export type LayerMove = 'front' | 'back' | 'forward' | 'backward';

/**
 * يحرّك المحدَّد بين الطبقات ثم يعيد ترقيمها ١..ن.
 *
 * وإعادةُ الترقيم مقصودة: بغيرها تتباعد الأرقام مع كل حركة حتى تصير بلا معنى،
 * ويصعب على المكتب أن يفهم قائمة الطبقات.
 */
export function moveLayer(
  elements: CanvasElement[],
  ids: string[],
  move: LayerMove
): CanvasElement[] {
  const picked = new Set(ids);
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  const order = sorted.map((el) => el.id);

  if (move === 'front' || move === 'back') {
    const kept = order.filter((id) => !picked.has(id));
    const moved = order.filter((id) => picked.has(id));
    const next = move === 'front' ? [...kept, ...moved] : [...moved, ...kept];
    return renumber(elements, next);
  }

  const step = move === 'forward' ? 1 : -1;
  const next = [...order];
  // من الطرف المقابل للاتجاه، فلا يتخطّى عنصرٌ أخاه المتحرّك في النقلة نفسها.
  const indices = next.map((id, i) => ({ id, i })).filter((o) => picked.has(o.id));
  for (const o of step > 0 ? [...indices].reverse() : indices) {
    const at = next.indexOf(o.id);
    const to = at + step;
    if (to < 0 || to >= next.length || picked.has(next[to]!)) continue;
    next.splice(at, 1);
    next.splice(to, 0, o.id);
  }
  return renumber(elements, next);
}

function renumber(elements: CanvasElement[], order: string[]): CanvasElement[] {
  const z = new Map(order.map((id, i) => [id, i + 1]));
  return elements.map((el) => ({ ...el, z: z.get(el.id) ?? el.z }));
}

// ── النسخ والتكرار ───────────────────────────────────────────────────

/** إزاحةُ النسخة عن أصلها — فلا تختفي فوقه ويظنّها المستعمل لم تُنسخ. */
export const CLONE_OFFSET = 0.02;

export function cloneElements(
  elements: CanvasElement[],
  ids: string[],
  newId: () => string
): CanvasElement[] {
  const picked = elements.filter((el) => ids.includes(el.id));
  const top = elements.reduce((max, el) => Math.max(max, el.z), 0);
  return picked.map((el, i) => ({
    ...el,
    id: newId(),
    z: top + i + 1,
    locked: false,
    box: clampBox({ ...el.box, x: el.box.x + CLONE_OFFSET, y: el.box.y + CLONE_OFFSET })
  }));
}

// ── التطبيق على اللوحة ───────────────────────────────────────────────

/** يطبّق تحويلًا على صناديق المحدَّد غير المقفل — والمقفل لا يُمسّ. */
export function withBoxes(
  canvas: Canvas,
  ids: string[],
  fn: (boxes: Box[]) => Box[]
): Canvas {
  const targets = canvas.elements.filter((el) => ids.includes(el.id) && !el.locked);
  if (!targets.length) return canvas;
  const next = fn(targets.map((el) => el.box));
  const byId = new Map(targets.map((el, i) => [el.id, next[i]!]));
  return {
    ...canvas,
    elements: canvas.elements.map((el) => (byId.has(el.id) ? { ...el, box: byId.get(el.id)! } : el))
  };
}

// ── التراجع ──────────────────────────────────────────────────────────

export type CanvasHistory = { past: Canvas[]; present: Canvas; future: Canvas[] };

export const HISTORY_DEPTH = 60;

export const startCanvasHistory = (canvas: Canvas): CanvasHistory => ({
  past: [],
  present: canvas,
  future: []
});

export function commitCanvas(history: CanvasHistory, next: Canvas): CanvasHistory {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_DEPTH),
    present: next,
    future: []
  };
}

export function undoCanvas(history: CanvasHistory): CanvasHistory {
  const prev = history.past[history.past.length - 1];
  if (!prev) return history;
  return {
    past: history.past.slice(0, -1),
    present: prev,
    future: [history.present, ...history.future].slice(0, HISTORY_DEPTH)
  };
}

export function redoCanvas(history: CanvasHistory): CanvasHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_DEPTH),
    present: next,
    future: history.future.slice(1)
  };
}
