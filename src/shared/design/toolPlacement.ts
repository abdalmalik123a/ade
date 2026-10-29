/** هندسة إدراج الأدوات: النسب من يمين الورقة بلا النزف، والتكبير للشاشة وحدها. */
import { clampBox } from './model/box';
import type { Box } from './model/types';
export type DesignTool = 'select' | 'text' | 'field' | 'image' | 'shape' | 'barcode' | 'table';
export type Point = { x: number; y: number };
export function designPoint(at: { clientX: number; clientY: number }, rect: { right: number; top: number }, g: { pxW: number; pxH: number; offset: number }, zoom: number): Point {
  return { x: (rect.right - at.clientX - g.offset * zoom) / (g.pxW * zoom), y: (at.clientY - rect.top - g.offset * zoom) / (g.pxH * zoom) };
}
const SIZES: Record<Exclude<DesignTool, 'select'>, [number, number]> = {
  text: [.4, .1], field: [.4, .1], image: [.24, .55], shape: [.3, .2], barcode: [.3, .14], table: [.84, .35]
};
export function placementBox(tool: Exclude<DesignTool, 'select'>, from: Point, to?: Point): Box {
  const [w, h] = SIZES[tool];
  return clampBox(to ? { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) } : { ...from, w, h });
}
