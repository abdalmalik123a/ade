/**
 * صورة المعاملة — القناع وما يُبنى عليه، حسابًا خالصًا على البكسلات (يُختبر بلا متصفّح).
 *
 * - **مدخل النموذج** (`modelInput`): الصورة مصغَّرةً بالمتوسّط حتى يصير ضلعها الأقصر ٥١٢
 *   (وكلا ضلعيها من مضاعفات ٣٢)، وقيمها بين −١ و١ — كما صُدِّر MODNet.
 * - **الحوافّ**: القناع يُكبَّر إلى الصورة (`upsampleAlpha`)، ثم يُشدّ إلى حوافّها الحقيقية بمرشّح
 *   الدليل (`refineAlpha` — He وزملاؤه ٢٠١٠) فيتبع الشعرَ لا بكسلات النموذج المكبَّرة.
 * - **هالة الخلفية** (`decontaminate`): البكسل نصف الشفّاف فيه لون الخلفية القديمة، فيظهر
 *   حول الرأس هالةً بيضاء على الخلفية الجديدة. فيُقدَّر لون المقدّمة وحده من جواره.
 * - **الفرشاة** (`paintAlpha`): «أبقِ» و«احذف» بحافّةٍ ناعمة — والألوان الأصلية باقية تحت
 *   القناع، فما يُعاد يعود كما كان.
 * - **المعالم** (`landmarks`): قمّة الرأس والذقن والرقبة والكتفان من عرض القناع صفًّا صفًّا —
 *   بلا كاشف وجوه: الرأس يتّسع ثم تضيق الرقبة ثم يتّسع الكتفان.
 * - **القاط** (`suitAnchor`، `placeSuit`، `fitSuit`): فتحة العنق في صورة القاط تُطابَق برقبة الشخص،
 *   ثم يُطابَق عرض القاط صفًّا صفًّا بعرض الشخص فيقع كتفاه على كتفيه. ويُقصّ الشخص على حدّ
 *   القاط (`neckLine`، `underSuit`): الرقبة إلى أسفل فتحة العنق، وما سواها عند أعلى الياقة —
 *   فلا يظهر لباسه الأصلي حول القاط ولا فوق كتفيه.
 *
 * ولا شيء هنا يحرّك بكسلًا من الوجه أو يغيّر شكله: القناع يقرّر ما يُرى، لا أين.
 */
import { cropBox, type Crop, type Size } from './photoSheet';
import type { HeadGuide } from './photoPresets';

// ── مدخل النموذج ───────────────────────────────────────────────────────

/** مقاس مدخل النموذج: الضلع الأقصر `short`، وكلا الضلعين من مضاعفات `mult`. */
export function modelSize(width: number, height: number, short = 512, mult = 32): { w: number; h: number } {
  const k = short / Math.min(width, height);
  const round = (v: number) => Math.max(mult, Math.round((v * k) / mult) * mult);
  return { w: round(width), h: round(height) };
}

/**
 * الصورة (RGBA أو BGRA) موتّرًا NCHW بقيمٍ في [−١، ١] بمقاس النموذج — تصغيرٌ بمتوسّط ما
 * يغطّيه كلّ بكسل، وتكبيرٌ ثنائيّ الخطّ.
 */
export function modelInput(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, tw: number, th: number, order: 'rgba' | 'bgra' = 'rgba'): Float32Array {
  const out = new Float32Array(3 * tw * th);
  const [ri, bi] = order === 'rgba' ? [0, 2] : [2, 0];
  const sx = width / tw;
  const sy = height / th;
  const plane = tw * th;
  for (let y = 0; y < th; y++) {
    const y0 = y * sy;
    const y1 = Math.min(height, (y + 1) * sy);
    for (let x = 0; x < tw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      if (sx >= 1 && sy >= 1) {
        const x0 = x * sx;
        const x1 = Math.min(width, (x + 1) * sx);
        for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
          for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
            const p = (yy * width + xx) * 4;
            r += pixels[p + ri]!;
            g += pixels[p + 1]!;
            b += pixels[p + bi]!;
            n++;
          }
        }
      } else {
        // تكبير: أقرب الأربعة بأوزانها.
        const fx = Math.min(width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
        const fy = Math.min(height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
        const xa = Math.floor(fx);
        const ya = Math.floor(fy);
        const xb = Math.min(width - 1, xa + 1);
        const yb = Math.min(height - 1, ya + 1);
        const tx = fx - xa;
        const ty = fy - ya;
        for (const [xx, yy, wgt] of [[xa, ya, (1 - tx) * (1 - ty)], [xb, ya, tx * (1 - ty)], [xa, yb, (1 - tx) * ty], [xb, yb, tx * ty]] as const) {
          const p = (yy * width + xx) * 4;
          r += pixels[p + ri]! * wgt;
          g += pixels[p + 1]! * wgt;
          b += pixels[p + bi]! * wgt;
          n += wgt;
        }
      }
      const i = y * tw + x;
      out[i] = r / n / 127.5 - 1;
      out[plane + i] = g / n / 127.5 - 1;
      out[2 * plane + i] = b / n / 127.5 - 1;
    }
  }
  return out;
}

/** قناع النموذج (٠..١) مكبَّرًا إلى الصورة بثنائيّ الخطّ — بايتًا لكلّ بكسل. */
export function upsampleAlpha(src: Float32Array, sw: number, sh: number, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / height - 0.5));
    const ya = Math.floor(fy);
    const yb = Math.min(sh - 1, ya + 1);
    const ty = fy - ya;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / width - 0.5));
      const xa = Math.floor(fx);
      const xb = Math.min(sw - 1, xa + 1);
      const tx = fx - xa;
      const v =
        src[ya * sw + xa]! * (1 - tx) * (1 - ty) + src[ya * sw + xb]! * tx * (1 - ty) + src[yb * sw + xa]! * (1 - tx) * ty + src[yb * sw + xb]! * tx * ty;
      out[y * width + x] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
  }
  return out;
}

// ── مرشّحات الصندوق ─────────────────────────────────────────────────────

/** متوسّط مربّعٍ نصف ضلعه `r` حول كلّ بكسل — بصورةٍ تكامليّة، فكلفته لا تكبر بـ`r`. */
function boxMean(src: Float64Array, width: number, height: number, r: number): Float64Array {
  const W = width + 1;
  const sum = new Float64Array(W * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += src[y * width + x]!;
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1]! + row;
    }
  }
  const out = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      out[y * width + x] = (sum[y1 * W + x1]! - sum[y0 * W + x1]! - sum[y1 * W + x0]! + sum[y0 * W + x0]!) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

const luminance = (pixels: Uint8Array | Uint8ClampedArray, n: number): Float64Array => {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!) / 255;
  return out;
};

/**
 * مرشّح الدليل: القناع يأخذ حوافّه من إضاءة الصورة نفسها — فيتبع خصلة الشعر وحافّة الكتف
 * لا مربّعات النموذج المكبَّرة. وما كان حبرًا تامًّا أو خلفيةً تامّة بعيدًا عن الحافّة يبقى.
 */
export function refineAlpha(alpha: Uint8Array, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, r = Math.max(2, Math.round(Math.min(width, height) / 300)), eps = 1e-3): Uint8Array {
  const n = width * height;
  const I = luminance(pixels, n);
  const p = new Float64Array(n);
  for (let i = 0; i < n; i++) p[i] = alpha[i]! / 255;
  const mI = boxMean(I, width, height, r);
  const mP = boxMean(p, width, height, r);
  const IP = new Float64Array(n);
  const II = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    IP[i] = I[i]! * p[i]!;
    II[i] = I[i]! * I[i]!;
  }
  const mIP = boxMean(IP, width, height, r);
  const mII = boxMean(II, width, height, r);
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const cov = mIP[i]! - mI[i]! * mP[i]!;
    const v = mII[i]! - mI[i]! * mI[i]!;
    a[i] = cov / (v + eps);
    b[i] = mP[i]! - a[i]! * mI[i]!;
  }
  const ma = boxMean(a, width, height, r);
  const mb = boxMean(b, width, height, r);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const q = ma[i]! * I[i]! + mb[i]!;
    // بعيدًا عن الحافّة يبقى القناع كما هو: المرشّح لا يُحدث ثقبًا في الوجه ولا بقعةً في الخلفية.
    const flat = mP[i]! < 0.004 || mP[i]! > 0.996;
    out[i] = flat ? alpha[i]! : Math.round(Math.max(0, Math.min(1, q)) * 255);
  }
  return out;
}

/**
 * لون المقدّمة في بكسلات الحافّة: الملاحظ = α·مقدّمة + (١−α)·خلفية، فتُقدَّر الخلفية من
 * جوارها الشفّاف والمقدّمة من جوارها المعتم، ويُحلّ للمقدّمة. ولا يُمسّ بكسلٌ معتمٌ تمامًا.
 */
export function decontaminate(pixels: Uint8Array | Uint8ClampedArray, alpha: Uint8Array, width: number, height: number, r = Math.max(4, Math.round(Math.min(width, height) / 120))): Uint8ClampedArray {
  const n = width * height;
  const out = Uint8ClampedArray.from(pixels);
  const wf = new Float64Array(n);
  const wb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    wf[i] = alpha[i]! / 255;
    wb[i] = 1 - wf[i]!;
  }
  const mf = boxMean(wf, width, height, r);
  const mb = boxMean(wb, width, height, r);
  for (let c = 0; c < 3; c++) {
    const cf = new Float64Array(n);
    const cb = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const v = pixels[i * 4 + c]!;
      cf[i] = v * wf[i]!;
      cb[i] = v * wb[i]!;
    }
    const F = boxMean(cf, width, height, r);
    const B = boxMean(cb, width, height, r);
    for (let i = 0; i < n; i++) {
      const a = wf[i]!;
      if (a <= 0.01 || a >= 0.99) continue;
      const fg = mf[i]! > 1e-6 ? F[i]! / mf[i]! : pixels[i * 4 + c]!;
      const bg = mb[i]! > 1e-6 ? B[i]! / mb[i]! : 0;
      const solved = (pixels[i * 4 + c]! - (1 - a) * bg) / a;
      // حين يقلّ α يضعف الحلّ (يُقسم على صغير): فيُمال إلى لون المقدّمة من جوارها.
      const t = Math.max(0, Math.min(1, (a - 0.3) / 0.5));
      out[i * 4 + c] = fg * (1 - t) + Math.max(0, Math.min(255, solved)) * t;
    }
  }
  return out;
}

// ── الفرشاة ─────────────────────────────────────────────────────────────

export type BrushMode = 'keep' | 'remove';

/** بصمةُ فرشاةٍ ناعمة الحافّة — ويعود بالمستطيل الذي تغيّر (لتُحدَّث المعاينة فيه وحده). */
export function paintAlpha(alpha: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, mode: BrushMode, hardness = 0.6): { x: number; y: number; w: number; h: number } {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width, Math.ceil(cx + radius + 1));
  const y1 = Math.min(height, Math.ceil(cy + radius + 1));
  const inner = radius * hardness;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const f = d <= inner ? 1 : (radius - d) / Math.max(1e-6, radius - inner);
      const i = y * width + x;
      alpha[i] = mode === 'keep' ? Math.max(alpha[i]!, Math.round(255 * f)) : Math.min(alpha[i]!, Math.round(255 * (1 - f)));
    }
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** خطّ فرشاةٍ بين نقطتين — بصماتٌ متقاربة فلا يتقطّع مع سرعة الفأرة. */
export function strokeAlpha(alpha: Uint8Array, width: number, height: number, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, mode: BrushMode): { x: number; y: number; w: number; h: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, radius / 3)));
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const d = paintAlpha(alpha, width, height, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius, mode);
    box = { x: Math.min(box.x, d.x), y: Math.min(box.y, d.y), x2: Math.max(box.x2, d.x + d.w), y2: Math.max(box.y2, d.y + d.h) };
  }
  return { x: box.x, y: box.y, w: Math.max(0, box.x2 - box.x), h: Math.max(0, box.y2 - box.y) };
}

// ── المعالم: الرأس والرقبة والكتفان ───────────────────────────────────────

export type Landmarks = {
  /** قمّة الرأس (الشعر). */
  top: number;
  /** الذقن تقديرًا: تحت ملتقى الفكّ بالرقبة بقليل. */
  chin: number;
  headWidth: number;
  headCenterX: number;
  /** أضيق الرقبة. */
  neckY: number;
  neckWidth: number;
  neckCenterX: number;
  /** حيث يتّسع الكتفان — `null` إن لم يظهرا في الصورة. */
  shoulderY: number | null;
};

/** المعالم من القناع صفًّا صفًّا — و`null` إن لم يكن فيه شخصٌ يُعرف رأسه من رقبته. */
export function landmarks(alpha: Uint8Array, width: number, height: number): Landmarks | null {
  const left = new Int32Array(height).fill(-1);
  const right = new Int32Array(height).fill(-1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let l = -1;
    let r = -1;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x]! >= 128) {
        if (l < 0) l = x;
        r = x;
      }
    }
    left[y] = l;
    right[y] = r;
  }
  const raw = Array.from({ length: height }, (_, y) => (left[y]! >= 0 ? right[y]! - left[y]! + 1 : 0));
  // تنعيمٌ بنافذة صغيرة: خصلةٌ شاردة أو ياقةٌ لا تصنع رقبةً كاذبة.
  const k = Math.max(1, Math.round(height / 200));
  const widthAt = raw.map((_, y) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, y - k); j <= Math.min(height - 1, y + k); j++) {
      s += raw[j]!;
      c++;
    }
    return s / c;
  });
  const top = widthAt.findIndex((v) => v > width * 0.03);
  if (top < 0) return null;

  // ١. الرأس يتّسع حتى أعرضه، ويُعرف انتهاؤه بأن يضيق عن ٩٠٪ منه (الفكّ).
  let headWidth = 0;
  let headY = top;
  let y = top;
  for (; y < height; y++) {
    const v = widthAt[y]!;
    if (v >= headWidth) {
      headWidth = v;
      headY = y;
    } else if (v < headWidth * 0.9) break;
  }
  if (y >= height || headWidth < width * 0.05) return null;
  // ٢. ثم أضيق الرقبة، حتى يتّسع الكتفان أضعافها — وشعرٌ طويلٌ يغطّي الرقبة يُفشل هذا فيُقال.
  const neckStart = y;
  let narrowest = widthAt[y]!;
  let shoulderY: number | null = null;
  for (; y < height; y++) {
    const v = widthAt[y]!;
    if (v < narrowest) narrowest = v;
    if (v > Math.max(narrowest * 1.8, headWidth * 1.3)) {
      shoulderY = y;
      break;
    }
  }
  // الرقبة سهلٌ من صفوفٍ متقاربة العرض لا صفٌّ واحد: يؤخذ وسطه، لا أوّله تحت الذقن.
  const end = shoulderY ?? height;
  const plateau: number[] = [];
  for (let r = neckStart; r < end; r++) if (widthAt[r]! <= narrowest * 1.05) plateau.push(r);
  const neckY = plateau.length ? plateau[Math.floor(plateau.length / 2)]! : neckStart;
  // الذقن لا يُرى في القناع: يقع أمام الرقبة داخل ظلّها. والوجه يضيق على الفكّ حتى يبلغ عرض الرقبة
  // (أوّل السهل)، والذقن تحت ذلك بنحو خُمس عرضها. وقياسه بضيق الرأس عن أعرضه يقع على الأنف إن
  // اتّسع الشعر عند الأذنين.
  const chin = Math.min(end - 1, Math.round((plateau.length ? plateau[0]! : neckStart) + narrowest * 0.2));
  const neckCenterX = (left[neckY]! + right[neckY]!) / 2;
  const headCenterX = (left[headY]! + right[headY]!) / 2;
  return { top, chin, headWidth, headCenterX, neckY, neckWidth: Math.max(1, narrowest), neckCenterX, shoulderY };
}

// ── القاط ───────────────────────────────────────────────────────────────

/** فتحة العنق في صورة القاط: مركزها وعرضها وموضعها، وعرض الكتفين. */
export type SuitAnchor = { cx: number; cy: number; neckWidth: number; shoulderWidth: number; top: number };

/**
 * تُقرأ من شفافيّة صورة القاط نفسها — فيُركَّب القاط المستورد كما يُركَّب المدمج: الفجوة
 * الشفّافة بين طرفَي الياقة في أعلاه هي مكان العنق.
 */
export function suitAnchor(alpha: Uint8Array, width: number, height: number): SuitAnchor | null {
  const opaque = (x: number, y: number) => alpha[y * width + x]! >= 128;
  let top = -1;
  for (let y = 0; y < height && top < 0; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (opaque(x, y)) n++;
    if (n > width * 0.01) top = y;
  }
  if (top < 0) return null;
  let shoulderWidth = 0;
  let best = { g: 0, cx: width / 2, y: top };
  const span = Math.max(4, Math.round((height - top) * 0.25));
  for (let y = top; y < Math.min(height, top + span); y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < width; x++) {
      if (opaque(x, y)) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l < 0) continue;
    shoulderWidth = Math.max(shoulderWidth, r - l + 1);
    // الفجوة الشفّافة الأقرب إلى وسط القاط في هذا الصفّ.
    const mid = Math.round((l + r) / 2);
    let c = -1;
    for (let d = 0; d < (r - l) / 4 && c < 0; d++) {
      if (!opaque(mid - d, y)) c = mid - d;
      else if (!opaque(mid + d, y)) c = mid + d;
    }
    if (c < 0) continue;
    let gl = c;
    let gr = c;
    while (gl > l && !opaque(gl - 1, y)) gl--;
    while (gr < r && !opaque(gr + 1, y)) gr++;
    const g = gr - gl + 1;
    if (g > best.g) best = { g, cx: (gl + gr) / 2, y };
  }
  // لا فجوة (ياقةٌ مغلقة في أعلاها): العنق وسط أعلاه، وعرضه ربع الكتفين.
  if (best.g < 3) return { cx: width / 2, cy: top, neckWidth: Math.max(1, shoulderWidth * 0.25), shoulderWidth, top };
  return { cx: best.cx, cy: best.y, neckWidth: best.g, shoulderWidth, top };
}

/** عرض الشكل في كلّ صفّ: من أوّل بكسلٍ معتمٍ إلى آخره (الفجوة بينهما محسوبة). */
export function rowWidths(alpha: Uint8Array, width: number, height: number): Float32Array {
  const out = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let l = 0;
    while (l < width && alpha[row + l]! < 128) l++;
    if (l === width) continue;
    let r = width - 1;
    while (alpha[row + r]! < 128) r--;
    out[y] = r - l + 1;
  }
  return out;
}

/**
 * أعلى القاط في كلّ عمودٍ منه من صفّ الفتحة نزولًا — في فتحة العنق أسفلُها (الربطة أو ملتقى
 * الياقة)، وعلى الياقة أعلاها. ومنه يُرسم حدّ الشخص تحت القاط.
 */
export function suitTops(alpha: Uint8Array, width: number, height: number, anchor: SuitAnchor): Float32Array {
  const out = new Float32Array(width);
  const from = Math.max(0, Math.round(anchor.cy));
  for (let x = 0; x < width; x++) {
    let y = from;
    while (y < height && alpha[y * width + x]! < 128) y++;
    out[x] = y;
  }
  return out;
}

/** موضع القاط: فتحة عنقه تحت رقبة الشخص، بعرضٍ يلائمها — ومنها يُدار ويُكبَّر. */
export type SuitTransform = { x: number; y: number; scale: number; angle: number };

export function placeSuit(anchor: SuitAnchor, lm: Landmarks): SuitTransform {
  // الياقة أعرض قليلًا من الرقبة؛ والكتفان نحو ضعفي الرأس ونصفٍ — يُحكم بهما إن شذّ الأوّل.
  let scale = (lm.neckWidth * 1.3) / anchor.neckWidth;
  const shoulders = anchor.shoulderWidth * scale;
  const low = lm.headWidth * 2.1;
  const high = lm.headWidth * 3.2;
  if (shoulders < low || shoulders > high) scale = (lm.headWidth * 2.6) / anchor.shoulderWidth;
  return { x: lm.neckCenterX, y: lm.neckY + lm.neckWidth * 0.35, scale, angle: 0 };
}

/**
 * يُلبس القاط على جسد الشخص: يُجرَّب حجمه وارتفاعه حول موضع الرقبة (`placeSuit`)، ويُختار ما
 * يطابق فيه عرضُ القاط عرضَ الشخص صفًّا صفًّا من الذقن إلى أسفل الصدر — فيقع كتفا القاط على
 * كتفيه ولا يظهر لباسه على جانبيه. وشرطه ألّا تضيق فتحة الياقة عن الرقبة كثيرًا (تلتفّ عليها). وبلا كتفين في الصورة
 * يبقى موضع الرقبة.
 *
 * `suitRows` عرض القاط صفًّا صفًّا بكسلاتِه، و`personRows` عرض الشخص بكسلاتِ صورته (`rowWidths`).
 */
export function fitSuit(anchor: SuitAnchor, suitRows: Float32Array, personRows: Float32Array, lm: Landmarks): SuitTransform {
  const seed = placeSuit(anchor, lm);
  if (lm.shoulderY === null || !suitRows.length) return seed;
  const height = personRows.length;
  const head = Math.max(1, lm.chin - lm.top);
  // ما يظهر في صور المعاملات تحت الذقن: الرقبة وأعلى الكتفين — فيه تُقاس المطابقة.
  const y1 = Math.min(height - 1, Math.round(lm.chin + head * 0.8));
  const step = Math.max(1, Math.round(height / 600));
  const exposed = lm.neckWidth * 1.3;
  let best = { cost: Infinity, scale: seed.scale, y: seed.y };
  for (let ks = 0.6; ks <= 1.6001; ks += 0.025) {
    const scale = seed.scale * ks;
    if (anchor.neckWidth * scale < lm.neckWidth * 0.85) continue;
    for (let y0 = lm.chin; y0 <= lm.shoulderY + lm.neckWidth * 0.5; y0 += step) {
      let cost = 0;
      for (let y = lm.chin; y <= y1; y += step) {
        const p = personRows[y]!;
        if (y < y0) {
          // فوق القاط: الرقبة وحدها — وما اتّسع هناك كتفا الشخص بلباسه مكشوفَين، وهو أسوأ ما يُرى.
          cost += 4 * Math.max(0, p - exposed);
          continue;
        }
        const q = suitRows[Math.min(suitRows.length - 1, Math.round(anchor.cy + (y - y0) / scale))]! * scale;
        // تحت أعلى القاط يُقصّ الشخص، فالقاط الأضيق يُنحِل كتفيه؛ والأعرض قليلًا طبيعيّ في القاط.
        cost += p > q ? p - q : 0.15 * (q - p);
      }
      if (cost < best.cost) best = { cost, scale, y: y0 };
    }
  }
  return { x: lm.neckCenterX, y: best.y, scale: best.scale, angle: 0 };
}

/**
 * حدّ الشخص تحت القاط لكلّ عمودٍ من الصورة: آخر صفٍّ يبقى منه. في فتحة العنق الرقبة إلى أسفل
 * الفتحة، وفي غيرها إلى أعلى الياقة — وما دون ذلك يغطّيه القاط، أو يصير خلفيةً حول كتفيه.
 * ويُحسب من نقاط أعلى القاط مُدارةً بزاويته، فيتبعه إن مال. و`overlap` يُدخل الحدّ تحت القاط قليلًا
 * فلا يظهر بينهما خيط.
 */
export function neckLine(tops: Float32Array, anchor: SuitAnchor, at: SuitTransform, width: number, overlap = 4): Float32Array {
  const line = new Float32Array(width).fill(NaN);
  const cos = Math.cos((at.angle * Math.PI) / 180);
  const sin = Math.sin((at.angle * Math.PI) / 180);
  const half = anchor.neckWidth / 2;
  for (let c = 0; c < tops.length; c++) {
    const dx = c - anchor.cx;
    const dy = (Math.abs(dx) < half ? tops[c]! : anchor.cy) - anchor.cy;
    const X = at.x + (dx * cos - dy * sin) * at.scale;
    const Y = at.y + (dx * sin + dy * cos) * at.scale + overlap;
    const x = Math.round(X);
    if (x >= 0 && x < width && !(line[x]! <= Y)) line[x] = Y;
  }
  // الأعمدة بين النقاط (القاط مكبَّر) تُملأ بجوارها، وما خرج عن عرضه يمتدّ بطرفيه.
  let last = NaN;
  for (let x = 0; x < width; x++) {
    if (Number.isNaN(line[x]!)) line[x] = last;
    else last = line[x]!;
  }
  last = NaN;
  for (let x = width - 1; x >= 0; x--) {
    if (Number.isNaN(line[x]!)) line[x] = last;
    else last = line[x]!;
  }
  return line;
}

/** مضاعف الشفافية تحت القاط: ١ فوق الحدّ، ويتلاشى في `feather` صفوف حتى الحدّ. */
export const keepAbove = (line: Float32Array, x: number, y: number, feather: number): number =>
  Math.max(0, Math.min(1, (line[x]! - y) / feather));

/** الشخص مقصوصًا على حدّ القاط — كما يُرسم. */
export function underSuit(alpha: Uint8Array, width: number, height: number, line: Float32Array, feather = 4): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = Math.round(alpha[y * width + x]! * keepAbove(line, x, y, feather));
  return out;
}

// ── القصّ على دليل الرأس ────────────────────────────────────────────────

/**
 * قصٌّ يضع الرأس في دليل القالب: ارتفاعه (القمّة إلى الذقن) وسط المدى المطلوب، وقمّته حيث
 * يطلب. ويعود بالقصّ بصيغة `photoSheet` (تكبيرٌ ومركز) — فيُسحب بعدُ باليد كما كان.
 */
export function autoCrop(lm: Landmarks, natural: Size, frame: Size, guide: HeadGuide): Crop {
  const base = Math.max(frame.w / natural.w, frame.h / natural.h);
  const headPx = Math.max(1, lm.chin - lm.top);
  const ratio = (guide.min + guide.max) / 2;
  const want = headPx / ratio;
  const zoom = Math.max(1, Math.min(6, frame.h / (base * want)));
  const shown = frame.h / (base * zoom);
  const cy = lm.top - guide.top * shown + shown / 2;
  const crop = { zoom, x: lm.headCenterX / natural.w, y: cy / natural.h };
  const box = cropBox(frame, natural, crop);
  return { zoom, x: box.x, y: box.y };
}
