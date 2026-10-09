/**
 * إصدار نموذج اللوحة وترحيله (DESIGNS.md ٣٫٥ و٠٫٥).
 *
 * - `Canvas.v` رقم إصدار النموذج. وما حُفظ قبل الرقم إصداره **١** — وهو شكل اليوم نفسه، فلا يُرحَّل.
 * - `migrateCanvas` خطواتٌ متتالية (١ ← ٢ ← …) تُطبَّق على الخام عند القراءة، قبل التقويم؛ والجديد يُحفظ عند الحفظ التالي —
 *   **لا كتابة صامتة**.
 * - **كلّ خاصّيةٍ جديدة اختيارية بقيمةٍ افتراضية تُعيد الرسم القديم كما كان** — فلا تحتاج خطوة؛ والخطوة لما يتغيّر
 *   معناه (اسمٌ يُبدَّل، وحدةٌ تتغيّر).
 * - وتصاميم كلّ إصدارٍ محفوظةٌ في `tests/fixtures/designs/v<الإصدار>/`، وكلّ إصدارٍ بعده يفتحها ويرسمها كما رُسمت
 *   (`tests/designFixtures.test.ts`).
 */

export const CANVAS_VERSION = 1;

type Raw = Record<string, unknown>;

/**
 * الخطوات: `STEPS[v]` ترفع لوحةً من الإصدار v إلى v+1 — على الخام، فتعمل قبل أن يعرف التقويمُ الشكلَ الجديد.
 * وليس بعدُ خطوة: الإصدار ١ هو ما حُفظ منذ أوّل يوم.
 */
const STEPS: Record<number, (raw: Raw) => Raw> = {};

/**
 * أدنى صيغةِ حزمةٍ تحمل التصميم كما رُسم (DESIGNS.md ٣٫٥): **١** لما يرسمه كلّ إصدار، و**٢** لما لا يرسمه ما قبل
 * المرحلة ١ — الشكل الحرّ (١٫٢)، والصورة المقصوصة بشكلٍ أو بإطار (١٫١)، والتدرّج والشفافية والخطّ المنقّط (١٫٣). فالحزمة
 * ترتفع صيغتها بما تحمل وحده، والإصدار الأقدم يرفضها ويقول «حدّث البرنامج» بدل أن يُسقط موجةً أو إطارًا أو تدرّجًا صامتًا.
 */
export function designPackLevel(doc: unknown): number {
  if (typeof doc !== 'object' || doc === null) return 1;
  const d = doc as Raw;
  for (const canvas of [d.canvas, d.backCanvas]) {
    const elements = typeof canvas === 'object' && canvas !== null ? (canvas as Raw).elements : null;
    if (!Array.isArray(elements)) continue;
    for (const el of elements as Raw[]) {
      if (el?.kind === 'path') return 2;
      if (el?.kind === 'image' && (el.shape !== undefined || el.frame !== undefined)) return 2;
      if (typeof el?.opacity === 'number' && el.opacity < 1) return 2;
      if (el?.hidden === true) return 2;
      if (el?.dash !== undefined || el?.gradient !== undefined || (el?.fill !== null && typeof el?.fill === 'object')) return 2;
    }
  }
  return 1;
}

/** إصدار اللوحة المحفوظة — وما لا رقم له (أو رقمه فاسد) ١. */
export function canvasVersionOf(raw: unknown): number {
  const v = typeof raw === 'object' && raw !== null ? (raw as Raw).v : undefined;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

/**
 * الترحيل خطوةً خطوة حتى الإصدار الحاضر. ولوحةٌ من برنامجٍ أحدث (إصدارها أكبر) تُقرأ بما يُعرف منها — والنوع الذي لا
 * يُعرف يُتخطّى ولا يُسقط القراءة — ويبقى رقمها كما هو، فلا تُوسَم بأقدم ممّا هي.
 */
export function migrateCanvas(raw: Raw): { raw: Raw; version: number } {
  let version = canvasVersionOf(raw);
  let out = raw;
  while (version < CANVAS_VERSION) {
    const step = STEPS[version];
    if (step) out = step(out);
    version += 1;
  }
  return { raw: out, version };
}
