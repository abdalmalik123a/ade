/**
 * فصل الشخص عن خلفيّته — نموذج MODNet على الجهاز وحده (`resources/models`)، بلا شبكة.
 *
 * يُحمَّل النموذج مرّةً عند أوّل صورة ويبقى، ويُقرأ مساره من الخارج (العملية الرئيسة تعرف
 * مكانه في المثبّت) — فيُختبر هنا بلا Electron بالنموذج الحقيقي. وما بعد النموذج حسابٌ خالص
 * في `@shared/portraitMask`: القناع يُكبَّر ويُشدّ إلى حوافّ الصورة، وتُزال هالة الخلفية.
 *
 * وصورة الزبون لا تغادر هذه العملية إلى أيّ مكان: تدخل بكسلاتٍ وتخرج قناعًا.
 */
import { InferenceSession, Tensor } from 'onnxruntime-node';
import { decontaminate, modelInput, modelSize, refineAlpha, upsampleAlpha } from '@shared/portraitMask';

let cached: { path: string; session: Promise<InferenceSession> } | null = null;

function session(modelPath: string): Promise<InferenceSession> {
  if (!cached || cached.path !== modelPath) {
    const pending = InferenceSession.create(modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
    // فشل التحميل لا يُحفظ: المحاولة التالية تعيده.
    pending.catch(() => (cached = null));
    cached = { path: modelPath, session: pending };
  }
  return cached.session;
}

/** قناع النموذج (٠..٢٥٥) بمقاس الصورة — قبل الشدّ إلى الحوافّ. */
export async function matte(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, order: 'rgba' | 'bgra' = 'rgba'): Promise<Uint8Array> {
  const s = await session(modelPath);
  const size = modelSize(width, height);
  const input = new Tensor('float32', modelInput(pixels, width, height, size.w, size.h, order), [1, 3, size.h, size.w]);
  const out = await s.run({ [s.inputNames[0]!]: input });
  const alpha = out[s.outputNames[0]!]!;
  return upsampleAlpha(alpha.data as Float32Array, size.w, size.h, width, height);
}

export type Cutout = { alpha: Uint8Array; pixels: Uint8ClampedArray; ms: number };

/**
 * الشخص مفصولًا: القناع مشدودًا إلى حوافّ الصورة، وألوان الحافّة بلا هالة الخلفية القديمة.
 * والألوان خارج الحافّة كما هي — فما تعيده فرشاة «أبقِ» يعود بلونه الأصلي.
 */
export async function cutout(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Cutout> {
  const t0 = Date.now();
  const raw = await matte(modelPath, pixels, width, height);
  const alpha = refineAlpha(raw, pixels, width, height);
  return { alpha, pixels: decontaminate(pixels, alpha, width, height), ms: Date.now() - t0 };
}

/** يُطلق النموذج عند الإغلاق. */
export async function closePortrait(): Promise<void> {
  const current = cached;
  cached = null;
  if (current) await (await current.session.catch(() => null))?.release();
}
