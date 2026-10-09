/**
 * الصورة: ثابتةٌ، أو صورةُ حقلٍ (`ref`) تُملأ من ملفّ الزبون أو الماسح أو الدفعة. وعنصر `svg` القديم صورةٌ بمحتواه.
 */
import { newUuid } from '../../doc';
import { escapeHtml } from '../../html';
import type { Box, ImageElement, ImageFrame } from '../model/types';
import { mmToPx } from '../model/units';
import { boxStyle } from '../render/box';
import { cssColor, isImageShape, shapePath } from '../shapes';
import { normalizeDash, svgDash } from '../paint';
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

/** الإطار المحفوظ مقوَّمًا: لونٌ آمن، وسُمكٌ وفسحةٌ بحدودهما بالملّم — والتالف لا إطار. */
function normalizeFrame(raw: unknown): { frame?: ImageFrame } {
  if (!raw || typeof raw !== 'object') return {};
  const f = raw as Record<string, unknown>;
  if (typeof f.width !== 'number' || !Number.isFinite(f.width) || f.width <= 0) return {};
  const width = Math.min(10, Math.max(0.1, f.width));
  const frame: ImageFrame = { color: cssColor(f.color, '#ffffff'), width };
  const dash = normalizeDash(f.dash);
  if (dash) frame.dash = dash;
  if (f.rings === 2) {
    frame.rings = 2;
    frame.gap = typeof f.gap === 'number' && Number.isFinite(f.gap) ? Math.min(10, Math.max(0, f.gap)) : 1.5;
  }
  return { frame };
}

/**
 * الصورة مقصوصةً بشكلها وإطارها على حدّه (DESIGNS.md ١٫١): القصّ `clip-path: path()` والإطار مسارٌ في SVG — متّجهان
 * في الطباعة. والإطار داخل الصندوق: حلقةٌ على حدّ الصورة، والثانية خارجها بفسحة، والصورة داخل الأولى.
 */
function shapedImage(el: ImageElement, href: string, w: number, h: number, dpi: number, box: string): string {
  const shape = el.shape ?? 'rect';
  const sw = el.frame ? mmToPx(el.frame.width, dpi) : 0;
  const gap = el.frame?.rings === 2 ? mmToPx(el.frame.gap ?? 1.5, dpi) : 0;
  const ring = (inset: number) => `<path d="${shapePath(shape, w, h, inset, el.radius)}" fill="none" stroke="${el.frame!.color}" stroke-width="${sw}"${svgDash(el.frame!.dash, sw)}/>`;
  const inner = el.frame?.rings === 2 ? sw + gap + sw / 2 : sw / 2;
  const clip = shapePath(shape, w, h, el.frame ? inner : 0, el.radius);
  const rings = el.frame ? `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;overflow:visible">${ring(inner)}${el.frame.rings === 2 ? ring(sw / 2) : ''}</svg>` : '';
  const img = href ? `<img alt="" src="${escapeHtml(href)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${el.fit};clip-path:path('${clip}')"/>` : '';
  return `<div style="${box}">${img}${rings}</div>`;
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
    radius: typeof raw.radius === 'number' ? raw.radius : undefined,
    ...(isImageShape(raw.shape) ? { shape: raw.shape } : {}),
    ...normalizeFrame(raw.frame)
  }),
  render(el, { canvas, values, opts, url }) {
    const src = (el.ref && values[el.ref]) || el.src;
    // صورةٌ لم تُملأ: لا شيء — إلا إطارها، فهو من التصميم (وموضعُ صورةٍ تُلصق باليد بعد الطباعة).
    if (!src) return el.frame ? shapedImage(el, '', mmToPx(canvas.size.w, opts.dpi) * el.box.w, mmToPx(canvas.size.h, opts.dpi) * el.box.h, opts.dpi, boxStyle(el, canvas, opts.dpi)) : '';
    // بلا شكلٍ ولا إطار: كما كانت — فلا يتغيّر تصميمٌ محفوظ.
    if (!el.shape && !el.frame) {
      const radius = el.radius ? `;border-radius:${el.radius}%` : '';
      return `<img alt="" src="${escapeHtml(url(src))}" style="${boxStyle(el, canvas, opts.dpi)};object-fit:${el.fit}${radius}"/>`;
    }
    return shapedImage(el, url(src), mmToPx(canvas.size.w, opts.dpi) * el.box.w, mmToPx(canvas.size.h, opts.dpi) * el.box.h, opts.dpi, boxStyle(el, canvas, opts.dpi));
  },
  keys: (el) => (el.ref ? [el.ref] : [])
};
