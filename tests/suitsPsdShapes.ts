/** شكل القاط المصنوع ومستطيلاه — يشترك فيه مولّد `suits-layers.psd` واختبار `suitsPsd` (D204). */
import type { Rect } from './psdBuilder';

export const SUITS_W = 300;
export const SUITS_H = 200;
export const BLACK: Rect = { top: 90, left: 20, bottom: 190, right: 140 };
export const NAVY: Rect = { top: 90, left: 160, bottom: 190, right: 280 };

/** شكل القاط في مستطيله: كتفان ينحدران من الوسط، وفتحة رقبةٍ على هيئة V — وما فوقهما شفّاف. */
export function suitShape(r: Rect) {
  const w = r.right - r.left;
  const cx = (r.left + r.right) / 2;
  return (x: number, y: number): number => {
    const dy = y - r.top;
    const dx = Math.abs(x - cx) / (w / 2);
    const shoulders = dy > 30 * dx;
    const neck = Math.abs(x - cx) < 22 - dy * 0.4;
    return shoulders && !neck ? 255 : 0;
  };
}
