/**
 * طبقات Photoshop — البكسلات: فكّ القنوات، والألوان بصيغة الملفّ، والمزج والتركيب (DESIGNS.md ٠٫٩).
 */
import { unzlibSync } from 'fflate';
import { unpackBits } from '../psd';
import { height, toBuffer, width, type Channel, type PsdDoc, type PsdLayer, type Rect } from './psdTypes';

// ── البكسلات ─────────────────────────────────────────────────────────

/** يفكّ قناةً واحدة: خامًا، أو PackBits، أو ZIP بتنبّؤٍ أو بدونه. */
export function decodeChannel(bytes: Uint8Array, channel: Channel, w: number, h: number): Uint8Array | null {
  const buf = toBuffer(bytes);
  if (w <= 0 || h <= 0 || channel.length < 2 || channel.offset + 2 > buf.length) return null;
  const compression = buf.readUInt16BE(channel.offset);
  const start = channel.offset + 2;
  const end = Math.min(channel.offset + channel.length, buf.length);
  const out = new Uint8Array(w * h);

  if (compression === 0) {
    out.set(buf.subarray(start, Math.min(start + w * h, end)));
  } else if (compression === 1) {
    let data = start + h * 2;
    for (let y = 0; y < h && start + y * 2 + 2 <= end; y++) {
      const length = buf.readUInt16BE(start + y * 2);
      if (data + length > end) break;
      unpackBits(buf, data, length, out, y * w);
      data += length;
    }
  } else if (compression === 2 || compression === 3) {
    try {
      const plain = unzlibSync(buf.subarray(start, end));
      out.set(plain.subarray(0, w * h));
    } catch {
      return null;
    }
    if (compression === 3) {
      for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) out[y * w + x] = (out[y * w + x]! + out[y * w + x - 1]!) & 255;
    }
  } else {
    return null;
  }
  return out;
}

/**
 * قنوات اللون بصيغة الملف نفسها: ٣ لـRGB، و٤ لـCMYK، وواحدةٌ للرماديّ.
 *
 * **والتركيب يجري فيها لا في RGB**: Photoshop يمزج حوافّ الحرف في CMYK حبرًا،
 * وتحويل CMYK إلى RGB ضربٌ (C × K) لا جمع — فمن مزج بعد التحويل أخرج حوافّ
 * الحرف الداكن على الأبيض رماديّةً، وبقي شبحُ الكلمة بعد محوها.
 */
export function colorChannels(doc: { colorMode: number }): number {
  return doc.colorMode === 4 ? 4 : doc.colorMode === 1 ? 1 : doc.colorMode === 3 ? 3 : 0;
}

/**
 * قيمٌ بصيغة الملف إلى RGB. وCMYK مخزَّنٌ **مقلوبًا** (٢٥٥ ورقٌ بلا حبر)،
 * فالمخزَّن «ضوءٌ باقٍ» يُضرب: R = C × K / ٢٥٥.
 */
export function toRgb(k: number, v: ArrayLike<number>, at: number, out: Uint8Array, o: number): void {
  if (k === 3) {
    out[o] = v[at]!;
    out[o + 1] = v[at + 1]!;
    out[o + 2] = v[at + 2]!;
  } else if (k === 4) {
    const kk = v[at + 3]!;
    out[o] = Math.round((v[at]! * kk) / 255);
    out[o + 1] = Math.round((v[at + 1]! * kk) / 255);
    out[o + 2] = Math.round((v[at + 2]! * kk) / 255);
  } else {
    out[o] = out[o + 1] = out[o + 2] = v[at]!;
  }
}

/** بكسلات الطبقة بصيغة الملف (`k` قنواتٍ متتالية لكل بكسل) وشفافيتُها بقناعها. */
export type Pixels = { rect: Rect; k: number; native: Uint8Array; alpha: Uint8Array };

/** بكسلات الطبقة على مستطيلها: ألوانها بصيغة الملف، وشفافيةٌ فيها قناعُها. */
export function layerPixels(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): Pixels | null {
  const w = width(layer.rect);
  const h = height(layer.rect);
  const k = colorChannels(doc);
  if (w <= 0 || h <= 0 || doc.depth !== 8 || !k) return null;
  const plane = (id: number) => {
    const channel = layer.channels.find((c) => c.id === id);
    return channel ? decodeChannel(bytes, channel, w, h) : null;
  };
  const n = w * h;
  const native = new Uint8Array(n * k);
  for (let j = 0; j < k; j++) {
    // القناة الغائبة ورقٌ أبيض في CMYK (بلا حبر)، وسوادٌ في RGB.
    const p = plane(j);
    const missing = k === 4 ? 255 : 0;
    for (let i = 0; i < n; i++) native[i * k + j] = p ? p[i]! : missing;
  }

  const alpha = plane(-1) ?? new Uint8Array(n).fill(255);
  if (layer.mask && layer.channels.some((c) => c.id === -2)) {
    const m = layer.mask;
    const mw = width(m);
    const values = decodeChannel(bytes, layer.channels.find((c) => c.id === -2)!, mw, height(m));
    if (values) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = layer.rect.left + x - m.left;
          const dy = layer.rect.top + y - m.top;
          const v = dx >= 0 && dy >= 0 && dx < mw && dy < height(m) ? values[dy * mw + dx]! : m.defaultColor;
          alpha[y * w + x] = Math.round((alpha[y * w + x]! * v) / 255);
        }
      }
    }
  }
  return { rect: layer.rect, k, native, alpha };
}

/** يحسب مزج اللون بطريقة الطبقة — وما لا يُعرف منها يُرسم عاديًّا. */
function blendChannel(mode: string, b: number, s: number): number {
  switch (mode) {
    case 'mul ':
      return b * s;
    case 'scrn':
      return b + s - b * s;
    case 'over':
      return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'dark':
      return Math.min(b, s);
    case 'lite':
      return Math.max(b, s);
    case 'lddg':
      return Math.min(1, b + s);
    default:
      return s;
  }
}

export const drawable = (layer: PsdLayer) =>
  layer.divider === 0 && !layer.hidden && layer.opacity > 0 && width(layer.rect) > 0 && height(layer.rect) > 0;

/**
 * يركّب الطبقات المرئية على مستطيلٍ من الورقة — إلا ما يُستثنى.
 *
 * والمزج على صيغة W3C بألوانٍ مضروبةٍ في شفافيتها. والطبقة المقصوصة
 * (`clipping`) تُرسم داخل شفافية قاعدتها، فإن غابت قاعدتها غابت معها.
 * **والمؤثّرات (الظلّ والإطار) لا تُرسم** — ولذلك يُقاس الناتج قبل أن يُؤخذ.
 */
export function compositeRect(
  bytes: Uint8Array,
  doc: PsdDoc,
  area: Rect,
  skip: Set<number>,
  /** إن وُجد: لا يُحسب إلا ما عُلِّم فيه — بإحداثيات الورقة. */
  only?: Uint8Array
): Float32Array {
  const aw = width(area);
  // لكل بكسل قنواتُ الملف مضروبةً في الشفافية، ثم الشفافية.
  const k = colorChannels(doc);
  const stride = k + 1;
  const out = new Float32Array(aw * height(area) * stride);
  // القاعدة تُقرأ عند الحاجة وحدها: أكثر القواعد لا يُقصّ بها شيء.
  let baseLayer: PsdLayer | null = null;
  let basePixels: Pixels | null | undefined;

  for (const layer of doc.layers) {
    if (layer.divider !== 0) {
      baseLayer = null;
      continue;
    }
    const clipped = layer.clipping;
    if (!drawable(layer) || skip.has(layer.index) || (clipped && !baseLayer)) {
      if (!clipped) baseLayer = null;
      continue;
    }
    if (!clipped) {
      baseLayer = layer;
      basePixels = undefined;
    }
    const top = Math.max(area.top, layer.rect.top);
    const bottom = Math.min(area.bottom, layer.rect.bottom);
    const left = Math.max(area.left, layer.rect.left);
    const right = Math.min(area.right, layer.rect.right);
    if (top >= bottom || left >= right) continue;
    const px = clipped || basePixels === undefined ? layerPixels(bytes, doc, layer) : basePixels;
    if (!clipped) basePixels = px;
    if (!px) continue;

    let clip: Pixels | null = null;
    if (clipped) {
      if (basePixels === undefined) basePixels = layerPixels(bytes, doc, baseLayer!);
      clip = basePixels;
      if (!clip) continue;
    }
    const lw = width(layer.rect);
    const cw = clip ? width(clip.rect) : 0;
    const ch = clip ? height(clip.rect) : 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (only && !only[y * doc.width + x]) continue;
        const li = (y - layer.rect.top) * lw + (x - layer.rect.left);
        let a = (px.alpha[li]! / 255) * layer.opacity;
        if (clip) {
          const cx = x - clip.rect.left;
          const cy = y - clip.rect.top;
          a *= cx >= 0 && cy >= 0 && cx < cw && cy < ch ? clip.alpha[cy * cw + cx]! / 255 : 0;
        }
        if (a <= 0) continue;
        const o = ((y - area.top) * aw + (x - area.left)) * stride;
        const ab = out[o + k]!;
        for (let c = 0; c < k; c++) {
          const s = px.native[li * k + c]! / 255;
          const cb = out[o + c]!;
          const bc = ab > 0 ? cb / ab : 0;
          out[o + c] = a * s * (1 - ab) + cb * (1 - a) + a * ab * blendChannel(layer.blend, bc, s);
        }
        out[o + k] = a + ab * (1 - a);
      }
    }
  }
  return out;
}
