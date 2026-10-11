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

/**
 * يبني استعلام FTS5 آمنًا: كل كلمة بادئة، والكلمات معًا (AND).
 *
 * والكلمة ما بين فاصلين كما يقطعها الفهرس نفسه — حرفٌ أو رقم — فـ«م/2026/1» ثلاث
 * كلمات. ولو مُرّرت كما هي صارت عبارةً، والعبارات لا تُسأل في فهرسٍ بلا مواضع
 * (`detail='none'`، services/searchIndex.ts). وبذلك لا تبقى في الكلمة علامةُ
 * اقتباسٍ تكسر الصيغة.
 */
export function toFtsQuery(raw: string): string {
  return normalizeFold(raw)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`)
    .join(' AND ');
}

const INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** الأرقام بالهندية كما يكتبها المكتب: «١٢» لا «12» (ز٢ — كانت تُعرَّف في نحو عشرين ملفًّا). */
/** والعكس: الهندية والفارسية لاتينيةً — فيُقرأ «٤:٥٥» و«۴:۵۵» كما يُقرأ «4:55». */
export const toLatinDigits = (s: string): string => s.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);

export const toIndic = (n: number | string): string => String(n).replace(/\d/g, (d) => INDIC_DIGITS[Number(d)]!);

/** وفي نصٍّ فيه رموزٌ لاتينية: الرقم بعد حرفٍ لاتيني يبقى كما هو («A4»)، وسائر الأرقام تُحوَّل. */
export const toIndicText = (s: number | string): string => String(s).replace(/(?<![A-Za-z])\d/g, (d) => INDIC_DIGITS[Number(d)]!);

// ── العدد ومعدوده ──────────────────────────────────────────────────

/**
 * العدد ومعدوده في الواجهة — أداةٌ واحدة (البند ١٧، دليل الواجهة `UI.md`): «ورقةٌ واحدة»، «ورقتان»، «٣ أوراق»،
 * «١١ ورقة»، «١٠٠ ورقة». كان كلّ موضعٍ يكتبها بيده فخرج «٣ اسمًا» و«1 كتابًا» و«0 نموذجًا».
 *
 * والرقم هنديٌّ أبدًا (`toIndic`) فلا تختلط في الجملة «١٢» و«5». ورقم الصادر والمقاسات ليست عدًّا — لا تمرّ من هنا.
 * والتفقيط بالحروف للورق الرسمي في `tafqeet.ts`، لا هنا.
 */

/** صيغ المعدود: المفرد مع الواحد، والمثنّى، والجمع (٣–١٠)، والمنصوب (١١–٩٩)، والمجرور (١٠٠، ١٠١…). */
export type Noun = { one: string; two: string; few: string; many: string; single: string };

const masc = (single: string, two: string, few: string, many = `${single}ًا`): Noun => ({ one: `${single} واحد`, two, few, many, single });
const fem = (single: string, two: string, few: string): Noun => ({ one: `${single} واحدة`, two, few, many: single, single });

export const NOUNS = {
  اسم: masc('اسم', 'اسمان', 'أسماء'),
  كتاب: masc('كتاب', 'كتابان', 'كتب'),
  نموذج: masc('نموذج', 'نموذجان', 'نماذج'),
  ملف: masc('ملفّ', 'ملفّان', 'ملفّات', 'ملفًّا'),
  حقل: masc('حقل', 'حقلان', 'حقول'),
  مواطن: masc('مواطن', 'مواطنان', 'مواطنين'),
  حرف: masc('حرف', 'حرفان', 'أحرف'),
  سؤال: masc('سؤال', 'سؤالان', 'أسئلة'),
  سطر: masc('سطر', 'سطران', 'أسطر'),
  عنصر: masc('عنصر', 'عنصران', 'عناصر'),
  يوم: masc('يوم', 'يومان', 'أيّام'),
  رقم: masc('رقم', 'رقمان', 'أرقام'),
  ورقة: fem('ورقة', 'ورقتان', 'أوراق'),
  بطاقة: fem('بطاقة', 'بطاقتان', 'بطاقات'),
  نسخة: fem('نسخة', 'نسختان', 'نسخ'),
  صورة: fem('صورة', 'صورتان', 'صور'),
  صفحة: fem('صفحة', 'صفحتان', 'صفحات'),
  مرة: fem('مرّة', 'مرّتان', 'مرّات'),
  ترويسة: fem('ترويسة', 'ترويستان', 'ترويسات'),
  كليشة: fem('كليشة', 'كليشتان', 'كليشات'),
  تصميم: masc('تصميم', 'تصميمان', 'تصاميم'),
  موظف: masc('موظف', 'موظفان', 'موظفين'),
  وثيقة: fem('وثيقة', 'وثيقتان', 'وثائق')
} satisfies Record<string, Noun>;

export type NounKey = keyof typeof NOUNS;

/**
 * «٣ أسماء» — والصفر «لا أسماء» (أو `zero` إن قيل غيره في جملته).
 * ومع الواحد والاثنين بلا رقم: «اسمٌ واحد» لا «1 اسم».
 */
export function count(n: number, noun: NounKey | Noun, zero?: string): string {
  const w = typeof noun === 'string' ? NOUNS[noun] : noun;
  if (n === 0) return zero ?? `لا ${w.few}`;
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  const last = n % 100;
  const form = last >= 3 && last <= 10 ? w.few : last >= 11 ? w.many : w.single;
  return `${toIndic(n)} ${form}`;
}

/**
 * بعد حرف جرٍّ أو مفعولًا به: المثنّى بالياء — «على ورقتين»، «اطبع ٣ أوراق»، «احفظ بطاقتين»، «طُلب مرّتين».
 * وما سواه كـ`count`.
 */
export function countIn(n: number, noun: NounKey | Noun, zero?: string): string {
  const said = count(n, noun, zero);
  return n === 2 ? said.replace(/ان$/, 'ين') : said;
}

