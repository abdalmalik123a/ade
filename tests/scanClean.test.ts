/**
 * تنظيف المستمسك الممسوح (هـ١): الأختام بألوانها، والبقع المعزولة تُمحى ونقاط
 * الحروف تبقى، والورقة المائلة تُقوَّم من أسطرها، والحبر يُقاس.
 */
import { describe, expect, it } from 'vitest';
import { cleanScan, coloredShare, despeckle, estimateSkew, inkCoverage, rotate, straighten } from '../src/shared/scanClean';
import type { PixelData } from '../src/shared/deskew';

function blank(w: number, h: number, rgb: [number, number, number] = [245, 243, 238]): PixelData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

function paint(px: PixelData, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * px.width + x) * 4;
      px.data[i] = rgb[0];
      px.data[i + 1] = rgb[1];
      px.data[i + 2] = rgb[2];
    }
  }
}

const at = (px: PixelData, x: number, y: number) => {
  const i = (y * px.width + x) * 4;
  return [px.data[i]!, px.data[i + 1]!, px.data[i + 2]!];
};

describe('مسحٌ نظيف يحفظ ألوان الأختام', () => {
  it('الختم الأزرق يبقى أزرق، والكتابة سوداء، والورق أبيض', () => {
    const px = blank(200, 120);
    paint(px, 20, 20, 120, 30, [60, 60, 60]); // سطر كتابة
    paint(px, 140, 60, 180, 100, [40, 70, 190]); // ختمٌ أزرق
    const out = cleanScan(px);
    const [r, , b] = at(out, 160, 80);
    expect(b).toBeGreaterThan(r + 60); // أزرق
    const [tr, tg, tb] = at(out, 60, 25);
    expect(tr).toBe(tg);
    expect(tg).toBe(tb); // رماديٌّ داكن
    expect(tr).toBeLessThan(80);
    expect(at(out, 5, 110)[0]).toBeGreaterThan(245); // الورق أبيض
    expect(coloredShare(out)).toBeGreaterThan(0.05);
  });

  it('وبلا حفظ الألوان: كلّه رماديّ كما كان «المسح النظيف»', () => {
    const px = blank(120, 80);
    paint(px, 20, 20, 60, 60, [40, 70, 190]);
    const [r, g, b] = at(cleanScan(px, { keepColor: false }), 40, 40);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe('إزالة البقع', () => {
  it('البقعة المعزولة تُمحى، ونقطة الحرف الملاصقة لحرفها تبقى', () => {
    const px = blank(300, 200, [255, 255, 255]);
    paint(px, 40, 100, 140, 108, [0, 0, 0]); // جسم حرفٍ ممتد
    paint(px, 88, 112, 91, 115, [0, 0, 0]); // نقطةٌ تحته بمسافة ٤ بكسلات — نقطة الباء
    paint(px, 250, 30, 253, 33, [0, 0, 0]); // بقعةٌ في الهامش وحدها
    const { px: out, removed } = despeckle(px);
    expect(removed).toBe(1);
    expect(at(out, 251, 31)[0]).toBe(255); // مُحيت
    expect(at(out, 89, 113)[0]).toBe(0); // بقيت نقطة الحرف
    expect(at(out, 60, 104)[0]).toBe(0); // والحرف
  });

  it('والكتلة الكبيرة لا تُمسّ ولو كانت وحدها', () => {
    const px = blank(200, 200, [255, 255, 255]);
    paint(px, 50, 50, 90, 90, [0, 0, 0]);
    expect(despeckle(px).removed).toBe(0);
  });
});

describe('التقويم من الأسطر', () => {
  /** صفحةٌ بأسطرٍ أفقية ثم تُمال بزاويةٍ معلومة. */
  function lined(): PixelData {
    const px = blank(400, 300, [255, 255, 255]);
    for (let y = 40; y < 280; y += 24) paint(px, 30, y, 370, y + 5, [20, 20, 20]);
    return px;
  }

  it('الورقة المستوية زاويتها صفر', () => {
    expect(Math.abs(estimateSkew(lined()))).toBeLessThanOrEqual(0.2);
  });

  it('المائلة تُقاس زاويتها، والتقويم يعيدها مستوية', () => {
    const tilted = rotate(lined(), 3);
    const angle = estimateSkew(tilted);
    expect(Math.abs(Math.abs(angle) - 3)).toBeLessThanOrEqual(0.4);
    const { px, angle: applied } = straighten(tilted);
    expect(applied).toBe(angle);
    expect(Math.abs(estimateSkew(px))).toBeLessThanOrEqual(0.4);
  });

  it('وما دون عُشر درجة يُترك كما هو', () => {
    const px = lined();
    expect(straighten(px)).toEqual({ px, angle: 0 });
  });
});

describe('قياس الحبر', () => {
  it('الورقة البيضاء بلا حبر، والخلفية الرمادية ثقيلة', () => {
    expect(inkCoverage(blank(50, 50, [255, 255, 255])).coverage).toBe(0);
    const grey = inkCoverage(blank(50, 50, [120, 120, 120]));
    expect(grey.coverage).toBeGreaterThan(0.5);
    expect(grey.heavy).toBe(true);
    const page = blank(100, 100, [255, 255, 255]);
    paint(page, 10, 10, 90, 20, [0, 0, 0]);
    expect(inkCoverage(page)).toMatchObject({ heavy: false });
    expect(inkCoverage(page).coverage).toBeCloseTo(0.08, 2);
  });
});
