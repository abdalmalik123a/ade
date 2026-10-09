/**
 * قصّ الصورة بشكلٍ مع إطارها (DESIGNS.md ١٫١): المسارات دوالّ خالصة من الصندوق، والإطار داخل الصندوق، والقديم كما كان،
 * والتالف يُقوَّم — ولقطةٌ للأشكال الثمانية بإطاراتها تحرس ما يُرسم.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, imageElement, normalizeCanvas, SCREEN_DPI } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { IMAGE_SHAPES, cssColor, shapePath } from '../src/shared/design/shapes';

const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('مسارات الأشكال', () => {
  it('كلّ شكلٍ مسارٌ مغلق داخل صندوقه', () => {
    for (const shape of IMAGE_SHAPES) {
      const d = shapePath(shape, 200, 120);
      expect(d.startsWith('M'), shape).toBe(true);
      expect(d.endsWith('Z'), shape).toBe(true);
      const v = nums(d.replace(/A[\d. ]+ \d \d /g, 'A ')); // أعلام القوس ليست إحداثيات
      expect(Math.min(...v), shape).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...v), shape).toBeLessThanOrEqual(200.01);
    }
  });

  it('والتصغير يُدخل الشكل في صندوقه من كلّ جهة', () => {
    expect(shapePath('rect', 100, 50, 5)).toBe('M5 5 H95 V45 H5 V5 Z');
    expect(shapePath('circle', 100, 100, 10)).toBe('M10 50 A40 40 0 1 1 90 50 A40 40 0 1 1 10 50 Z');
    expect(shapePath('hexagon', 80, 40)).toBe('M20 0 H60 L80 20 L60 40 H20 L0 20 Z');
  });

  it('والمستطيل بزواياه القديمة (radius ٪) كما كان border-radius', () => {
    expect(shapePath('rect', 100, 60, 0, 50)).toBe('M15 0 H85 A15 15 0 0 1 100 15 V45 A15 15 0 0 1 85 60 H15 A15 15 0 0 1 0 45 V15 A15 15 0 0 1 15 0 Z');
  });

  it('واللون يُقبل سداسيًّا أو rgb أو اسمًا — وما يكسر النمط لا', () => {
    expect(cssColor('#C9A45C', 'x')).toBe('#C9A45C');
    expect(cssColor('rgba(0, 0, 0, .5)', 'x')).toBe('rgba(0, 0, 0, .5)');
    expect(cssColor('white', 'x')).toBe('white');
    expect(cssColor('red;background:url(x)', 'x')).toBe('x');
    expect(cssColor('"/><script>', 'x')).toBe('x');
  });
});

describe('الصورة المقصوصة', () => {
  const photo = (patch: Record<string, unknown>) =>
    normalizeCanvas({ size: { w: 100, h: 100 }, elements: [{ ...imageElement({ id: 'p', box: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, src: 'photos/a.png' }), ...patch }] });

  it('بلا شكلٍ ولا إطار: كما كانت تمامًا', () => {
    const html = renderCanvasHtml(canvasDoc(photo({ radius: 50 })), {}, { dpi: SCREEN_DPI });
    expect(html).toContain('object-fit:cover;border-radius:50%"/>');
    expect(html).not.toContain('clip-path');
  });

  it('بشكلٍ: قصٌّ بمساره، وبإطارٍ حلقتان بفسحة داخل الصندوق', () => {
    const html = renderCanvasHtml(canvasDoc(photo({ shape: 'circle', frame: { color: '#c9a45c', width: 1, rings: 2, gap: 2 } })), {}, { dpi: SCREEN_DPI });
    expect(html).toContain("clip-path:path('M");
    expect((html.match(/<path /g) ?? []).length).toBe(2);
    expect(html).toContain('stroke="#c9a45c"');
  });

  it('وصورةٌ لم تُملأ: إطارها وحده يُرسم (موضع صورةٍ تُلصق باليد)، وبلا إطارٍ لا شيء كما كان', () => {
    const doc = (patch: Record<string, unknown>) => canvasDoc(photo({ src: '', ref: 'الصورة', ...patch }));
    const framed = renderCanvasHtml(doc({ shape: 'circle', frame: { color: '#000', width: 1 } }), {}, { dpi: SCREEN_DPI });
    expect(framed).toContain('stroke="#000"');
    expect(framed).not.toContain('<img');
    expect(renderCanvasHtml(doc({ shape: 'circle' }), {}, { dpi: SCREEN_DPI })).not.toContain('position:absolute;right');
  });

  it('والتالف يُقوَّم: شكلٌ مجهول يسقط، ولونٌ يكسر النمط يُستبدل، والسُّمك بحدّه', () => {
    const el = photo({ shape: 'star', frame: { color: 'red;x:1', width: 99, rings: 2 } }).elements[0]!;
    expect(el).toMatchObject({ kind: 'image', frame: { color: '#ffffff', width: 10, rings: 2, gap: 1.5 } });
    expect('shape' in el).toBe(false);
    expect('frame' in photo({ frame: { width: 0 } }).elements[0]!).toBe(false);
  });

  it('لقطة الأشكال الثمانية بإطاراتها', async () => {
    const canvas = emptyCanvas({ w: 200, h: 100 });
    canvas.elements = IMAGE_SHAPES.map((shape, i) =>
      imageElement({
        id: `s${i}`,
        box: { x: (i % 4) * 0.25 + 0.02, y: i < 4 ? 0.05 : 0.55, w: 0.2, h: 0.4 },
        src: 'photos/a.png',
        shape,
        frame: i % 2 ? { color: '#1f3a8a', width: 0.8, rings: 2, gap: 1.2 } : { color: '#c9a45c', width: 1 },
        z: i + 1
      })
    );
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/image-shapes.html');
  });
});
