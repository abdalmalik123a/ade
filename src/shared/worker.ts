/**
 * عقد العامل المستقلّ (A03، D53؛ ARCHITECTURE §٢ «العامل المستقلّ») — ما يمرّ بين العملية الرئيسة وعملية العامل.
 *
 * الرئيسة ترسل طلبًا `{id, job, input}`، والعامل يردّ بنتيجةٍ أو إخفاقٍ بالمعرّف نفسه. ولكلّ عملٍ مدخله ومخرجه مكتوبان هنا،
 * فلا تعرف الواجهة ولا القنوات ما وراء العقد (ولا لغة المحرّك إن صار Rust لاحقًا). والعامل لا يفتح القاعدة ولا المخزن.
 */

import type { Face } from './portraitFace';

/** صورةٌ بكسلاتها RGBA ومقاسها — كما تصل من الواجهة. */
type Pixels = { pixels: Uint8Array; width: number; height: number };
/** الصورة مفصولةً: القناع، وألوان الحافّة بلا هالة، وزمن النموذج — كما يعيدها `main/services/portrait.ts`. */
export type CutoutOutput = { alpha: Uint8Array; pixels: Uint8ClampedArray; ms: number };

/** الأعمال بمدخلها ومخرجها — وكلّ عملٍ ينتقل إلى العامل سطرٌ هنا. */
export type WorkerJobs = {
  /** «أنا هنا»: رقم عملية العامل ووقت الجواب. */
  ping: { input: null; output: { pid: number; at: number } };
  /** للاختبار وحده (أبواب الاختبار): يخرج العامل بـ`process.exit(1)` — فيُرى السقوط وما بعده. */
  crash: { input: null; output: never };
  /** «أزل الخلفية» للأشخاص (D54): MODNet، ووجهه بـYuNet إن وُجد نموذجه (`facePath`) — وتعذّر الوجه لا يُفشل الفصل. */
  cutout: { input: Pixels & { modelPath: string; facePath: string | null }; output: CutoutOutput & { face: Face | null } };
  /** «أزل الخلفية» للأشياء في التصاميم (D54): BiRefNet. */
  cutoutObject: { input: Pixels & { modelPath: string }; output: CutoutOutput };
  /**
   * «استورد تصميمًا» (D56): يقرأ الملف بمساره بعد سقف حجمه في الرئيسة، ثم سقف نقاطه و`readDesign`، ولـPhotoshop بلا صور تسطيحه.
   * و`imported` نوعه `DesignImport` في `main/services/design/importTypes.ts` — والمشترك لا يرى الرئيسة، فتنصّه القناة (`ipc/designs.ts`).
   */
  readDesign: { input: { path: string; name: string; fonts: string[] }; output: { imported: unknown; flat: { png: Uint8Array | null; warnings: string[] } | null } };
};

export type WorkerJob = keyof WorkerJobs;
export type WorkerInput<J extends WorkerJob> = WorkerJobs[J]['input'];
export type WorkerOutput<J extends WorkerJob> = WorkerJobs[J]['output'];

/** طلبٌ من الرئيسة إلى العامل. */
export type WorkerRequest<J extends WorkerJob = WorkerJob> = { id: number; job: J; input: WorkerInput<J> };
/** نتيجة الطلب بمعرّفه. */
export type WorkerResult = { type: 'result'; id: number; output: unknown };
/** إخفاق الطلب بمعرّفه — ورسالة الخطأ كما رماها العمل. */
export type WorkerFailure = { type: 'failure'; id: number; message: string };
export type WorkerReply = WorkerResult | WorkerFailure;

/** ما يُقال للمكتب حين يخرج العامل والطلبات معلّقة — والطلب التالي يُقلعه من جديد. */
export const WORKER_STOPPED = 'توقّف المعالج — جرّب ثانيةً';
/** عملٌ تجاوز مهلته: يُقتل العامل ويُقال هذا (D55). */
export const WORKER_TIMED_OUT = 'استغرق أكثر ممّا يُحتمل — أُوقف';
/** عملٌ أوقفه المكتب بـ«ألغِ» (D55). */
export const WORKER_CANCELLED = 'أُلغي';

/**
 * مهلة كلّ عمل (`timeoutMs`، D55): «أنا هنا» ٥ ث، و«أزل الخلفية» ٦٠ ث — عشرة أضعاف أبطأ ما قيس (٥٫٧ ث بتحميل النموذج، D52)
 * لجهازٍ أبطأ — و«استورد تصميمًا» ٦٠ ث (D56). وما ينتهي في وقته لا يتغيّر.
 */
export const WORKER_TIMEOUT_MS: { [J in WorkerJob]: number } = {
  ping: 5_000,
  crash: 5_000,
  cutout: 60_000,
  cutoutObject: 60_000,
  // أبطأ ما قيس ٤٫١ ث (Photoshop عند حدّه، D52).
  readDesign: 60_000
};
