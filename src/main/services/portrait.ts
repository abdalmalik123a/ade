/**
 * فصل الشخص عن خلفيّته — نموذج MODNet على الجهاز وحده (`resources/models`)، بلا شبكة.
 *
 * يُحمَّل النموذج مرّةً عند أوّل صورة ويبقى، ويُقرأ مساره من الخارج (العملية الرئيسة تعرف
 * مكانه في المثبّت) — فيُختبر هنا بلا Electron بالنموذج الحقيقي. وما بعد النموذج حسابٌ خالص
 * في `@shared/portraitMask`: القناع يُكبَّر وتُشدّ حافّته فلا غواش حولها، وتُزال هالة الخلفية.
 *
 * وصورة الزبون لا تغادر هذه العملية إلى أيّ مكان: تدخل بكسلاتٍ وتخرج قناعًا.
 */
import { availableParallelism } from 'node:os';
import type { InferenceSession } from 'onnxruntime-node';
import { decontaminate, modelInput, modelSize, sharpenAlpha, upsampleAlpha } from '@shared/portraitMask';
import { decodeFaces, FACE_SIZE, faceChin, faceInput, type Face } from '@shared/portraitFace';

type Ort = typeof import('onnxruntime-node');

/**
 * مكتبة ONNX تُحمَّل عند أوّل صورةٍ لا عند إقلاع البرنامج (مراجعة ٧ ت١).
 *
 * ملحقها الأصلي يستورد مكتبات مايكروسوفت (VC++ 2015-2022). وكان `import` علويًّا في أوّل سطور العملية
 * الرئيسة قبل أن يُركَّب معالج الأخطاء، فجهازٌ بلا تلك المكتبات يُسقط **البرنامج كلّه** عند الإقلاع
 * بنافذة خطأٍ إنكليزية — لمجرّد ميزةٍ واحدة. الآن تتعطّل «إزالة الخلفية» وحدها برسالةٍ عربية تُقال لماذا.
 * (والمثبّت يحمل تلك الملفات بجوار الملحق، فهذا خطّ الدفاع الثاني لا الأوّل.)
 */
let ortLoad: Promise<Ort> | null = null;
export function loadOrt(): Promise<Ort> {
  ortLoad ??= import('onnxruntime-node').catch((e: unknown) => {
    ortLoad = null; // المحاولة التالية تعيد المحاولة (قد يكون المستخدم ثبّتها الآن)
    const why = e instanceof Error ? e.message.split('\n')[0]!.slice(0, 160) : String(e).slice(0, 160);
    console.error('[portrait] تعذّر تحميل onnxruntime-node', e);
    throw new Error(
      'تعذّر تشغيل مكتبة إزالة الخلفية على هذا الجهاز — غالبًا لأنّ «Microsoft Visual C++ Redistributable» (x64) غير مثبّتة. ' +
        `ثبّتها مجانًا من موقع مايكروسوفت ثم أعد فتح ديوان، وباقي الأدوات تعمل كما هي. (${why})`
    );
  });
  return ortLoad;
}

/** جلسةٌ لكلّ نموذج (الأشخاص، والأشياء — DESIGNS.md ٢٫٣) بالمحرّك نفسه: تُحمَّل عند أوّل صورةٍ وتبقى حتى الإغلاق. */
const sessions = new Map<string, Promise<InferenceSession>>();

/**
 * خيوط المعالج صراحةً: في العملية الرئيسة لـElectron كان المحرّك يعمل بخيطٍ واحد — نموذج الأشياء ٩ ثوانٍ للصورة، وهو بخيوط
 * الجهاز الثمانية ٢٫٣ (قيس على i5-1035G1، ١٠ ت١). و`level` «basic» للنموذج الكبير: يُحمَّل في ٢٫٦ ثانية بدل ٩ والسرعة نفسها.
 */
const THREADS = Math.max(1, Math.min(8, availableParallelism()));

export function modelSession(modelPath: string, level: 'basic' | 'all' = 'all'): Promise<InferenceSession> {
  let pending = sessions.get(modelPath);
  if (!pending) {
    pending = loadOrt().then((ort) => ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: level, intraOpNumThreads: THREADS }));
    // فشل التحميل لا يُحفظ: المحاولة التالية تعيده.
    pending.catch(() => sessions.delete(modelPath));
    sessions.set(modelPath, pending);
  }
  return pending;
}

/** قناع النموذج (٠..٢٥٥) بمقاس الصورة — قبل الشدّ إلى الحوافّ. */
export async function matte(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, order: 'rgba' | 'bgra' = 'rgba'): Promise<Uint8Array> {
  const s = await modelSession(modelPath);
  const { Tensor } = await loadOrt();
  const size = modelSize(width, height);
  const input = new Tensor('float32', modelInput(pixels, width, height, size.w, size.h, order), [1, 3, size.h, size.w]);
  const out = await s.run({ [s.inputNames[0]!]: input });
  const alpha = out[s.outputNames[0]!]!;
  return upsampleAlpha(alpha.data as Float32Array, size.w, size.h, width, height);
}

export type Cutout = { alpha: Uint8Array; pixels: Uint8ClampedArray; ms: number };

/**
 * الشخص مفصولًا: القناع بحافّةٍ حادّة لا غواش حولها، وألوان الحافّة بلا هالة الخلفية القديمة.
 * والألوان خارج الحافّة كما هي — فما تعيده فرشاة «أبقِ» يعود بلونه الأصلي.
 */
export async function cutout(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Cutout> {
  const t0 = Date.now();
  const raw = await matte(modelPath, pixels, width, height);
  const alpha = sharpenAlpha(raw);
  return { alpha, pixels: decontaminate(pixels, alpha, width, height), ms: Date.now() - t0 };
}

/**
 * الوجه الأوثق في الصورة بنموذج YuNet (`@shared/portraitFace`) وذقنه — أو `null` إن لم يُوجد. يُسأل مع الفصل نفسه:
 * الذقن الحقيقيّ منه لا من عرض القناع.
 */
export async function detectFace(modelPath: string, pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Face | null> {
  const s = await modelSession(modelPath);
  const { Tensor } = await loadOrt();
  const { data, scale } = faceInput(pixels, width, height);
  const out = await s.run({ [s.inputNames[0]!]: new Tensor('float32', data, [1, 3, FACE_SIZE, FACE_SIZE]) });
  const raw = Object.fromEntries(s.outputNames.map((k) => [k, out[k]!.data as Float32Array]));
  const best = decodeFaces(raw, scale)[0];
  return best ? { ...best, chin: faceChin(best, pixels, width, height) } : null;
}

/** يُطلق النماذج عند الإغلاق. */
export async function closePortrait(): Promise<void> {
  const open = [...sessions.values()];
  sessions.clear();
  for (const s of open) await (await s.catch(() => null))?.release();
}
