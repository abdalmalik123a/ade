/**
 * التصميم صورةً (DESIGNS.md ١٫٨): الشفّافة بلا ورقٍ أبيض ولا خلفية، ومقاسات الشاشة ببكسلاتها تمامًا على ٩٦ نقطة.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, mmToPx, SCREEN_DPI, SIZE_PRESETS, shapeElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';

describe('التصميم صورةً', () => {
  it('الشفّافة: لا ورقٌ أبيض ولا خلفية — والعناصر كما هي', () => {
    const canvas = { ...emptyCanvas({ w: 100, h: 50 }), background: { kind: 'color' as const, color: '#123456' } };
    canvas.elements = [shapeElement({ id: 's', box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, fill: '#c9a45c' })];
    const solid = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI });
    const clear = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI, transparent: true });
    expect(solid).toContain('background:#fff');
    expect(solid).toContain('#123456');
    expect(clear).toContain('background:transparent');
    expect(clear).not.toContain('#123456');
    expect(clear).toContain('background:#c9a45c');
  });

  it('ومقاسات الشاشة ببكسلاتها تمامًا على ٩٦ نقطة', () => {
    const screens = SIZE_PRESETS.filter((p) => p.px);
    expect(screens.map((p) => p.key)).toEqual(['post-square', 'post-portrait', 'story']);
    for (const p of screens) {
      expect(Math.round(mmToPx(p.size.w, 96)), p.key).toBe(p.px!.w);
      expect(Math.round(mmToPx(p.size.h, 96)), p.key).toBe(p.px!.h);
    }
  });
});
