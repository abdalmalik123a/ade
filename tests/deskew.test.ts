import { describe, expect, it } from 'vitest';
import {
  computeProjectiveCoefficients,
  defaultQuadForSize,
  mapUnitToQuad,
  DESKEW_ASPECTS,
  detectQuad,
  flattenLight,
  type PixelData,
  type Quad
} from '../src/shared/deskew';

describe('إزالة ميلان المستمسكات (Perspective De-skew)', () => {
  it('نسب الأبعاد للمستمسكات العراقية مطابقة للواقع', () => {
    const id1 = DESKEW_ASPECTS.find((a) => a.key === 'id1')!;
    expect(id1.aspect).toBeCloseTo(85.6 / 54.0);

    const a7 = DESKEW_ASPECTS.find((a) => a.key === 'a7')!;
    expect(a7.aspect).toBeCloseTo(105.0 / 74.0);
  });

  it('الشكل الرباعي الافتراضي يتمركز في وسط الصورة', () => {
    const quad = defaultQuadForSize(1000, 800, 0.1);
    expect(quad.tl).toEqual({ x: 100, y: 80 });
    expect(quad.tr).toEqual({ x: 900, y: 80 });
    expect(quad.br).toEqual({ x: 900, y: 720 });
    expect(quad.bl).toEqual({ x: 100, y: 720 });
  });

  it('حساب معاملات التحويل الإسقاطي يطابق الأركان الأربعة تماماً', () => {
    const quad = {
      tl: { x: 50, y: 40 },
      tr: { x: 800, y: 60 },
      br: { x: 850, y: 550 },
      bl: { x: 40, y: 520 }
    };

    const coeff = computeProjectiveCoefficients(quad);

    // ركن (0,0) يجب أن يرجع tl
    const p00 = mapUnitToQuad(0, 0, coeff);
    expect(p00.x).toBeCloseTo(quad.tl.x);
    expect(p00.y).toBeCloseTo(quad.tl.y);

    // ركن (1,0) يجب أن يرجع tr
    const p10 = mapUnitToQuad(1, 0, coeff);
    expect(p10.x).toBeCloseTo(quad.tr.x);
    expect(p10.y).toBeCloseTo(quad.tr.y);

    // ركن (1,1) يجب أن يرجع br
    const p11 = mapUnitToQuad(1, 1, coeff);
    expect(p11.x).toBeCloseTo(quad.br.x);
    expect(p11.y).toBeCloseTo(quad.br.y);

    // ركن (0,1) يجب أن يرجع bl
    const p01 = mapUnitToQuad(0, 1, coeff);
    expect(p01.x).toBeCloseTo(quad.bl.x);
    expect(p01.y).toBeCloseTo(quad.bl.y);

    // مركز المستطيل (0.5, 0.5) يقع داخل حدود الشكل
    const center = mapUnitToQuad(0.5, 0.5, coeff);
    expect(center.x).toBeGreaterThan(quad.tl.x);
    expect(center.x).toBeLessThan(quad.tr.x);
    expect(center.y).toBeGreaterThan(quad.tl.y);
    expect(center.y).toBeLessThan(quad.br.y);
  });
});

describe('كشف الأركان والمسح النظيف', () => {
  /** بطاقةٌ مائلة على غطاء ماسحٍ أبيض — أركانها معروفة، فيُقاس الكشف بالبكسل. */
  function photo(quad: Quad, w = 400, h = 300, bg = [245, 245, 245], card = [40, 110, 170]): PixelData {
    const data = new Uint8ClampedArray(w * h * 4);
    const pts = [quad.tl, quad.tr, quad.br, quad.bl];
    const inside = (x: number, y: number) => {
      let sign = 0;
      for (let i = 0; i < 4; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % 4]!;
        const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
        if (cross === 0) continue;
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) return false;
      }
      return sign !== 0;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = inside(x + 0.5, y + 0.5) ? card : bg;
        data.set([c[0]!, c[1]!, c[2]!, 255], (y * w + x) * 4);
      }
    }
    return { width: w, height: h, data };
  }

  it('يكشف أركان بطاقةٍ مائلة بفارق بكسلاتٍ قليلة', () => {
    const quad: Quad = { tl: { x: 80, y: 60 }, tr: { x: 300, y: 40 }, br: { x: 320, y: 180 }, bl: { x: 95, y: 205 } };
    const found = detectQuad(photo(quad))!;
    for (const k of ['tl', 'tr', 'br', 'bl'] as const) {
      expect(Math.hypot(found[k].x - quad[k].x, found[k].y - quad[k].y)).toBeLessThan(4);
    }
  });

  it('ولا يخترع بطاقةً في صورةٍ بلا شيء', () => {
    const none = { x: 0, y: 0 };
    expect(detectQuad(photo({ tl: none, tr: none, br: none, bl: none }))).toBeNull();
  });

  it('المسح النظيف يمحو الظلّ: الورق أبيض في الناحيتين، والحبر يبقى', () => {
    const w = 200;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // ظلُّ يدٍ يعتم النصف الأيسر، وخطُّ حبرٍ في الوسط.
        const light = x < 100 ? 150 : 240;
        const v = y >= 48 && y < 52 ? light * 0.2 : light;
        data.set([v, v, v, 255], (y * w + x) * 4);
      }
    }
    const out = flattenLight({ width: w, height: h, data }, { gray: true });
    const at = (x: number, y: number) => out.data[(y * w + x) * 4]!;
    expect(at(20, 10)).toBeGreaterThan(240);
    expect(at(180, 10)).toBeGreaterThan(240);
    expect(at(20, 50)).toBeLessThan(80);
  });
});
