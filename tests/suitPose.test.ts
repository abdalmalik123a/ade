/**
 * القاط بنقطتي الكتفين (S45، D174): الزاوية من ميل خطّهما، والعرض بالسير منهما إلى حدّ القناع، والمقطوع بالإطار يُقدَّر بالجانب الآخر،
 * وكلاهما مقطوعٌ أو ضعيف الثقة ← `null` فيبقى تركيب اليوم.
 */
import { describe, expect, it } from 'vitest';
import { fitSuitByShoulders, shoulderRow, walkOut } from '../src/shared/suitPose';
import type { Landmarks } from '../src/shared/portraitMask';
import type { SuitAnchor } from '../src/shared/suitFit';

const W = 600;
const H = 500;

/** جسدٌ مستطيلٌ مائلٌ بزاويةٍ حول (٣٠٠، ٢٥٠): عرضه ٤٠٠ وارتفاعه ٤٠٠ — قناعه ٢٥٥. */
function body(angleDeg: number, cx = 300, halfW = 200): Uint8Array {
  const alpha = new Uint8Array(W * H);
  const c = Math.cos((angleDeg * Math.PI) / 180);
  const s = Math.sin((angleDeg * Math.PI) / 180);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // إحداثيّا البكسل في إطار الجسد غير المائل.
      const u = (x - cx) * c + (y - 250) * s;
      const v = -(x - cx) * s + (y - 250) * c;
      if (Math.abs(u) <= halfW && v >= -50 && v <= 350) alpha[y * W + x] = 255;
    }
  return alpha;
}

/** النقطتان مفصلا الكتفين: داخل الجسد بـ٢٨ بكسلًا من حافّتيه على خطّ الكتف (v = 0). */
function shoulders(angleDeg: number, cx = 300, halfW = 200, score = 0.8) {
  const c = Math.cos((angleDeg * Math.PI) / 180);
  const s = Math.sin((angleDeg * Math.PI) / 180);
  const at = (u: number) => ({ x: cx + u * c, y: 250 + u * s, score });
  // ترتيب COCO: الأيسر (٥) يمين الناظر.
  return { left: at(halfW - 28), right: at(-(halfW - 28)) };
}

const lm: Landmarks = { top: 40, chin: 200, headWidth: 150, headCenterX: 300, neckY: 220, neckWidth: 70, neckCenterX: 300, shoulderY: 250 };
const anchor: SuitAnchor = { cx: 100, cy: 20, neckWidth: 40, shoulderWidth: 200, top: 0 };
/** قاطٌ عرضه يتّسع حتى صفّ ٦٠ (٢٠٠ بكسل) ثم يثبت. */
const suitRows = Float32Array.from({ length: 200 }, (_, y) => Math.min(200, 80 + y * 2));

describe('القاط بنقطتي الكتفين', () => {
  it('صفّ الكتف أوّل صفٍّ يبلغ ٩٠٪ من أعرضه', () => {
    expect(shoulderRow(suitRows)).toBe(50);
    expect(shoulderRow(new Float32Array(0))).toBe(-1);
  });

  it('السير إلى حدّ القناع، والإطار يُقال', () => {
    const alpha = body(0);
    expect(walkOut(alpha, W, H, 300, 250, 1, 0)).toEqual({ t: 201, frame: false });
    expect(walkOut(body(0, 500), W, H, 500, 250, 1, 0)).toEqual({ t: 100, frame: true });
  });

  it('كتفان مائلان ٥°: الزاوية ±٠٫٥° والعرض على خطّهما ±٣٪، وفتحة العنق على الرقبة', () => {
    const at = fitSuitByShoulders(anchor, suitRows, body(5), W, H, lm, shoulders(5))!;
    expect(at).not.toBeNull();
    expect(Math.abs(at.angle - 5)).toBeLessThan(0.5);
    // عرض الشخص ٤٠٠ (+ بكسلٌ لكلّ حافّة)، وصفّ كتف القاط ١٨٠ بكسلًا.
    expect(Math.abs((at.scale * 180) / 400 - 1)).toBeLessThan(0.03);
    expect(at.x).toBe(lm.neckCenterX);
  });

  it('وكتفٌ يقطعه الإطار: العرض من الجانب الآخر', () => {
    // الجسد أعرض من الصورة يمينًا: حافّته اليمنى خارجها.
    const alpha = body(0, 420);
    const at = fitSuitByShoulders(anchor, suitRows, alpha, W, H, lm, shoulders(0, 420))!;
    expect(at).not.toBeNull();
    expect(Math.abs((at.scale * 180) / 400 - 1)).toBeLessThan(0.03);
  });

  it('وكلاهما مقطوع، أو ثقةٌ ضعيفة، أو بلا نقطتين ← `null` (تركيب اليوم)', () => {
    const wide = body(0, 300, 340);
    expect(fitSuitByShoulders(anchor, suitRows, wide, W, H, lm, shoulders(0, 300, 340))).toBeNull();
    expect(fitSuitByShoulders(anchor, suitRows, body(0), W, H, lm, shoulders(0, 300, 200, 0.2))).toBeNull();
    expect(fitSuitByShoulders(anchor, suitRows, body(0), W, H, lm, null)).toBeNull();
  });
});
