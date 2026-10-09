/**
 * الطلاء المشترك (DESIGNS.md ١٫٣): التدرّج والشفافية والخطّ المنقّط — يُقوَّم ويُرسم بقاعدةٍ واحدة في الأنواع كلّها،
 * والقديم بلا شيءٍ منها كما كان. ولقطةٌ لشهادةٍ بزاويةٍ ذهبيةٍ متدرّجة وعنوانٍ متدرّج وأسطرٍ منقّطة.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, imageElement, normalizeCanvas, pathElement, shapeElement, SCREEN_DPI, textElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { run } from '../src/shared/doc';
import { cssGradient, normalizeGradient, normalizePaint, svgDash, svgGradient, type Gradient } from '../src/shared/design/paint';

const GOLD: Gradient = { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#f5d77a' }, { offset: 1, color: '#9a7524' }] };
const render = (elements: unknown[]) => renderCanvasHtml(canvasDoc(normalizeCanvas({ size: { w: 100, h: 60 }, elements })), {}, { dpi: SCREEN_DPI });

describe('التدرّج', () => {
  it('يُقوَّم: نقاطٌ مرتّبة بحدودها وألوانٍ آمنة، والزاوية في دائرتها — والتالف عدم', () => {
    expect(normalizeGradient({ type: 'radial', angle: -90, stops: [{ offset: 2, color: '#fff' }, { offset: -1, color: 'red;x' }] })).toEqual({
      type: 'radial',
      angle: 270,
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#fff' }]
    });
    expect(normalizeGradient({ stops: [{ offset: 0, color: '#fff' }] })).toBeUndefined();
    expect(normalizeGradient('linear-gradient(red, blue)')).toBeUndefined();
    expect(normalizePaint('none', '#000')).toBeUndefined();
    expect(normalizePaint('url(javascript:x)', '#123456')).toBe('#123456');
  });

  it('وCSS بزاويته (٩٠ من الأعلى إلى الأسفل)، وSVG بمعرّفه', () => {
    expect(cssGradient(GOLD)).toBe('linear-gradient(180deg, #f5d77a 0%, #9a7524 100%)');
    expect(cssGradient({ ...GOLD, type: 'radial' })).toBe('radial-gradient(circle, #f5d77a 0%, #9a7524 100%)');
    expect(svgGradient('g1', GOLD)).toBe('<linearGradient id="g1" gradientTransform="rotate(90 0.5 0.5)"><stop offset="0%" stop-color="#f5d77a"/><stop offset="100%" stop-color="#9a7524"/></linearGradient>');
  });

  it('والمنقّط نقاطٌ مدوّرة، والمتقطّع شرطاتٌ بسُمكه', () => {
    expect(svgDash('dotted', 2)).toBe(' stroke-dasharray="0 4.00" stroke-linecap="round"');
    expect(svgDash('dashed', 2)).toBe(' stroke-dasharray="6.00 4.00"');
    expect(svgDash(undefined, 2)).toBe('');
  });
});

describe('في الأنواع', () => {
  const box = { x: 0.1, y: 0.1, w: 0.5, h: 0.3 };

  it('الشفافية لكلّ عنصرٍ في صندوقه — و١ لا تُكتب', () => {
    const html = render([{ ...shapeElement({ id: 'a', box, fill: '#000' }), opacity: 0.4 }, { ...shapeElement({ id: 'b', box, fill: '#000' }), opacity: 7 }]);
    expect(html.match(/opacity:0\.4/g)?.length).toBe(1);
    expect(html).not.toContain('opacity:1');
  });

  it('والشكل بتدرّجٍ وحدٍّ منقّط', () => {
    const html = render([shapeElement({ id: 's', box, fill: GOLD, stroke: '#000', dash: 'dotted' })]);
    expect(html).toContain('background:linear-gradient(180deg');
    expect(html).toContain('px dotted #000');
  });

  it('والشكل الحرّ بتدرّجٍ بمعرّفه وحدٍّ متقطّع', () => {
    const html = render([pathElement({ id: 'p-1', box, d: 'M0 0 H100 V100 Z', fill: GOLD, stroke: '#000', dash: 'dashed' })]);
    expect(html).toContain('<defs><linearGradient id="fill-p-1"');
    expect(html).toContain('fill="url(#fill-p-1)"');
    expect(html).toContain('stroke-dasharray=');
  });

  it('والنصّ المتدرّج: التدرّج مقصوصٌ بحروفه، ولونه احتياط', () => {
    const html = render([textElement({ id: 't', box, inlines: [run('شهادة تقدير')], gradient: GOLD })]);
    expect(html).toContain('-webkit-background-clip:text;background-clip:text;color:transparent');
    expect(html).toContain('شهادة تقدير');
  });

  it('وإطار الصورة منقّط', () => {
    expect(render([imageElement({ id: 'i', box, src: 'photos/a.png', shape: 'circle', frame: { color: '#000', width: 1, dash: 'dotted' } })])).toContain('stroke-linecap="round"');
  });

  it('لقطة: شهادةٌ بزاويةٍ ذهبيةٍ متدرّجة وعنوانٍ متدرّج وأسطرٍ منقّطة وختمٍ شفّاف', async () => {
    const canvas = emptyCanvas({ w: 297, h: 210 });
    canvas.elements = [
      pathElement({ id: 'corner', box: { x: 0, y: 0, w: 0.3, h: 0.42 }, d: 'M100 0 V100 L0 0 Z', fill: GOLD, z: 1 }),
      textElement({ id: 'title', box: { x: 0.15, y: 0.2, w: 0.7, h: 0.15 }, inlines: [run('شهادة شكر وتقدير')], size: 36, bold: true, gradient: GOLD, z: 2 }),
      shapeElement({ id: 'line1', box: { x: 0.2, y: 0.6, w: 0.6, h: 0.003 }, shape: 'line', stroke: '#555', dash: 'dotted', z: 3 }),
      { ...pathElement({ id: 'seal', box: { x: 0.75, y: 0.7, w: 0.14, h: 0.2 }, d: 'M0 50 A50 50 0 1 1 100 50 A50 50 0 1 1 0 50 Z', fill: '#7a1e2c', z: 4 }), opacity: 0.35 }
    ];
    const html = renderCanvasHtml(canvasDoc(normalizeCanvas(canvas)), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/paint-certificate.html');
  });
});
