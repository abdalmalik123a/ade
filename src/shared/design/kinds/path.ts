/**
 * الشكل الحرّ (DESIGNS.md ١٫٢): مسارٌ في مربّع ٠..١٠٠ يتمدّد مع صندوقه — والحدّ بالملّم لا يتمدّد معه
 * (`vector-effect: non-scaling-stroke`)، فالخطّ الرفيع يبقى رفيعًا في الشريط العريض. متّجهٌ في الطباعة.
 */
import { newUuid } from '../../doc';
import type { Box, PathElement } from '../model/types';
import { mmToPx } from '../model/units';
import { boxStyle } from '../render/box';
import { cssColor } from '../shapes';
import { isGradient, normalizeDash, normalizePaint, paintId, svgDash, svgGradient } from '../paint';
import type { KindSpec } from './types';

/** أوامر المسار وأرقامه وحدها — ولا شيء يكسر السمة. */
const SAFE_D = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/;
const D_MAX = 20_000;

export function cleanPathData(d: unknown): string {
  return typeof d === 'string' && d.length <= D_MAX && SAFE_D.test(d) && /^\s*[Mm]/.test(d) ? d.trim() : '';
}

export function pathElement(patch: Partial<PathElement> & { box: Box; d: string }): PathElement {
  return { id: newUuid(), kind: 'path', z: 1, fill: '#1f3a8a', ...patch };
}

export const PATH_KIND: KindSpec<PathElement> = {
  kind: 'path',
  normalize: (raw, b) => {
    const d = cleanPathData(raw.d);
    if (!d) return null;
    const width = typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth) && raw.strokeWidth > 0 ? Math.min(10, raw.strokeWidth) : undefined;
    return {
      id: b.id,
      kind: 'path',
      name: b.name,
      box: b.box,
      z: b.z,
      locked: b.locked,
      rotate: b.rotate,
      dir: b.dir,
      d,
      ...(typeof raw.preset === 'string' && raw.preset ? { preset: raw.preset.slice(0, 40) } : {}),
      ...(normalizePaint(raw.fill, '#1f3a8a') !== undefined ? { fill: normalizePaint(raw.fill, '#1f3a8a') } : {}),
      ...(raw.stroke !== undefined && raw.stroke !== 'none' ? { stroke: cssColor(raw.stroke, '#333333') } : {}),
      ...(width ? { strokeWidth: width } : {}),
      ...(raw.evenodd === true ? { evenodd: true } : {}),
      ...(normalizeDash(raw.dash) ? { dash: normalizeDash(raw.dash) } : {}),
      ...(raw.flipX === true ? { flipX: true } : {}),
      ...(raw.flipY === true ? { flipY: true } : {})
    };
  },
  render(el, { canvas, opts }) {
    const flip = el.flipX || el.flipY ? ` transform="translate(${el.flipX ? 100 : 0} ${el.flipY ? 100 : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})"` : '';
    const sw = mmToPx(el.strokeWidth ?? 0.5, opts.dpi);
    const stroke = el.stroke ? ` stroke="${el.stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round"${svgDash(el.dash, sw)}` : '';
    const rule = el.evenodd ? ' fill-rule="evenodd"' : '';
    // التدرّج تعريفٌ بمعرّف العنصر — ومنه يُملأ.
    const gid = paintId(el.id, 'fill');
    const defs = isGradient(el.fill) ? `<defs>${svgGradient(gid, el.fill)}</defs>` : '';
    const fill = el.fill === undefined ? 'none' : isGradient(el.fill) ? `url(#${gid})` : el.fill;
    return (
      `<svg style="${boxStyle(el, canvas, opts.dpi)};overflow:visible" viewBox="0 0 100 100" preserveAspectRatio="none">` +
      `${defs}<path d="${el.d}" fill="${fill}"${rule}${stroke}${flip}/></svg>`
    );
  },
  keys: () => []
};
