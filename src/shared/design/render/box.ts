/**
 * موضع العنصر في الورقة المرسومة — يشترك فيه رسم الأنواع كلّها.
 */
import { mmToPx } from '../model/units';
import type { Canvas, CanvasElement } from '../model/types';

/** الصندوق موضعًا مطلقًا بالبكسل — النِّسَب من التصميم، والنزف إزاحة. */
export function boxStyle(el: CanvasElement, canvas: Canvas, dpi: number): string {
  const offset = mmToPx(canvas.bleed, dpi);
  const w = mmToPx(canvas.size.w, dpi);
  const h = mmToPx(canvas.size.h, dpi);
  const parts = [
    'position:absolute',
    `right:${offset + el.box.x * w}px`,
    `top:${offset + el.box.y * h}px`,
    `width:${el.box.w * w}px`,
    `height:${el.box.h * h}px`,
    `z-index:${el.z}`
  ];
  if (el.rotate) parts.push(`transform:rotate(${-el.rotate}deg)`);
  return parts.join(';');
}
