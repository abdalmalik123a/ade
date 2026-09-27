/**
 * صورة الورقة قبل قراءتها (هـ٨): الجدول من خطوطه، والفاصل، والختم الملوّن يُمحى
 * والعنوان الملوّن والكتابة السوداء تحت الختم يبقيان.
 */
import { describe, expect, it } from 'vitest';
import { dropColoredMarks, eraseBoxes, findRules } from '../src/shared/paperRules';
import type { PixelData } from '../src/shared/deskew';

const W = 1000;
const H = 1400;
const BLACK = [20, 20, 20];
const BLUE = [30, 60, 200];

function page(): PixelData {
  return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(255) };
}
function paint(px: PixelData, x0: number, y0: number, x1: number, y1: number, rgb = BLACK) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      px.data[i] = rgb[0]!;
      px.data[i + 1] = rgb[1]!;
      px.data[i + 2] = rgb[2]!;
    }
  }
}
const at = (px: PixelData, x: number, y: number) => [...px.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];

/** «كلمات»: كتلٌ قصيرة بفراغات — لا تُحسب خطوطًا. */
function words(px: PixelData, y: number, x0: number, x1: number, rgb = BLACK) {
  for (let x = x0; x + 40 < x1; x += 55) paint(px, x, y, x + 40, y + 14, rgb);
}

function sample(): PixelData {
  const px = page();
  words(px, 100, 300, 700, BLUE); // عنوانٌ ملوّن في الترويسة
  words(px, 150, 100, 900);
  // الفاصل تحت الترويسة — مائلٌ بكسلًا واحدًا على طوله، كما يبقى بعد التقويم
  paint(px, 100, 200, 500, 201);
  paint(px, 501, 201, 900, 202);
  words(px, 300, 100, 900);
  // جدول ٣×٣
  for (const y of [500, 600, 700, 800]) paint(px, 100, y, 900, y + 1);
  for (const x of [100, 400, 650, 900]) paint(px, x, 500, x + 1, 801);
  words(px, 540, 120, 380);
  // إطارٌ حول فقرة — خانةٌ واحدة
  for (const y of [900, 1000]) paint(px, 100, y, 900, y + 1);
  for (const x of [100, 900]) paint(px, x, 900, x + 1, 1001);
  words(px, 940, 150, 850);
  // ختمٌ أزرق مستدير يعبر كتابةً سوداء
  for (let a = 0; a < 360; a += 0.5) {
    const x = Math.round(700 + 70 * Math.cos((a * Math.PI) / 180));
    const y = Math.round(1200 + 70 * Math.sin((a * Math.PI) / 180));
    paint(px, x - 2, y - 2, x + 2, y + 2, BLUE);
  }
  paint(px, 660, 1190, 700, 1204, BLUE);
  // «ختم المدرسة» سطرٌ أزرق عريض في وسط الحلقة — من الختم لا عنوان
  for (let x = 650; x < 750; x += 20) paint(px, x, 1160, x + 15, 1172, BLUE);
  words(px, 1195, 560, 860);
  return px;
}

describe('الخطوط الطويلة', () => {
  const rules = findRules(sample());

  it('الجدول بخاناته من خطوطه', () => {
    expect(rules.tables).toHaveLength(1);
    const t = rules.tables[0]!;
    expect(t.rows).toHaveLength(4);
    expect(t.cols).toHaveLength(4);
    expect(t.rows[0]).toBeCloseTo(500, -1);
    expect(t.cols[1]).toBeCloseTo(400, -1);
    // والحدود بسُمك الخطّ وبكسلٍ حوله — فالصفّ يُقرأ مع جاريه.
    expect(Math.abs(t.box.x0 - 100)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.box.y0 - 500)).toBeLessThanOrEqual(2);
  });

  it('والفاصل المائل بكسلًا خطٌّ واحد، والإطار يُمحى ولا يصير جدولًا', () => {
    expect(rules.dividers).toHaveLength(1);
    expect(rules.dividers[0]!.y0).toBeGreaterThanOrEqual(199);
    expect(rules.dividers[0]!.y1).toBeLessThanOrEqual(203);
    expect(rules.dividers[0]!.x1 - rules.dividers[0]!.x0).toBeGreaterThan(780);
    // أربعة أفقيّة وأربعة عموديّة للجدول، وأربعةٌ للإطار، وفاصل
    expect(rules.erase.length).toBe(13);
  });

  it('والكلمات ليست خطوطًا، وحافّة الختم ليست عمودًا', () => {
    const px = sample();
    const clean = eraseBoxes(px, rules.erase);
    expect(at(clean, 300, 200)).toEqual([255, 255, 255]);
    expect(at(clean, 400, 650)).toEqual([255, 255, 255]);
    expect(at(clean, 130, 545)).toEqual(BLACK); // كلمةٌ في الخانة
    expect(at(clean, 110, 155)).toEqual(BLACK); // سطر المتن
  });
});

describe('الحبر الملوّن', () => {
  it('الختم يُمحى ملوّنُه، والكتابة السوداء عبره تبقى، والعنوان الملوّن يبقى', () => {
    const { px, removed } = dropColoredMarks(sample());
    expect(removed).toHaveLength(1);
    expect(removed[0]!.x0).toBeLessThan(640);
    expect(removed[0]!.x1).toBeGreaterThan(760);
    expect(at(px, 770, 1200)).toEqual([255, 255, 255]); // حافة الختم
    expect(at(px, 680, 1191)).toEqual([255, 255, 255]); // حروفه
    expect(at(px, 700, 1165)).toEqual([255, 255, 255]); // السطر الأزرق داخل الحلقة
    expect(at(px, 615, 1200)).toEqual(BLACK); // الكتابة تحته
    expect(at(px, 305, 105)).toEqual(BLUE); // العنوان الملوّن
  });

  it('ولا ملوّن: الصورة كما هي', () => {
    const px = page();
    words(px, 100, 100, 900);
    expect(dropColoredMarks(px)).toEqual({ px, removed: [] });
  });
});
