/**
 * فصل الشخص عن خلفيّته بالنموذج الحقيقي (MODNet على الجهاز) — على صورةٍ مولَّدة لا لشخصٍ
 * حقيقيّ (`fixtures/portrait-generated.png`)، خلفيّتها جدارٌ متدرّج بضجيج، وقناعها الصحيح
 * معروف (`portrait-generated-mask.png`) فيُقاس النموذج به لا بالعين.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closePortrait, cutout, matte } from '../src/main/services/portrait';
import { landmarks } from '../src/shared/portraitMask';
import { readPngRgba } from './helpers';

const MODEL = join(__dirname, '..', 'resources', 'models', 'modnet-portrait-q8.onnx');
const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
const truth = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated-mask.png')));
const n = img.width * img.height;

/** تقاطع القناعين على اتّحادهما — ١ تطابقٌ تامّ. */
function iou(alpha: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < n; i++) {
    const a = alpha[i]! >= 128;
    const t = truth.rgba[i * 4]! >= 128;
    if (a && t) inter++;
    if (a || t) union++;
  }
  return inter / union;
}

afterAll(() => closePortrait());

describe('فصل الشخص عن خلفيّته — على الجهاز', () => {
  it('يطابق القناعَ الصحيح (IoU ≥ ٠٫٩٥)، والخلفية شفّافة والوجه معتم', async () => {
    const alpha = await matte(MODEL, img.rgba, img.width, img.height);
    expect(alpha.length).toBe(n);
    expect(iou(alpha)).toBeGreaterThan(0.95);
    // زوايا الجدار شفّافة، ووسط الوجه (عند ٣٥٪ من الارتفاع) معتم.
    for (const [x, y] of [[5, 5], [img.width - 6, 5], [5, img.height / 2]]) expect(alpha[Math.round(y) * img.width + x]).toBeLessThan(20);
    expect(alpha[Math.round(img.height * 0.35) * img.width + img.width / 2]).toBeGreaterThan(240);
  }, 60_000);

  it('والحافّة بلا هالة الخلفية القديمة: لون الحافّة أقرب إلى الشخص منه إلى الجدار', async () => {
    const out = await cutout(MODEL, img.rgba, img.width, img.height);
    expect(iou(out.alpha)).toBeGreaterThan(0.95);
    // بكسلات الحافّة (نصف شفّافة) على كتف السترة السوداء: كانت تحمل لون الجدار الفاتح.
    let before = 0;
    let after = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const a = out.alpha[i]!;
      const y = Math.floor(i / img.width);
      if (a > 40 && a < 215 && y > img.height * 0.6) {
        before += img.rgba[i * 4]! + img.rgba[i * 4 + 1]! + img.rgba[i * 4 + 2]!;
        after += out.pixels[i * 4]! + out.pixels[i * 4 + 1]! + out.pixels[i * 4 + 2]!;
        count++;
      }
    }
    expect(count).toBeGreaterThan(20);
    expect(after / count).toBeLessThan(before / count);
  }, 60_000);

  it('ولا يُمسّ بكسلٌ معتمٌ تمامًا: الوجه كما هو', async () => {
    const out = await cutout(MODEL, img.rgba, img.width, img.height);
    let changed = 0;
    let solid = 0;
    for (let i = 0; i < n; i++) {
      if (out.alpha[i]! < 255) continue;
      solid++;
      if (out.pixels[i * 4] !== img.rgba[i * 4] || out.pixels[i * 4 + 1] !== img.rgba[i * 4 + 1] || out.pixels[i * 4 + 2] !== img.rgba[i * 4 + 2]) changed++;
    }
    expect(solid).toBeGreaterThan(n * 0.3);
    expect(changed).toBe(0);
  }, 60_000);

  it('ومن القناع تُعرف الرقبة والكتفان — فيوضع القاط تحتها', async () => {
    const out = await cutout(MODEL, img.rgba, img.width, img.height);
    const lm = landmarks(out.alpha, img.width, img.height)!;
    expect(lm).not.toBeNull();
    // في الصورة: قمّة الرأس نحو ٨٪، والرقبة نحو ٥٠٪، والكتفان تحتها، ووسطها في الوسط.
    expect(lm.top / img.height).toBeLessThan(0.14);
    expect(lm.neckY / img.height).toBeGreaterThan(0.4);
    expect(lm.neckY / img.height).toBeLessThan(0.62);
    expect(lm.shoulderY).not.toBeNull();
    expect(Math.abs(lm.neckCenterX - img.width / 2)).toBeLessThan(img.width * 0.06);
    expect(lm.neckWidth).toBeLessThan(lm.headWidth);
    // الذقن في الصورة عند نصف ارتفاعها تقريبًا (١٩٢ من ٣٨٤) — تحت الفم لا عند الأنف.
    expect(Math.abs(lm.chin / img.height - 0.5)).toBeLessThan(0.04);
  }, 60_000);
});
