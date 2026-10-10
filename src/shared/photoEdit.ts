/**
 * «حسّن الصورة» في التصاميم (DESIGNS.md ٢٫٢) — حسابٌ خالص على البكسلات (يُختبر بلا متصفّح):
 *
 * - **الهندسة**: ربع دورةٍ وقلبٌ أفقيّ، ثم **استقامةٌ** ±١٥° تُقصّ زواياها الفارغة وحدها (`straightenScale`: أكبر مستطيلٍ
 *   بنسبة الصورة داخلها بعد الميل)، ثم **قصٌّ** بنِسَبٍ من الإطار. والرسم نفسه في الواجهة (اللوحة تدوّر وتقصّ).
 * - **الضوء واللون**: تحسين الصور الشخصية نفسه (`portraitEnhance`: الإضاءة والتباين والظلال والدفء وضجيج اللون، والتلقائي)،
 *   ويزيد هنا **التشبّع** — يبقى البكسل بإضاءته ويقوى لونه أو يبهت — و**التنعيم**: متوسّطٌ يزن الجار بقرب لونه (ثنائيّ)، فالحبّة
 *   والضجيج يذوبان والحافّة (حرفٌ، طرفُ منتج) حادّةٌ كما هي. وهذا للتصاميم وحدها: صورة المعاملة لا تُنعَّم (لا «تجميل»).
 */
import { applyEnhance, NEUTRAL, type Enhance } from './portraitEnhance';

export type CropRect = { x: number; y: number; w: number; h: number };

export type PhotoEdit = {
  /** ربع دوراتٍ مع عقارب الساعة. */
  quarter: 0 | 1 | 2 | 3;
  flip: boolean;
  /** درجاتٌ −١٥..١٥: موجبٌ مع العقارب. */
  straighten: number;
  /** نِسَبٌ من الإطار بعد الاستقامة. */
  crop: CropRect;
  enhance: Enhance;
  /** −١..١. */
  saturation: number;
  /** ٠..١. */
  smooth: number;
};

export const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
export const NO_EDIT: PhotoEdit = { quarter: 0, flip: false, straighten: 0, crop: FULL, enhance: NEUTRAL, saturation: 0, smooth: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** مقاس الإطار بعد ربع الدورات. */
export const turned = (w: number, h: number, quarter: number) => (quarter % 2 ? { w: h, h: w } : { w, h });

/**
 * نسبة الإطار المستقيم من الصورة المائلة: أكبر مستطيلٍ بنسبتها نفسها داخلها بعد ميلها `deg` — فلا تظهر زاويةٌ فارغة.
 * المستطيل الداخليّ (k·w × k·h) بعد ردّه إلى ميل الصورة يحيط به (k·w·cos + k·h·sin) × (k·w·sin + k·h·cos) ويسعه w × h.
 */
export function straightenScale(w: number, h: number, deg: number): number {
  const a = (Math.abs(deg) * Math.PI) / 180;
  if (!a) return 1;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Math.min(w / (w * c + h * s), h / (w * s + h * c));
}

/** القصّ مقوَّمًا: داخل الإطار، وأصغره عُشره. */
export function normalizeCrop(c: CropRect): CropRect {
  const w = clamp(c.w, 0.1, 1);
  const h = clamp(c.h, 0.1, 1);
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
}

/** قصٌّ بنسبة عرضٍ إلى ارتفاع (`ratio`) في وسط الإطار، بأكبر ما يسع — وبلا نسبةٍ الإطار كلّه. */
export function cropForRatio(frameW: number, frameH: number, ratio: number | null): CropRect {
  if (!ratio) return FULL;
  const frame = frameW / frameH;
  return frame > ratio ? { x: (1 - ratio / frame) / 2, y: 0, w: ratio / frame, h: 1 } : { x: 0, y: (1 - frame / ratio) / 2, w: 1, h: frame / ratio };
}

/** التشبّع: كلّ بكسلٍ بإضاءته، ولونه أبعد عنها أو أقرب — والرماديّ رماديّ. */
export function saturate(pixels: Uint8ClampedArray, amount: number): Uint8ClampedArray {
  const k = 1 + clamp(amount, -1, 1);
  if (k === 1) return pixels;
  const out = new Uint8ClampedArray(pixels.length);
  for (let p = 0; p < pixels.length; p += 4) {
    const L = 0.299 * pixels[p]! + 0.587 * pixels[p + 1]! + 0.114 * pixels[p + 2]!;
    out[p] = L + (pixels[p]! - L) * k;
    out[p + 1] = L + (pixels[p + 1]! - L) * k;
    out[p + 2] = L + (pixels[p + 2]! - L) * k;
    out[p + 3] = pixels[p + 3]!;
  }
  return out;
}

/**
 * التنعيم: متوسّطٌ في جوارٍ ٥×٥ يزن كلّ جارٍ بقرب لونه من البكسل (مرشّحٌ ثنائيّ) — فالجار عبر حافّةٍ حادّة لا يُحسب، فتبقى
 * الحافّة، ويذوب الضجيج والحبّة على السطح الواحد. والقوّة سعة «القرب».
 */
export function smoothImage(pixels: Uint8ClampedArray, width: number, height: number, strength: number): Uint8ClampedArray {
  const s = clamp(strength, 0, 1);
  if (!s) return pixels;
  const range = 8 + 40 * s;
  const inv = 1 / (2 * range * range);
  const out = new Uint8ClampedArray(pixels.length);
  // أوزان المسافة ثابتة: ٥×٥ بانحرافٍ ١٫٥ بكسل.
  const spatial = new Float32Array(25);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) spatial[(dy + 2) * 5 + dx + 2] = Math.exp(-(dx * dx + dy * dy) / 4.5);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const r0 = pixels[p]!;
      const g0 = pixels[p + 1]!;
      const b0 = pixels[p + 2]!;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          const q = (yy * width + xx) * 4;
          const dr = pixels[q]! - r0;
          const dg = pixels[q + 1]! - g0;
          const db = pixels[q + 2]! - b0;
          const w = spatial[(dy + 2) * 5 + dx + 2]! * Math.exp(-(dr * dr + dg * dg + db * db) * inv);
          sr += pixels[q]! * w;
          sg += pixels[q + 1]! * w;
          sb += pixels[q + 2]! * w;
          sw += w;
        }
      }
      out[p] = sr / sw;
      out[p + 1] = sg / sw;
      out[p + 2] = sb / sw;
      out[p + 3] = pixels[p + 3]!;
    }
  }
  return out;
}

/** الضوء واللون معًا على بكسلات الإطار المقصوص — والأصل لا يُمسّ. */
export function applyColor(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, edit: Pick<PhotoEdit, 'enhance' | 'saturation' | 'smooth'>): Uint8ClampedArray {
  const toned = applyEnhance(pixels, width, height, edit.enhance);
  return smoothImage(saturate(toned, edit.saturation), width, height, edit.smooth);
}

/** أتغيّر شيءٌ عن الأصل؟ — فـ«استعمل» بلا تغييرٍ لا يحفظ صورةً جديدة. */
export function isEdited(e: PhotoEdit): boolean {
  const n = e.enhance;
  return (
    e.quarter !== 0 || e.flip || e.straighten !== 0 || e.crop.x !== 0 || e.crop.y !== 0 || e.crop.w !== 1 || e.crop.h !== 1 ||
    e.saturation !== 0 || e.smooth !== 0 || n.exposure !== 0 || n.contrast !== 0 || n.shadows !== 0 || n.warmth !== 0 || n.denoise !== 0 ||
    n.gains.some((g) => g !== 1)
  );
}
