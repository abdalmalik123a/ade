/**
 * الياقة تلقائيًّا (البند ٣٩) — تحت الذقن في فتحة القاط الجلد وحده، والقاط يرتفع إلى الذقن إن ظهرت فوقه ملابس. على شخصٍ
 * يرسمه الاختبار (وجهٌ بلون البشرة، ورقبةٌ في ظلّ الذقن، وياقةٌ بيضاء مرتفعة) ثم على صورة المعاملة المولَّدة بالنموذج الحقيقي.
 * وبوجهٍ معروف (إصلاح البند ٣٩، `@shared/portraitFace`): الذقن الحقيقيّ حدّ القصّ، والرقبة المضاءة وظلّها الأحمر جلد.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closePortrait, cutout } from '../src/main/services/portrait';
import { landmarks, type Landmarks } from '../src/shared/portraitMask';
import { clothesTop, jawLine, neckSkin, raiseSuit, skinAt, skinSample, skinWeight } from '../src/shared/portraitSkin';
import { faceChin, withFace, type Face, type FaceBox } from '../src/shared/portraitFace';
import { readPngRgba } from './helpers';

const SKIN = [224, 178, 150];
const W = 400;
const H = 500;

/** شخصٌ مبسّط بقناعه وألوانه: رأسٌ بيضاويّ (عينان وفمٌ ولحيةٌ اختيارية)، ورقبةٌ أعتم، وياقةٌ بلونٍ من `collarFrom`، وسترةٌ داكنة. */
function person(collar: number[] | null, collarFrom = 245, beard = false) {
  const alpha = new Uint8Array(W * H);
  const px = new Uint8ClampedArray(W * H * 4);
  let seed = 11;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 7) - 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const head = ((x - 200) / 62) ** 2 + ((y - 150) / 80) ** 2 <= 1;
      const neck = y > 150 && y <= 285 && Math.abs(x - 200) <= 27;
      const t = Math.min(1, Math.max(0, (y - 285) / 40));
      const body = y > 285 && Math.abs(x - 200) <= (54 + 276 * t) / 2;
      if (!(head || neck || body)) continue;
      alpha[i] = 255;
      let c = SKIN;
      if (neck && !head) c = SKIN.map((v) => v * 0.78); // الرقبة في ظلّ الذقن
      if (head && (Math.hypot(x - 178, y - 135) < 7 || Math.hypot(x - 222, y - 135) < 7)) c = [40, 30, 30];
      if (head && Math.abs(y - 190) < 3 && Math.abs(x - 200) < 16) c = [190, 90, 90]; // الفم
      if (beard && head && y > 205) c = [35, 28, 25];
      if (collar && (neck || body) && y >= collarFrom && y <= 300) c = collar;
      if (body && y > 300) c = [30, 30, 38];
      for (let k = 0; k < 3; k++) px[i * 4 + k] = c[k]! + noise();
      px[i * 4 + 3] = 255;
    }
  }
  return { px, alpha, lm: landmarks(alpha, W, H)! };
}

describe('الجلد من الوجه', () => {
  it('العيّنة لونيّة البشرة، والرقبة في الظلّ جلد، والقميص الأبيض والسترة السوداء والكنزة الرمادية ليست جلدًا', () => {
    const { px, alpha, lm } = person(null);
    const m = skinSample(px, alpha, W, H, lm)!;
    const s = SKIN[0]! + SKIN[1]! + SKIN[2]!;
    expect(Math.abs(m.r - SKIN[0]! / s)).toBeLessThan(0.01);
    expect(Math.abs(m.g - SKIN[1]! / s)).toBeLessThan(0.01);
    expect(skinWeight(m, ...(SKIN as [number, number, number]))).toBe(1);
    expect(skinWeight(m, ...(SKIN.map((v) => v * 0.6) as [number, number, number]))).toBe(1);
    expect(skinWeight(m, 240, 240, 238)).toBe(0);
    expect(skinWeight(m, 30, 30, 38)).toBe(0);
    expect(skinWeight(m, 120, 120, 125)).toBe(0);
    // رأسٌ صغيرٌ جدًّا أو لا معالم: لا عيّنة تُخترع.
    expect(skinSample(px, alpha, W, H, { ...lm, chin: lm.top + 10 })).toBeNull();
  });
});

describe('الياقة تلقائيًّا', () => {
  it('ياقةٌ بيضاء مرتفعة بعرض الرقبة تُقصّ من تحت الفكّ، والرقبة الظاهرة تبقى', () => {
    // الياقة تبدأ تحت الفكّ مباشرةً: الرقبة كلّها خلفها.
    const high = person([240, 240, 238], 236);
    const m = skinSample(high.px, high.alpha, W, H, high.lm)!;
    const mask = neckSkin(high.px, W, H, high.lm, m, high.lm.chin + high.lm.neckWidth * 2.5, high.lm.neckWidth / 2 + 1)!;
    expect(mask.y0).toBeLessThanOrEqual(Math.ceil(jawLine(high.lm)));
    for (const y of [Math.round(high.lm.chin) + 4, 260, 290]) expect(skinAt(mask, 200, y)).toBe(0);
    // وبلا ياقة: الرقبة كلّها جلدٌ تبقى.
    const open = person(null);
    const m2 = skinSample(open.px, open.alpha, W, H, open.lm)!;
    const mask2 = neckSkin(open.px, W, H, open.lm, m2, open.lm.chin + open.lm.neckWidth * 2.5, open.lm.neckWidth / 2 + 1)!;
    for (const y of [Math.round(open.lm.chin) + 4, 250, 280]) expect(skinAt(mask2, 200, y)).toBe(1);
    // وخارج قناع الجلد لا يُمسّ شيء (الوجه فوقه).
    expect(skinAt(mask2, 200, 150)).toBe(1);
  });

  it('واللحية بين الفكّ والذقن تبقى — والقصّ تحت الذقن وحده', () => {
    const b = person(null, 245, true);
    const m = skinSample(b.px, b.alpha, W, H, b.lm)!;
    const mask = neckSkin(b.px, W, H, b.lm, m, b.lm.chin + b.lm.neckWidth * 2.5, b.lm.neckWidth / 2 + 1)!;
    const y = Math.round((jawLine(b.lm) + b.lm.chin) / 2);
    expect(y).toBeLessThan(230); // داخل الوجه حيث اللحية
    expect(skinAt(mask, 200, y)).toBe(1);
  });

  it('والقاط يرتفع إلى أعلى الملابس الظاهرة فوقه — ولا يتجاوز الذقن، ولا يتحرّك إن كانت الرقبة جلدًا', () => {
    const { px, alpha, lm } = person([240, 240, 238], 250);
    const m = skinSample(px, alpha, W, H, lm)!;
    const at = { x: 200, y: 285, scale: 1, angle: 0 };
    const top = clothesTop(px, alpha, W, lm, m, at.y)!;
    expect(Math.abs(top - 250)).toBeLessThanOrEqual(2);
    expect(raiseSuit(at, top, lm.chin).y).toBe(top);
    // ملابس تبدأ فوق الذقن (تقديرًا): القاط عند الذقن لا فوقه.
    expect(raiseSuit(at, lm.chin - 10, lm.chin).y).toBe(lm.chin);
    const open = person(null);
    const m2 = skinSample(open.px, open.alpha, W, H, open.lm)!;
    expect(clothesTop(open.px, open.alpha, W, open.lm, m2, at.y)).toBeNull();
    expect(raiseSuit(at, null, lm.chin)).toBe(at);
  });
});

describe('بوجهٍ معروف — إصلاح البند ٣٩', () => {
  // وجه الشخص المرسوم كما يجده النموذج: العينان والفم حيث رُسما، والرأس ينتهي على الصفّ ٢٣٠.
  const box: FaceBox = { x: 138, y: 90, w: 124, h: 140, eyes: [{ x: 178, y: 135 }, { x: 222, y: 135 }], nose: { x: 200, y: 165 }, mouth: [{ x: 184, y: 190 }, { x: 216, y: 190 }], score: 0.9 };
  const faced = (p: ReturnType<typeof person>, chin?: number) => {
    const face: Face = { ...box, chin: chin ?? faceChin(box, p.px, W, H) };
    return { face, lm: withFace(p.lm, face)! };
  };

  it('الرقبة المضاءة أكثر من الوجه، وظلّها الأحمر الداكن جلد؛ والرماديّ القريب ليس جلدًا', () => {
    const m = { r: 224 / 552, g: 178 / 552, spread: 0.012, lum: 120 };
    expect(skinWeight(m, 202, 160, 135)).toBe(1); // أفتح من الوجه بأربعة أعشار
    expect(skinWeight(m, 78, 55, 38)).toBe(1); // ظلٌّ تحت الذقن: أحمر وأعتم
    expect(skinWeight({ ...m, spread: 0.019, lum: 140 }, 73, 69, 68)).toBe(0); // قميصٌ رماديّ مخلوط
    expect(skinWeight(m, 30, 30, 38)).toBe(0);
  });

  it('الذقن على نهاية الرأس واللحية، والقصّ يبدأ عنده: الرقبة تبقى والوجه لا يُمسّ', () => {
    const b = person(null, 245, true);
    const { face, lm } = faced(b);
    expect(Math.abs(lm.chin - 230)).toBeLessThanOrEqual(3);
    const m = skinSample(b.px, b.alpha, W, H, lm, face)!;
    const mask = neckSkin(b.px, W, H, lm, m, lm.chin + lm.neckWidth * 2.5, lm.neckWidth / 2 + 1, face)!;
    expect(mask.y0).toBe(Math.ceil(lm.chin));
    for (const y of [Math.round(lm.chin) + 4, 260, 280]) expect(skinAt(mask, 200, y)).toBe(1);
    expect(skinAt(mask, 200, 220)).toBe(1); // اللحية فوق الذقن خارج القناع
  });

  it('والياقة البيضاء تحت الذقن تُقصّ، وما بقي من اللحية تحت ذقنٍ قُدِّر أعلى قليلًا يبقى', () => {
    const high = person([240, 240, 238], 236);
    const { face, lm } = faced(high);
    const m = skinSample(high.px, high.alpha, W, H, lm, face)!;
    const mask = neckSkin(high.px, W, H, lm, m, lm.chin + lm.neckWidth * 2.5, lm.neckWidth / 2 + 1, face)!;
    for (const y of [245, 260, 290]) expect(skinAt(mask, 200, y)).toBe(0);
    expect(skinAt(mask, 200, 225)).toBe(1);
    // ذقنٌ أعلى من نهاية اللحية بستّة صفوف (خطأٌ أسوأ من المقيس): اللحية الداكنة تحته تبقى.
    const b = person(null, 245, true);
    const early = faced(b, 224);
    const m2 = skinSample(b.px, b.alpha, W, H, early.lm, early.face)!;
    const mask2 = neckSkin(b.px, W, H, early.lm, m2, early.lm.chin + early.lm.neckWidth * 2.5, early.lm.neckWidth / 2 + 1, early.face)!;
    expect(skinAt(mask2, 200, 228)).toBeGreaterThan(0.9);
  });
});

describe('على صورة المعاملة المولَّدة — بالنموذج الحقيقي', () => {
  afterAll(() => closePortrait());

  it('الرقبة تحت الذقن جلد، والقميص الأبيض بجانبها ليس جلدًا', async () => {
    const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
    const out = await cutout(join(__dirname, '..', 'resources', 'models', 'modnet-portrait-q8.onnx'), img.rgba, img.width, img.height);
    const lm: Landmarks = landmarks(out.alpha, img.width, img.height)!;
    const m = skinSample(out.pixels, out.alpha, img.width, img.height, lm)!;
    const mask = neckSkin(out.pixels, img.width, img.height, lm, m, lm.chin + lm.neckWidth * 2.5, lm.neckWidth / 2 + 1)!;
    const cx = Math.round(lm.neckCenterX);
    expect(skinAt(mask, cx, Math.round(lm.chin) + 6)).toBeGreaterThan(0.9);
    // ياقة القميص البيضاء أسفل جانب الرقبة.
    expect(skinAt(mask, cx - Math.round(lm.neckWidth * 0.45), Math.round(lm.chin + lm.neckWidth * 0.5))).toBeLessThan(0.1);
  }, 60_000);
});
