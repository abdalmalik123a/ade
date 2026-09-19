import { describe, expect, it } from 'vitest';
import { GALLERY, galleryDesign, galleryPreview } from '../src/shared/designGallery';
import { canvasDoc, canvasKeys, canvasPx } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { reconcileFields } from '../src/shared/doc';

describe('معرض التصاميم: عشرةٌ مولَّدةٌ لا مأخوذة', () => {
  it('عشرةٌ بمفاتيحَ فريدة', () => {
    expect(GALLERY).toHaveLength(10);
    expect(new Set(GALLERY.map((d) => d.key)).size).toBe(10);
    expect(new Set(GALLERY.map((d) => d.title)).size).toBe(10);
  });

  it('وكلُّها تُبنى بمقاسٍ موجب وعناصرَ وحقول', () => {
    for (const design of GALLERY) {
      const canvas = design.build();
      expect([design.key, canvas.size.w > 0 && canvas.size.h > 0]).toEqual([design.key, true]);
      expect([design.key, canvas.size]).toEqual([design.key, design.size]);
      expect([design.key, canvas.bleed]).toEqual([design.key, design.bleed]);
      expect([design.key, canvas.elements.length > 0]).toEqual([design.key, true]);
      expect([design.key, canvasKeys(canvas).length > 0]).toEqual([design.key, true]);
    }
  });

  /**
   * الخلفيةُ متجهةٌ في الوثيقة نفسها.
   *
   * ولا صورةَ نقطيّة تُحزَم: الحجم كيلوبايتات، واللون يتبدّل، والمقاس يتبدّل بلا
   * تشوّه. **ولا ملفَّ في المخزن** — فلا مسارَ يُكسر حين تُنقل القاعدة.
   */
  it('وخلفيتُها SVG في الوثيقة، لا ملفًّا في المخزن', () => {
    for (const design of GALLERY) {
      const canvas = design.build();
      expect([design.key, canvas.background.kind]).toEqual([design.key, 'image']);
      const src = canvas.background.kind === 'image' ? canvas.background.src : '';
      expect([design.key, src.startsWith('data:image/svg+xml')]).toEqual([design.key, true]);
      // كيلوبايتاتٌ لا ميغابايتات.
      expect([design.key, src.length < 60_000]).toEqual([design.key, true]);
    }
  });

  it('وما يُقصّ يأخذ نزفًا، وما لا يُقصّ لا يأخذه', () => {
    const cards = GALLERY.filter((d) => d.size.w < 120);
    expect(cards.length).toBeGreaterThan(0);
    for (const design of cards) expect([design.key, design.bleed]).toEqual([design.key, 3]);

    const sheets = GALLERY.filter((d) => d.key === 'thanks' || d.key === 'honour');
    for (const design of sheets) expect([design.key, design.bleed]).toEqual([design.key, 0]);
  });

  it('والمقاسات هي المعيارية', () => {
    expect(galleryDesign('student-id')!.size).toEqual({ w: 85.6, h: 54 });
    expect(galleryDesign('thanks')!.size).toEqual({ w: 297, h: 210 });
    expect(galleryDesign('honour')!.size).toEqual({ w: 297, h: 420 });
    expect(galleryDesign('invitation')!.size).toEqual({ w: 148, h: 210 });
  });

  it('وكلُّها تُرسم بلا خطأ، ووسومُها تظهر', () => {
    for (const design of GALLERY) {
      const doc = canvasDoc(design.build());
      doc.fields = reconcileFields(doc);
      const html = renderCanvasHtml(doc, {}, { missing: 'token', dpi: 96 });
      expect([design.key, html.includes('data-canvas')]).toEqual([design.key, true]);
      expect([design.key, html.includes('{')]).toEqual([design.key, true]);
    }
  });

  it('والهوية تحمل صورةً وباركودًا بحقليهما', () => {
    const canvas = galleryDesign('student-id')!.build();
    expect(canvas.elements.some((el) => el.kind === 'image' && el.ref === 'الصورة')).toBe(true);
    expect(canvas.elements.some((el) => el.kind === 'barcode' && el.ref === 'الرقم')).toBe(true);
    // ١٠١١ × ٦٣٨ عند ٣٠٠، والنزف يزيدها.
    const px = canvasPx(canvas, 300);
    expect(Math.round(px.w)).toBe(Math.round(((85.6 + 6) / 25.4) * 300));
  });

  it('واللمحة هي الخلفية نفسها — فما يُرى في المعرض هو ما يُفتح', () => {
    for (const design of GALLERY) {
      const canvas = design.build();
      const src = canvas.background.kind === 'image' ? canvas.background.src : '';
      expect([design.key, galleryPreview(design)]).toEqual([design.key, src]);
    }
  });

  it('وتُبنى مرّتين فتتطابقان — فلا عشوائية في الزخرفة', () => {
    for (const design of GALLERY) {
      const a = design.build();
      const b = design.build();
      expect([design.key, JSON.stringify(a.background)]).toEqual([
        design.key,
        JSON.stringify(b.background)
      ]);
    }
  });
});
