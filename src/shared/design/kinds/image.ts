/**
 * الصورة: ثابتةٌ، أو صورةُ حقلٍ (`ref`) تُملأ من ملفّ الزبون أو الماسح أو الدفعة. وعنصر `svg` القديم صورةٌ بمحتواه.
 */
import { newUuid } from '../../doc';
import { escapeHtml } from '../../html';
import type { Box, ImageElement } from '../model/types';
import { boxStyle } from '../render/box';
import type { ElementCommon, KindSpec } from './types';

export function imageElement(patch: Partial<ImageElement> & { box: Box }): ImageElement {
  return { id: newUuid(), kind: 'image', src: '', fit: 'cover', z: 1, ...patch };
}

/** رسمة SVG صورةً مضمَّنة — والرموز بعد التشفير لا تكسر السمة. */
function svgImageSrc(svg: string): string {
  const body = svg.includes('<svg') ? svg : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`;
}

/**
 * `svg` عنصرٌ قديم من التصميم بالذكاء الاصطناعي، وقد حُذف (المبدأ ٣): فالرسمة المحفوظة تصير صورةً بمحتواها نفسه —
 * لا يتغيّر شكل تصميمٍ حُفظ.
 */
export function legacySvgImage(raw: Record<string, unknown>, b: ElementCommon): ImageElement | null {
  const svg = typeof raw.svg === 'string' ? raw.svg.trim() : '';
  if (!svg) return null;
  return { id: b.id, kind: 'image', name: b.name, box: b.box, z: b.z, locked: b.locked, rotate: b.rotate, dir: b.dir, src: svgImageSrc(svg), fit: 'contain' };
}

export const IMAGE_KIND: KindSpec<ImageElement> = {
  kind: 'image',
  normalize: (raw, b) => ({
    id: b.id,
    kind: 'image',
    name: b.name,
    box: b.box,
    z: b.z,
    locked: b.locked,
    rotate: b.rotate,
    dir: b.dir,
    src: typeof raw.src === 'string' ? raw.src : '',
    ref: typeof raw.ref === 'string' ? raw.ref : undefined,
    fit: raw.fit === 'contain' ? 'contain' : 'cover',
    radius: typeof raw.radius === 'number' ? raw.radius : undefined
  }),
  render(el, { canvas, values, opts, url }) {
    const src = (el.ref && values[el.ref]) || el.src;
    if (!src) return '';
    const radius = el.radius ? `;border-radius:${el.radius}%` : '';
    return `<img alt="" src="${escapeHtml(url(src))}" style="${boxStyle(el, canvas, opts.dpi)};object-fit:${el.fit}${radius}"/>`;
  },
  keys: (el) => (el.ref ? [el.ref] : [])
};
