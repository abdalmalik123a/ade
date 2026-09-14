/**
 * تطبيع النص العربي للبحث.
 *
 * القاعدة: تُخزَّن صورتان لكل حقل قابل للبحث —
 *  - `fold`  : تطبيع كامل (الهمزات كلها ألف، التاء المربوطة هاء، الألف المقصورة ياء)
 *              يخدم البحث المتساهل: «احمد» تجد «أحمد».
 *  - `strict`: تطبيع خفيف (حذف التشكيل والتطويل فقط، الهمزات كما هي)
 *              يخدم المطابقة الدقيقة عند الحاجة إلى نص الوثيقة الرسمي.
 *
 * سبب الصورتين: الكتاب الرسمي لا يحتمل تحريف اسم، لكن الموظف يكتب بلا همزات.
 */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩]/g;

/** أرقام عربية-هندية وفارسية إلى لاتينية. */
const DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

function common(input: string): string {
  return input
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d)
    .replace(/\s+/g, ' ')
    .trim();
}

/** الصورة الدقيقة: تشكيل وتطويل محذوفان، والهمزات محفوظة. */
export function normalizeStrict(input: string): string {
  return common(input);
}

/** الصورة المتساهلة: كل صور الهمزة تُردّ إلى أصلها، والتاء المربوطة هاء. */
export function normalizeFold(input: string): string {
  return common(input)
    .replace(/[آأإٱٲٳ]/g, 'ا') // آ أ إ ٱ ٲ ٳ → ا
    .replace(/ؤ/g, 'و')                                  // ؤ → و
    .replace(/[ئى]/g, 'ي')                          // ئ ى → ي
    .replace(/ة/g, 'ه')                                  // ة → ه
    .replace(/ء/g, '')                                        // ء مفردة تُحذف
    .toLowerCase();
}

/** يبني استعلام FTS5 آمنًا: كل كلمة بادئة، والاقتباس يمنع كسر الصيغة. */
export function toFtsQuery(raw: string): string {
  const terms = normalizeFold(raw)
    .split(' ')
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"*`);
  return terms.join(' AND ');
}
