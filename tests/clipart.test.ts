/**
 * مكتبة الرسومات (هـ٣): لا شعار دولةٍ فيها — المكتب يستورد شعار جهته صورةً. والتصاميم القديمة التي أُدرج فيها
 * الشعار تبقى كما هي: الرسمة تُحفظ في التصميم صورةً بنفسها (`svgToDataUrl`) لا بمعرّفها، فلا يُبحث عنها في المكتبة.
 */
import { describe, expect, it } from 'vitest';
import { BUILTIN_CLIPARTS, svgToDataUrl } from '../src/shared/clipart';
import { normalizeCanvas } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { emptyDoc } from '../src/shared/doc';

describe('مكتبة الرسومات (هـ٣)', () => {
  it('لا شعار جمهورية العراق ولا فئة «وطنية ورسمية»', () => {
    expect(BUILTIN_CLIPARTS.find((c) => c.id === 'iraq_emblem')).toBeUndefined();
    expect(BUILTIN_CLIPARTS.some((c) => /شعار|نسر|جمهورية/.test(c.name) || c.tags.includes('شعار_العراق'))).toBe(false);
    expect(new Set(BUILTIN_CLIPARTS.map((c) => c.category))).toEqual(new Set(['دينية وإسلامية', 'شخصيات وأطفال', 'تكريم وشهادات']));
  });

  it('والمعرّفات فريدة، ولكلّ رسمةٍ SVG', () => {
    expect(new Set(BUILTIN_CLIPARTS.map((c) => c.id)).size).toBe(BUILTIN_CLIPARTS.length);
    expect(BUILTIN_CLIPARTS.every((c) => c.svg.trim().startsWith('<svg'))).toBe(true);
  });

  it('وتصميمٌ قديم أُدرج فيه الشعار يُفتح كما حُفظ ويُرسم — بلا انهيار', () => {
    // كما يُدرجها `handleSelectClipart`: صورةٌ مصدرها الرسمة نفسها.
    const src = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M46 16 L58 14 Z" fill="#d97706"/></svg>');
    const saved = JSON.parse(
      JSON.stringify({
        size: { w: 210, h: 297 },
        bleed: 0,
        elements: [{ id: 'e1', kind: 'image', box: { x: 0.35, y: 0.35, w: 0.3, h: 0.3 }, z: 1, src, fit: 'contain' }]
      })
    );
    const canvas = normalizeCanvas(saved);
    expect(canvas.elements).toHaveLength(1);
    expect(canvas.elements[0]).toMatchObject({ kind: 'image', src });
    expect(renderCanvasHtml({ ...emptyDoc(), canvas })).toContain('data:image/svg+xml');
  });
});
