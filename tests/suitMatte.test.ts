/**
 * تحضير القاط المستورد (S39، `suitMatte.ts`) — على قاطٍ مرسومٍ هنا: كتفان داكنان وفتحة عنقٍ V على أبيض بحافّةٍ منعّمة،
 * كما تحفظه المكاتب JPG من الإنترنت. والمقارنة بأداة `tools/prepare-suits.py` شرطًا شرطًا.
 */
import { describe, expect, it } from 'vitest';
import { prepareSuit } from '../src/shared/suitMatte';
import { suitAnchor } from '../src/shared/suitFit';

const W = 300;
const H = 240;
const CLOTH = [30, 32, 40];

/** نصيب القماش في البكسل (٠..١) بأخذ عيّناتٍ ٤×٤ — فالحافّة منعّمة كما في صورةٍ حقيقية. */
function coverage(x: number, y: number, inside: (x: number, y: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (inside(x + (i + 0.5) / 4, y + (j + 0.5) / 4)) n++;
  return n / 16;
}

/** القاط: كتفان منحدران من صفّ ٤٠ إلى أسفل الصورة، وفتحة عنقٍ V في وسطها حتى صفّ ١٢٠. */
const inSuit = (x: number, y: number) => {
  const dx = Math.abs(x - W / 2);
  const shoulder = y > 40 + Math.max(0, dx - 50) * 0.35 && dx < 140;
  const gap = y < 120 && dx < 34 * (1 - (y - 40) / 80);
  return shoulder && !gap;
};

/** على أبيض (JPG): القماش ممزوجٌ بالأبيض على حافّته. */
function onWhite(extra?: (rgba: Uint8ClampedArray) => void): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = coverage(x, y, inSuit);
      const o = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) rgba[o + ch] = Math.round(CLOTH[ch]! * a + 255 * (1 - a));
      rgba[o + 3] = 255;
    }
  extra?.(rgba);
  return rgba;
}

const set = (rgba: Uint8ClampedArray, x: number, y: number, rgb: number[], a = 255) => {
  const o = (y * W + x) * 4;
  rgba.set([...rgb, a], o);
};

describe('prepareSuit — قاطٌ على أبيض', () => {
  it('الخلفية وفتحة العنق شفّافتان، والحافّة بلا بياضٍ معتم، وفتحة العنق في وسط الـV', () => {
    const out = prepareSuit(onWhite(), W, H)!;
    expect(out).not.toBeNull();
    const at = (x: number, y: number) => out.rgba[(y * out.width + x) * 4 + 3]!;
    // يُقصّ إلى القاط: يبدأ من أعلى كتفيه، وعرضه عرضهما.
    expect(out.width).toBeGreaterThan(270);
    expect(out.width).toBeLessThanOrEqual(282);
    // الزاويتان العلويّتان خلفيةٌ شفّافة، ووسط الـV شفّاف، وأسفل الوسط قماشٌ معتم.
    expect(at(1, 1)).toBe(0);
    expect(at(out.width - 2, 1)).toBe(0);
    const cx = Math.round((out.width - 1) / 2);
    expect(at(cx, 10)).toBe(0);
    expect(at(cx, out.height - 2)).toBe(255);
    // لا هالة بيضاء: ما ظهر من الحافّة (شفافيّته ربعٌ فأكثر) لونه القماش لا الأبيض.
    let whiteEdge = 0;
    for (let i = 0; i < out.width * out.height; i++) {
      const a = out.rgba[i * 4 + 3]!;
      if (a >= 64 && a < 255 && Math.max(out.rgba[i * 4]!, out.rgba[i * 4 + 1]!, out.rgba[i * 4 + 2]!) > 160) whiteEdge++;
    }
    expect(whiteEdge).toBe(0);
    // ويُركَّب كما يُركَّب غيره: فتحة العنق عند مركز الـV.
    const alpha = new Uint8Array(out.width * out.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = out.rgba[i * 4 + 3]!;
    const anchor = suitAnchor(alpha, out.width, out.height)!;
    expect(Math.abs(anchor.cx - (out.width - 1) / 2)).toBeLessThanOrEqual(2);
  });

  it('النقطة البيضاء داخل القماش تبقى قماشًا، والبقعة الداكنة الشاردة تُمحى', () => {
    const rgba = onWhite((px) => {
      set(px, W / 2 + 60, 200, [255, 255, 255]);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) set(px, x, y, [180, 0, 0]);
    });
    const out = prepareSuit(rgba, W, H)!;
    // البقعة في الزاوية لم تمدّ الإطار إلى أعلى الصورة: يبدأ من أعلى الكتفين كما بدونها.
    const plain = prepareSuit(onWhite(), W, H)!;
    expect([out.width, out.height]).toEqual([plain.width, plain.height]);
    let stray = 0;
    for (let i = 0; i < out.width * out.height; i++) if (out.rgba[i * 4 + 3]! > 0 && out.rgba[i * 4]! > 120 && out.rgba[i * 4 + 1]! < 60) stray++;
    expect(stray).toBe(0);
    // النقطة البيضاء ليست خلفية (لا تتّصل بالحافّة): معتمة.
    const off = (W - out.width) / 2;
    const top = H - out.height;
    const dot = Math.round((200 - top) * out.width + W / 2 + 60 - off);
    expect(out.rgba[dot * 4 + 3]).toBe(255);
  });

  it('صورةٌ كلّها رماديّ (لا أبيض حولها ولا شفافية) ← null', () => {
    const gray = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) gray.set([120, 120, 120, 255], i * 4);
    expect(prepareSuit(gray, W, H)).toBeNull();
    // وقاطٌ على خلفيةٍ زرقاء ليس على أبيض.
    const blue = onWhite((px) => {
      for (let i = 0; i < W * H; i++) if (px[i * 4]! > 200) px.set([40, 90, 200, 255], i * 4);
    });
    expect(prepareSuit(blue, W, H)).toBeNull();
    // وأبيضٌ كلّه لا قاط فيه.
    expect(prepareSuit(onWhite((px) => px.fill(255)), W, H)).toBeNull();
  });
});

describe('prepareSuit — قاطٌ شفّاف (WebP أو PNG)', () => {
  it('شفافيّته كما هي، وثقب القماش المغلق يُملأ، ويُقصّ إلى الصدر', () => {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inSuit(x + 0.5, y + 0.5)) set(rgba, x, y, CLOTH);
    for (let y = 180; y < 186; y++) for (let x = 100; x < 106; x++) set(rgba, x, y, [0, 0, 0], 0);
    const out = prepareSuit(rgba, W, H)!;
    const off = (W - out.width) / 2;
    const top = H - out.height;
    expect(out.rgba[((183 - top) * out.width + 103 - off) * 4 + 3]).toBe(255);
    expect(out.rgba[3]).toBe(0);
  });

  it('العرض ٩٠٠ على الأكثر، والنسبة باقية', () => {
    const big = 4;
    const w = W * big;
    const h = H * big;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inSuit((x + 0.5) / big, (y + 0.5) / big)) rgba.set([...CLOTH, 255], (y * w + x) * 4);
    const out = prepareSuit(rgba, w, h)!;
    const small = prepareSuit(onWhite(), W, H)!;
    expect(out.width).toBe(900);
    expect(Math.abs(out.height / out.width - small.height / small.width)).toBeLessThan(0.02);
  });
});
