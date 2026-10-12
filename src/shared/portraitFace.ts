/**
 * الوجه نفسه (إصلاح البند ٣٩) — نموذج YuNet من OpenCV (`resources/models`) يجد الوجه وعينيه وأنفه وطرفي فمه، فيُعرف
 * **الذقن الحقيقيّ** لا تقديره من عرض القناع.
 *
 * والعلّة: `landmarks` تعرف الذقن من حيث يضيق القناع إلى عرض الرقبة. وعلى صورٍ حقيقية (لحيةٌ، أو تصويرٌ قريب) وقع على
 * الشفة السفلى: فقصّت «الياقة تلقائيًّا» أسفل الوجه واللحية، وبدأ «رمّم» من الشفة، وقيس الرأس في دليل القالب أقصر من
 * حقيقته فكبر في الصورة الرسمية.
 *
 * حسابٌ خالص هنا (مدخل النموذج وقراءة مخرجه والذقن)؛ والنموذج يعمل في العملية الرئيسة (`services/portrait.ts`). وإن لم
 * يُوجد وجهٌ أو لم يتّفق مع القناع بقيت المعالم كما كانت.
 */
import type { Landmarks } from './portraitMask';

type Px = Uint8Array | Uint8ClampedArray;
export type Point = { x: number; y: number };

/** وجهٌ بمقاس الصورة كما يخرج من النموذج: مستطيله، والعينان والأنف وطرفا الفم (من اليسار إلى اليمين في الصورة)، وثقته ٠..١. */
export type FaceBox = { x: number; y: number; w: number; h: number; eyes: [Point, Point]; nose: Point; mouth: [Point, Point]; score: number };

/** والذقن معه (`faceChin`): صفّه في الصورة. */
export type Face = FaceBox & { chin: number };

/** مقاس مدخل النموذج: مربّعٌ ثابت. */
export const FACE_SIZE = 640;
const STRIDES = [8, 16, 32] as const;

/**
 * مدخل النموذج: الصورة مصغّرةً (بمتوسّط ما تحت كلّ بكسل) حتى يسع ضلعها الأطول ٦٤٠، في الزاوية العليا اليسرى والباقي أسود —
 * كما يحشو OpenCV. بترتيب BGR وقيمها ٠..٢٥٥ كما هي.
 */
export function faceInput(pixels: Px, width: number, height: number, order: 'rgba' | 'bgra' = 'rgba'): { data: Float32Array; scale: number } {
  const S = FACE_SIZE;
  const scale = Math.min(S / width, S / height);
  const tw = Math.min(S, Math.round(width * scale));
  const th = Math.min(S, Math.round(height * scale));
  const data = new Float32Array(3 * S * S);
  const [ri, bi] = order === 'rgba' ? [0, 2] : [2, 0];
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.min(height - 1, Math.floor(ty / scale));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor((ty + 1) / scale)));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.min(width - 1, Math.floor(tx / scale));
      const x1 = Math.max(x0 + 1, Math.min(width, Math.floor((tx + 1) / scale)));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += pixels[i + ri]!;
          g += pixels[i + 1]!;
          b += pixels[i + bi]!;
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = ty * S + tx;
      data[o] = b / n;
      data[S * S + o] = g / n;
      data[2 * S * S + o] = r / n;
    }
  }
  return { data, scale };
}

const overlap = (a: FaceBox, b: FaceBox): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.w * a.h + b.w * b.h - w * h);
};

/**
 * الوجوه من مخرج النموذج (`cls_8`…`kps_32`) بمقاس الصورة الأصليّ، الأوثق أوّلًا — وفكّ الترميز كما في OpenCV
 * (`FaceDetectorYN`): الثقة جذر حاصل الصنف والوجود، والمستطيل والنقاط من خليّة الشبكة وخطوتها، ثم يُحذف المتداخل.
 */
export function decodeFaces(out: Record<string, Float32Array>, scale: number, threshold = 0.6): FaceBox[] {
  const all: FaceBox[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (const stride of STRIDES) {
    const cols = FACE_SIZE / stride;
    const cls = out[`cls_${stride}`]!;
    const obj = out[`obj_${stride}`]!;
    const box = out[`bbox_${stride}`]!;
    const kps = out[`kps_${stride}`]!;
    for (let idx = 0; idx < cls.length; idx++) {
      const score = Math.sqrt(clamp(cls[idx]!) * clamp(obj[idx]!));
      if (score < threshold) continue;
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const w = Math.exp(box[idx * 4 + 2]!) * stride;
      const h = Math.exp(box[idx * 4 + 3]!) * stride;
      const cx = (c + box[idx * 4]!) * stride;
      const cy = (r + box[idx * 4 + 1]!) * stride;
      const p = (n: number): Point => ({ x: ((kps[idx * 10 + 2 * n]! + c) * stride) / scale, y: ((kps[idx * 10 + 2 * n + 1]! + r) * stride) / scale });
      const eyes = [p(0), p(1)].sort((a, b) => a.x - b.x) as [Point, Point];
      const mouth = [p(3), p(4)].sort((a, b) => a.x - b.x) as [Point, Point];
      all.push({ x: (cx - w / 2) / scale, y: (cy - h / 2) / scale, w: w / scale, h: h / scale, eyes, nose: p(2), mouth, score });
    }
  }
  all.sort((a, b) => b.score - a.score);
  const kept: FaceBox[] = [];
  for (const f of all) if (kept.every((k) => overlap(k, f) < 0.3)) kept.push(f);
  return kept;
}

/** مقاييس الوجه: صفّ العينين والفم والمسافة بينهما، ومركز الفم وعرضه — وحدة كلّ ما يُقاس تحته. */
export function faceGeometry(f: FaceBox): { eyeY: number; mouthY: number; em: number; cx: number; mw: number } {
  const eyeY = (f.eyes[0].y + f.eyes[1].y) / 2;
  const mouthY = (f.mouth[0].y + f.mouth[1].y) / 2;
  return { eyeY, mouthY, em: Math.max(1, mouthY - eyeY), cx: (f.mouth[0].x + f.mouth[1].x) / 2, mw: Math.max(1, f.mouth[1].x - f.mouth[0].x) };
}

/**
 * الذقن: **حافّة الإضاءة** تحت الفم — حيث ينتهي الوجه أو اللحية إلى الرقبة (أفتح أو في ظلّ) — موزونةً بموضعه المعتاد.
 *
 * يُقاس بالمسافة بين العينين والفم: الذقن تحت الفم بنحو ٠٫٨٥ منها (٠٫٧٤–٠٫٩٧ على ثماني صورٍ حقيقية بلحىً وبلا لحى)، فيُبحث
 * بين ٠٫٥ و١٫٢ عن أقوى تغيّرٍ في إضاءة الصفّ وسط الفم (بلا طرفيه: الياقة قد تدخلهما) — **متوسّط نصفه الأوسط**: لا تحرّكه شامةٌ
 * أو بقعةٌ أو قلادة (والوسيط وحده أخطأ في صورةٍ بلحيةٍ متفرّقة) — والأقرب إلى ٠٫٨٥ أرجح.
 * وعلى تلك الصور أخطأ بـ٠٫٠٣ وسطًا وأسوأه ٠٫١١، والموضع الثابت كان يخطئ بـ٠٫١٢. وبلا حافّةٍ تُرى (أقلّ من ثلاث درجات
 * إضاءة) يبقى الموضع المعتاد.
 */
export function faceChin(f: FaceBox, pixels: Px, width: number, height: number): number {
  const { mouthY, em, cx, mw } = faceGeometry(f);
  const usual = mouthY + em * 0.85;
  const d = Math.max(1, Math.round(em * 0.05));
  const xa = Math.max(0, Math.round(cx - mw * 0.3));
  const xb = Math.min(width - 1, Math.round(cx + mw * 0.3));
  const y0 = Math.max(d, Math.round(mouthY + em * 0.5));
  const y1 = Math.min(height - 1 - d, Math.round(mouthY + em * 1.2));
  if (em < 8 || xb <= xa || y1 <= y0) return Math.min(height - 1, usual);
  const row = new Float64Array(y1 - y0 + 2 * d + 1);
  const line = new Float64Array(xb - xa + 1);
  for (let k = 0; k < row.length; k++) {
    const i0 = (y0 - d + k) * width;
    for (let x = xa; x <= xb; x++) line[x - xa] = 0.299 * pixels[(i0 + x) * 4]! + 0.587 * pixels[(i0 + x) * 4 + 1]! + 0.114 * pixels[(i0 + x) * 4 + 2]!;
    line.sort();
    let sum = 0;
    const lo = Math.floor(line.length * 0.25);
    const hi = Math.max(lo + 1, Math.ceil(line.length * 0.75));
    for (let j = lo; j < hi; j++) sum += line[j]!;
    row[k] = sum / (hi - lo);
  }
  let best = 3;
  let chin = usual;
  for (let y = y0; y <= y1; y++) {
    let above = 0;
    let below = 0;
    for (let j = 1; j <= d; j++) {
      above += row[y - j - y0 + d]!;
      below += row[y + j - y0 + d]!;
    }
    const k = (y - mouthY) / em;
    const s = (Math.abs(above - below) / d) * Math.exp(-(((k - 0.85) / 0.15) ** 2) / 2);
    if (s > best) {
      best = s;
      chin = y;
    }
  }
  return Math.min(height - 1, chin);
}

/**
 * المعالم والذقن من الوجه — إن كان الوجه وجهَ هذا الرأس: وسطه في عرض الرأس وعرضه منه. وإلا (أو بلا وجه) كما هي: الصورة
 * المرسومة والرأس من الخلف وصورٌ لا وجه فيها تبقى على تقدير القناع.
 */
export function withFace(lm: Landmarks | null, face: Face | null | undefined): Landmarks | null {
  if (!lm || !face) return lm;
  const fits = Math.abs(face.x + face.w / 2 - lm.headCenterX) < lm.headWidth * 0.5 && face.w > lm.headWidth * 0.4 && face.w < lm.headWidth * 1.3 && face.eyes[0].y > lm.top;
  return fits ? { ...lm, chin: Math.round(face.chin) } : lm;
}

/**
 * أسفل الوجه عند العمود `x`: محيطه من صفّ العينين إلى الذقن على هيئة U (بيضيٌّ مربّع: |dx|⁴) أعرض من مستطيل الوجه قليلًا —
 * فيبقى تحت الفكّ واللحية على جانبي الذقن لا فوقهما — ولا يعلو صفّ الفم (الأذنان والشعر فوقه). وما تحته من الشخص خارج الوجه
 * كتفان وياقةٌ ولباس: يُقصّ تحت القاط. وفي الصور القريبة يعلو الكتفان والياقة الذقن، فكان يبقى منهما فوق القاط بعد أن صار
 * الذقن حقيقيًّا.
 */
export function faceFloor(face: Face, chin: number, x: number): number {
  const { eyeY, mouthY } = faceGeometry(face);
  const dx = Math.abs(x - (face.x + face.w / 2)) / (face.w * 0.6);
  const contour = dx < 1 ? eyeY + (chin - eyeY) * (1 - dx ** 4) ** 0.25 : eyeY;
  return Math.min(chin, Math.max(mouthY, contour));
}
