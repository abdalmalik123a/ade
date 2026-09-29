/**
 * تحسين صورة المعاملة — محافظٌ لا يغيّر الهوية.
 *
 * كلّ عمليةٍ هنا **لونٌ وإضاءةٌ لكلّ بكسلٍ في مكانه**: توازن الأبيض، والتعريض، والتباين،
 * ورفع الظلال — دوالّ رتيبةٌ على الإضاءة (ما كان أفتح يبقى أفتح)، فلا تتحرّك حافّةٌ ولا
 * يتغيّر شكل. **وتخفيف الضجيج على اللون وحده** (Cb وCr): الإضاءة — وفيها تفاصيل الوجه —
 * لا تُنعَّم أبدًا. ولا تنحيف ولا تكبير ولا تنعيم بشرة ولا «تجميل».
 *
 * والتلقائي يقيس ولا يبالغ: قوّته مقيّدة، والموظف يرى المنزلقات ويعدّلها أو يعيدها.
 */

export type Enhance = {
  /** كسب القنوات من توازن الأبيض التلقائي — [أحمر، أخضر، أزرق]. */
  gains: [number, number, number];
  /** −١..١: أدفأ أو أبرد (يُضاف إلى التلقائي). */
  warmth: number;
  /** −١..١: التعريض. */
  exposure: number;
  /** −١..١: التباين حول الوسط. */
  contrast: number;
  /** ٠..١: رفع الظلال. */
  shadows: number;
  /** ٠..١: تخفيف ضجيج اللون. */
  denoise: number;
};

export const NEUTRAL: Enhance = { gains: [1, 1, 1], warmth: 0, exposure: 0, contrast: 0, shadows: 0, denoise: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** منحنى الإضاءة (٠..١ ← ٠..١) — رتيبٌ صاعدٌ في كلّ القيم المسموحة. */
export function toneCurve(L: number, e: Pick<Enhance, 'exposure' | 'contrast' | 'shadows'>): number {
  let v = L * (1 + clamp(e.exposure, -1, 1) * 0.5);
  // الظلال: إضافةٌ أكبرها في الأعتم وتتلاشى في الفاتح — ومشتقّتها موجبة (١ − ٠٫٨/٣ على الأقلّ).
  v = v + clamp(e.shadows, 0, 1) * 0.8 * v * (1 - v) * (1 - v) * (v < 1 ? 1 : 0);
  v = 0.5 + (v - 0.5) * (1 + clamp(e.contrast, -1, 1) * 0.5);
  return clamp(v, 0, 1);
}

/** يطبّق التحسين على نسخةٍ — والأصل لا يُمسّ (فيُعاد الضبط من الصورة نفسها). */
export function applyEnhance(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, e: Enhance): Uint8ClampedArray {
  const n = width * height;
  const out = new Uint8ClampedArray(n * 4);
  const warm = clamp(e.warmth, -1, 1) * 0.08;
  const gr = e.gains[0] * (1 + warm);
  const gg = e.gains[1];
  const gb = e.gains[2] * (1 - warm);
  // جدولٌ للمنحنى: ٤٠٩٦ درجة إضاءة تكفي بلا تدرّجٍ ظاهر.
  const LUT = new Float32Array(4097);
  for (let i = 0; i <= 4096; i++) LUT[i] = toneCurve(i / 4096, e);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = clamp((pixels[p]! / 255) * gr, 0, 1);
    const g = clamp((pixels[p + 1]! / 255) * gg, 0, 1);
    const b = clamp((pixels[p + 2]! / 255) * gb, 0, 1);
    const L = lum(r, g, b);
    const L2 = LUT[Math.round(L * 4096)]!;
    // الإضاءة الجديدة بنسبتها — فيبقى اللون لونه، والحافّة مكانها.
    const k = L > 1e-4 ? L2 / L : 1;
    out[p] = Math.round(clamp(L > 1e-4 ? r * k : L2, 0, 1) * 255);
    out[p + 1] = Math.round(clamp(L > 1e-4 ? g * k : L2, 0, 1) * 255);
    out[p + 2] = Math.round(clamp(L > 1e-4 ? b * k : L2, 0, 1) * 255);
    out[p + 3] = pixels[p + 3]!;
  }
  return e.denoise > 0 ? denoiseChroma(out, width, height, e.denoise) : out;
}

/**
 * تخفيف ضجيج اللون: Cb وCr يُنعَّمان بمتوسّط جوارٍ صغير، والإضاءة Y كما هي — فالنقاط
 * الملوّنة من كاميرا الهاتف في الغرفة المعتمة تختفي، ولا تُمسّ حافّةٌ ولا تفصيل.
 */
export function denoiseChroma(pixels: Uint8ClampedArray, width: number, height: number, strength: number): Uint8ClampedArray {
  const n = width * height;
  const Y = new Float32Array(n);
  const Cb = new Float32Array(n);
  const Cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = pixels[i * 4]!;
    const g = pixels[i * 4 + 1]!;
    const b = pixels[i * 4 + 2]!;
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  const r = Math.max(1, Math.round(1 + clamp(strength, 0, 1) * 2));
  const blur = (src: Float32Array) => {
    // ممرّان: أفقيٌّ ثم رأسيّ.
    const tmp = new Float32Array(n);
    const dst = new Float32Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        let c = 0;
        for (let d = -r; d <= r; d++) {
          const xx = x + d;
          if (xx < 0 || xx >= width) continue;
          s += src[y * width + xx]!;
          c++;
        }
        tmp[y * width + x] = s / c;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        let c = 0;
        for (let d = -r; d <= r; d++) {
          const yy = y + d;
          if (yy < 0 || yy >= height) continue;
          s += tmp[yy * width + x]!;
          c++;
        }
        dst[y * width + x] = s / c;
      }
    }
    return dst;
  };
  const bCb = blur(Cb);
  const bCr = blur(Cr);
  const t = clamp(strength, 0, 1);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const cb = Cb[i]! * (1 - t) + bCb[i]! * t;
    const cr = Cr[i]! * (1 - t) + bCr[i]! * t;
    const y = Y[i]!;
    out[i * 4] = y + 1.402 * cr;
    out[i * 4 + 1] = y - 0.344136 * cb - 0.714136 * cr;
    out[i * 4 + 2] = y + 1.772 * cb;
    out[i * 4 + 3] = pixels[i * 4 + 3]!;
  }
  return out;
}

/**
 * التحسين التلقائي — يقيس ولا يبالغ:
 * - **الأبيض** من البكسلات المحايدة (جدارٌ، ياقة، قميص — تشبّعٌ دون ٢٨٪): متوسّطها يُعاد رماديًّا، بسبعين
 *   بالمئة من الفرق وبكسبٍ لا يتجاوز ±١٥٪ — فلا تنقلب البشرة لونًا آخر.
 * - **التعريض** من الثلث الأعلى من الشخص (الوجه غالبًا) إلى وسطٍ مريح، بحدّ.
 * - **التباين** إن ضاق مدى الإضاءة، **والظلال** إن كثر المعتم، **والضجيج** قليلًا دائمًا.
 */
export function autoEnhance(pixels: Uint8Array | Uint8ClampedArray, alpha: Uint8Array | null, width: number, height: number): Enhance {
  const n = width * height;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < n; i += 3) {
    const r = pixels[i * 4]! / 255;
    const g = pixels[i * 4 + 1]! / 255;
    const b = pixels[i * 4 + 2]! / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const L = lum(r, g, b);
    // «محايد»: تشبّعٌ دون ٢٨٪ — فجدارٌ تحت ضوءٍ دافئٍ يُعدّ، والبشرة (٣٠٪ فأكثر) لا.
    if (L > 0.15 && L < 0.95 && mx - mn < 0.28 * mx) {
      sr += r;
      sg += g;
      sb += b;
      count++;
    }
  }
  let gains: [number, number, number] = [1, 1, 1];
  if (count > n / 3 / 100) {
    const mean = (sr + sg + sb) / 3;
    const soft = (m: number) => 1 + (clamp(mean / m, 0.85, 1.15) - 1) * 0.7;
    gains = [soft(sr), soft(sg), soft(sb)];
  }

  // الإضاءة في الشخص (أو الصورة كلّها بلا قناع) — وفي ثلثه الأعلى للتعريض.
  const people: number[] = [];
  const face: number[] = [];
  let firstRow = -1;
  let lastRow = -1;
  if (alpha) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 4) {
        if (alpha[y * width + x]! > 200) {
          if (firstRow < 0) firstRow = y;
          lastRow = y;
          break;
        }
      }
    }
  }
  const faceEnd = firstRow >= 0 ? firstRow + (lastRow - firstRow) / 3 : height;
  // عيّنةٌ لا تتجاوز ربع مليون بكسل — فالصورة الكبيرة لا تُبطئ القياس.
  const stride = Math.max(2, Math.round(Math.sqrt(n / 250_000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = y * width + x;
      if (alpha && alpha[i]! <= 200) continue;
      const L = lum((pixels[i * 4]! / 255) * gains[0], (pixels[i * 4 + 1]! / 255) * gains[1], (pixels[i * 4 + 2]! / 255) * gains[2]);
      people.push(L);
      if (y <= faceEnd) face.push(L);
    }
  }
  if (!people.length) return { ...NEUTRAL, gains };
  // تُرتَّب مرّةً واحدة، وتُقرأ منها النِّسَب.
  const all = Float32Array.from(people).sort();
  const pct = (s: Float32Array, q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  const faceMid = pct(face.length ? Float32Array.from(face).sort() : all, 0.5);
  const exposure = clamp((clamp(0.56 / Math.max(0.05, faceMid), 0.85, 1.45) - 1) / 0.5, -0.3, 0.9);
  const spread = pct(all, 0.98) - pct(all, 0.02);
  const contrast = spread < 0.6 ? 0.2 : 0;
  const shadows = pct(all, 0.1) < 0.12 ? 0.3 : 0;
  return { gains, warmth: 0, exposure, contrast, shadows, denoise: 0.3 };
}
