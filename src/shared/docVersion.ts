/**
 * إصدار صيغة الوثيقة وترحيلها (A05، D50) — على مثال اللوحة (`design/model/version.ts`).
 *
 * - `Doc.schemaVersion` رقم الصيغة، وما لا رقم له (أو رقمه فاسد) **١** — وهو شكل اليوم نفسه، فلا يُرحَّل.
 * - `migrateDoc` خطواتٌ متتالية (١ ← ٢ ← …) تُطبَّق على الخام عند القراءة، قبل التقويم؛ والجديد يُحفظ عند الحفظ التالي.
 * - **وثيقةٌ من برنامجٍ أحدث** تُقرأ بما يُعرف منها ويبقى رقمها، فلا تُوسَم بأقدم ممّا هي؛ والحزمة التي تحملها تُرفض
 *   «حدّث البرنامج» (`contentPack.ts`) بدل أن يُضاف نموذجٌ نصفُه ساقط.
 *
 * والصيغة الحاضرة (`DOC_SCHEMA` في `doc.ts`) تُمرَّر وسيطًا: فلا يستورد هذا الملفّ من `doc.ts` شيئًا ولا حلقة.
 */

type Raw = Record<string, unknown>;

/**
 * الخطوات: `STEPS[v]` ترفع وثيقةً من الصيغة v إلى v+1 — على الخام. وليس بعدُ خطوة: الصيغة ١ هي ما حُفظ منذ أوّل يوم.
 * وكلّ خاصّيةٍ جديدة اختيارية بقيمةٍ افتراضية تُعيد الورقة القديمة كما كانت لا تحتاج خطوة؛ والخطوة لما يتغيّر معناه.
 */
const STEPS: Record<number, (raw: Raw) => Raw> = {};

/** صيغة الوثيقة المحفوظة — وما لا رقم له (أو رقمه فاسد) ١. */
export function docSchemaOf(raw: unknown): number {
  const v = typeof raw === 'object' && raw !== null ? (raw as Raw).schemaVersion : undefined;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

/** الترحيل خطوةً خطوة حتى الصيغة الحاضرة — والأحدث منها يبقى برقمه. */
export function migrateDoc(raw: Raw, current: number): { raw: Raw; version: number } {
  let version = docSchemaOf(raw);
  let out = raw;
  while (version < current) {
    const step = STEPS[version];
    if (step) out = step(out);
    version += 1;
  }
  return { raw: out, version };
}

/** أصيغتها أحدث ممّا يعرفه هذا البرنامج؟ */
export function isNewerDoc(raw: unknown, current: number): boolean {
  return docSchemaOf(raw) > current;
}
