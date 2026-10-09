/**
 * ما في المجلّد ولم يدخل (هـ١) بلغة المكتب: لكلّ سببٍ سطرٌ بعدده وبما يُفعل له.
 *
 * يُعرض في المراجعة قبل الاستيراد وفي رسالة نتيجته — وكان المتروك يُسكت عنه: مكتبٌ أرشيفه `.doc` أو مجلّداتٌ
 * فرعية يظنّ أنّه نقله كلّه وقد دخل بعضه، وهي أوّل تجربة ثقة.
 */
import type { ImportSkipped } from './api';

/** كم مستوى من المجلّدات الفرعية يُفتح: أرشيف «سنة / شهر / جهة» دونه، ومجلّدٌ اختير خطأً لا يُمشى كلّه. */
export const FOLDER_DEPTH = 5;

/** أسطر المتروك — فارغةٌ إن لم يُترك شيء. */
export function skippedLines(s: ImportSkipped | undefined): string[] {
  if (!s) return [];
  const lines: string[] = [];
  if (s.doc) lines.push(`${s.doc} ملفّ Word بصيغةٍ قديمة (.doc وأمثالها) لم يُنقل — احفظه .docx من Word («حفظ باسم») في مجلّدٍ جديد ثم استورد ذلك المجلّد`);
  if (s.xls) lines.push(`${s.xls} ملفّ Excel لم يُنقل — يُستورد من «كتب من ملف Excel» ملفًّا ملفًّا (والقديم .xls يُحفظ .xlsx أوّلًا)`);
  if (s.overCap) lines.push(`${s.overCap} ملفّ Word بعد الـ${s.limit} الأولى لم يُقرأ — انقلها إلى مجلّدٍ آخر واستورده بعد هذا`);
  if (s.folders) lines.push(`${s.folders} مجلّد لم يُفتح — أعمق من ${FOLDER_DEPTH} مستويات أو ممنوعٌ فتحه`);
  if (s.unsupported) lines.push(`${s.unsupported} ملفّ ليس Word (PDF أو صور أو غيرها) — بقي كما هو`);
  return lines;
}
