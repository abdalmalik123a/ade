/**
 * صورة سطور MRZ قبل قراءتها (تعميق الموجود ٨) — حسابٌ خالص على البكسلات.
 *
 * - **الأبيض والأسود محليًّا**: عتبةٌ من جوار كلّ بكسل للإيجاد (`binarizeLocal`)، ولكلّ رمزٍ
 *   عتبته (Otsu) للقراءة — فالبطاقة الرماديّة لا تصير كتلةً والطرف الباهت لا يُمحى.
 * - **«<» من شكله**: القارئ يراه C أو L أو K. والفرق في يسار الرمز: لتلك ساقٌ أو قوسٌ يملأ
 *   أكثر ارتفاعه، و«<» نقطةٌ واحدة في وسطه.
 */

/** عتبة Otsu لتدرّجٍ رماديّ (٠..٢٥٥). */
export function otsu(gray: Uint8Array | number[], from = 0, to = gray.length): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = from; i < to; i++) hist[gray[i]!]!++;
  const total = to - from;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** رماديٌّ من بكسلات BGRA (كما يعطيها محرّك الصور) أو RGBA. */
export function grayOf(pixels: Uint8Array, width: number, height: number, order: 'bgra' | 'rgba' = 'bgra'): Uint8Array {
  const out = new Uint8Array(width * height);
  const [r, b] = order === 'bgra' ? [2, 0] : [0, 2];
  for (let i = 0; i < out.length; i++) {
    const p = i * 4;
    out[i] = Math.round(0.299 * pixels[p + r]! + 0.587 * pixels[p + 1]! + 0.114 * pixels[p + b]!);
  }
  return out;
}

/**
 * حبرٌ بعتبةٍ محليّة (Bradley): البكسل حبرٌ إن كان أغمق من متوسّط ما حوله بنسبة. البطاقة
 * الملوّنة في نسخةٍ مصوّرة تصير رماديّةً كلّها — فعتبة الصفحة تجعلها كتلة حبرٍ واحدة (هكذا
 * خرجت في نسخةٍ حقيقية)، والمحليّة ترى الرموز على خلفيّتها.
 */
export function binarizeLocal(gray: Uint8Array, width: number, height: number, radius: number, t = 0.15): Uint8Array {
  const sum = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]!;
      sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1]! + row;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const s = sum[y1 * (width + 1) + x1]! - sum[y0 * (width + 1) + x1]! - sum[y1 * (width + 1) + x0]! + sum[y0 * (width + 1) + x0]!;
      out[y * width + x] = gray[y * width + x]! * (x1 - x0) * (y1 - y0) < s * (1 - t) ? 1 : 0;
    }
  }
  return out;
}

/**
 * كم من ارتفاع الرمز فيه حبرٌ في خُمسه الأيسر (٠..١): «<» قليلٌ (نقطة الرأس وحدها)، وC وL وK
 * كثير (قوسٌ أو ساق).
 */
export function leftInk(bin: Uint8Array, width: number, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const x0 = Math.max(0, Math.floor(box.x0));
  const x1 = Math.max(x0 + 1, Math.floor(box.x0 + (box.x1 - box.x0) * 0.22));
  const y0 = Math.max(0, Math.floor(box.y0));
  const y1 = Math.max(y0 + 1, Math.ceil(box.y1));
  let rows = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (bin[y * width + x]) {
        rows++;
        break;
      }
    }
  }
  return rows / (y1 - y0);
}

/** أهو «<» — لرمزٍ رآه القارئ C أو L أو K أو «<». */
export const looksLikeChevron = (inkLeft: number) => inkLeft < 0.45;

/**
 * أهو «<» من شكله وحده، بلا قارئ: رأسه في وسط يساره وحده، وطرفا ذراعيه أعلى يمينه وأسفله
 * ولا شيء بينهما. فـK ساقٌ يملأ يساره، وT و7 يسارهما في أعلاه، وX يساره طرفان.
 */
export function chevronShape(bin: Uint8Array, width: number, box: Box): boolean {
  const x0 = Math.max(0, Math.round(box.x0));
  const y0 = Math.max(0, Math.round(box.y0));
  const x1 = Math.max(x0 + 2, Math.round(box.x1));
  const y1 = Math.max(y0 + 2, Math.round(box.y1));
  const w = x1 - x0;
  const h = y1 - y0;
  const inkIn = (y: number, from: number, to: number) => {
    for (let x = from; x < to; x++) if (bin[y * width + x]) return true;
    return false;
  };
  const leftEnd = x0 + Math.max(1, Math.round(w * 0.22));
  const rightStart = x1 - Math.max(1, Math.round(w * 0.25));
  let leftRows = 0;
  let top = false;
  let bottom = false;
  for (let y = y0; y < y1; y++) {
    const r = (y - y0 + 0.5) / h;
    if (inkIn(y, x0, leftEnd)) {
      if (r < 0.25 || r > 0.75) return false;
      leftRows++;
    }
    if (inkIn(y, rightStart, x1)) {
      if (r < 0.3) top = true;
      else if (r > 0.7) bottom = true;
      else if (r > 0.4 && r < 0.6) return false;
    }
  }
  return leftRows > 0 && leftRows / h <= 0.45 && top && bottom;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** مقطعٌ من صورةٍ رمادية. */
export function cropGray(gray: Uint8Array, width: number, height: number, box: Box): { gray: Uint8Array; width: number; height: number } {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(width, Math.ceil(box.x1));
  const y1 = Math.min(height, Math.ceil(box.y1));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) out.set(gray.subarray((y0 + y) * width + x0, (y0 + y) * width + x0 + w), y * w);
  return { gray: out, width: w, height: h };
}

/**
 * تكبيرٌ ثنائيّ الخطّ لصورةٍ رمادية، وتصغيرٌ بمتوسّط ما يغطّيه كلّ بكسل — فالنسخة المصوّرة
 * حبرها نقاط، وأخذُ بكسلٍ واحدٍ منها يجعل الحروف مخطَّطة.
 */
export function resizeGray(gray: Uint8Array, width: number, height: number, scale: number): { gray: Uint8Array; width: number; height: number } {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(w * h);
  if (scale < 1) {
    const sum = new Float64Array(w * h);
    const count = new Float64Array(w * h);
    const fx = w / width;
    const fy = h / height;
    for (let y = 0; y < height; y++) {
      const row = Math.min(h - 1, Math.floor(y * fy)) * w;
      for (let x = 0; x < width; x++) {
        const i = row + Math.min(w - 1, Math.floor(x * fx));
        sum[i] += gray[y * width + x]!;
        count[i]++;
      }
    }
    for (let i = 0; i < out.length; i++) out[i] = count[i] ? Math.round(sum[i]! / count[i]!) : 255;
    return { gray: out, width: w, height: h };
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, (y + 0.5) / scale - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = Math.max(0, sy - y0);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, (x + 0.5) / scale - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = Math.max(0, sx - x0);
      const top = gray[y0 * width + x0]! * (1 - fx) + gray[y0 * width + x1]! * fx;
      const bottom = gray[y1 * width + x0]! * (1 - fx) + gray[y1 * width + x1]! * fx;
      out[y * w + x] = Math.round(top * (1 - fy) + bottom * fy);
    }
  }
  return { gray: out, width: w, height: h };
}

/**
 * تنعيمٌ بمتوسّط مربّعٍ حول كلّ بكسل. نسخةٌ مصوّرة حقيقية للبطاقة جاءت حروفها رماديّةً
 * يقطعها تخطيطٌ أفقيّ دقيق — فقطّعتها العتبة شرائح، والتنعيم يصلها.
 */
export function blurGray(gray: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius < 1) return gray;
  const sum = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]!;
      sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1]! + row;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const s = sum[y1 * (width + 1) + x1]! - sum[y0 * (width + 1) + x1]! - sum[y1 * (width + 1) + x0]! + sum[y0 * (width + 1) + x0]!;
      out[y * width + x] = Math.round(s / ((x1 - x0) * (y1 - y0)));
    }
  }
  return out;
}

/** نصف دورة: البطاقة ممسوحةً مقلوبة. */
export function rotate180(gray: Uint8Array): Uint8Array {
  return Uint8Array.from(gray).reverse();
}

/** رماديٌّ أو حبرٌ ← RGBA ليُكتب PNG ويقرأه القارئ. */
export function toRgba(values: Uint8Array, binary = false): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const v = binary ? (values[i] ? 0 : 255) : values[i]!;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}
