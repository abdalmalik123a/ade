/**
 * الطبقات والنسخ، وتطبيق التحويل على صناديق المحدَّد.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import { clampBox } from '../model/box';
import type { Box, Canvas, CanvasElement } from '../model/types';

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
