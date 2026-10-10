/**
 * «حسّن الصورة» (DESIGNS.md ٢٫٢): الاستقامة تقصّ زواياها الفارغة وحدها، والقصّ بنسبةٍ في الوسط، والتشبّع يُبقي الرماديّ
 * رماديًّا، والتنعيم يذيب الضجيج ويُبقي الحافّة — وبلا تعديلٍ لا يتغيّر بكسل.
 */
import { describe, expect, it } from 'vitest';
import { applyColor, cropForRatio, FULL, isEdited, NO_EDIT, normalizeCrop, saturate, smoothImage, straightenScale, turned } from '../src/shared/photoEdit';

const rgba = (w: number, h: number, f: (x: number, y: number) => [number, number, number]) => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set([...f(x, y), 255], (y * w + x) * 4);
  return out;
};

describe('الهندسة', () => {
  it('ربع الدورة يقلب المقاس، والاستقامة صفرٌ لا تقصّ شيئًا', () => {
    expect(turned(400, 300, 1)).toEqual({ w: 300, h: 400 });
    expect(turned(400, 300, 2)).toEqual({ w: 400, h: 300 });
    expect(straightenScale(400, 300, 0)).toBe(1);
  });

  it('والمائلة تقصّ أكبر ما يسع بنسبتها: زوايا المستطيل الداخليّ كلّها داخل الصورة المائلة', () => {
    for (const [w, h, deg] of [[400, 300, 10], [300, 500, -15], [600, 600, 7]] as const) {
      const k = straightenScale(w, h, deg);
      expect(k).toBeLessThan(1);
      const a = (deg * Math.PI) / 180;
      // كلّ زاويةٍ من المستطيل (k·w × k·h) بعد ردّها بميل الصورة داخل w × h (بهامش تقريبٍ صغير).
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = (sx * k * w) / 2;
        const y = (sy * k * h) / 2;
        const rx = x * Math.cos(a) + y * Math.sin(a);
        const ry = -x * Math.sin(a) + y * Math.cos(a);
        expect(Math.abs(rx)).toBeLessThanOrEqual(w / 2 + 1e-6);
        expect(Math.abs(ry)).toBeLessThanOrEqual(h / 2 + 1e-6);
      }
    }
    // المربّع بخمسٍ وأربعين: ١/(جتا + جا).
    expect(straightenScale(100, 100, 45)).toBeCloseTo(1 / Math.SQRT2, 5);
  });

  it('والقصّ بنسبةٍ في الوسط بأكبر ما يسع، ويُقوَّم داخل الإطار', () => {
    expect(cropForRatio(400, 300, 1)).toEqual({ x: 0.125, y: 0, w: 0.75, h: 1 });
    expect(cropForRatio(300, 400, 1)).toEqual({ x: 0, y: 0.125, w: 1, h: 0.75 });
    expect(cropForRatio(400, 300, null)).toBe(FULL);
    expect(normalizeCrop({ x: 0.95, y: -1, w: 0.02, h: 3 })).toEqual({ x: 0.9, y: 0, w: 0.1, h: 1 });
  });
});

describe('الضوء واللون', () => {
  it('بلا تعديلٍ لا يتغيّر بكسل، ولا يُعدّ معدَّلًا', () => {
    const px = rgba(6, 4, (x, y) => [x * 40, y * 60, 120]);
    const out = applyColor(px, 6, 4, NO_EDIT);
    for (let i = 0; i < px.length; i++) expect(Math.abs(out[i]! - px[i]!)).toBeLessThanOrEqual(1);
    expect(isEdited(NO_EDIT)).toBe(false);
    expect(isEdited({ ...NO_EDIT, quarter: 1 })).toBe(true);
    expect(isEdited({ ...NO_EDIT, enhance: { ...NO_EDIT.enhance, exposure: 0.2 } })).toBe(true);
  });

  it('التشبّع: الرماديّ رماديّ، و−١ يُبهته رماديًّا بإضاءته، و+ يقوّي اللون', () => {
    const grey = rgba(1, 1, () => [128, 128, 128]);
    expect([...saturate(grey, 1)].slice(0, 3)).toEqual([128, 128, 128]);
    const red = rgba(1, 1, () => [200, 80, 60]);
    const flat = saturate(red, -1);
    expect(flat[0]).toBe(flat[1]);
    expect(flat[1]).toBe(flat[2]);
    const strong = saturate(red, 0.5);
    expect(strong[0]! - strong[2]!).toBeGreaterThan(200 - 60);
  });

  it('التنعيم يذيب الضجيج على السطح الواحد، والحافّة الحادّة تبقى حادّة', () => {
    let seed = 3;
    const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 30;
    const w = 40;
    const h = 20;
    // نصفٌ داكنٌ ونصفٌ فاتح، وضجيجٌ على كليهما.
    const px = rgba(w, h, (x) => {
      const v = (x < 20 ? 60 : 200) + noise();
      return [v, v, v];
    });
    const out = smoothImage(px, w, h, 0.6);
    const spread = (a: Uint8ClampedArray, from: number, to: number) => {
      const vals: number[] = [];
      for (let y = 3; y < h - 3; y++) for (let x = from; x < to; x++) vals.push(a[(y * w + x) * 4]!);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    };
    expect(spread(out, 3, 16)).toBeLessThan(spread(px, 3, 16) * 0.6);
    // عبر الحافّة: الفرق بين العمودين المتجاورين ما زال كبيرًا.
    const at = (a: Uint8ClampedArray, x: number) => a[(10 * w + x) * 4]!;
    expect(at(out, 20) - at(out, 19)).toBeGreaterThan(100);
    expect(smoothImage(px, w, h, 0)).toBe(px);
  });
});
