/**
 * نقطتا الكتفين بنموذج RTMPose-t (S45، D173) — حسابٌ خالص: مدخل النموذج من الصورة وقناعها، وفكّ مخرجه (SimCC) إلى إحداثيّات الصورة.
 * والنموذج نفسه يجري في العامل وحده (`main/services/portrait.ts` `detectShoulders`)، كما يجري نموذجا القصّ والوجه.
 *
 * كما يهيّئه `pipeline.json` في حزمته الرسمية (وجُرِّب في D159 على عشرين صورة): صندوق الشخص من القناع بحشوة ١٫٢٥ ونسبة ١٩٢:٢٥٦،
 * ثم RGB بتطبيع ImageNet، والمخرج توزيعان لكلّ نقطةٍ على المحورين بدقّة نصف بكسلٍ من المدخل (نسبة SimCC = ٢).
 * والنقطتان مفصلا الكتفين (٥ يسار الشخص و٦ يمينه في ترتيب COCO) — داخل حدّ الجسد بـ٥–٧٪ من عرضه، لا حافّته (D159).
 */

type Px = Uint8Array | Uint8ClampedArray;

/** مقاس مدخل النموذج: عرضٌ ١٩٢ وارتفاعٌ ٢٥٦. */
export const POSE_W = 192;
export const POSE_H = 256;
/** دقّة SimCC: موضعان لكلّ بكسلٍ من المدخل. */
export const SIMCC_RATIO = 2;
const PADDING = 1.25;
const MEAN = [123.675, 116.28, 103.53];
const STD = [58.395, 57.12, 57.375];

/** صندوق الشخص في الصورة: مركزه وعرضه وارتفاعه بنسبة المدخل. */
export type PoseBox = { cx: number; cy: number; w: number; h: number };
/** نقطةٌ في الصورة وثقتها (أعلى قيمتي توزيعيها). */
export type Keypoint = { x: number; y: number; score: number };
/** كتفا الشخص: `left` كتفه الأيسر (يمين الناظر)، و`right` الأيمن. */
export type Shoulders = { left: Keypoint; right: Keypoint };

/** صندوق ما في القناع (≥١٢٨) بحشوة ١٫٢٥ ممدودًا إلى نسبة ١٩٢:٢٥٦ — أو `null` إن خلا القناع. */
export function poseBox(alpha: Uint8Array, width: number, height: number): PoseBox | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x]! >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  let w = (x1 - x0 + 1) * PADDING;
  let h = (y1 - y0 + 1) * PADDING;
  if (w > h * (POSE_W / POSE_H)) h = w / (POSE_W / POSE_H);
  else w = h * (POSE_W / POSE_H);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w, h };
}

/** مدخل النموذج: الصندوق مقصوصًا بتقريبٍ ثنائيّ الخطّ إلى ١٩٢×٢٥٦، وRGB بتطبيع ImageNet (CHW) — وما خرج عن الصورة صفر. */
export function poseInput(pixels: Px, width: number, height: number, box: PoseBox): Float32Array {
  const plane = POSE_W * POSE_H;
  const data = new Float32Array(3 * plane);
  for (let v = 0; v < POSE_H; v++)
    for (let u = 0; u < POSE_W; u++) {
      const X = box.cx + (u - POSE_W / 2) * (box.w / POSE_W);
      const Y = box.cy + (v - POSE_H / 2) * (box.h / POSE_H);
      const xa = Math.floor(X);
      const ya = Math.floor(Y);
      const fx = X - xa;
      const fy = Y - ya;
      const taps: [number, number, number][] = [
        [xa, ya, (1 - fx) * (1 - fy)],
        [xa + 1, ya, fx * (1 - fy)],
        [xa, ya + 1, (1 - fx) * fy],
        [xa + 1, ya + 1, fx * fy]
      ];
      for (let ch = 0; ch < 3; ch++) {
        let val = 0;
        for (const [xx, yy, w] of taps) if (xx >= 0 && xx < width && yy >= 0 && yy < height) val += pixels[(yy * width + xx) * 4 + ch]! * w;
        data[ch * plane + v * POSE_W + u] = (val - MEAN[ch]!) / STD[ch]!;
      }
    }
  return data;
}

/** أعلى موضعٍ في توزيع نقطةٍ وقيمته. */
function peak(dist: Float32Array, k: number, length: number): { at: number; value: number } {
  let at = 0;
  for (let i = 1; i < length; i++) if (dist[k * length + i]! > dist[k * length + at]!) at = i;
  return { at, value: dist[k * length + at]! };
}

/** نقطة المؤشّر `k` من مخرجي SimCC (`[1, K, length]`) إلى إحداثيّات الصورة بصندوقها. */
export function decodeKeypoint(simccX: Float32Array, simccY: Float32Array, k: number, lengthX: number, lengthY: number, box: PoseBox): Keypoint {
  const px = peak(simccX, k, lengthX);
  const py = peak(simccY, k, lengthY);
  return {
    x: box.cx + (px.at / SIMCC_RATIO - POSE_W / 2) * (box.w / POSE_W),
    y: box.cy + (py.at / SIMCC_RATIO - POSE_H / 2) * (box.h / POSE_H),
    score: Math.min(px.value, py.value)
  };
}

/** كتفا COCO (٥ و٦) من مخرجي النموذج. */
export function decodeShoulders(simccX: Float32Array, simccY: Float32Array, lengthX: number, lengthY: number, box: PoseBox): Shoulders {
  return {
    left: decodeKeypoint(simccX, simccY, 5, lengthX, lengthY, box),
    right: decodeKeypoint(simccX, simccY, 6, lengthX, lengthY, box)
  };
}
