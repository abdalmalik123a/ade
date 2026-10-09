/**
 * الشكل: مستطيلٌ (بزواياه المدوّرة) أو بيضاويٌّ أو خطّ — بلونٍ وحدٍّ.
 */
import { newUuid } from '../../doc';
import type { Box, ShapeElement } from '../model/types';
import { boxStyle } from '../render/box';
import type { KindSpec } from './types';

export function shapeElement(patch: Partial<ShapeElement> & { box: Box }): ShapeElement {
  return { id: newUuid(), kind: 'shape', shape: 'rect', z: 1, ...patch };
}

export const SHAPE_KIND: KindSpec<ShapeElement> = {
  kind: 'shape',
  normalize: (raw, b) => ({
    id: b.id,
    kind: 'shape',
    name: b.name,
    box: b.box,
    z: b.z,
    locked: b.locked,
    rotate: b.rotate,
    dir: b.dir,
    shape: raw.shape === 'ellipse' || raw.shape === 'line' ? raw.shape : 'rect',
    fill: typeof raw.fill === 'string' ? raw.fill : undefined,
    stroke: typeof raw.stroke === 'string' ? raw.stroke : undefined,
    strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : undefined,
    radius: typeof raw.radius === 'number' ? raw.radius : undefined
  }),
  render(el, { canvas, opts }) {
    const radius = el.shape === 'ellipse' ? ';border-radius:50%' : el.radius ? `;border-radius:${el.radius}px` : '';
    const border = el.stroke ? `;border:${(el.strokeWidth ?? 1) * (opts.dpi / 96)}px solid ${el.stroke}` : '';
    return `<div style="${boxStyle(el, canvas, opts.dpi)};background:${el.fill ?? 'transparent'}${border}${radius}"></div>`;
  },
  keys: () => []
};
