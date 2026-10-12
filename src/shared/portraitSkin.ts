/**
 * الياقة تلقائيًّا (البند ٣٩) — تحت الذقن في فتحة القاط **يبقى لون الجلد وحده**، وما ليس جلدًا (ياقة الزبون وقميصه وكنزته)
 * يُقصّ؛ و**يُرفع القاط إلى الذقن** إن ظهرت ملابس فوقه.
 *
 * والعلّة: الرقبة تُعرف من عرض القناع (`landmarks`)، والياقة المرتفعة بعرض الرقبة — فكانت تُحسب رقبةً وتبقى في الفتحة.
 * فالجلد يُعرف بلونه: **عيّنته من الوجه نفسه** بين العينين والذقن (الخدّان والأنف والفم — والوسيط لا يحرفه الفم ولا
 * الشارب)، ويُقاس **باللونيّة** (نسبة الأحمر والأخضر إلى المجموع) لا بالإضاءة: الرقبة في ظلّ الذقن أعتم من الوجه ولونيّتها
 * لونيّته، والقميص الأبيض والكنزة الرمادية لونيّتهما محايدة، والأسود أعتم من أن يكون رقبة.
 *
 * حسابٌ خالص على البكسلات (يُختبر بلا متصفّح)؛ والقناع لا يُمسّ — يُضرب في الشفافية عند الرسم (`usePhotoCanvas`)، فما
 * يُخلع القاط يعود كما كان. ولا شيء هنا يمسّ الوجه: الذقن حدٌّ أعلى.
 */
import type { Landmarks, SuitTransform } from './portraitMask';
import { faceFloor, faceGeometry, type Face } from './portraitFace';

type Px = Uint8Array | Uint8ClampedArray;

/** لون الجلد: لونيّته الوسيطة (r وg من المجموع) ومداها، وإضاءته. */
export type SkinModel = { r: number; g: number; spread: number; lum: number };

const lum = (px: Px, i: number) => 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1]!;

/**
 * عيّنة الجلد من الوجه — المعتم من القناع وحده، و`null` إن قلّت (رأسٌ صغيرٌ جدًّا أو لم يُعرف).
 *
 * وإن عُرف الوجه (`face`): **الخدّان والأنف** تحت العينين بأكثر من ثلث المسافة إلى الفم (تحت إطار النظّارة) وفوق الشارب،
 * من خارج العين إلى خارج الأخرى. وكانت العيّنة بين نصف الرأس والذقن المقدَّر — فتدخلها اللحية والشفتان في الصور الحقيقية.
 * وبلا وجه: بين العينين والذقن تقديرًا، وفي وسطه بعرض نصف الرأس (لا شعر الجانبين ولا الأذنان).
 */
export function skinSample(pixels: Px, alpha: Uint8Array, width: number, height: number, lm: Landmarks, face?: Face | null): SkinModel | null {
  const head = lm.chin - lm.top;
  if (!(head > 20)) return null;
  const f = face ? faceGeometry(face) : null;
  const ed = face ? face.eyes[1].x - face.eyes[0].x : 0;
  const y0 = Math.max(0, Math.round(f ? f.eyeY + f.em * 0.4 : lm.top + head * 0.55));
  const y1 = Math.min(height - 1, Math.round(f ? f.eyeY + f.em * 0.72 : lm.top + head * 0.88));
  const x0 = Math.max(0, Math.round(face ? face.eyes[0].x - ed * 0.15 : lm.headCenterX - lm.headWidth * 0.25));
  const x1 = Math.min(width - 1, Math.round(face ? face.eyes[1].x + ed * 0.15 : lm.headCenterX + lm.headWidth * 0.25));
  const rs: number[] = [];
  const gs: number[] = [];
  const ls: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt(((y1 - y0) * (x1 - x0)) / 4000)));
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const i = y * width + x;
      if (alpha[i]! < 250) continue;
      const s = pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]!;
      if (s < 60) continue; // حاجبٌ أو حدقةٌ أو شاربٌ معتم: لونيّته لا يُعتمد عليها
      rs.push(pixels[i * 4]! / s);
      gs.push(pixels[i * 4 + 1]! / s);
      ls.push(lum(pixels, i));
    }
  }
  if (rs.length < 30) return null;
  const r = median([...rs]);
  const g = median([...gs]);
  const spread = median(rs.map((v, k) => Math.hypot(v - r, gs[k]! - g)));
  return { r, g, spread: Math.max(0.004, spread), lum: median(ls) };
}

/**
 * نصيب الجلد في البكسل ٠..١: لونيّته قريبةٌ من الوجه، وإضاءته بين أعتم ظلّ الرقبة وأفتح من الوجه بسبعة أعشار — الرقبة قد
 * تكون في الضوء والخدّان في ظلّ (كانت ٠٫٣٥ فقُصّت رقبةٌ ظاهرة أفتح من الوجه بـ٠٫٣٧ في صورةٍ حقيقية). والأبيض والرماديّ يُعرفان
 * بلونيّتهما المحايدة لا بإضاءتهما.
 *
 * والجلد في الظلّ (تحت الذقن) أحمر قليلًا من الوجه: فيُتسامح في **زيادة الأحمر وحدها** بقدر عتمة البكسل. والملابس الداكنة
 * (الأسود والرماديّ والكحليّ) أقلّ حمرةً من الجلد، فلا تنالها المسامحة.
 *
 * وما قطع **أكثر من نصف الطريق من لون الجلد إلى الرماديّ** ليس جلدًا وإن قرب: قميصٌ رماديّ مخلوط بقي نصفه حين اتّسع مدى
 * العيّنة (خدّان تحت نظّارة)، والرقبة المضاءة لا تبلغ ثلث الطريق.
 */
export function skinWeight(m: SkinModel, R: number, G: number, B: number): number {
  const s = R + G + B;
  if (s < 1) return 0;
  const L = 0.299 * R + 0.587 * G + 0.114 * B;
  const dark = Math.max(0, Math.min(1, (m.lum - L) / (0.5 * m.lum)));
  const dr = R / s - m.r;
  const d = Math.hypot(dr > 0 ? Math.max(0, dr - 0.07 * dark) : dr, G / s - m.g);
  const near = 2.5 * m.spread + 0.012;
  const wc = Math.max(0, Math.min(1, 1 - (d - near) / 0.02));
  const nr = 1 / 3 - m.r;
  const ng = 1 / 3 - m.g;
  const ns = Math.hypot(nr, ng);
  const gray = ns > 0.01 ? ((R / s - m.r) * nr + (G / s - m.g) * ng) / ns : 0;
  const wn = ns > 0.01 ? Math.max(0, Math.min(1, (0.55 * ns - gray) / (0.1 * ns))) : 1;
  const wl = Math.max(0, Math.min(1, (L - 0.3 * m.lum) / (0.1 * m.lum))) * Math.max(0, Math.min(1, (1.7 * m.lum - L) / (0.15 * m.lum)));
  return wc * wn * wl;
}

/** قناع الجلد في مستطيلٍ من الصورة (٠..٢٥٥) — يبدأ صفّه الأوّل `y0` وعموده `x0`. */
export type SkinMask = { x0: number; y0: number; w: number; h: number; mask: Uint8Array };

/**
 * الجلد تحت الذقن في عمود الرقبة إلى `bottom` (أسفل فتحة القاط): كلّ بكسلٍ بنصيبه، ثم يُنعَّم بمتوسّط ٥×٥ ويُشدّ — فلا
 * تبقى نقاط ضجيجٍ ثقوبًا في الرقبة، والحدّ بين الرقبة والياقة ناعمٌ بلا درج.
 *
 * ويبدأ من **ملتقى الفكّ بالرقبة** (`jawLine`) لا من الذقن المقدَّر تحته بخُمس عرض الرقبة: الياقة المرتفعة تبدأ عند ذلك
 * الملتقى، فكان أعلاها يبقى شريطًا. وبين الملتقى والذقن (أسفل الوجه) يبقى الداكن أيضًا — لحيةٌ أو ظلٌّ لا يُعرف من ياقةٍ
 * سوداء، فلا يُقصّ من الوجه ما قد يكون منه.
 *
 * وإن عُرف الوجه (`face`) فالذقن حقيقيّ (`withFace`): يبدأ القصّ عنده لا فوقه — وعلى جانبيه من أسفل الوجه (`faceFloor`)، فما
 * علا الذقن من الياقة بجانب الفكّ يُقصّ والوجه لا يُمسّ — ويبقى الداكن تحته في نصف بيضيٍّ بعرض الذقن وحافّةٍ ناعمة: خطأ الذقن
 * في أسوئه نحو عُشر المسافة بين العينين والفم، فلا تُقصّ نهاية لحية؛ وعلى جانبيه ياقةٌ لا لحية. والتنعيم بقدر
 * الرقبة: في صورةٍ كبيرة كانت ٥×٥ أصغر من نسيج القميص فيبقى منه نقاط.
 */
export function neckSkin(pixels: Px, width: number, height: number, lm: Landmarks, m: SkinModel, bottom: number, half: number, face?: Face | null): SkinMask | null {
  const g = face ? faceGeometry(face) : null;
  const em = g ? g.em : 0;
  const x0 = Math.max(0, Math.floor(lm.neckCenterX - half - 3));
  const x1 = Math.min(width, Math.ceil(lm.neckCenterX + half + 4));
  // أوّل صفٍّ يُقصّ في كلّ عمود: أسفل الوجه عنده إن عُرف، وإلا ملتقى الفكّ.
  const from = Array.from({ length: Math.max(0, x1 - x0) }, (_, x) => Math.max(0, Math.ceil(face ? faceFloor(face, lm.chin, x0 + x) : jawLine(lm))));
  const y0 = Math.min(height, ...from);
  const y1 = Math.min(height, Math.ceil(bottom) + 3);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  const raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y0 + y) * width + x0 + x;
      const R = pixels[i * 4]!;
      const G = pixels[i * 4 + 1]!;
      const B = pixels[i * 4 + 2]!;
      const beard = g ? Math.max(0, Math.min(1, (1 - ((x0 + x - g.cx) / (g.mw * 0.7)) ** 2 - ((y0 + y - lm.chin) / (em * 0.17)) ** 2) / 0.3)) : y0 + y < lm.chin ? 1 : 0;
      const dark = beard * Math.max(0, Math.min(1, (0.45 * m.lum - (0.299 * R + 0.587 * G + 0.114 * B)) / (0.1 * m.lum)));
      raw[y * w + x] = Math.max(dark, skinWeight(m, R, G, B));
    }
  }
  // مجموعٌ تراكميّ: متوسّط المربّع حول كلّ بكسل بلا حلقةٍ عليه.
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0, row = 0; x < w; x++) {
      row += raw[y * w + x]!;
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1]! + row;
    }
  }
  const r = Math.max(2, Math.round(lm.neckWidth / 60));
  const mask = new Uint8Array(w * h);
  const fade = Math.max(2, Math.round(face ? em * 0.1 : lm.neckWidth * 0.08));
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r);
    const yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(w, x + r + 1);
      const s = sum[yb * (w + 1) + xb]! - sum[ya * (w + 1) + xb]! - sum[yb * (w + 1) + xa]! + sum[ya * (w + 1) + xa]!;
      const n = (yb - ya) * (xb - xa);
      const t = Math.max(0, Math.min(1, (s / n - 0.35) / 0.3));
      const v = t * t * (3 - 2 * t);
      // تحت الذقن مباشرةً يتدرّج القصّ: لا خطّ حادٌّ في موضعٍ مقدَّر. وفوق أوّل صفٍّ يُقصّ في العمود (الوجه) لا يُمسّ شيء.
      const keep = Math.max(v, 1 - (y0 + y - from[x]!) / fade);
      mask[y * w + x] = Math.round(Math.min(1, keep) * 255);
    }
  }
  return { x0, y0, w, h, mask };
}

/** ملتقى الفكّ بالرقبة: أوّل صفٍّ يضيق فيه القناع إلى عرض الرقبة — والذقن المقدَّر تحته بخُمس عرضها (`landmarks`). */
export const jawLine = (lm: Landmarks): number => lm.chin - lm.neckWidth * 0.2;

/** مضاعف الشفافية عند (x، y) من قناع الجلد — ١ خارجه. */
export const skinAt = (s: SkinMask | null, x: number, y: number): number =>
  s && y >= s.y0 && y < s.y0 + s.h && x >= s.x0 && x < s.x0 + s.w ? s.mask[(y - s.y0) * s.w + x - s.x0]! / 255 : 1;

/**
 * أوّل صفٍّ تحت الذقن وفوق القاط (`suitTop`) تغلب فيه الملابس على الرقبة: أكثر من ثلث المرئيّ في عمود الرقبة ليس جلدًا.
 * و`null` إن كانت الرقبة جلدًا حتى القاط.
 */
export function clothesTop(pixels: Px, alpha: Uint8Array, width: number, lm: Landmarks, m: SkinModel, suitTop: number, face?: Face | null): number | null {
  const half = lm.neckWidth / 2;
  const x0 = Math.max(0, Math.round(lm.neckCenterX - half));
  const x1 = Math.min(width - 1, Math.round(lm.neckCenterX + half));
  // صفوف الذقن الأولى تقديرٌ قد يقع على الفكّ (أو نهاية اللحية إن عُرف الوجه): يُبدأ بعدها بقليل.
  const from = Math.ceil(lm.chin + Math.max(2, face ? faceGeometry(face).em * 0.15 : lm.neckWidth * 0.08));
  let run = 0;
  for (let y = from; y < suitTop; y++) {
    let shown = 0;
    let cloth = 0;
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (alpha[i]! < 128) continue;
      shown++;
      cloth += 1 - skinWeight(m, pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!);
    }
    // صفّان متتاليان على الأقلّ: خيطٌ واحدٌ من الضجيج ليس ياقة.
    run = shown > half && cloth > shown / 3 ? run + 1 : 0;
    if (run >= 2) return y - 1;
  }
  return null;
}

/** القاط يرتفع حتى أعلى الملابس الظاهرة فوقه — ولا يتجاوز الذقن. */
export function raiseSuit(at: SuitTransform, clothes: number | null, chin: number): SuitTransform {
  if (clothes === null || clothes >= at.y) return at;
  return { ...at, y: Math.max(chin, clothes) };
}
