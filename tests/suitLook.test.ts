/**
 * لون القاط على قدر الصورة (S45، D176): صورةٌ خافتةٌ مشوَّشة ← القاط أغمق وتشويشه قريبٌ من تشويشها · وصورةٌ ساطعةٌ نظيفة ← لا يتغيّر
 * إلا قليلًا (مستويان على الأكثر) · والقاط الأسود لا يصير أزرق تحت ضوءٍ بارد · والبذرة تثبّت الرسم.
 */
import { describe, expect, it } from 'vitest';
import { applyLook, grainOf, NO_LOOK, photoLook } from '../src/shared/suitLook';
import { gaussNoise } from '../src/shared/neckFill';

const W = 300;
const H = 400;

/** شخصٌ مبسّط: وجهٌ بلون البشرة في أعلاه وقميصٌ بلون `shirt` تحته، وتشويش إضاءةٍ `noise` (انحرافٌ معياريّ)، وقناعه مستطيلٌ وسطها. */
function person(skin: number[], shirt: number[], noise: number) {
  const px = new Uint8ClampedArray(W * H * 4);
  const alpha = new Uint8Array(W * H);
  const g = gaussNoise(7);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inside = x >= 40 && x < 260 && y >= 20;
      const c = y < 200 ? skin : shirt;
      const n = noise ? g() * noise : 0;
      for (let k = 0; k < 3; k++) px[i * 4 + k] = c[k]! + n;
      px[i * 4 + 3] = 255;
      alpha[i] = inside ? 255 : 0;
    }
  return { px, alpha };
}

/** قاطٌ ٢٠٠×١٢٠: سترةٌ كحليّة على جانبين وقميصٌ فاتح بينهما، والزاويتان العلويّتان شفّافتان. */
function suit(jacket = [40, 42, 60]) {
  const sw = 200;
  const sh = 120;
  const rgba = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      if (y < 20 && (x < 30 || x >= 170)) continue;
      const c = Math.abs(x - 100) < 25 ? [220, 220, 222] : jacket;
      rgba.set([...c, 255], (y * sw + x) * 4);
    }
  return { rgba, sw, sh };
}

const meanLum = (rgba: Uint8ClampedArray) => {
  let s = 0;
  let n = 0;
  for (let o = 0; o < rgba.length; o += 4) if (rgba[o + 3]) {
    s += 0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!;
    n++;
  }
  return s / n;
};

describe('لون القاط على قدر الصورة', () => {
  it('صورةٌ خافتةٌ مشوَّشة: القاط أغمق، وتشويشه قريبٌ من تشويشها', () => {
    const p = person([120, 92, 78], [110, 110, 108], 5);
    const look = photoLook(p.px, p.alpha, W, H);
    // الإضاءة: أعلاها نحو ١٢٢ من ٢٣٥ ← أقصى التعتيم (٠٫٨).
    for (const g of look.gains) expect(g).toBeLessThan(0.85);
    expect(Math.abs(look.grain - 5)).toBeLessThan(0.8);
    const s = suit();
    const out = applyLook(s.rgba, s.sw, s.sh, look);
    expect(meanLum(out)).toBeLessThan(meanLum(s.rgba) * 0.85);
    const opaque = (px: Uint8ClampedArray) => (i: number) => px[i * 4 + 3]! >= 250;
    expect(grainOf(s.rgba, s.sw, s.sh, opaque(s.rgba))).toBeLessThan(0.5);
    expect(Math.abs(grainOf(out, s.sw, s.sh, opaque(out)) - look.grain)).toBeLessThan(1);
    // والقاط المصغَّر للنصف يُزاد تشويشه ضعفًا (يُنعَّم بالتصغير).
    expect(grainOf(applyLook(s.rgba, s.sw, s.sh, look, 0.5), s.sw, s.sh, opaque(out))).toBeGreaterThan(look.grain * 1.7);
    // والشفافية كما هي.
    for (let o = 3; o < out.length; o += 4) expect(out[o]).toBe(s.rgba[o]);
  });

  it('صورةٌ ساطعةٌ نظيفة: القاط لا يتغيّر إلا مستويين على الأكثر', () => {
    const p = person([235, 200, 182], [246, 246, 246], 0);
    const look = photoLook(p.px, p.alpha, W, H);
    const s = suit();
    const out = applyLook(s.rgba, s.sw, s.sh, look);
    let most = 0;
    for (let o = 0; o < out.length; o += 4) for (let k = 0; k < 3; k++) most = Math.max(most, Math.abs(out[o + k]! - s.rgba[o + k]!));
    expect(most).toBeLessThanOrEqual(2);
  });

  it('ضوءٌ بارد: ميل اللون ٤٪ على الأكثر — فالقاط الأسود لا يصير أزرق', () => {
    // القميص محايدٌ تحت ضوءٍ بارد (تشبّعه ١٢٪): ميله ٧٪ نحو الأزرق، فيُحدّ بـ٤٪.
    const p = person([150, 130, 140], [180, 188, 205], 0);
    const look = photoLook(p.px, p.alpha, W, H);
    expect(look.gains[2]).toBeGreaterThan(look.gains[0]);
    expect(Math.max(...look.gains) / Math.min(...look.gains)).toBeLessThanOrEqual(1.04 / 0.96 + 1e-9);
    const s = suit([22, 22, 22]);
    const out = applyLook(s.rgba, s.sw, s.sh, look);
    const o = (60 * s.sw + 10) * 4;
    expect(Math.abs(out[o + 2]! - out[o]!)).toBeLessThanOrEqual(2);
  });

  it('البذرة تثبّت الرسم، وبلا مقياسٍ لا يتغيّر شيء', () => {
    const p = person([120, 92, 78], [110, 110, 108], 5);
    const look = photoLook(p.px, p.alpha, W, H);
    const s = suit();
    expect(applyLook(s.rgba, s.sw, s.sh, look)).toEqual(applyLook(s.rgba, s.sw, s.sh, look));
    expect(applyLook(s.rgba, s.sw, s.sh, look, 1, 2)).not.toEqual(applyLook(s.rgba, s.sw, s.sh, look));
    expect(applyLook(s.rgba, s.sw, s.sh, NO_LOOK)).toEqual(s.rgba);
    // وقناعٌ فارغ: لا مقياس.
    expect(photoLook(p.px, new Uint8Array(W * H), W, H)).toEqual(NO_LOOK);
  });
});
