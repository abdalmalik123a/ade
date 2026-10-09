/**
 * الشكل الحرّ ومكتبته (DESIGNS.md ١٫٢): المسار أوامرُ وأرقامٌ وحدها، والملء والحدّ بلونٍ آمن، والحدّ لا يتمدّد،
 * والقلب والفراغ الداخليّ — ولقطةٌ لأشكال المكتبة كلّها.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, normalizeCanvas, pathElement, SCREEN_DPI } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { cleanPathData } from '../src/shared/design/kinds/path';
import { PATH_PRESETS } from '../src/shared/design/pathPresets';

const one = (raw: Record<string, unknown>) => normalizeCanvas({ size: { w: 100, h: 50 }, elements: [{ kind: 'path', id: 'p', box: { x: 0, y: 0, w: 1, h: 1 }, ...raw }] }).elements;

describe('الشكل الحرّ', () => {
  it('المسار أوامرُ وأرقامٌ وحدها — وما يكسر السمة لا يُقبل', () => {
    expect(cleanPathData('M0 0 L10 10 Z')).toBe('M0 0 L10 10 Z');
    expect(cleanPathData('M0 0" onload="alert(1)')).toBe('');
    expect(cleanPathData('L0 0')).toBe('');
    expect(cleanPathData(42)).toBe('');
    expect(cleanPathData(`M0 0 ${'L1 1 '.repeat(5000)}`)).toBe('');
  });

  it('وكلّ أشكال المكتبة مساراتٌ سليمة', () => {
    for (const p of PATH_PRESETS) expect(cleanPathData(p.d), p.key).toBe(p.d);
    expect(new Set(PATH_PRESETS.map((p) => p.key)).size).toBe(PATH_PRESETS.length);
  });

  it('والتقويم: مسارٌ تالف يُسقط العنصر، واللون الآمن، والسُّمك بحدّه، والقلب', () => {
    expect(one({ d: 'x' })).toEqual([]);
    expect(one({ d: 'M0 0 H100 V100 Z', fill: 'red;x', stroke: '#c9a45c', strokeWidth: 99, flipX: true, flipY: 'نعم', evenodd: true })[0]).toMatchObject({
      kind: 'path',
      fill: '#1f3a8a',
      stroke: '#c9a45c',
      strokeWidth: 10,
      flipX: true,
      evenodd: true
    });
    expect(one({ d: 'M0 0 Z', fill: 'none' })[0]).not.toHaveProperty('fill');
  });

  it('والرسم: يتمدّد مع صندوقه، والحدّ لا يتمدّد، والقلب حول المركز', () => {
    const canvas = { ...emptyCanvas({ w: 100, h: 50 }), elements: [pathElement({ id: 'p', box: { x: 0, y: 0, w: 1, h: 0.5 }, d: 'M0 0 H100 V100 Z', stroke: '#000', strokeWidth: 1, flipX: true, evenodd: true })] };
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI });
    expect(html).toContain('viewBox="0 0 100 100" preserveAspectRatio="none"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('transform="translate(100 0) scale(-1 1)"');
  });

  it('لقطة أشكال المكتبة', async () => {
    const canvas = emptyCanvas({ w: 297, h: 210 });
    canvas.elements = PATH_PRESETS.map((p, i) =>
      pathElement({ id: `s${i}`, box: { x: (i % 6) / 6 + 0.01, y: Math.floor(i / 6) / 3 + 0.02, w: 0.14, h: 0.28 }, d: p.d, preset: p.key, evenodd: p.evenodd, ...(p.stroke ? { fill: undefined, stroke: '#c9a45c', strokeWidth: 0.8 } : {}), z: i + 1 })
    );
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/path-presets.html');
  });
});
