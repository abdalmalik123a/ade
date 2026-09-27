/**
 * الماسح متعدّد البطاقات (هـ٢): البطاقات في مسحةٍ واحدة تُعرف وتُقصّ، والظهر
 * يُطابَق بوجهه من موضعه.
 */
import { describe, expect, it } from 'vitest';
import { detectCards, matchBacks, padRect, type Rect } from '../src/shared/multiCard';
import type { PixelData } from '../src/shared/deskew';

/** زجاج الماسح بغطائه الأبيض، وعليه بطاقاتٌ بإطارٍ داكن وداخلٍ فاتح وكتابة. */
function glass(cards: Rect[], w = 850, h = 1100): PixelData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 250;
    data[i + 1] = 250;
    data[i + 2] = 248;
    data[i + 3] = 255;
  }
  const put = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * w + x) * 4;
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  };
  for (const c of cards) {
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        const edge = x - c.x < 4 || c.x + c.w - x <= 4 || y - c.y < 4 || c.y + c.h - y <= 4;
        // حافّةٌ رمادية، وداخلٌ أفتح قليلًا من الغطاء بلونٍ خفيف — كالبطاقة الوطنية
        put(x, y, edge ? [120, 120, 125] : [236, 240, 250]);
      }
    }
    // أسطر كتابةٍ وصورةٌ شخصية
    for (let line = 0; line < 4; line++) {
      for (let x = c.x + 20; x < c.x + c.w * 0.55; x++) for (let t = 0; t < 4; t++) put(x, c.y + 30 + line * 30 + t, [40, 40, 50]);
    }
    for (let y = c.y + 25; y < c.y + c.h - 25; y++) for (let x = c.x + c.w - 90; x < c.x + c.w - 25; x++) put(x, y, [150, 110, 90]);
  }
  return { width: w, height: h, data };
}

const ID1 = (x: number, y: number): Rect => ({ x, y, w: 340, h: 214 }); // ١٫٥٩

describe('البطاقات في مسحةٍ واحدة', () => {
  it('ثلاث بطاقات تُعرف كلٌّ بموضعها — من الأعلى ثم من اليمين', () => {
    const cards = [ID1(60, 80), ID1(450, 80), ID1(250, 500)];
    const found = detectCards(glass(cards));
    expect(found).toHaveLength(3);
    // الترتيب: الصفّ الأول يمينًا ثم يسارًا، ثم الثاني
    expect(found[0]!.x).toBeGreaterThan(400);
    expect(found[1]!.x).toBeLessThan(100);
    expect(found[2]!.y).toBeGreaterThan(450);
    for (const [i, want] of [cards[1]!, cards[0]!, cards[2]!].entries()) {
      const got = found[i]!;
      expect(Math.abs(got.x - want.x)).toBeLessThan(15);
      expect(Math.abs(got.y - want.y)).toBeLessThan(15);
      expect(Math.abs(got.w - want.w)).toBeLessThan(25);
      expect(Math.abs(got.h - want.h)).toBeLessThan(25);
    }
  });

  it('والزجاج الفارغ لا بطاقة فيه', () => {
    expect(detectCards(glass([]))).toEqual([]);
  });

  it('وخطٌّ طويل ليس بطاقة', () => {
    expect(detectCards(glass([{ x: 50, y: 500, w: 750, h: 30 }]))).toEqual([]);
  });
});

describe('الظهر بوجهه من موضعه', () => {
  const page = { w: 850, h: 1100 };
  it('البطاقة المقلوبة في مكانها — ولو انزاحت باليد', () => {
    const fronts = [ID1(450, 80), ID1(60, 80), ID1(250, 500)];
    const backs = [ID1(255, 520), ID1(470, 70), ID1(40, 95)]; // بترتيبٍ آخر ومزاحةً قليلًا
    expect(matchBacks(fronts, backs, page)).toEqual([1, 2, 0]);
  });

  it('وجهٌ لم يُمسح ظهره يبقى بلا ظهر، والظهر البعيد ليس لأحد', () => {
    const fronts = [ID1(60, 80), ID1(450, 80)];
    const backs = [ID1(455, 85), ID1(250, 800)];
    expect(matchBacks(fronts, backs, page)).toEqual([null, 0]);
  });
});

describe('الهامش حول المقصوص', () => {
  it('يتّسع قليلًا ولا يخرج من الصورة', () => {
    expect(padRect({ x: 2, y: 2, w: 340, h: 214 }, { w: 350, h: 300 })).toEqual({ x: 0, y: 0, w: 349, h: 223 });
    expect(padRect({ x: 100, y: 50, w: 340, h: 214 }, { w: 850, h: 1100 })).toEqual({ x: 93, y: 43, w: 354, h: 228 });
  });
});
