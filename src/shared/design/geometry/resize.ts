/**
 * المقابض والأسهم: تغيير الحجم من طرف، والإزاحة خطوةً.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import { clampBox } from '../model/box';
import type { Box } from '../model/types';
import { MIN_SIDE, type Edge } from './boxes';

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
