/**
 * محرك تسوية وإزالة ميلان صور المستمسكات (Perspective De-skew & Flattening).
 *
 * عند تصوير الهويات والوثائق بالهاتف المحمول، تظهر بزوايا مائلة ومنظور مشوه (Keystone/Trapezoid).
 * يقوم هذا المحرك بحساب التحويل الإسقاطي (Projective Homography Transformation)
 * لتحويل الأركان الأربعة المختارة إلى مستطيل مستوٍ ومسطح تمامًا بنسبة أبعاد الهوية
 * القياسية (ID-1 أو A7 أو A4) بدقة بكسل فائقة وفلاتر تصفية وتباين لتبدو كأنها
 * سُحبت بماكنة سكانر احترافية.
 */

export type Point = { x: number; y: number };

export type Quad = {
  tl: Point; // أعلى يسار
  tr: Point; // أعلى يمين
  br: Point; // أسفل يمين
  bl: Point; // أسفل يسار
};

export type AspectPreset = {
  key: string;
  label: string;
  aspect: number; // width / height
};

export const DESKEW_ASPECTS: AspectPreset[] = [
  { key: 'id1', label: 'البطاقة الوطنية / إجازة السوق (85.6 × 54 ملم)', aspect: 85.6 / 54.0 },
  { key: 'a7', label: 'بطاقة السكن / هوية الأحوال (105 × 74 ملم)', aspect: 105.0 / 74.0 },
  { key: 'a6', label: 'شهادة الجنسية القديمة (148 × 105 ملم)', aspect: 148.0 / 105.0 },
  { key: 'a4_portrait', label: 'A4 عمودي (وثيقة رسمية)', aspect: 210.0 / 297.0 },
  { key: 'a4_landscape', label: 'A4 أفقي (شهادة)', aspect: 297.0 / 210.0 }
];

/**
 * حساب المعاملات الرياضية لتحويل المربع القياسي [0,1]x[0,1] إلى الشكل الرباعي
 * (Unit Square to Quad Mapping)
 */
export function computeProjectiveCoefficients(quad: Quad): {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
} {
  const { tl, tr, br, bl } = quad;

  const dx1 = tr.x - br.x + bl.x - tl.x;
  const dy1 = tr.y - br.y + bl.y - tl.y;

  // إذا كان الشكل متوازي أضلاع تقريبًا (Affine)
  if (Math.abs(dx1) < 1e-7 && Math.abs(dy1) < 1e-7) {
    return {
      a: tr.x - tl.x,
      b: bl.x - tl.x,
      c: tl.x,
      d: tr.y - tl.y,
      e: bl.y - tl.y,
      f: tl.y,
      g: 0,
      h: 0
    };
  }

  const A = br.x - tr.x;
  const B = br.x - bl.x;
  const C = br.y - tr.y;
  const D = br.y - bl.y;

  const det = A * D - B * C;
  if (Math.abs(det) < 1e-9) {
    return {
      a: tr.x - tl.x,
      b: bl.x - tl.x,
      c: tl.x,
      d: tr.y - tl.y,
      e: bl.y - tl.y,
      f: tl.y,
      g: 0,
      h: 0
    };
  }

  const g = (dx1 * D - B * dy1) / det;
  const h = (A * dy1 - dx1 * C) / det;

  return {
    a: tr.x - tl.x + g * tr.x,
    b: bl.x - tl.x + h * bl.x,
    c: tl.x,
    d: tr.y - tl.y + g * tr.y,
    e: bl.y - tl.y + h * bl.y,
    f: tl.y,
    g,
    h
  };
}

/**
 * تحويل نقطة من المستطيل الناتج (u, v) في المجال [0, 1] إلى موضعها في الصورة الأصلية (x, y)
 */
export function mapUnitToQuad(
  u: number,
  v: number,
  coeff: ReturnType<typeof computeProjectiveCoefficients>
): Point {
  const denom = coeff.g * u + coeff.h * v + 1;
  const x = (coeff.a * u + coeff.b * v + coeff.c) / denom;
  const y = (coeff.d * u + coeff.e * v + coeff.f) / denom;
  return { x, y };
}

/**
 * استخراج شكل رباعي افتراضي في وسط الصورة بنسبة هامش محددة
 */
export function defaultQuadForSize(width: number, height: number, inset = 0.08): Quad {
  const x0 = width * inset;
  const y0 = height * inset;
  const x1 = width * (1 - inset);
  const y1 = height * (1 - inset);

  return {
    tl: { x: x0, y: y0 },
    tr: { x: x1, y: y0 },
    br: { x: x1, y: y1 },
    bl: { x: x0, y: y1 }
  };
}

export type PixelData = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

/**
 * خوارزمية فرد وتسوية الصورة عبر بيكسلات المصفوفة
 */
export function warpPerspective(
  srcData: PixelData,
  quad: Quad,
  targetWidth: number,
  targetHeight: number,
  options?: {
    grayscale?: boolean;
    highContrast?: boolean;
    brightness?: number; // default 1
    contrast?: number; // default 1
  }
): PixelData {
  const { width: srcW, height: srcH, data: srcPixels } = srcData;
  const coeff = computeProjectiveCoefficients(quad);

  // مصفوفة البكسلات للمخرج
  const outPixels = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  const bright = options?.brightness ?? 1;
  const cont = options?.contrast ?? 1;
  const isGray = Boolean(options?.grayscale || options?.highContrast);
  const isHighContrast = Boolean(options?.highContrast);

  for (let y = 0; y < targetHeight; y++) {
    const v = y / targetHeight;
    for (let x = 0; x < targetWidth; x++) {
      const u = x / targetWidth;
      const pt = mapUnitToQuad(u, v, coeff);

      // استيفاء ثنائي خطي (Bilinear Interpolation) لجودة ونعومة حواف فائقة
      const sx = pt.x;
      const sy = pt.y;

      let r = 255;
      let g = 255;
      let b = 255;
      let a = 255;

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = sx - x0;
        const fy = sy - y0;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = (y0 * srcW + x1) * 4;
        const i01 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;

        for (let c = 0; c < 3; c++) {
          const top = (1 - fx) * srcPixels[i00 + c]! + fx * srcPixels[i10 + c]!;
          const bot = (1 - fx) * srcPixels[i01 + c]! + fx * srcPixels[i11 + c]!;
          const val = (1 - fy) * top + fy * bot;
          if (c === 0) r = val;
          else if (c === 1) g = val;
          else b = val;
        }
        a = 255;
      }

      // تطبيق السطوع والتباين
      if (bright !== 1 || cont !== 1) {
        r = ((r - 128) * cont + 128) * bright;
        g = ((g - 128) * cont + 128) * bright;
        b = ((b - 128) * cont + 128) * bright;
      }

      // تدرج رمادي أو أبيض وأسود استنساخي
      if (isGray) {
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (isHighContrast) {
          // فلتر استنساخ الوثائق: تبييض الخلفية وتغميق النصوص
          gray = (gray - 128) * 1.5 + 135;
        }
        r = g = b = Math.max(0, Math.min(255, gray));
      } else {
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
      }

      const outIdx = (y * targetWidth + x) * 4;
      outPixels[outIdx] = r;
      outPixels[outIdx + 1] = g;
      outPixels[outIdx + 2] = b;
      outPixels[outIdx + 3] = a;
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data: outPixels
  };
}

// ── كشف الأركان آليًّا ───────────────────────────────────────────────

/**
 * يكشف أركان البطاقة أو الورقة في الصورة — أو `null` إن لم تتميّز عن خلفيتها.
 *
 * لونُ الخلفية من حافّة الصورة (الوسيط: فالبطاقة قد تلامس الحافّة من جهة)،
 * وكلّ بكسلٍ يُقاس بعده عن ذلك اللون، والحدّ الفاصل بطريقة Otsu لا برقمٍ
 * ثابت — فالهوية على غطاء الماسح الأبيض كالهوية على طاولةٍ داكنة. ثم أكبرُ
 * كتلةٍ متّصلة، وأركانها أطرافها: أصغرُ x+y وأكبره، وأصغرُ x−y وأكبره —
 * وهي أركان المستطيل ما دام ميلانه دون ٤٥ درجة.
 *
 * والحساب على صورةٍ مصغّرة (٤٨٠ بكسلًا) ثم يُكبَّر: الأركان لا تحتاج دقّةً
 * أعلى، والموظف يضبطها بالفأرة إن شاء.
 */
export function detectQuad(src: PixelData, maxSide = 480): Quad | null {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const sy = Math.min(src.height - 1, Math.floor(y / scale));
      const s = (sy * src.width + sx) * 4;
      const d = (y * w + x) * 3;
      rgb[d] = src.data[s]!;
      rgb[d + 1] = src.data[s + 1]!;
      rgb[d + 2] = src.data[s + 2]!;
    }
  }

  // لون الخلفية: وسيطُ حافّة الصورة لكل قناة.
  const border: number[][] = [[], [], []];
  const take = (x: number, y: number) => {
    for (let c = 0; c < 3; c++) border[c]!.push(rgb[(y * w + x) * 3 + c]!);
  };
  for (let x = 0; x < w; x++) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    take(0, y);
    take(w - 1, y);
  }
  const bg = border.map((list) => list.sort((a, z) => a - z)[Math.floor(list.length / 2)]!);

  const total = w * h;
  const dist = new Float32Array(total);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < total; i++) {
    const d = Math.hypot(rgb[i * 3]! - bg[0]!, rgb[i * 3 + 1]! - bg[1]!, rgb[i * 3 + 2]! - bg[2]!);
    dist[i] = d;
    hist[Math.min(255, Math.round(d / 1.74))]!++;
  }
  // Otsu: الحدّ الذي يفصل الكتلتين بأكبر تباينٍ بينهما.
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  const cut = Math.max(18, threshold * 1.74);
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) mask[i] = dist[i]! > cut ? 1 : 0;

  // أكبر كتلةٍ متّصلة (رباعيًّا) — لا فتاتُ الغبار ولا ظلُّ الغطاء.
  const label = new Int32Array(total);
  const stack = new Int32Array(total);
  let bestLabel = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < total; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    let size = 0;
    while (top) {
      const p = stack[--top]!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const around = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of around) {
        if (q >= 0 && mask[q] && !label[q]) {
          label[q] = next;
          stack[top++] = q;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  if (bestSize < total * 0.04) return null;

  let tl = { v: Infinity, x: 0, y: 0 };
  let br = { v: -Infinity, x: 0, y: 0 };
  let tr = { v: -Infinity, x: 0, y: 0 };
  let bl = { v: Infinity, x: 0, y: 0 };
  for (let p = 0; p < total; p++) {
    if (label[p] !== bestLabel) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < tl.v) tl = { v: x + y, x, y };
    if (x + y > br.v) br = { v: x + y, x, y };
    if (x - y > tr.v) tr = { v: x - y, x, y };
    if (x - y < bl.v) bl = { v: x - y, x, y };
  }
  const quad: Quad = {
    tl: { x: tl.x / scale, y: tl.y / scale },
    tr: { x: (tr.x + 1) / scale, y: tr.y / scale },
    br: { x: (br.x + 1) / scale, y: (br.y + 1) / scale },
    bl: { x: bl.x / scale, y: (bl.y + 1) / scale }
  };
  // رباعيٌّ أصغر كثيرًا من كتلته ليس بطاقة (كتلةٌ ملتوية لا مستطيل).
  const area =
    Math.abs(
      quad.tl.x * quad.tr.y -
        quad.tr.x * quad.tl.y +
        (quad.tr.x * quad.br.y - quad.br.x * quad.tr.y) +
        (quad.br.x * quad.bl.y - quad.bl.x * quad.br.y) +
        (quad.bl.x * quad.tl.y - quad.tl.x * quad.bl.y)
    ) / 2;
  return area >= (bestSize / (scale * scale)) * 0.6 ? quad : null;
}

// ── مسحٌ نظيف: الظلّ والإضاءة غير المتساوية ──────────────────────────

/**
 * يسوّي الإضاءة: صورة الهاتف فيها ظلُّ اليد ووهجُ المصباح، فتخرج الورقة
 * رماديّةً في ناحيةٍ وبيضاء في أخرى.
 *
 * فالورق يُقدَّر بأسطع ما في كل خليّةٍ من شبكةٍ خشنة (فالحبر أغمق من الورق
 * دائمًا)، وتُنعَّم الشبكة، ثم يُقسم كلّ بكسلٍ على ورقه — فيصير الورق أبيض
 * في كل مكان ويبقى الحبر حبرًا. و`ink` يشدّ الحبر إلى السواد كالماسح.
 */
export function flattenLight(px: PixelData, options: { gray?: boolean; ink?: number } = {}): PixelData {
  const { width: w, height: h, data } = px;
  const cell = Math.max(8, Math.round(Math.max(w, h) / 40));
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      // الورقُ النسبةُ المئوية ٩٠ من السطوع — لا الأقصى: بكسلٌ لامعٌ واحد يكذب.
      const values: number[] = [];
      for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 2) {
        for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 2) {
          const i = (y * w + x) * 4;
          values.push(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
        }
      }
      values.sort((a, z) => a - z);
      grid[gy * gw + gx] = Math.max(40, values[Math.floor(values.length * 0.9)] ?? 255);
    }
  }
  // تنعيمٌ مرّتين بمربّع ٣×٣ — فلا تظهر حدود الخلايا.
  for (let pass = 0; pass < 2; pass++) {
    const copy = grid.slice();
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = gx + dx;
            const y = gy + dy;
            if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
            s += copy[y * gw + x]!;
            n++;
          }
        }
        grid[gy * gw + gx] = s / n;
      }
    }
  }
  const paperAt = (x: number, y: number) => {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5));
    const fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = grid[y0 * gw + x0]! * (1 - tx) + grid[y0 * gw + x1]! * tx;
    const bottom = grid[y1 * gw + x0]! * (1 - tx) + grid[y1 * gw + x1]! * tx;
    return top * (1 - ty) + bottom * ty;
  };
  const ink = options.ink ?? 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const k = 255 / paperAt(x, y);
      let r = data[i]! * k;
      let g = data[i + 1]! * k;
      let b = data[i + 2]! * k;
      if (options.gray) r = g = b = 0.299 * r + 0.587 * g + 0.114 * b;
      // شدُّ الحبر: ما دون الأبيض يُدفع نحو الأسود بقوّة `ink`.
      if (ink !== 1) {
        r = 255 - Math.min(255, (255 - Math.min(255, r)) * ink);
        g = 255 - Math.min(255, (255 - Math.min(255, g)) * ink);
        b = 255 - Math.min(255, (255 - Math.min(255, b)) * ink);
      }
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}
