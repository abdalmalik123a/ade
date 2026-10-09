/**
 * تأثيرات النصّ (DESIGNS.md ١٫١٠): الظلّ والحدّ والقوس — تُقوَّم بحدودها، وتُرسم ظلًّا وحدًّا تحت الملء، والقوس SVG
 * متّجهٌ على دائرةٍ تنحني بالقصير والطويل سواء ويصغر حجمه ليسع؛ والحزمة ترتفع صيغتها بها، والقديم بلا شيءٍ منها كما كان.
 * ولقطةٌ لختم مدرسةٍ: اسمٌ على قوسٍ بحدٍّ أبيض، وتحته شعارٌ مقلوبُ القوس، وعنوانٌ بظلّ.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, designPackLevel, emptyCanvas, normalizeCanvas, SCREEN_DPI, textElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { run } from '../src/shared/doc';
import { arcGeometry } from '../src/shared/design/kinds/text';
import type { TextElement } from '../src/shared/canvas';

const box = { x: 0.1, y: 0.1, w: 0.8, h: 0.2 };
const one = (patch: Record<string, unknown>) => normalizeCanvas({ size: { w: 100, h: 60 }, elements: [{ ...textElement({ id: 't', box, inlines: [run('مدرسة النور')] }), ...patch }] }).elements[0] as TextElement;
const render = (patch: Record<string, unknown>) => renderCanvasHtml(canvasDoc(normalizeCanvas({ size: { w: 100, h: 60 }, elements: [one(patch)] })), {}, { dpi: SCREEN_DPI });

describe('تأثيرات النصّ', () => {
  it('تُقوَّم: ألوانٌ آمنة وأرقامٌ بحدودها، والحدّ بلا سُمك والقوس صفرٌ عدم', () => {
    const el = one({ shadow: { color: 'red;x', dx: 99, dy: -1, blur: -3 }, outline: { color: '#fff', width: 9 }, arc: 140.6 });
    expect(el.shadow).toEqual({ color: 'rgba(0,0,0,0.35)', dx: 20, dy: -1, blur: 0 });
    expect(el.outline).toEqual({ color: '#fff', width: 5 });
    expect(el.arc).toBe(100);
    const plain = one({ outline: { color: '#fff', width: 0 }, arc: 0, shadow: 'x' });
    expect('outline' in plain || 'arc' in plain || 'shadow' in plain).toBe(false);
  });

  it('الظلّ ظلّ نصٍّ بالنقاط، والحدّ ضعفُه تحت الملء — والقديم بلا شيءٍ منهما', () => {
    expect(render({})).not.toMatch(/text-shadow|text-stroke/);
    const html = render({ shadow: { color: '#333333', dx: 0.75, dy: 1.5, blur: 3 }, outline: { color: '#ffffff', width: 0.75 } });
    expect(html).toContain('text-shadow:1.00px 2.00px 4.00px #333333');
    expect(html).toContain('-webkit-text-stroke:2.00px #ffffff;paint-order:stroke fill');
  });

  it('والقوس SVG: النصّ على دائرةٍ بمنتصفه، فوقها كقوس الباب أو تحتها كالابتسامة', () => {
    const up = render({ arc: 60 });
    expect(up).toContain('<textPath href="#arc-t" startOffset="50%">مدرسة النور</textPath>');
    expect(up).toContain('text-anchor="middle"');
    expect(up).toContain('direction:rtl');
    // من اليسار إلى اليمين: فوق المركز مع عقارب الساعة، وتحته عكسها — فيُقرأ كلاهما.
    expect(up).toMatch(/d="M[\d.]+ [\d.-]+ A[\d.]+ [\d.]+ 0 [01] 1 /);
    expect(render({ arc: -60 })).toMatch(/d="M[\d.]+ [\d.-]+ A[\d.]+ [\d.]+ 0 [01] 0 /);
  });

  it('والقصير والطويل ينحنيان سواء: نصف القطر بطول النصّ، و١٠٠ نصف دائرة', () => {
    const short = arcGeometry(50, 4, 20, 300, 60);
    const long = arcGeometry(50, 12, 20, 300, 60);
    expect(long.r / short.r).toBeCloseTo(3);
    // نصف دائرة: نصّ طوله ٢٠٠ على نصف قطرٍ ٢٠٠/π.
    expect(arcGeometry(100, 10, 20, 400, 60).r).toBeCloseTo(200 / Math.PI);
  });

  it('والقوس يصغر حجمه ليسع وترُه الصندوق، ويحمل التدرّج والحدّ والظلّ', () => {
    expect(arcGeometry(100, 30, 40, 300, 60).size).toBeCloseTo((300 * 0.96 * Math.PI) / (30 * 2));
    const long = render({ arc: 40, size: 72, inlines: [run('مدرسة النور الابتدائية المختلطة للبنين والبنات')] });
    const size = Number(/font-size:([\d.]+)px/.exec(long.slice(long.indexOf('<text')))![1]);
    expect(size).toBeLessThan(96);
    const html = render({
      arc: 40,
      gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#f5d77a' }, { offset: 1, color: '#9a7524' }] },
      outline: { color: '#ffffff', width: 1 },
      shadow: { color: '#000000', dx: 1, dy: 1, blur: 0 }
    });
    expect(html).toContain('fill="url(#text-t)"');
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('paint-order="stroke fill"');
    // الظلّ نسخةٌ مزاحةٌ تحت النصّ، وبلا نعومةٍ لا مرشّح عليها (متّجهةٌ في PDF).
    expect(html.indexOf('fill="#000000"')).toBeLessThan(html.indexOf('fill="url(#text-t)"'));
    expect(html).not.toContain('filter:blur');
  });

  it('والحزمة ترتفع صيغتها بها وحدها', () => {
    const doc = (patch: Record<string, unknown>) => ({ canvas: { elements: [{ kind: 'text', ...patch }] } });
    expect(designPackLevel(doc({}))).toBe(1);
    expect(designPackLevel(doc({ arc: 30 }))).toBe(2);
    expect(designPackLevel(doc({ outline: { color: '#fff', width: 1 } }))).toBe(2);
    expect(designPackLevel(doc({ shadow: { color: '#000', dx: 1, dy: 1, blur: 1 } }))).toBe(2);
  });

  it('لقطة ختم المدرسة', async () => {
    const canvas = {
      ...emptyCanvas({ w: 80, h: 80 }),
      elements: [
        textElement({ id: 'name', box: { x: 0.1, y: 0.12, w: 0.8, h: 0.25 }, inlines: [run('مدرسة النور الابتدائية')], size: 16, bold: true, color: '#1f3a8a', arc: 70, outline: { color: '#ffffff', width: 0.5 } }),
        textElement({ id: 'motto', box: { x: 0.15, y: 0.62, w: 0.7, h: 0.2 }, inlines: [run('العلم نور')], size: 12, color: '#7a1e2c', arc: -50 }),
        textElement({ id: 'year', box: { x: 0.25, y: 0.42, w: 0.5, h: 0.16 }, inlines: [run('٢٠٢٦')], size: 20, bold: true, color: '#9a7524', shadow: { color: 'rgba(0,0,0,0.35)', dx: 0.5, dy: 1, blur: 1.5 } })
      ]
    };
    const html = renderCanvasHtml(canvasDoc(normalizeCanvas(canvas)), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/text-effects-stamp.html');
  });
});
