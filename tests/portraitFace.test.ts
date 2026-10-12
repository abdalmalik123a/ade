/**
 * الوجه والذقن (إصلاح البند ٣٩) — نموذج YuNet: مدخله وفكّ مخرجه بأرقامٍ يصنعها الاختبار، والذقن من حافّة الإضاءة تحت الفم
 * على صورةٍ مرسومة، ثم النموذج الحقيقيّ على صورة المعاملة المولَّدة (لا شخصٌ حقيقيّ) وعلى صورةٍ بلا وجه.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closePortrait, cutout, detectFace } from '../src/main/services/portrait';
import { decodeFaces, FACE_SIZE, faceChin, faceInput, withFace, type FaceBox } from '../src/shared/portraitFace';
import { landmarks } from '../src/shared/portraitMask';
import { readPngRgba } from './helpers';

const S = FACE_SIZE;
const MODELS = join(__dirname, '..', 'resources', 'models');

describe('مدخل النموذج', () => {
  it('BGR بقيمه كما هي، والصورة في الزاوية العليا بنسبتها والباقي أسود', () => {
    // ٤×٢: البكسل الأوّل أحمر.
    const px = new Uint8ClampedArray(4 * 2 * 4).fill(0);
    px.set([255, 10, 20, 255], 0);
    const { data, scale } = faceInput(px, 4, 2);
    expect(scale).toBe(160);
    expect(data[0]).toBe(20); // الأزرق أوّلًا
    expect(data[S * S]).toBe(10);
    expect(data[2 * S * S]).toBe(255);
    expect(data[320 * S]).toBe(0); // تحت الصورة (ارتفاعها ٣٢٠) حشوٌ أسود
    expect(faceInput(px, 4, 2, 'bgra').data[0]).toBe(255);
  });

  it('والتصغير بمتوسّط ما تحت البكسل لا بأخذ واحدٍ منه', () => {
    const W = 1280;
    const px = new Uint8ClampedArray(W * 2 * 4);
    for (let x = 0; x < W; x++) for (let y = 0; y < 2; y++) px.fill(x % 2 ? 200 : 0, (y * W + x) * 4, (y * W + x) * 4 + 3);
    const { data, scale } = faceInput(px, W, 2);
    expect(scale).toBe(0.5);
    expect(data[0]).toBe(100);
    expect(data[2 * S * S + 300]).toBe(100);
  });
});

describe('فكّ مخرج النموذج', () => {
  it('المستطيل والنقاط بمقاس الصورة، والأوثق أوّلًا، والمتداخل يُحذف وما دون العتبة', () => {
    const out: Record<string, Float32Array> = {};
    for (const s of [8, 16, 32]) {
      const n = (S / s) ** 2;
      out[`cls_${s}`] = new Float32Array(n);
      out[`obj_${s}`] = new Float32Array(n);
      out[`bbox_${s}`] = new Float32Array(n * 4);
      out[`kps_${s}`] = new Float32Array(n * 10);
    }
    const put = (s: number, r: number, c: number, score: number, box: number[], kps: number[] = Array(10).fill(0)) => {
      const i = r * (S / s) + c;
      out[`cls_${s}`]![i] = score;
      out[`obj_${s}`]![i] = score;
      out[`bbox_${s}`]!.set(box, i * 4);
      out[`kps_${s}`]!.set(kps, i * 10);
    };
    // العين الأولى في المخرج على اليمين: تُرتَّب من اليسار.
    put(16, 10, 20, 0.9, [0.5, 0.5, Math.log(6), Math.log(8)], [1.5, 0, -0.5, 0, 0.5, 1, -0.25, 2, 1.25, 2]);
    put(16, 10, 21, 0.8, [0.5, 0.5, Math.log(6), Math.log(8)]); // يتداخل مع الأوّل
    put(32, 2, 2, 0.5, [0, 0, 0, 0]); // دون العتبة
    put(8, 70, 70, 0.7, [0.5, 0.5, Math.log(4), Math.log(4)]); // وجهٌ آخر بعيد
    const faces = decodeFaces(out, 0.5);
    expect(faces).toHaveLength(2);
    const f = faces[0]!;
    expect(f.score).toBeCloseTo(0.9, 5);
    expect([f.x, f.y, f.w, f.h].map((v) => Math.round(v))).toEqual([560, 208, 192, 256]);
    expect(f.eyes.map((p) => [p.x, p.y])).toEqual([[624, 320], [688, 320]]);
    expect([f.nose.x, f.nose.y]).toEqual([656, 352]);
    expect(f.mouth.map((p) => [p.x, p.y])).toEqual([[632, 384], [680, 384]]);
    expect(faces[1]!.score).toBeCloseTo(0.7, 5);
  });
});

describe('الذقن من حافّة الإضاءة', () => {
  // عينان على الصفّ ١٠٠ وفمٌ على ٢٠٠: المسافة ١٠٠، والذقن المعتاد تحت الفم بـ٨٥.
  const box: FaceBox = { x: 60, y: 60, w: 80, h: 200, eyes: [{ x: 80, y: 100 }, { x: 120, y: 100 }], nose: { x: 100, y: 150 }, mouth: [{ x: 80, y: 200 }, { x: 120, y: 200 }], score: 0.9 };
  const image = (edge: number | null) => {
    const px = new Uint8ClampedArray(200 * 400 * 4);
    for (let y = 0; y < 400; y++) px.fill(edge !== null && y >= edge ? 80 : 200, y * 800, y * 800 + 800);
    return px;
  };

  it('يقع على الحافّة بين الوجه والرقبة', () => {
    expect(Math.abs(faceChin(box, image(290), 200, 400) - 290)).toBeLessThanOrEqual(2);
    expect(Math.abs(faceChin(box, image(265), 200, 400) - 265)).toBeLessThanOrEqual(2);
  });

  it('وبلا حافّةٍ تُرى يبقى الموضع المعتاد — لا أوّل الصفوف', () => {
    expect(faceChin(box, image(null), 200, 400)).toBe(285);
  });
});

describe('النموذج الحقيقيّ', () => {
  afterAll(() => closePortrait());
  const FACE = join(MODELS, 'face_detection_yunet_2023mar.onnx');

  it('يجد وجه صورة المعاملة المولَّدة وذقنها، والمعالم تأخذ الذقن منه', async () => {
    const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
    const f = (await detectFace(FACE, img.rgba, img.width, img.height))!;
    expect(f.score).toBeGreaterThan(0.8);
    for (const e of f.eyes) expect(Math.abs(e.y - 122)).toBeLessThan(6);
    for (const m of f.mouth) expect(Math.abs(m.y - 165)).toBeLessThan(6);
    // الذقن بالعين ~١٩٦–١٩٨ (أسفل الوجه فوق ظلّ الرقبة).
    expect(f.chin).toBeGreaterThan(190);
    expect(f.chin).toBeLessThan(206);
    const out = await cutout(join(MODELS, 'modnet-portrait-q8.onnx'), img.rgba, img.width, img.height);
    const lm = landmarks(out.alpha, img.width, img.height)!;
    const withChin = withFace(lm, f)!;
    expect(withChin).toEqual({ ...lm, chin: Math.round(f.chin) });
    // وجهٌ ليس وجه هذا الرأس (خارج عرضه)، أو لا وجه: المعالم كما هي.
    expect(withFace(lm, { ...f, x: f.x + lm.headWidth })).toBe(lm);
    expect(withFace(lm, null)).toBe(lm);
    expect(withFace(null, f)).toBeNull();
  }, 60_000);

  it('ولا وجه في صورةٍ بلا وجه', async () => {
    const W = 320;
    const H = 240;
    const px = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.set([80 + x / 4, 120, 200 - y / 3, 255], (y * W + x) * 4);
    expect(await detectFace(FACE, px, W, H)).toBeNull();
  }, 60_000);
});
