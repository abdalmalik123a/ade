/**
 * فصل الشيء عن خلفيّته (DESIGNS.md ٢٫٣) — المنتج والكوب والشعار في التصاميم — بنموذج BiRefNet_lite-matting على الجهاز
 * وحده (`resources/models`)، بالمحرّك وجلساته نفسها التي للأشخاص (`portrait.ts`). والأشخاص في «الصور الشخصية» يبقون
 * لـMODNet: الدقّة فيهم واحدة، وهو أسرع سبع مرّات — فهذا لما لا يعرفه MODNet.
 *
 * وما بعد النموذج كالأشخاص: القناع يُكبَّر وتُشدّ حافّته (والمطابقة تجعل الشيء المسطّح اللون نصف شفّاف أحيانًا — فالشدّ
 * يعيده معتمًا)، وتُزال هالة الخلفية من ألوان الحافّة. والصورة لا تغادر هذه العملية.
 */
import { OBJECT_SIZE, objectInput } from '@shared/objectMask';
import { decontaminate, sharpenAlpha, upsampleAlpha } from '@shared/portraitMask';
import { loadOrt, modelSession, type Cutout } from './portrait';

/** قناع النموذج (٠..٢٥٥) بمقاس الصورة — قبل الشدّ. */
export async function objectMatte(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Uint8Array> {
  const s = await modelSession(modelPath, 'basic');
  const { Tensor } = await loadOrt();
  const input = new Tensor('float32', objectInput(pixels, width, height), [1, 3, OBJECT_SIZE, OBJECT_SIZE]);
  const out = await s.run({ [s.inputNames[0]!]: input });
  return upsampleAlpha(out[s.outputNames[0]!]!.data as Float32Array, OBJECT_SIZE, OBJECT_SIZE, width, height);
}

export async function objectCutout(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Cutout> {
  const t0 = Date.now();
  const alpha = sharpenAlpha(await objectMatte(modelPath, pixels, width, height));
  return { alpha, pixels: decontaminate(pixels, alpha, width, height), ms: Date.now() - t0 };
}
