/**
 * «امسح لونًا» (البند ٣٨) — على صورٍ يرسمها الاختبار: شعارٌ أزرق بحافّةٍ ناعمة على بطاقةٍ بيضاء بضجيج الهاتف، وحلقةٌ
 * داخلها بياضٌ لا يتّصل بما حولها (كما بين الحروف). والقناع كلّه معتم أوّلًا — كما ترك النموذجُ البطاقة.
 */
import { describe, expect, it } from 'vitest';
import { colorRegion, eraseColor, ERASE_DEFAULTS, leftoverBorder, sampleColor, undoErase, type Rgb } from '../src/shared/colorErase';

const W = 240;
const H = 160;
const BLUE: Rgb = [30, 60, 160];
const WHITE: Rgb = [248, 248, 246];

/** تغطية دائرةٍ لبكسلٍ بعيّناتٍ ٤×٤ — حافّةٌ ناعمة كما تُطبع وتُصوَّر. */
function coverage(x: number, y: number, inside: (px: number, py: number) => boolean): number {
  let n = 0;
  for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
  return n / 16;
}

/** الدائرة الممتلئة عند (٧٠،٨٠) نصف قطرها ٣٠، والحلقة عند (١٧٠،٨٠) بين ١٨ و٣٠. */
const disc = (px: number, py: number) => Math.hypot(px - 70, py - 80) <= 30;
const ring = (px: number, py: number) => {
  const d = Math.hypot(px - 170, py - 80);
  return d <= 30 && d >= 18;
};

function card(): { pixels: Uint8ClampedArray; alpha: Uint8Array; logo: Float32Array } {
  const pixels = new Uint8ClampedArray(W * H * 4);
  const logo = new Float32Array(W * H);
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 9) - 4; // ±٤: ضجيج صورة هاتف
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const f = Math.max(coverage(x, y, disc), coverage(x, y, ring));
      logo[i] = f;
      for (let c = 0; c < 3; c++) pixels[i * 4 + c] = Math.round(BLUE[c]! * f + WHITE[c]! * (1 - f)) + noise();
      pixels[i * 4 + 3] = 255;
    }
  }
  return { pixels, alpha: new Uint8Array(W * H).fill(255), logo };
}

const at = (x: number, y: number) => y * W + x;

describe('امسح لونًا', () => {
  it('ضغطةٌ على البطاقة تزيلها، والشعار معتمٌ كما هو — والمتّصل لا يبلغ ما داخل الحلقة', () => {
    const { pixels, alpha, logo } = card();
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    expect(Math.max(...color.map((v, c) => Math.abs(v - WHITE[c]!)))).toBeLessThan(6);
    const undo = eraseColor(pixels, alpha, W, H, [at(5, 5)], color, ERASE_DEFAULTS)!;
    expect(undo).not.toBeNull();
    let leftWhite = 0;
    let lostLogo = 0;
    for (let i = 0; i < W * H; i++) {
      const outsideRing = Math.hypot((i % W) - 170, Math.floor(i / W) - 80) > 32;
      if (logo[i] === 0 && outsideRing && alpha[i]! > 0) leftWhite++;
      if (logo[i] === 1 && alpha[i]! < 255) lostLogo++;
    }
    expect(leftWhite).toBe(0);
    expect(lostLogo).toBe(0);
    // داخل الحلقة بياضٌ لا يتّصل بالبطاقة: يبقى.
    expect(alpha[at(170, 80)]).toBe(255);
  });

  it('و«الصورة كلّها» تزيل ما بين الحروف أيضًا', () => {
    const { pixels, alpha } = card();
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    eraseColor(pixels, alpha, W, H, [at(5, 5)], color, { ...ERASE_DEFAULTS, contiguous: false });
    expect(alpha[at(170, 80)]).toBe(0);
    expect(alpha[at(70, 80)]).toBe(255);
    expect(alpha[at(170, 55)]).toBe(255); // جسم الحلقة
  });

  it('وتنعيم الحافّة: الحافّة نصف شفّافة بنسبة الشعار فيها، ولونها الأزرق بلا هالةٍ بيضاء', () => {
    const { pixels, alpha, logo } = card();
    const before = Uint8ClampedArray.from(pixels);
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    eraseColor(pixels, alpha, W, H, [at(5, 5)], color, ERASE_DEFAULTS);
    let n = 0;
    let errAlpha = 0;
    let whiteBefore = 0;
    let whiteAfter = 0;
    for (let i = 0; i < W * H; i++) {
      const f = logo[i]!;
      if (f < 0.25 || f > 0.75 || Math.hypot((i % W) - 70, Math.floor(i / W) - 80) > 32) continue;
      n++;
      errAlpha += Math.abs(alpha[i]! / 255 - f);
      // على خلفيةٍ سوداء: ما يظهر من البياض القديم هالة.
      whiteBefore += (before[i * 4]! * f) / 255;
      whiteAfter += (pixels[i * 4]! * alpha[i]!) / 255 / 255;
    }
    expect(n).toBeGreaterThan(20);
    expect(errAlpha / n).toBeLessThan(0.2);
    expect(whiteAfter).toBeLessThan(whiteBefore * 0.6);
    // ولون الحافّة أقرب إلى الأزرق منه قبل المسح: بكسلٌ على محيط الدائرة نصفه أزرق.
    let edge = 0;
    for (let i = 0; i < W * H; i++) if ((i % W) < 120 && Math.abs(logo[i]! - 0.5) < Math.abs(logo[edge]! - 0.5)) edge = i;
    expect(Math.abs(logo[edge]! - 0.5)).toBeLessThan(0.1);
    const toBlue = (px: ArrayLike<number>) => Math.max(...[0, 1, 2].map((c) => Math.abs(px[edge * 4 + c]! - BLUE[c]!)));
    expect(toBlue(pixels)).toBeLessThan(toBlue(before));
  });

  it('وبلا تنعيم: ما في السماحية وحده يُمسح بحافّةٍ حادّة، ولا يتغيّر لون', () => {
    const { pixels, alpha } = card();
    const before = Uint8ClampedArray.from(pixels);
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    eraseColor(pixels, alpha, W, H, [at(5, 5)], color, { ...ERASE_DEFAULTS, smooth: 0 });
    expect([...alpha].every((a) => a === 0 || a === 255)).toBe(true);
    expect(pixels).toEqual(before);
  });

  it('والتراجع يعيد القناع والألوان كما كانت بايتًا ببايت', () => {
    const { pixels, alpha } = card();
    const p0 = Uint8ClampedArray.from(pixels);
    const a0 = Uint8Array.from(alpha);
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    const u = eraseColor(pixels, alpha, W, H, [at(5, 5)], color, { ...ERASE_DEFAULTS, contiguous: false })!;
    expect(alpha).not.toEqual(a0);
    // ومستطيل ما تغيّر يحوي كلّ ما تغيّر.
    for (const i of u.idx) {
      const x = i % W;
      const y = Math.floor(i / W);
      expect(x >= u.rect.x && x < u.rect.x + u.rect.w && y >= u.rect.y && y < u.rect.y + u.rect.h).toBe(true);
    }
    undoErase(pixels, alpha, u);
    expect(alpha).toEqual(a0);
    expect(pixels).toEqual(p0);
  });

  it('والسماحية تحكم: دون ضجيج البطاقة يُمسح أقلّها، وبها البطاقة كلّها', () => {
    const count = (tol: number) => {
      const { pixels, alpha } = card();
      const { list } = colorRegion(pixels, alpha, W, H, [at(5, 5)], sampleColor(pixels, alpha, W, H, 5, 5)!, tol, true);
      return list.length;
    };
    expect(count(1)).toBeLessThan(count(32) * 0.5);
    expect(count(32)).toBeGreaterThan(W * H * 0.6);
  });

  it('ولا يرتفع القناع أبدًا، ولا يُعبر ما لا يُرى: بياضٌ وراء فجوةٍ شفّافة يبقى', () => {
    const { pixels, alpha } = card();
    // فجوةٌ شفّافة عموديّة عند x=120 تقطع البطاقة نصفين (أخفاها النموذج) — وبكسلٌ نصف شفّاف يبقى كما هو أو أقلّ.
    for (let y = 0; y < H; y++) for (let x = 118; x < 122; x++) alpha[at(x, y)] = 0;
    alpha[at(5, 150)] = 100;
    const color = sampleColor(pixels, alpha, W, H, 5, 5)!;
    eraseColor(pixels, alpha, W, H, [at(5, 5)], color, ERASE_DEFAULTS);
    expect(alpha[at(230, 5)]).toBe(255); // البياض وراء الفجوة
    expect(alpha[at(120, 5)]).toBe(0);
    expect(alpha[at(5, 150)]).toBeLessThanOrEqual(100);
    // الضغطة على ما لا يُرى لا تأخذ لونًا.
    expect(sampleColor(pixels, alpha, W, H, 120, 50)).toBeNull();
  });

  it('ويُقترح وحده إن بقيت حوافّ الصورة لونًا واحدًا — لا في صورةٍ فُرّغت حوافّها', () => {
    const { pixels, alpha } = card();
    const hint = leftoverBorder(pixels, alpha, W, H, 'all')!;
    expect(hint).not.toBeNull();
    expect(hint.share).toBeGreaterThan(0.9);
    expect(Math.max(...hint.color.map((v, c) => Math.abs(v - WHITE[c]!)))).toBeLessThan(6);
    // والمسح من بذوره يزيل البطاقة.
    eraseColor(pixels, alpha, W, H, hint.seeds, hint.color, ERASE_DEFAULTS);
    expect(alpha[at(120, 10)]).toBe(0);
    expect(leftoverBorder(pixels, alpha, W, H, 'all')).toBeNull();

    // صورةٌ شخصية فُرّغت: سترةٌ داكنة تلامس الأسفل وأسفل الجانبين، والباقي شفّاف — لا اقتراح.
    const p2 = new Uint8ClampedArray(W * H * 4).fill(255);
    const a2 = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const body = y > H * 0.7;
        const head = Math.hypot(x - W / 2, y - H * 0.4) < H * 0.25;
        if (body || head) a2[at(x, y)] = 255;
        if (body) [0, 1, 2].forEach((c) => (p2[at(x, y) * 4 + c] = 25));
      }
    }
    expect(leftoverBorder(p2, a2, W, H, 'portrait')).toBeNull();
    // وإن بقي الجدار حولها كلّه (أخطأ النموذج): يُقترح.
    a2.fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!(y > H * 0.7)) [0, 1, 2].forEach((c) => (p2[at(x, y) * 4 + c] = [214, 196, 170][c]!));
    expect(leftoverBorder(p2, a2, W, H, 'portrait')?.color).toEqual([214, 196, 170]);
  });
});
