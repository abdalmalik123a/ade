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
