/**
 * عناصر ديوان المحزومة (DESIGNS.md ١٫٤): أيقوناتٌ وزخارف وصورٌ ظلّية رسمها ديوان — كلٌّ مسارٌ سليمٌ يُدرج شكلًا حرًّا،
 * بمفاتيح لا تتكرّر وأسماءٍ وكلماتٍ للبحث؛ وأدوات الرسم تثقب الثقوب بعكس الاتّجاه؛ ولقطةٌ لها كلّها.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, pathElement, SCREEN_DPI } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { cleanPathData } from '../src/shared/design/kinds/path';
import { BUNDLED_ELEMENTS } from '../src/shared/assets/elements';
import { circle, poly, rect } from '../src/shared/assets/draw';

describe('عناصر ديوان', () => {
  it('كلٌّ مسارٌ سليم يمرّ بتقويم الشكل الحرّ كما هو', () => {
    for (const e of BUNDLED_ELEMENTS) expect(cleanPathData(e.d), e.key).toBe(e.d);
  });

  it('بمفاتيح لا تتكرّر، وأسماءٍ، وكلماتٍ للبحث، وأصنافٍ معروفة — وما تحتاجه أمثلة المالك فيها', () => {
    const keys = BUNDLED_ELEMENTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of BUNDLED_ELEMENTS) {
      expect(e.name.trim(), e.key).not.toBe('');
      expect(e.tags.length, e.key).toBeGreaterThan(0);
      expect(['أيقونات', 'زخارف', 'صور ظلّية']).toContain(e.category);
    }
    // الدعوة (الموقع)، والفلاير الطبّي، والمنيو، وهوية الموظف، والإمساكية.
    for (const k of ['pin', 'medical', 'cutlery', 'cup', 'id-card', 'building', 'lantern', 'mosque', 'crescent']) expect(keys).toContain(k);
  });

  it('وأدوات الرسم: الثقب بعكس الاتّجاه — في الدائرة والمستطيل والمضلّع أيًّا كان ترتيب نقاطه', () => {
    expect(circle(50, 50, 10)).toContain(' 0 1 1 ');
    expect(circle(50, 50, 10, true)).toContain(' 0 1 0 ');
    expect(rect(0, 0, 10, 10).startsWith('M0 0 H10')).toBe(true);
    expect(rect(0, 0, 10, 10, 0, true).startsWith('M0 0 V10')).toBe(true);
    const cw = poly([[0, 0], [10, 0], [10, 10]]);
    expect(poly([[10, 10], [10, 0], [0, 0]])).toBe(cw);
    expect(poly([[0, 0], [10, 0], [10, 10]], true)).toBe('M10 10 L10 0 L0 0 Z');
  });

  it('لقطة العناصر كلّها أشكالًا حرّة', async () => {
    const canvas = emptyCanvas({ w: 280, h: 160 });
    canvas.elements = BUNDLED_ELEMENTS.map((e, i) => pathElement({ id: `e${i}`, box: { x: (i % 10) / 10 + 0.01, y: Math.floor(i / 10) / 4 + 0.01, w: 0.08, h: 0.14 }, d: e.d, name: e.name, z: i + 1 }));
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/bundled-elements.html');
  });
});
