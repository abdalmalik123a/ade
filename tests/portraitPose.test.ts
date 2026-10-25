/**
 * نقطتا الكتفين بـRTMPose-t (S45، D173): صندوق الشخص من القناع بحشوته ونسبته، وفكّ SimCC بنسبة ٢ إلى إحداثيّات الصورة،
 * والنموذج الحقيقيّ على صورة المعاملة المولَّدة.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closePortrait, cutout, detectFace, detectShoulders } from '../src/main/services/portrait';
import { decodeKeypoint, POSE_H, POSE_W, poseBox, poseInput, SIMCC_RATIO } from '../src/shared/portraitPose';
import { readPngRgba } from './helpers';

const MODELS = join(__dirname, '..', 'resources', 'models');

describe('صندوق الشخص ومدخل النموذج', () => {
  it('الصندوق من القناع بحشوة ١٫٢٥ ممدودًا إلى نسبة ١٩٢:٢٥٦', () => {
    const W = 400;
    const H = 300;
    const alpha = new Uint8Array(W * H);
    // شخصٌ عريض: ٢٠٠ عرضًا و١٠٠ ارتفاعًا من (١٠٠، ١٠٠).
    for (let y = 100; y < 200; y++) for (let x = 100; x < 300; x++) alpha[y * W + x] = 255;
    const box = poseBox(alpha, W, H)!;
    expect(box.cx).toBe(199.5);
    expect(box.cy).toBe(149.5);
    expect(box.w).toBe(250);
    expect(box.h).toBeCloseTo(250 / (POSE_W / POSE_H), 6);
    expect(box.w / box.h).toBeCloseTo(POSE_W / POSE_H, 6);
    expect(poseBox(new Uint8Array(W * H), W, H)).toBeNull();
  });

  it('والمدخل RGB بتطبيع ImageNet، وما خرج عن الصورة صفرٌ قبل التطبيع', () => {
    const W = 4;
    const H = 4;
    const px = new Uint8ClampedArray(W * H * 4).fill(255);
    const data = poseInput(px, W, H, { cx: 1.5, cy: 1.5, w: 400, h: 400 * (POSE_H / POSE_W) });
    const plane = POSE_W * POSE_H;
    // المركز داخل الصورة البيضاء، والزاوية خارجها.
    const centre = (POSE_H / 2) * POSE_W + POSE_W / 2;
    expect(data[centre]).toBeCloseTo((255 - 123.675) / 58.395, 4);
    expect(data[2 * plane + centre]).toBeCloseTo((255 - 103.53) / 57.375, 4);
    expect(data[0]).toBeCloseTo(-123.675 / 58.395, 4);
  });
});

describe('فكّ SimCC', () => {
  it('قمّة التوزيع ← النقطة في الصورة بنسبة ٢، والثقة أصغر القمّتين', () => {
    const LX = POSE_W * SIMCC_RATIO;
    const LY = POSE_H * SIMCC_RATIO;
    const K = 17;
    const sx = new Float32Array(K * LX);
    const sy = new Float32Array(K * LY);
    // الكتف الأيسر (٥) في المدخل عند (١٤٠، ٩٠) ← موضعا SimCC ٢٨٠ و١٨٠.
    sx[5 * LX + 280] = 0.9;
    sy[5 * LY + 180] = 0.7;
    const box = { cx: 500, cy: 400, w: 384, h: 512 };
    const kp = decodeKeypoint(sx, sy, 5, LX, LY, box);
    // مقياس الصندوق ضعف المدخل: (١٤٠ − ٩٦)×٢ + ٥٠٠ = ٥٨٨، و(٩٠ − ١٢٨)×٢ + ٤٠٠ = ٣٢٤.
    expect(kp.x).toBeCloseTo(588, 6);
    expect(kp.y).toBeCloseTo(324, 6);
    expect(kp.score).toBeCloseTo(0.7, 6);
  });
});

describe('النموذج الحقيقيّ', () => {
  afterAll(() => closePortrait());

  it('على صورة المعاملة المولَّدة: الكتفان على جانبي الرقبة تحت الذقن، والأيسر يمين الناظر', async () => {
    const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
    const cut = await cutout(join(MODELS, 'modnet-portrait-q8.onnx'), img.rgba, img.width, img.height);
    const face = (await detectFace(join(MODELS, 'face_detection_yunet_2023mar.onnx'), img.rgba, img.width, img.height))!;
    const s = (await detectShoulders(join(MODELS, 'rtmpose-t-body7-256x192.onnx'), img.rgba, cut.alpha, img.width, img.height))!;
    expect(s).not.toBeNull();
    // تحت الذقن، وعلى جانبي مركز الوجه بعرضٍ أوسع من الوجه.
    for (const k of [s.left, s.right]) {
      expect(k.y).toBeGreaterThan(face.chin);
      expect(k.score).toBeGreaterThan(0.3);
    }
    const mid = face.x + face.w / 2;
    expect(s.left.x).toBeGreaterThan(mid + face.w * 0.5);
    expect(s.right.x).toBeLessThan(mid - face.w * 0.5);
  }, 60_000);
});
