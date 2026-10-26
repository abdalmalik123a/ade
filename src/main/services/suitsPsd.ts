/**
 * القاط من Photoshop (S48، ر181، D204): ملفٌّ بطبقاتٍ كثيرة **كلّ طبقةٍ مفرّغةٍ ترسم قاطٌ** باسمها — دفعةً واحدة —
 * وبلا طبقاتٍ صالحة فالصورة المسطّحة إن كانت مفرّغة **قاطٌ واحد**. والقاط مقصوصٌ على حدّ ما يرسم (كـ`tools/psd-layers.mjs`
 * الذي كان يجهّز القاط من ملفّ المكتب). وتستعمله «استورد قاطًا» وقطع الحزمة المختومة (D205).
 *
 * «مفرّغةٌ» أي فيها شفّافٌ وفيها مرسوم: الخلفية البيضاء المعتمة وصورةٌ مستطيلة بلا شفافية ليستا قاطًا.
 */
import { parsePsdLayers } from './psdLayers';
import { drawable, layerPixels, toRgb } from './design/psdPixels';
import { readPsd } from './psd';

export type PsdSuit = { name: string; rgba: Uint8Array; width: number; height: number };

export const PSD_SUITS_MAX = 200;
/** ضلع القاط الأكبر — كحدّ `photos:addSuit`. */
const SIDE = 4000;
export const NO_PSD_CUTOUT = 'ملفّ Photoshop بلا قاطٍ مفرّغ — احفظه بخلفيةٍ شفّافة';

/** يقصّ RGBA على حدّ ما يرسم (شفافيةٌ فوق ٨)، ويقول أهو مفرّغ: شفّافٌ ١٪ فأكثر ومرسومٌ ١٪ فأكثر. */
function cutout(rgba: Uint8Array, w: number, h: number): { rgba: Uint8Array; width: number; height: number } | null {
  let clear = 0;
  let drawn = 0;
  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = rgba[(y * w + x) * 4 + 3]!;
      if (a < 16) clear++;
      if (a > 8) {
        drawn++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  const n = w * h;
  if (clear < n * 0.01 || drawn < n * 0.01 || right < left) return null;
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width > SIDE || height > SIDE) return null;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) out.set(rgba.subarray(((top + y) * w + left) * 4, ((top + y) * w + left + width) * 4), y * width * 4);
  return { rgba: out, width, height };
}

/** قاط ملفّ Photoshop: طبقاته المفرّغة باسمائها، وإلا صورته المسطّحة المفرّغة باسم الملفّ — وإلا رسالةٌ تقول ما يُصلحه. */
export function suitsFromPsd(bytes: Uint8Array, fileName: string): PsdSuit[] {
  const doc = parsePsdLayers(bytes);
  if (!doc) throw new Error('الملف ليس ملفّ Photoshop');
  const out: PsdSuit[] = [];
  for (const layer of doc.layers) {
    if (out.length >= PSD_SUITS_MAX) break;
    if (!drawable(layer) || layer.text || layer.clipping) continue;
    const px = layerPixels(bytes, doc, layer);
    if (!px) continue;
    const w = layer.rect.right - layer.rect.left;
    const h = layer.rect.bottom - layer.rect.top;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      toRgb(px.k, px.native, i * px.k, rgba, i * 4);
      rgba[i * 4 + 3] = px.alpha[i]!;
    }
    const cut = cutout(rgba, w, h);
    if (cut) out.push({ name: layer.name.trim().slice(0, 80) || fileName, ...cut });
  }
  if (out.length) return out;
  const flat = readPsd(bytes);
  const cut = flat?.rgba ? cutout(flat.rgba, flat.width, flat.height) : null;
  if (cut) return [{ name: fileName, ...cut }];
  throw new Error(NO_PSD_CUTOUT);
}
