/**
 * تحضير صورة قاطٍ يستوردها المكتب (S39، PH-4) — نقلٌ لـ`tools/prepare-suits.py` شرطًا شرطًا، حسابٌ خالص على البكسلات
 * (يُختبر بلا متصفّح، ويجري في الواجهة بعد أن يفكّ Chromium الصيغة: PNG أو JPG أو WebP أو BMP).
 *
 * - **ما فيه شفافية** (WebP أو PNG): شفافيّته كما هي (`load` في الأداة).
 * - **وما على خلفيةٍ بيضاء** (`white_matte`): الأبيض المتّصل بحافّة الصورة خلفيةٌ شفّافة — ومنه فتحة العنق — وحافّته ناعمةٌ بكسلًا،
 *   ويُنزع منها بياضها فلا تظهر هالةٌ بيضاء. وما ليس حوله أبيضٌ يكفي (ربع حافّة الصورة) ليس قاطًا على أبيض: `null`.
 * - **ثم** (`prepare`): ما لا يتّصل بأسفل القاط (جسمه) يُمحى، وثقوب القماش المغلقة تُملأ، ويُقصّ إلى الصدر، وعرضه ٩٠٠ على الأكثر.
 *
 * والناتج يُخزَّن PNG شفّافًا فيُركَّب بـ`suitAnchor` كما يُركَّب غيره.
 */

export type SuitImage = { rgba: Uint8ClampedArray; width: number; height: number };

const MAX_WIDTH = 900;
/** أقلّ نصيبٍ من حافّة الصورة يكون خلفيةً بيضاء — وإلا فليست قاطًا على أبيض (صورةٌ معتمة أو خلفيةٌ ملوّنة). */
const MIN_WHITE_BORDER = 0.25;

/** ما يتّصل بالبذرة داخل القناع (اتّصالٌ رباعيّ) — كـ`flood` في الأداة، بطابورٍ لا بتمدّدٍ متكرّر. */
export function flood(mask: Uint8Array, seed: Uint8Array, width: number, height: number): Uint8Array {
  const region = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let tail = 0;
  for (let i = 0; i < mask.length; i++)
    if (seed[i] && mask[i]) {
      region[i] = 1;
      queue[tail++] = i;
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]!;
    const x = i % width;
    const y = (i - x) / width;
    const visit = (j: number) => {
      if (mask[j] && !region[j]) {
        region[j] = 1;
        queue[tail++] = j;
      }
    };
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (y > 0) visit(i - width);
    if (y < height - 1) visit(i + width);
  }
  return region;
}

/** حافّة الصورة: الصفّ الأوّل والأخير والعمودان. */
function borderOf(width: number, height: number): Uint8Array {
  const b = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) b[x] = b[(height - 1) * width + x] = 1;
  for (let y = 0; y < height; y++) b[y * width] = b[y * width + width - 1] = 1;
  return b;
}

/** تآكلٌ بمربّع ٣×٣ (`MinFilter(3)`): الأدنى حول كلّ بكسل — والحافّة تأخذ ما داخل الصورة وحده. */
function minFilter3(m: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let v = 255;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx;
          const Y = y + dy;
          if (X >= 0 && X < width && Y >= 0 && Y < height) v = Math.min(v, m[Y * width + X]!);
        }
      out[y * width + x] = v;
    }
  return out;
}

/** تمويهٌ غاوسيّ (`GaussianBlur(0.8)`): نواةٌ منفصلة بانحراف ٠٫٨ ونصف قطر ٢، والحافّة تمتدّ بطرفها. */
function gaussian(m: Uint8Array, width: number, height: number, sigma = 0.8): Uint8Array {
  const r = 2;
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const w = k.map((v) => v / sum);
  const tmp = new Float32Array(m.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let d = -r; d <= r; d++) v += m[y * width + Math.min(width - 1, Math.max(0, x + d))]! * w[d + r]!;
      tmp[y * width + x] = v;
    }
  const out = new Uint8Array(m.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let d = -r; d <= r; d++) v += tmp[Math.min(height - 1, Math.max(0, y + d)) * width + x]! * w[d + r]!;
      out[y * width + x] = Math.round(v);
    }
  return out;
}

/**
 * الأبيض المتّصل بحافّة الصورة خلفية (`white_matte`) — والحافّة ناعمةٌ بكسلًا، ويُنزع منها بياضها:
 * الملاحظ = α·القماش + (١−α)·أبيض، فالقماش = (الملاحظ − (١−α)·٢٥٥) / α. و`null` إن قلّ الأبيض على الحافّة.
 */
function whiteMatte(rgba: Uint8ClampedArray, width: number, height: number): { rgb: Uint8ClampedArray; alpha: Uint8Array } | null {
  const n = width * height;
  const nearWhite = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const mn = Math.min(r, g, b);
    if (mn >= 228 && Math.max(r, g, b) - mn <= 22) nearWhite[i] = 1;
  }
  const border = borderOf(width, height);
  const background = flood(nearWhite, border, width, height);
  let edge = 0;
  let white = 0;
  for (let i = 0; i < n; i++)
    if (border[i]) {
      edge++;
      if (background[i]) white++;
    }
  if (white < edge * MIN_WHITE_BORDER) return null;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = background[i] ? 0 : 255;
  const alpha = gaussian(minFilter3(m, width, height), width, height);
  const rgb = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const a = alpha[i]! / 255;
    for (let ch = 0; ch < 3; ch++) {
      const v = rgba[i * 4 + ch]!;
      rgb[i * 4 + ch] = a > 0.05 ? (v - (1 - a) * 255) / Math.max(a, 0.05) : v;
    }
  }
  return { rgb, alpha };
}

/** تصغيرٌ بمتوسّط المساحة مضروبًا في الشفافية (فلا تسودّ الحافّة) — بدل LANCZOS في الأداة. */
function shrinkTo(src: SuitImage, width: number): SuitImage {
  const height = Math.max(1, Math.round((src.height * width) / src.width));
  const out = new Uint8ClampedArray(width * height * 4);
  const kx = src.width / width;
  const ky = src.height / height;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * kx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * kx));
      const y0 = Math.floor(y * ky);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ky));
      let a = 0;
      const c = [0, 0, 0];
      let n = 0;
      for (let Y = y0; Y < y1; Y++)
        for (let X = x0; X < x1; X++) {
          const i = (Y * src.width + X) * 4;
          const w = src.rgba[i + 3]!;
          a += w;
          for (let ch = 0; ch < 3; ch++) c[ch] += src.rgba[i + ch]! * w;
          n++;
        }
      const o = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) out[o + ch] = a ? c[ch]! / a : 0;
      out[o + 3] = a / n;
    }
  return { rgba: out, width, height };
}

/** صورة القاط جاهزةً للتركيب: شفّافة الخلفية والعنق ومقصوصةً إلى الصدر — أو `null` إن لم تكن قاطًا على أبيض ولا شفّافًا. */
export function prepareSuit(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): SuitImage | null {
  const n = width * height;
  if (!(n > 0) || rgba.length < n * 4) return null;
  const px = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  let transparent = false;
  for (let i = 0; i < n && !transparent; i++) if (px[i * 4 + 3]! < 255) transparent = true;
  let rgb: Uint8ClampedArray;
  let alpha: Uint8Array;
  if (transparent) {
    rgb = px;
    alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) alpha[i] = px[i * 4 + 3]!;
  } else {
    const m = whiteMatte(px, width, height);
    if (!m) return null;
    ({ rgb, alpha } = m);
  }

  // ١. البقع الشاردة: يبقى ما اتّصل بأسفل القاط (جسمه).
  const opaque = new Uint8Array(n);
  let bottom = -1;
  for (let i = 0; i < n; i++)
    if (alpha[i]! >= 128) {
      opaque[i] = 1;
      bottom = Math.floor(i / width);
    }
  if (bottom < 0) return null;
  const seed = new Uint8Array(n);
  seed.fill(1, bottom * width, (bottom + 1) * width);
  const body = flood(opaque, seed, width, height);
  const any = new Uint8Array(n);
  for (let i = 0; i < n; i++) any[i] = alpha[i]! > 0 ? 1 : 0;
  const kept = flood(any, body, width, height);
  for (let i = 0; i < n; i++) if (!kept[i]) alpha[i] = 0;

  // ٢. ثقوب القماش: الشفّاف الذي لا يتّصل بحافّة الصورة يُملأ.
  const clear = new Uint8Array(n);
  for (let i = 0; i < n; i++) clear[i] = alpha[i]! < 128 ? 1 : 0;
  const outside = flood(clear, borderOf(width, height), width, height);
  for (let i = 0; i < n; i++) if (clear[i] && !outside[i]) alpha[i] = 255;

  // ٣. الإطار: من أعلى القاط إلى ما تحت الكتفين بعرضهما — لا يدان ولا حزام.
  let yMin = height;
  let yMax = -1;
  let xMin = width;
  let xMax = -1;
  let faint = height;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x]!;
      if (a > 0 && y < faint) faint = y;
      if (a < 128) continue;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
    }
  if (yMax < 0) return null;
  // من أوّل ما يُرى — ولا يُبدأ من غبشٍ خافتٍ بعيدٍ فوق القاط.
  const top = Math.max(faint, yMin - 6);
  const upper = top + (yMax - top) * 0.35;
  let ul = width;
  let ur = -1;
  for (let y = yMin; y < upper && y <= yMax; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x]! >= 128) {
        if (x < ul) ul = x;
        if (x > ur) ur = x;
      }
  const shoulders = ur - ul + 1;
  const y1 = Math.min(height, Math.floor(top + shoulders * 1.05), yMax + 1);
  const w = xMax + 1 - xMin;
  const h = y1 - top;
  if (w <= 0 || h <= 0) return null;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (top + y) * width + xMin + x;
      const o = (y * w + x) * 4;
      const a = alpha[i]!;
      // وما تحت الشفّاف يُصفَّر.
      if (a > 0) for (let ch = 0; ch < 3; ch++) out[o + ch] = rgb[i * 4 + ch]!;
      out[o + 3] = a;
    }
  const img = { rgba: out, width: w, height: h };
  return w > MAX_WIDTH ? shrinkTo(img, MAX_WIDTH) : img;
}
