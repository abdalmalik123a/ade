/**
 * طبقات Photoshop — المحو: ما صار عنصرًا يُعاد من الطبقات التي تحته، ويُقاس صدقه على حلقةٍ حوله (DESIGNS.md ٠٫٩).
 */
import { height, width, type PsdDoc, type PsdLayer, type Rect } from './psdTypes';
import { colorChannels, compositeRect, drawable, layerPixels, toRgb, type Pixels } from './psdPixels';

// ── المحو: المنطقة، والحلقة، والملء ─────────────────────────────────

/** قناعٌ على مستطيله لا على الورقة كلّها — فثلاثون نصًّا في A4 لا تأكل الذاكرة. */
type Region = { rect: Rect; on: Uint8Array };

const within = (r: Region, x: number, y: number) =>
  x >= r.rect.left && y >= r.rect.top && x < r.rect.right && y < r.rect.bottom
    ? r.on[(y - r.rect.top) * width(r.rect) + (x - r.rect.left)] === 1
    : false;

/** يوسّع المنطقة بمربّعٍ نصفُ قطره `r` — تمريرتان أفقيّة ثم رأسيّة، داخل الورقة. */
function dilate(region: Region, r: number, W: number, H: number): Region {
  const rect: Rect = {
    top: Math.max(0, region.rect.top - r),
    left: Math.max(0, region.rect.left - r),
    bottom: Math.min(H, region.rect.bottom + r),
    right: Math.min(W, region.rect.right + r)
  };
  const w = width(rect);
  const h = height(rect);
  const src = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (within(region, rect.left + x, rect.top + y)) src[y * w + x] = 1;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0, run = -Infinity; x < w; x++) {
      if (src[y * w + x]) run = x;
      if (x - run <= r) tmp[y * w + x] = 1;
    }
    for (let x = w - 1, run = Infinity; x >= 0; x--) {
      if (src[y * w + x]) run = x;
      if (run - x <= r) tmp[y * w + x] = 1;
    }
  }
  const on = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0, run = -Infinity; y < h; y++) {
      if (tmp[y * w + x]) run = y;
      if (y - run <= r) on[y * w + x] = 1;
    }
    for (let y = h - 1, run = Infinity; y >= 0; y--) {
      if (tmp[y * w + x]) run = y;
      if (run - y <= r) on[y * w + x] = 1;
    }
  }
  return { rect, on };
}

/** قاعدةُ الطبقة المقصوصة: أوّل ما تحتها غيرُ مقصوص، في مجموعتها. */
export function clipBase(doc: PsdDoc, layer: PsdLayer): PsdLayer | null {
  if (!layer.clipping) return null;
  for (let i = layer.index - 1; i >= 0; i--) {
    const below = doc.layers[i]!;
    if (below.divider !== 0) return null;
    if (!below.clipping) return below;
  }
  return null;
}

/** موضعُ الطبقة على الورقة: ما كان فيه بكسلٌ منها — داخل قاعدتها إن قُصّت. */
function layerRegion(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): Region | null {
  const rect: Rect = {
    top: Math.max(0, layer.rect.top),
    left: Math.max(0, layer.rect.left),
    bottom: Math.min(doc.height, layer.rect.bottom),
    right: Math.min(doc.width, layer.rect.right)
  };
  if (width(rect) <= 0 || height(rect) <= 0) return null;
  const px = layerPixels(bytes, doc, layer);
  const baseLayer = clipBase(doc, layer);
  const base = baseLayer ? layerPixels(bytes, doc, baseLayer) : null;
  const w = width(rect);
  const lw = width(layer.rect);
  const on = new Uint8Array(w * height(rect));
  for (let y = rect.top; y < rect.bottom; y++) {
    for (let x = rect.left; x < rect.right; x++) {
      let hit = px ? px.alpha[(y - layer.rect.top) * lw + (x - layer.rect.left)]! > 8 : true;
      if (hit && base) {
        const bx = x - base.rect.left;
        const by = y - base.rect.top;
        const bw = width(base.rect);
        hit = bx >= 0 && by >= 0 && bx < bw && by < height(base.rect) && base.alpha[by * bw + bx]! > 8;
      }
      if (hit) on[(y - rect.top) * w + (x - rect.left)] = 1;
    }
  }
  return { rect, on };
}

/**
 * يستعيد ما تحت حوافّ الحرف من الصورة نفسها.
 *
 * البكسل في الصورة المسطَّحة مزيجٌ: C = a·T + (1 − a)·B، والحرف (T) وشفافيته
 * (a) معلومان من طبقته — فالخلفية B = (C − a·T) / (1 − a). وهذا صادقٌ ولو كان
 * تحته نقشٌ لا نرسمه. وما غطّاه الحرف تمامًا (a قريبةٌ من ١) لا يُستعاد، فيُعلَّم
 * مجهولًا يُملأ من جيرانه.
 */
function unblend(
  rgba: Uint8Array,
  planes: Uint8Array[],
  W: number,
  H: number,
  px: Pixels,
  opacity: number,
  unknown: Uint8Array
): void {
  const lw = width(px.rect);
  const k = px.k;
  const under = new Uint8Array(k);
  for (let y = Math.max(0, px.rect.top); y < Math.min(H, px.rect.bottom); y++) {
    for (let x = Math.max(0, px.rect.left); x < Math.min(W, px.rect.right); x++) {
      const i = (y - px.rect.top) * lw + (x - px.rect.left);
      const a = (px.alpha[i]! / 255) * opacity;
      if (a <= 0.01) continue;
      const d = y * W + x;
      if (a >= 0.9) {
        unknown[d] = 1;
        continue;
      }
      // بصيغة الملف: فالمزج خطّيٌّ هناك لا في RGB.
      for (let c = 0; c < k; c++) {
        const b = (planes[c]![d]! - a * px.native[i * k + c]!) / (1 - a);
        under[c] = Math.max(0, Math.min(255, Math.round(b)));
      }
      toRgb(k, under, 0, rgba, d * 4);
    }
  }
}

/**
 * يملأ المجهول قشرةً قشرة: كلّ بكسلٍ مجهول له جارٌ معلوم يأخذ متوسّط جيرانه
 * المعلومين، ثم التي تليها. وجرّةُ الحرف رفيعة، فتُملأ في خطواتٍ قليلة من لون ما
 * يلاصقها — لا رقعًا مربّعة من هرمٍ مصغَّر.
 */
function peel(rgba: Uint8Array, W: number, H: number, unknown: Uint8Array, box: Rect): void {
  let pending: number[] = [];
  for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) if (unknown[y * W + x]) pending.push(y * W + x);
  while (pending.length) {
    const next: number[] = [];
    const fills: [number, number, number, number][] = [];
    for (const d of pending) {
      const x = d % W;
      const y = (d - x) / W;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nd = ny * W + nx;
          if (unknown[nd]) continue;
          r += rgba[nd * 4]!;
          g += rgba[nd * 4 + 1]!;
          b += rgba[nd * 4 + 2]!;
          n++;
        }
      }
      if (n) fills.push([d, r / n, g / n, b / n]);
      else next.push(d);
    }
    if (!fills.length) {
      // جزيرةٌ لا جار لها معلوم: ورقٌ أبيض.
      for (const d of next) fills.push([d, 255, 255, 255]);
      next.length = 0;
    }
    for (const [d, r, g, b] of fills) {
      rgba[d * 4] = Math.round(r);
      rgba[d * 4 + 1] = Math.round(g);
      rgba[d * 4 + 2] = Math.round(b);
      rgba[d * 4 + 3] = 255;
      unknown[d] = 0;
    }
    pending = next;
  }
}

/**
 * الفرق المسموح بين تركيبنا وصورة Photoshop على الحلقة — متوسّطًا من ٢٥٥.
 *
 * قيس على قوالب حقيقية: ما صدق تركيبُه بقي دون ٢٫٧، وما تحته نقشٌ لا نرسمه
 * بدأ من ٣٫٤ — و١٠ كانت تقبل رقعةً حمراء مسطّحةً مكان نقشٍ مضلَّع فيظهر
 * الاسم شبحًا.
 */
const RING_TOLERANCE = 3;

/** ودونه فالتركيب صادقٌ تمامًا (تقريب الأعداد وحده) — يُقدَّم على كلّ استعادة. */
const EXACT = 0.8;

export type PsdBackground = {
  rgba: Uint8Array;
  /** مواضع أُعيدت من الطبقات تحتها. */
  rebuiltAreas: number;
  /** ومواضع مُلئت ممّا حولها لأنّ تحتها ما لا نرسمه. */
  filledAreas: number;
  /** الصورة المسطَّحة كانت بيضاء فرُكّبت الورقة كلّها من طبقاتها. */
  recomposed: boolean;
};

/** يسطّح ما ركّبناه على ورقٍ أبيض، في مواضعه من صورة الورقة. */
function flatten(f: Float32Array, k: number, area: Rect, W: number, into: Uint8Array, only?: Uint8Array): void {
  const aw = width(area);
  const px = new Uint8Array(k);
  for (let y = area.top; y < area.bottom; y++) {
    for (let x = area.left; x < area.right; x++) {
      const d = y * W + x;
      if (only && !only[d]) continue;
      const o = ((y - area.top) * aw + (x - area.left)) * (k + 1);
      const a = f[o + k]!;
      // الورق الأبيض ٢٥٥ في الصيغ كلّها: ضوءٌ كامل في RGB، ولا حبر في CMYK.
      for (let c = 0; c < k; c++) px[c] = Math.round(Math.min(1, f[o + c]! + (1 - a)) * 255);
      toRgb(k, px, 0, into, d * 4);
      into[d * 4 + 3] = 255;
    }
  }
}

/** صورةٌ بلونٍ واحد في كل مكان — كما يكتبها Photoshop بلا «توافقٍ أقصى». */
function isBlank(rgba: Uint8Array): boolean {
  const step = 4 * 97;
  for (let i = step; i < rgba.length; i += step) {
    if (rgba[i] !== rgba[0] || rgba[i + 1] !== rgba[1] || rgba[i + 2] !== rgba[2]) return false;
  }
  return true;
}

/**
 * يمحو من الصورة المسطَّحة مواضعَ الطبقات المستثناة.
 *
 * لكلّ طبقةٍ: موضعُها موسَّعًا ببكسلين أو ثلاثة (حوافّ الحروف الناعمة)، ثم
 * حلقةٌ حوله تُقارَن فيها صورتنا بصورة Photoshop. فإن اتّفقتا أُخذ تركيبُنا
 * للموضع كما هو. وإلا فتحته ما لا نرسمه (نقشٌ أو ظلٌّ من مؤثّرات Photoshop):
 * فيُستعاد ما تحت حوافّ الحرف حسابًا (`unblend`) ويُملأ جوفه من جيرانه.
 *
 * وملفٌّ حُفظ بلا «توافقٍ أقصى» صورتُه المسطَّحة بيضاء كلّها: فتُركَّب الورقة
 * من طبقاتها كاملةً — وإلا فتح المكتبُ ورقةً بيضاء وحقولًا عائمة.
 */
export function eraseLayers(
  bytes: Uint8Array,
  doc: PsdDoc,
  composite: Uint8Array | null,
  /** قنوات الصورة المسطَّحة بصيغة الملف — لاستعادة ما تحت حوافّ الحروف. */
  planes: Uint8Array[] | null,
  exclude: number[],
  dpi: number | null
): PsdBackground | null {
  const W = doc.width;
  const H = doc.height;
  const k = colorChannels(doc);
  const skip = new Set(exclude);

  if (!composite || isBlank(composite)) {
    if (!doc.layers.some(drawable)) return null;
    const full: Rect = { top: 0, left: 0, bottom: H, right: W };
    const rgba = new Uint8Array(W * H * 4);
    flatten(compositeRect(bytes, doc, full, skip), k, full, W, rgba);
    return { rgba, rebuiltAreas: skip.size, filledAreas: 0, recomposed: true };
  }

  const rgba = new Uint8Array(composite);
  const grow = Math.max(2, Math.round((dpi ?? 300) / 120));
  const erased = [...skip]
    .map((index) => doc.layers[index])
    .filter((l): l is PsdLayer => !!l && drawable(l))
    .flatMap((layer) => {
      const region = layerRegion(bytes, doc, layer);
      return region ? [{ layer, region: dilate(region, grow, W, H) }] : [];
    });
  if (!erased.length) return { rgba, rebuiltAreas: 0, filledAreas: 0, recomposed: false };

  // المواضع كلّها، وما يُحسب منها ومن حلقاتها — بإحداثيات الورقة.
  const inside = new Uint8Array(W * H);
  const needed = new Uint8Array(W * H);
  const rings = erased.map(({ region }) => dilate(region, grow + 1, W, H));
  const box: Rect = { top: H, left: W, bottom: 0, right: 0 };
  erased.forEach(({ region }, n) => {
    const ring = rings[n]!;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        if (!within(ring, x, y)) continue;
        needed[y * W + x] = 1;
        if (within(region, x, y)) inside[y * W + x] = 1;
      }
    }
    box.top = Math.min(box.top, ring.rect.top);
    box.left = Math.min(box.left, ring.rect.left);
    box.bottom = Math.max(box.bottom, ring.rect.bottom);
    box.right = Math.max(box.right, ring.rect.right);
  });

  const ours = new Uint8Array(W * H * 4);
  flatten(compositeRect(bytes, doc, box, skip, needed), k, box, W, ours, needed);

  // الحكم لكلّ موضعٍ على حلقته، ثم التطبيق — فلا يقرأ موضعٌ ما كتبه غيره.
  // ويُحسب فرقُ الدرجة أولًا ويُطرح: تركيبنا قد يخالف Photoshop بدرجةٍ واحدة
  // في كلّ مكان (طبقةُ تعديلٍ لا نرسمها)، فتظهر مواضع النصوص رقعًا أفتح على
  // خلفيةٍ فاتحة. وما بقي بعد الطرح هو الحكم.
  const judged = erased.map((_, n) => {
    const ring = rings[n]!;
    const sum = [0, 0, 0];
    let count = 0;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        const d = y * W + x;
        if (!within(ring, x, y) || inside[d]) continue;
        for (let c = 0; c < 3; c++) sum[c] += composite[d * 4 + c]! - ours[d * 4 + c]!;
        count++;
      }
    }
    const shift = sum.map((s) => (count ? s / count : 0)) as [number, number, number];
    let residual = 0;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        const d = y * W + x;
        if (!within(ring, x, y) || inside[d]) continue;
        for (let c = 0; c < 3; c++) residual += Math.abs(composite[d * 4 + c]! - ours[d * 4 + c]! - shift[c]!);
      }
    }
    const usable = count > 0 && shift.every((s) => Math.abs(s) <= 40);
    return { shift, residual: usable ? residual / (count * 3) : Infinity };
  });

  const unknown = new Uint8Array(W * H);
  let rebuiltAreas = 0;
  let filledAreas = 0;
  erased.forEach(({ layer, region }, n) => {
    const { shift, residual } = judged[n]!;
    const rebuild = () => {
      for (let y = region.rect.top; y < region.rect.bottom; y++) {
        for (let x = region.rect.left; x < region.rect.right; x++) {
          if (!within(region, x, y)) continue;
          const d = y * W + x;
          for (let c = 0; c < 3; c++) rgba[d * 4 + c] = Math.max(0, Math.min(255, Math.round(ours[d * 4 + c]! + shift[c]!)));
        }
      }
      rebuiltAreas++;
    };
    // تركيبٌ صادقٌ تمامًا يُؤخذ كما هو.
    if (residual <= EXACT) return rebuild();
    // والنصّ بعده يُستعاد من الصورة نفسها: صادقٌ فوق أيّ نقش، ما دام لونُ حرفه
    // في الصورة لونَ طبقته — لا لونًا يصبغه مؤثّر («تراكب لون»).
    const px = layer.text && !layer.clipping ? layerPixels(bytes, doc, layer) : null;
    if (px && planes?.length === k && trueColored(px, composite, W, H, layer.opacity)) {
      unblend(rgba, planes, W, H, px, layer.opacity, unknown);
      filledAreas++;
      return;
    }
    if (residual <= RING_TOLERANCE) return rebuild();
    // وما سوى ذلك يُملأ موضعه كلّه من حوله.
    for (let y = region.rect.top; y < region.rect.bottom; y++) {
      for (let x = region.rect.left; x < region.rect.right; x++) if (within(region, x, y)) unknown[y * W + x] = 1;
    }
    filledAreas++;
  });
  if (filledAreas) peel(rgba, W, H, unknown, box);
  return { rgba, rebuiltAreas, filledAreas, recomposed: false };
}

/** أيطابق لونُ الحرف المصمت في الصورة لونَ طبقته؟ */
function trueColored(px: Pixels, composite: Uint8Array, W: number, H: number, opacity: number): boolean {
  const lw = width(px.rect);
  const rgb = new Uint8Array(3);
  let diff = 0;
  let count = 0;
  for (let y = Math.max(0, px.rect.top); y < Math.min(H, px.rect.bottom); y++) {
    for (let x = Math.max(0, px.rect.left); x < Math.min(W, px.rect.right); x++) {
      const i = (y - px.rect.top) * lw + (x - px.rect.left);
      if ((px.alpha[i]! / 255) * opacity < 0.97) continue;
      const d = y * W + x;
      toRgb(px.k, px.native, i * px.k, rgb, 0);
      for (let c = 0; c < 3; c++) diff += Math.abs(composite[d * 4 + c]! - rgb[c]!);
      count += 3;
    }
  }
  return count > 0 && diff / count <= 12;
}
