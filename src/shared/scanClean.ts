/**
 * تنظيف المستمسك الممسوح (هـ١) — دوالّ خالصة على البكسلات، تُختبر بلا متصفّح.
 *
 * - **حفظ ألوان الأختام**: «مسحٌ نظيف» يبيّض الورق ويشدّ الحبر إلى السواد؛ والختم
 *   الأزرق والتوقيع الأحمر كانا يصيران رماديّين فلا يُعرف الختم من الكتابة. فما كان
 *   ملوّنًا يبقى بلونه، وما سواه يُسوَّد.
 * - **إزالة البقع**: نقطةٌ معزولة من غبار الزجاج أو حبرٍ متطاير تُمحى — **والمعزولة
 *   وحدها**: نقاط الحروف العربية ملاصقةٌ لحروفها فتبقى.
 * - **التقويم من الأسطر**: ورقةٌ وُضعت مائلةً على الماسح تُعدَّل بزاوية أسطرها —
 *   حيث لا أركان تُكشف (الورقة بملء الزجاج).
 * - **قياس الحبر**: كم من الورقة سيُطبع حبرًا — فالنسخة بخلفيةٍ داكنة تستنزف الطابعة.
 */
import type { PixelData } from './deskew';
import { flattenLight } from './deskew';

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** أملوّنٌ هذا البكسل حبرًا — لا ورقًا ولا رماديًّا؟ */
export function isColoredInk(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // الورق المصفرّ خفيف التشبّع؛ والختم الأزرق أو الأحمر مشبعٌ وليس أبيض.
  return max - min > 55 && (max - min) / Math.max(1, max) > 0.3 && max < 250;
}

/**
 * «مسحٌ نظيف» يحفظ الألوان: الإضاءة تُسوّى، والرماديّ يُسوَّد بقوّة `ink`، والملوّن
 * يبقى بلونه بعد تسوية إضاءته.
 */
export function cleanScan(px: PixelData, opts: { keepColor?: boolean; ink?: number } = {}): PixelData {
  const flat = flattenLight(px);
  const ink = opts.ink ?? 1.3;
  const keep = opts.keepColor ?? true;
  const out = new Uint8ClampedArray(flat.data.length);
  const d = flat.data;
  const src = px.data;
  // الملوّن يُعرف من الأصل لا من المسوّى: ختمٌ عريضٌ يملأ خليّة التسوية يُحسب ورقًا
  // فيُبيَّض. ويُفتَّح بعاملٍ واحدٍ للورقة كلّها (سطوع ورقها)، فيبقى لونه لونه.
  const k = keep ? 255 / paperLevel(px) : 1;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    if (keep && isColoredInk(src[i]!, src[i + 1]!, src[i + 2]!)) {
      out[i] = src[i]! * k;
      out[i + 1] = src[i + 1]! * k;
      out[i + 2] = src[i + 2]! * k;
    } else {
      const v = 255 - Math.min(255, (255 - Math.min(255, lum(r, g, b))) * ink);
      out[i] = out[i + 1] = out[i + 2] = v;
    }
    out[i + 3] = 255;
  }
  return { width: flat.width, height: flat.height, data: out };
}

/** سطوع الورق في الصورة كلّها: النسبة المئوية ٩٠ — لا الأقصى، فبكسلٌ لامع يكذب. */
function paperLevel(px: PixelData): number {
  const d = px.data;
  const hist = new Uint32Array(256);
  const stride = Math.max(1, Math.floor(d.length / 4 / 20000)) * 4;
  let n = 0;
  for (let i = 0; i < d.length; i += stride) {
    hist[Math.round(lum(d[i]!, d[i + 1]!, d[i + 2]!))]!++;
    n++;
  }
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += hist[v]!;
    if (seen >= n * 0.9) return Math.max(120, v);
  }
  return 255;
}

/** كم بكسلًا بقيت ملوّنة — لتُعرض: «حُفظ لون ختمٍ واحد». */
export function coloredShare(px: PixelData): number {
  let n = 0;
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) if (isColoredInk(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
  return n / (px.width * px.height);
}

/**
 * يمحو البقع المعزولة: كتلةٌ داكنة صغيرة (دون `maxArea`) لا حبر حولها في نصف قطرٍ
 * `radius`. ويعيد الصورة وعدد ما مُحي.
 *
 * والعزلة شرطٌ لا الصِّغر وحده: نقطة الباء والتاء والثاء كتلةٌ صغيرة أيضًا، لكنّها
 * على بعد بكسلاتٍ من حرفها.
 */
export function despeckle(
  px: PixelData,
  opts: { maxArea?: number; radius?: number; threshold?: number } = {}
): { px: PixelData; removed: number } {
  const { width: w, height: h, data } = px;
  const threshold = opts.threshold ?? 128;
  // البقعة: دون ١٫٨ ملّم تقريبًا في مسح ٦٠٠ نقطة/إنش — والعزلة: لا حبر في ٣ ملّم حولها.
  // ونقطة الحرف أقرب إلى حرفها من ذلك دائمًا.
  const maxArea = opts.maxArea ?? Math.max(16, Math.round(w * h * 0.00005));
  const radius = opts.radius ?? Math.max(6, Math.round(Math.min(w, h) * 0.015));
  const dark = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) dark[p] = lum(data[i]!, data[i + 1]!, data[i + 2]!) < threshold ? 1 : 0;

  // الكتل الداكنة بجوارٍ ثمانيّ — مكدّسٌ لا تعاود فيه الدالّة نفسها.
  const label = new Int32Array(w * h);
  const out = new Uint8ClampedArray(data);
  let removed = 0;
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!dark[start] || label[start]) continue;
    next++;
    const pixels: number[] = [];
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    stack.push(start);
    label[start] = next;
    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // الكتلة الكبيرة لا تُمحى — فلا حاجة لتتبّعها كلّها لنعرف ذلك.
      if (pixels.length > maxArea) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (dark[q] && !label[q]) {
            label[q] = next;
            stack.push(q);
          }
        }
      }
    }
    if (pixels.length > maxArea) {
      // ما بقي في المكدّس يُوسم فلا تُبدأ منه كتلةٌ ثانية مبتورة.
      stack.length = 0;
      continue;
    }
    // عزلة: لا بكسلٌ داكنٌ من غيرها حولها.
    let lonely = true;
    for (let y = Math.max(0, y0 - radius); y <= Math.min(h - 1, y1 + radius) && lonely; y++) {
      for (let x = Math.max(0, x0 - radius); x <= Math.min(w - 1, x1 + radius); x++) {
        const q = y * w + x;
        if (dark[q] && label[q] !== next) {
          lonely = false;
          break;
        }
      }
    }
    if (!lonely) continue;
    for (const p of pixels) {
      out[p * 4] = out[p * 4 + 1] = out[p * 4 + 2] = 255;
    }
    removed++;
  }
  return { px: { width: w, height: h, data: out }, removed };
}

/**
 * زاوية الأسطر بالدرجات (موجبةٌ: الأسطر تصعد يمينًا). تُجرَّب الزوايا في مدى ±`range`،
 * وتُختار التي تجعل الحبر أشدّ تجمّعًا في صفوف — فالأسطر المستوية تعطي إسقاطًا
 * أفقيًّا بقممٍ حادّة وفجواتٍ بيضاء بينها.
 */
export function estimateSkew(px: PixelData, range = 6, step = 0.2): number {
  const { width: w, height: h, data } = px;
  // تصغيرٌ إلى ٦٠٠ بكسل عرضًا: الزاوية لا تحتاج دقّة الماسح.
  const scale = Math.min(1, 600 / w);
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (Math.min(h - 1, Math.floor(y / scale)) * w + Math.min(w - 1, Math.floor(x / scale))) * 4;
      if (lum(data[i]!, data[i + 1]!, data[i + 2]!) < 110) points.push({ x, y });
    }
  }
  if (points.length < 50) return 0;
  const bins = sh * 2;
  let best = 0;
  let bestScore = -1;
  for (let a = -range; a <= range + 1e-9; a += step) {
    const t = Math.tan((a * Math.PI) / 180);
    const hist = new Float64Array(bins);
    for (const p of points) {
      // الصفّ الذي يقع فيه البكسل لو دُوّرت الورقة بـ`a`.
      const row = Math.round(p.y + p.x * t + sh / 2);
      if (row >= 0 && row < bins) hist[row]!++;
    }
    let score = 0;
    for (let i = 1; i < bins; i++) score += (hist[i]! - hist[i - 1]!) ** 2;
    if (score > bestScore + 1e-6) {
      bestScore = score;
      best = a;
    }
  }
  return Math.round(best * 100) / 100;
}

/** تدوير الصورة حول مركزها بـ`deg` درجة، والأطراف بيضاء (ورق). */
export function rotate(px: PixelData, deg: number): PixelData {
  const { width: w, height: h, data } = px;
  if (Math.abs(deg) < 0.01) return px;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // البكسل الهدف يُسأل عن مصدره (التحويل العكسي) بتقريبٍ ثنائيّ الخطّ.
      const sx = cos * (x - cx) + sin * (y - cy) + cx;
      const sy = -sin * (x - cx) + cos * (y - cy) + cy;
      const o = (y * w + x) * 4;
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const a = data[(y0 * w + x0) * 4 + c]! * (1 - fx) + data[(y0 * w + x1) * 4 + c]! * fx;
        const b = data[(y1 * w + x0) * 4 + c]! * (1 - fx) + data[(y1 * w + x1) * 4 + c]! * fx;
        out[o + c] = a * (1 - fy) + b * fy;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * يقوّم الورقة من أسطرها: يقدّر الزاوية ثم يدوّر بها — فـ`rotate` بزاويةٍ موجبة يُميل
 * الأسطر بسالبها، والتدوير بالمقدَّرة يعيدها أفقية. وما دون عُشر درجةٍ يُترك: التدوير
 * يُنعّم الحروف قليلًا، فلا يُدفع ثمنه بلا فائدة.
 */
export function straighten(px: PixelData): { px: PixelData; angle: number } {
  const angle = estimateSkew(px);
  return Math.abs(angle) < 0.1 ? { px, angle: 0 } : { px: rotate(px, angle), angle };
}

/**
 * قياس الحبر: ما تغطّيه الطباعة من الورقة (٠..١) — كل بكسلٍ بقدر سواده. وتُعدّ
 * `heavy` حين تتجاوز الربع: خلفيةٌ رمادية أو ظلٌّ لم يُسوَّ يُطبع حبرًا كلّه.
 */
export function inkCoverage(px: PixelData): { coverage: number; heavy: boolean } {
  const d = px.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 1 - lum(d[i]!, d[i + 1]!, d[i + 2]!) / 255;
  const coverage = sum / (px.width * px.height);
  return { coverage, heavy: coverage > 0.25 };
}
