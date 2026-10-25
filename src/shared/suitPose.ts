/**
 * القاط بنقطتي الكتفين (S45، D174) — نقلٌ لنموذج D159 الأوّلي (`fitPose` و`walk` في `reports/diag/suitMeasure.diag.ts`) شرطًا شرطًا، حسابٌ خالص.
 *
 * زاوية القاط ميل خطّ النقطتين؛ وعرض صفّ كتفه عرضُ الشخص على ذلك الخطّ — من كلّ نقطةٍ إلى حدّ القناع خارجها، فالنقطة مفصل الكتف
 * داخل الجسد بـ٥–٧٪ من عرضه لا حافّته (D159) — وما قطعه إطار الصورة يُقدَّر بالجانب الآخر؛ وصفّ كتفه على منتصفهما ارتفاعًا؛
 * وفتحة عنقه على رقبة الشخص (`neckCenterX`) كاليوم، فمنتصف النقطتين يزيحه عن العنق حين يقطع الإطار كتفًا (مُجرَّب في D159: العنق ٩–١٣٪).
 * **وإن قطع الإطار الكتفين كليهما، أو ضعفت ثقة النقطتين: `null`** — فيبقى تركيب اليوم (`fitSuit`): النقطتان حينها تخمين (الزاوية تضطرب ±٥°).
 * وما بعده (الارتفاع فوق ما ظهر من الملابس، `raiseSuit`) كاليوم في الواجهة.
 */
import type { Landmarks } from './portraitMask';
import type { Shoulders } from './portraitPose';
import type { SuitAnchor, SuitTransform } from './suitFit';

/** أدنى ثقةٍ لكلتا النقطتين — وما دونها تخمين (D159). */
export const MIN_SHOULDER_SCORE = 0.3;
/** ركبة منحنى عرض القاط (D177): نافذة الاتّساع من طول القاط، ونسبة الاتّساع إلى أسرعه — بالقياس على تسعة قوالب. */
export const SLOPE_SPAN = 0.03;
export const KNEE = 0.35;

/**
 * «صفّ الكتف» في القاط — أو −١ لقاطٍ بلا صفوف. أوّل صفٍّ يبلغ ٩٠٪ من أعرضه (D159)، **إلا أن يبطؤ اتّساعه قبله** (D177): الكتف المنحدر
 * يتّسع سريعًا ثم الذراع شبه عموديّ، وفي قوالب القميص والربطة يتّسع الذراعان حتى أسفل الصورة فكان «٩٠٪ من الأعرض» يقع على الذراعين
 * (٤٠–٧٠٪ من طولها) فيُلبس القاط أصغر. فالركبة: بعد أن يبلغ العرض نصف الأعرض (فوقه أطراف الياقة)، أوّل صفٍّ بعد أسرع اتّساعٍ ينزل فيه الاتّساع (على نافذة `SLOPE_SPAN` من الطول) دون
 * `KNEE` من أسرعه. والقاط الذي يثبت عرضه بعد الكتف (القاطان المقيسان) لا ركبة فيه قبل ذلك الصفّ: كما كان.
 */
export function shoulderRow(suitRows: Float32Array, knee = KNEE): number {
  let widest = 0;
  for (const v of suitRows) widest = Math.max(widest, v);
  if (!(widest > 0)) return -1;
  const old = suitRows.findIndex((v) => v >= widest * 0.9);
  const top = suitRows.findIndex((v) => v > 0);
  const k = Math.max(2, Math.round((suitRows.length - top) * SLOPE_SPAN));
  const slope = (y: number) => (suitRows[Math.min(suitRows.length - 1, y + k)]! - suitRows[y]!) / k;
  // بعد أطراف الياقة: من أوّل صفٍّ يبلغ نصف الأعرض (أطرافها تتّسع سريعًا ثم تبطؤ قبل الكتف).
  let fast = suitRows.findIndex((v) => v >= widest * 0.5);
  for (let y = fast; y < old; y++) if (slope(y) > slope(fast)) fast = y;
  for (let y = fast; y < old; y++) if (slope(y) < knee * slope(fast)) return y;
  return old;
}

/** من النقطة إلى خارج القناع على اتّجاهٍ: كم بكسلًا، وهل بلغ إطار الصورة قبل ذلك. */
export function walkOut(alpha: Uint8Array, width: number, height: number, x: number, y: number, dx: number, dy: number): { t: number; frame: boolean } {
  for (let t = 0; ; t++) {
    const X = Math.round(x + dx * t);
    const Y = Math.round(y + dy * t);
    if (X < 0 || X >= width || Y < 0 || Y >= height) return { t, frame: true };
    if (alpha[Y * width + X]! < 128) return { t, frame: false };
  }
}

/** موضع القاط بكتفي الشخص — أو `null` فيبقى تركيب اليوم. */
export function fitSuitByShoulders(
  anchor: SuitAnchor,
  suitRows: Float32Array,
  alpha: Uint8Array,
  width: number,
  height: number,
  lm: Landmarks,
  shoulders: Shoulders | null,
  sRow = shoulderRow(suitRows)
): SuitTransform | null {
  if (!shoulders) return null;
  const { left: a, right: b } = shoulders;
  if (Math.min(a.score, b.score) < MIN_SHOULDER_SCORE || sRow < 0) return null;
  // L يسار الناظر و R يمينه — أيًّا كان ترتيب النموذج.
  const [L, R] = a.x < b.x ? [a, b] : [b, a];
  const span = Math.hypot(R.x - L.x, R.y - L.y);
  if (!(span > 0)) return null;
  const ux = (R.x - L.x) / span;
  const uy = (R.y - L.y) / span;
  const l = walkOut(alpha, width, height, L.x, L.y, -ux, -uy);
  const r = walkOut(alpha, width, height, R.x, R.y, ux, uy);
  if (l.frame && r.frame) return null;
  const across = !l.frame && !r.frame ? span + l.t + r.t : !l.frame ? span + 2 * l.t : span + 2 * r.t;
  const scale = across / suitRows[sRow]!;
  const angle = (Math.atan2(R.y - L.y, R.x - L.x) * 180) / Math.PI;
  const dy = (sRow - anchor.cy) * scale;
  const cos = Math.cos((angle * Math.PI) / 180);
  return { x: lm.neckCenterX, y: (L.y + R.y) / 2 - dy * cos, scale, angle };
}
