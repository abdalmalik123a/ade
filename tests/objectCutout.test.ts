/**
 * فصل الشيء عن خلفيّته بالنموذج الحقيقي (DESIGNS.md ٢٫٣، BiRefNet_lite-matting على الجهاز): تفّاحةٌ يرسمها الاختبار نفسه
 * على جدارٍ متدرّجٍ بضجيج — فقناعها الصحيح معروفٌ حسابًا — والشخص المولَّد (`fixtures/portrait-generated.png`) يُفصل به
 * أيضًا كما بـMODNet. والمدخل مربّعٌ ٥١٢ بمقياس ImageNet.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { objectCutout, objectMatte } from '../src/main/services/objectCutout';
import { closePortrait } from '../src/main/services/portrait';
import { OBJECT_SIZE, objectInput } from '../src/shared/objectMask';
import { readPngRgba } from './helpers';

const MODEL = join(__dirname, '..', 'resources', 'models', 'birefnet-lite-matting-q8.onnx');
afterAll(() => closePortrait());

/** تفّاحةٌ حمراء مظلّلة بعودٍ على جدارٍ متدرّجٍ بضجيجٍ ثابت — والقناع الصحيح بتغطية كلّ بكسل (رسمٌ بأربعٍ في كلّ اتجاه). */
function appleScene(size = 384): { rgba: Uint8Array; truth: Float32Array } {
  const rgba = new Uint8Array(size * size * 4);
  const truth = new Float32Array(size * size);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 30;
  const inside = (x: number, y: number) => {
    const [cx, cy, r] = [size * 0.5, size * 0.56, size * 0.27];
    return Math.hypot(x - cx, y - cy) < r || (Math.abs(x - size * 0.5) < size * 0.012 && y > size * 0.2 && y < size * 0.32);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) cover++;
      const a = cover / 16;
      const i = y * size + x;
      truth[i] = a;
      const wall = [150 + (y / size) * 60 + noise(), 160 - (x / size) * 40 + noise(), 120 + noise()];
      const shade = 0.6 + 0.5 * (1 - Math.hypot(x - size * 0.42, y - size * 0.45) / size);
      const apple = [200 * shade, 30 * shade, 35 * shade];
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.max(0, Math.min(255, Math.round(apple[c]! * a + wall[c]! * (1 - a))));
      rgba[i * 4 + 3] = 255;
    }
  }
  return { rgba, truth };
}

const iou = (alpha: Uint8Array, truth: (i: number) => boolean) => {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]! >= 128;
    const t = truth(i);
    if (a && t) inter++;
    if (a || t) union++;
  }
  return inter / union;
};

describe('فصل الشيء عن خلفيّته — على الجهاز', () => {
  it('المدخل مربّعٌ ٥١٢ بمقياس ImageNet: الأبيض والأسود في حدودهما', () => {
    const white = objectInput(new Uint8Array(4 * 4 * 4).fill(255), 4, 4);
    const black = objectInput(Uint8Array.from({ length: 4 * 4 * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0)), 4, 4);
    expect(white.length).toBe(3 * OBJECT_SIZE * OBJECT_SIZE);
    expect(white[0]).toBeCloseTo((1 - 0.485) / 0.229, 4);
    expect(black[2 * OBJECT_SIZE * OBJECT_SIZE]).toBeCloseTo(-0.406 / 0.225, 4);
  });

  it('التفّاحة تُفصل (IoU ≥ ٠٫٩٥): الجدار شفّاف والتفّاحة معتمة', async () => {
    const { rgba, truth } = appleScene();
    const alpha = await objectMatte(MODEL, rgba, 384, 384);
    expect(iou(alpha, (i) => truth[i]! >= 0.5)).toBeGreaterThan(0.95);
    for (const [x, y] of [[5, 5], [378, 5], [5, 378], [378, 378]]) expect(alpha[y! * 384 + x!]).toBeLessThan(20);
    expect(alpha[Math.round(384 * 0.56) * 384 + 192]).toBeGreaterThan(240);
  }, 60_000);

  it('والشخص المولَّد يُفصل به أيضًا كما بـMODNet (IoU ≥ ٠٫٩٥)', async () => {
    const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
    const truth = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated-mask.png')));
    const alpha = await objectMatte(MODEL, img.rgba, img.width, img.height);
    expect(iou(alpha, (i) => truth.rgba[i * 4]! >= 128)).toBeGreaterThan(0.95);
  }, 60_000);

  it('والقصّ: حافّةٌ مشدودة (لا نصف شفّافٍ إلا عندها) وألوانٌ بمقاس الصورة', async () => {
    const { rgba, truth } = appleScene();
    const out = await objectCutout(MODEL, rgba, 384, 384);
    expect(out.pixels.length).toBe(rgba.length);
    let soft = 0;
    for (let i = 0; i < out.alpha.length; i++) if (out.alpha[i]! > 20 && out.alpha[i]! < 235 && (truth[i] === 0 || truth[i] === 1)) soft++;
    // نصف الشفّاف خارج حافّة القناع الصحيح قليلٌ: أقلّ من ١٪ من الصورة.
    expect(soft / out.alpha.length).toBeLessThan(0.01);
    expect(out.ms).toBeGreaterThan(0);
  }, 60_000);
});
