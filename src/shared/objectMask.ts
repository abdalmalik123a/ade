/**
 * مدخل نموذج الأشياء (DESIGNS.md ٢٫٣، BiRefNet_lite-matting): الصورة مربّعًا ٥١٢ × ٥١٢ — تُمطّ ولا تُقصّ، فالشيء كلّه
 * يُرى — وقيمها بمتوسّط ImageNet وانحرافه كما تدرّب. والتصغير بالمتوسّط نفسه الذي لـMODNet (`modelInput`)، ثم تُحوَّل
 * القيم من [−١، ١] إلى مقياس ImageNet. وما بعد النموذج كالأشخاص: `upsampleAlpha` ثم `sharpenAlpha` ثم `decontaminate`.
 */
import { modelInput } from './portraitMask';

export const OBJECT_SIZE = 512;
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

export function objectInput(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, order: 'rgba' | 'bgra' = 'rgba'): Float32Array {
  const out = modelInput(pixels, width, height, OBJECT_SIZE, OBJECT_SIZE, order);
  const plane = OBJECT_SIZE * OBJECT_SIZE;
  for (let c = 0; c < 3; c++) {
    for (let i = c * plane; i < (c + 1) * plane; i++) out[i] = (out[i]! * 0.5 + 0.5 - MEAN[c]!) / STD[c]!;
  }
  return out;
}
