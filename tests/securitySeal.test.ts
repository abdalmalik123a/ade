import { describe, expect, it } from 'vitest';
import { emptyCanvas, barcodeElement } from '../src/shared/canvas';
import { emptyDoc } from '../src/shared/doc';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { inlineBarcodes } from '../src/shared/imposition';
import { sealCode, sealSvg } from '../src/shared/securitySeal';

describe('نقش الأمان الفريد', () => {
  it('الاسم نفسه يعطي النقش نفسه، واسمٌ آخر نقشًا آخر', () => {
    expect(sealSvg('زينب علي 1024')).toBe(sealSvg('زينب علي 1024'));
    expect(sealSvg('زينب علي 1024')).not.toBe(sealSvg('أحمد عادل 1025'));
    expect(sealCode('زينب علي 1024')).toMatch(/^[0-9A-Z]{6}$/);
  });

  it('ولا نقش لبطاقةٍ بلا صاحب', () => {
    expect(sealSvg('  ')).toBe('');
  });

  it('في البطاقة: بذرتُه وسومُ قيمته — فلكلّ طالبٍ نقشه في الطباعة', () => {
    const doc = emptyDoc();
    doc.kind = 'canvas';
    doc.canvas = emptyCanvas({ w: 85.6, h: 54 }, 3);
    doc.canvas.elements = [barcodeElement({ box: { x: 0.7, y: 0.6, w: 0.2, h: 0.3 }, symbology: 'seal', value: '{اسم الطالب} {الرقم}' })];
    const a = inlineBarcodes(renderCanvasHtml(doc, { 'اسم الطالب': 'زينب', الرقم: '1' }));
    const b = inlineBarcodes(renderCanvasHtml(doc, { 'اسم الطالب': 'أحمد', الرقم: '2' }));
    expect(a).toContain(sealCode('زينب 1'));
    expect(b).toContain(sealCode('أحمد 2'));
  });
});
