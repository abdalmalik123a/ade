/**
 * الشكل: مستطيلٌ (بزواياه المدوّرة) أو بيضاويٌّ أو خطّ — بلونٍ وحدٍّ.
 */
import { newUuid } from '../../doc';
import type { Box, ShapeElement } from '../model/types';
import { boxStyle } from '../render/box';
import type { KindSpec } from './types';
import { cssPaint, normalizeDash, normalizePaint } from '../paint';

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
    fill: normalizePaint(raw.fill, 'transparent'),
    stroke: typeof raw.stroke === 'string' ? raw.stroke : undefined,
    strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : undefined,
    radius: typeof raw.radius === 'number' ? raw.radius : undefined,
    ...(normalizeDash(raw.dash) ? { dash: normalizeDash(raw.dash) } : {})
  }),
  render(el, { canvas, opts }) {
    const radius = el.shape === 'ellipse' ? ';border-radius:50%' : el.radius ? `;border-radius:${el.radius}px` : '';
    // الخطّ المنقّط أو المتقطّع (١٫٣) خطٌّ واحدٌ في وسط صندوقه — سطرٌ يُكتب عليه باليد؛ والمتّصل كما كان.
    if (el.shape === 'line' && el.dash && el.stroke) {
      const line = `position:absolute;left:0;right:0;top:50%;border-top:${(el.strokeWidth ?? 1) * (opts.dpi / 96)}px ${el.dash} ${el.stroke};transform:translateY(-50%)`;
      return `<div style="${boxStyle(el, canvas, opts.dpi)}"><div style="${line}"></div></div>`;
    }
    const border = el.stroke ? `;border:${(el.strokeWidth ?? 1) * (opts.dpi / 96)}px ${el.dash ?? 'solid'} ${el.stroke}` : '';
    return `<div style="${boxStyle(el, canvas, opts.dpi)};background:${cssPaint(el.fill)}${border}${radius}"></div>`;
  },
  keys: () => []
};
