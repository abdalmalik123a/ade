import { describe, expect, it } from 'vitest';
import {
  KINDS,
  PALETTES,
  STYLES,
  buildDesign,
  buildDoc,
  dominantColor,
  paletteFrom,
  sampleValues
} from '../src/shared/designKit';
import { canvasKeys, canvasPx } from '../src/shared/canvas';
import { estimateEm, renderCanvasHtml } from '../src/shared/canvasHtml';
import { luminance } from '../src/shared/designKit/color';

const royal = PALETTES[0]!;

describe('محرّك التصاميم: نوعٌ × نمطٌ × لوحة', () => {
  it('اثنا عشر نوعًا بخمسة أنماط — ستّون تصميمًا يُبنى كلٌّ منها', () => {
    expect(KINDS).toHaveLength(12);
    expect(STYLES).toHaveLength(5);
    for (const kind of KINDS)
      for (const style of STYLES) {
        const canvas = buildDesign({ kind: kind.key, style: style.key, palette: royal });
        const id = `${kind.key}/${style.key}`;
        expect([id, canvas.size]).toEqual([id, kind.size]);
        expect([id, canvas.bleed]).toEqual([id, kind.bleed]);
        expect([id, canvasKeys(canvas).length > 0]).toEqual([id, true]);
        const src = canvas.background.kind === 'image' ? canvas.background.src : '';
        expect([id, src.startsWith('data:image/svg+xml')]).toEqual([id, true]);
        // يُحفظ داخل الوثيقة — فحجمه كيلوبايتات لا ميغابايتات.
        expect([id, src.length < 120_000]).toEqual([id, true]);
      }
  });

  it('وتُبنى مرّتين فتتطابقان — لا عشوائيّة، حتى قصاصات الأطفال', () => {
    for (const style of STYLES) {
      const a = buildDesign({ kind: 'thanks', style: style.key, palette: royal });
      const b = buildDesign({ kind: 'thanks', style: style.key, palette: royal });
      expect(a.background).toEqual(b.background);
    }
  });

  it('الخلفية بمقاس الورقة مع النزف — فلا يظهر خيطٌ أبيض بعد القصّ', () => {
    const canvas = buildDesign({ kind: 'student-id', style: 'modern', palette: royal });
    const svg = decodeURIComponent((canvas.background as { src: string }).src.split(',')[1]!);
    expect(svg).toContain('viewBox="-30 -30 916 600"');
    expect(svg).toContain('width="91.6mm"');
  });

  it('والهوية تحمل صورة الطالب حقلًا، والشعار صورةً إن وُجد', () => {
    const bare = buildDesign({ kind: 'student-id', style: 'official', palette: royal });
    expect(bare.elements.some((e) => e.kind === 'image' && e.ref === 'الصورة')).toBe(true);
    // الباركود للهويّات والبطاقات وحدها — قرار المالك.
    expect(bare.elements.some((e) => e.kind === 'barcode' && e.ref === 'الرقم')).toBe(true);
    const cert = buildDesign({ kind: 'thanks', style: 'official', palette: royal });
    expect(cert.elements.some((e) => e.kind === 'barcode')).toBe(false);
    expect(bare.elements.some((e) => e.kind === 'image' && e.name === 'شعار الجهة')).toBe(false);
    const branded = buildDesign({
      kind: 'student-id',
      style: 'official',
      palette: royal,
      brand: { logo: 'seals/x.png' }
    });
    expect(branded.elements.some((e) => e.kind === 'image' && e.src === 'seals/x.png')).toBe(true);
  });

  it('والاسم الطويل يصغر ليسع ولا يُقصّ', () => {
    const doc = buildDoc({ kind: 'student-id', style: 'official', palette: royal });
    const long = 'عبد الرحمن محمد عبد الكريم حسين الجبوري';
    const html = renderCanvasHtml(doc, { ...sampleValues(), الاسم: long }, { dpi: 96 });
    const box = html.match(/data-fit="([\d.]+)" style="[^"]*font-size:([\d.]+)px[^"]*"><span[^>]*>عبد الرحمن/);
    expect(box).not.toBeNull();
    expect(Number(box![2])).toBeLessThan(Number(box![1]));
    expect(estimateEm(long)).toBeGreaterThan(estimateEm('زينب علي'));
  });

  it('والرقم اللاتيني يُعزل باتجاهه — «2026-0457» لا «0457-2026»', () => {
    const doc = buildDoc({ kind: 'student-id', style: 'official', palette: royal });
    const html = renderCanvasHtml(doc, { الرقم: '2026-0457', الاسم: 'زينب' }, { dpi: 96 });
    expect(html).toContain('<bdi dir="ltr">2026-0457</bdi>');
    expect(html).not.toContain('<bdi dir="ltr">زينب');
  });

  it('والعيّنة تحمل اسم الجهة إن عُرف', () => {
    expect(sampleValues({ name: 'ثانوية المتميزين' }).المدرسة).toBe('ثانوية المتميزين');
  });

  it('وتُرسم ٣٠٠ نقطة/إنش بمقاسها ونزفها', () => {
    const canvas = buildDesign({ kind: 'student-id', style: 'kids', palette: royal });
    expect(Math.round(canvasPx(canvas, 300).w)).toBe(Math.round((91.6 / 25.4) * 300));
  });
});

describe('ألوان الجهة', () => {
  it('اللون الغالب من شعارٍ أزرق على ورقٍ أبيض بخطٍّ أسود', () => {
    const px: number[] = [];
    const put = (r: number, g: number, b: number, count: number) => {
      for (let i = 0; i < count; i++) px.push(r, g, b, 255);
    };
    put(255, 255, 255, 500); // الورق
    put(0, 0, 0, 200); // الخطّ
    put(20, 70, 160, 120); // الأزرق
    put(200, 40, 40, 30); // لمسةٌ حمراء صغيرة
    const hex = dominantColor(px)!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('وشعارٌ بلا لون لا يُخترع له لون', () => {
    expect(dominantColor([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255])).toBeNull();
  });

  it('واللوحة منه: رئيسٌ مقروء وعميقٌ داكن وورقٌ فاتح', () => {
    const p = paletteFrom('#9fd3ff');
    expect(luminance(p.primary)).toBeLessThan(0.3);
    expect(luminance(p.deep)).toBeLessThan(luminance(p.primary));
    expect(luminance(p.paper)).toBeGreaterThan(0.9);
  });
});
