/**
 * محرك التفقيط المالي بالدينار العراقي والعملات (Arabic Tafqeet Engine).
 *
 * تحويل المبالغ الرقمية إلى نصوص عربية فصيحة ومضبوطة لغويًا وقانونيًا
 * مع مراعاة قواعد التمييز والإفراد والجمع والعطف وصيغ العقود العراقية.
 *
 * أمثلة:
 * 15,250,000 ⬅ فقط خمسة عشر مليونًا ومئتان وخمسون ألف دينار عراقي لا غير
 * 500,000    ⬅ فقط خمسمئة ألف دينار عراقي لا غير
 * 25,000     ⬅ فقط خمسة وعشرون ألف دينار عراقي لا غير
 * 3,750      ⬅ فقط ثلاثة آلاف وسبعمئة وخمسون دولارًا أمريكيًا لا غير
 * 2,000      ⬅ فقط ألفا دينار عراقي لا غير
 * 250.5      ⬅ فقط مئتان وخمسون دينارًا عراقيًا وخمسمئة فلس لا غير
 */

export type CurrencyType = 'IQD' | 'USD' | 'NONE';

const ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة'
];

const TENS = [
  '',
  'عشرة',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون'
];

const HUNDREDS = [
  '',
  'مئة',
  'مئتان',
  'ثلاثمئة',
  'أربعمئة',
  'خمسمئة',
  'ستمئة',
  'سبعمئة',
  'ثمانمئة',
  'تسعمئة'
];

/**
 * الآحاد لمعدودٍ مؤنّث: «ثلاث درجات» لا «ثلاثة»، و«إحدى عشرة»، و«ثماني».
 * فالعدد من ٣ إلى ١٠ يخالف معدوده: مع المذكّر بالتاء (ثلاثة أيام) ومع المؤنّث بلا تاء.
 */
const ONES_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع'];

/** تفقيط عدد صحيح بين 0 و 999 — لمعدودٍ مذكّر، أو مؤنّثٍ بـ`feminine`. */
function convertGroup(n: number, feminine = false): string {
  if (n === 0) return '';

  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  const ones = feminine ? ONES_F : ONES;

  if (h > 0) {
    parts.push(HUNDREDS[h]!);
  }

  if (rem > 0) {
    if (rem <= 9) {
      parts.push(ones[rem]!);
    } else if (rem === 10) {
      parts.push(feminine ? 'عشر' : 'عشرة');
    } else if (rem === 11) {
      parts.push(feminine ? 'إحدى عشرة' : 'أحد عشر');
    } else if (rem === 12) {
      parts.push(feminine ? 'اثنتا عشرة' : 'اثنا عشر');
    } else if (rem < 20) {
      parts.push(`${ones[rem % 10]} ${feminine ? 'عشرة' : 'عشر'}`);
    } else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      if (o > 0) {
        const unit = feminine && o === 1 ? 'إحدى' : ones[o];
        parts.push(`${unit} و${TENS[t]}`);
      } else {
        parts.push(TENS[t]!);
      }
    }
  }

  return parts.join(' و');
}

/**
 * صيغُ المعدود بحسب العدد — وهي قاعدة التمييز كلّها:
 *
 * | آخر رقمين | الصيغة | مثال |
 * |---|---|---|
 * | ٣–١٠ | جمعٌ مجرور | ثلاثة آلاف · مئة وخمسة دنانير |
 * | ١١–٩٩ | مفردٌ منصوب | أحد عشر دينارًا · خمسة وعشرون ألفًا |
 * | ٠٠ (مئة فأكثر) | مفردٌ مجرور | خمسمئة ألف · ألف دينار |
 *
 * و«منصوبًا» يفقد تنوينه إذا أُضيف إلى ما بعده: «خمسة عشر ألفَ دينار»
 * لا «ألفًا دينار»؛ ومثنّاه يفقد نونه: «ألفا دينار» لا «ألفان دينار».
 */
type Noun = {
  one: string;
  two: string;
  /** المثنّى مضافًا: «ألفا دينار». */
  twoBound: string;
  few: string;
  many: string;
  /** المنصوب مضافًا: بلا تنوين. */
  manyBound: string;
  single: string;
  /** معدودٌ مؤنّث (درجة، سنة، ساعة): آحادُه تخالفه — «ثلاث درجات». */
  feminine?: boolean;
};

function counted(n: number, noun: Noun, bound: boolean): string {
  if (n === 1) return noun.one;
  if (n === 2) return bound ? noun.twoBound : noun.two;
  const last = n % 100;
  const words = convertGroup(n);
  if (last >= 3 && last <= 10) return `${words} ${noun.few}`;
  if (last >= 11) return `${words} ${bound ? noun.manyBound : noun.many}`;
  return `${words} ${noun.single}`;
}

const SCALES: [number, Noun][] = [
  [1e9, { one: 'مليار', two: 'ملياران', twoBound: 'مليارا', few: 'مليارات', many: 'مليارًا', manyBound: 'مليار', single: 'مليار' }],
  [1e6, { one: 'مليون', two: 'مليونان', twoBound: 'مليونا', few: 'ملايين', many: 'مليونًا', manyBound: 'مليون', single: 'مليون' }],
  [1e3, { one: 'ألف', two: 'ألفان', twoBound: 'ألفا', few: 'آلاف', many: 'ألفًا', manyBound: 'ألف', single: 'ألف' }]
];

/** العملة وكسرُها: الدينار ألف فلس، والدولار مئة سنت. */
const MONEY: Record<Exclude<CurrencyType, 'NONE'>, { unit: Noun; part: Noun; parts: number }> = {
  IQD: {
    unit: { one: 'دينار عراقي واحد', two: 'ديناران عراقيان', twoBound: 'ديناران عراقيان', few: 'دنانير عراقية', many: 'دينارًا عراقيًا', manyBound: 'دينارًا عراقيًا', single: 'دينار عراقي' },
    part: { one: 'فلس واحد', two: 'فلسان', twoBound: 'فلسان', few: 'فلوس', many: 'فلسًا', manyBound: 'فلسًا', single: 'فلس' },
    parts: 1000
  },
  USD: {
    unit: { one: 'دولار أمريكي واحد', two: 'دولاران أمريكيان', twoBound: 'دولاران أمريكيان', few: 'دولارات أمريكية', many: 'دولارًا أمريكيًا', manyBound: 'دولارًا أمريكيًا', single: 'دولار أمريكي' },
    part: { one: 'سنت واحد', two: 'سنتان', twoBound: 'سنتان', few: 'سنتات', many: 'سنتًا', manyBound: 'سنتًا', single: 'سنت' },
    parts: 100
  }
};

/** العدد كلماتٍ — والمراتب بتمييزها، و`bound` إن أُضيف آخرُه إلى معدودٍ بعده. */
function numberWords(n: number, bound: boolean, feminine = false): string {
  const chunks: string[] = [];
  let rest = n;
  for (const [size, noun] of SCALES) {
    const count = Math.floor(rest / size);
    rest %= size;
    if (count) chunks.push(counted(count, noun, bound && rest === 0));
  }
  // والمراتب (ألف، مليون) مذكّرةٌ أبدًا؛ التأنيث في ما دون الألف وحده.
  if (rest) chunks.push(convertGroup(rest, feminine));
  return chunks.join(' و');
}

/**
 * يقرأ المبلغ من نصّ الحقل — أو `null` إن لم يكن مبلغًا.
 *
 * يقبل الأرقام العربية والهندية، وفواصل الآلاف (, ٬ والمسافة، والنقطة إن
 * جاءت آلافًا: 1.500.000)، وفاصلةً عشريّةً واحدة (. أو ٫). وما سوى ذلك ليس
 * مبلغًا: التاريخ 2026/01/15 والهاتف 0770… كانا يُفقَّطان ملايين.
 */
export function parseAmount(value: string): number | null {
  let s = value
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٬\s]/g, '')
    .replace('٫', '.');
  if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s) || /^0\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n <= 999_999_999_999 ? n : null;
}

/**
 * تحويل رقم مالي إلى نص عربي مفقط.
 *
 * والكسر لا يُسقط صامتًا: ٢٥٠٫٥ دينار «مئتان وخمسون دينارًا وخمسمئة فلس» —
 * لا «مئتان وخمسون» ونصفُ الدينار ضائع في كمبيالة. وما ليس مبلغًا يعود فارغًا.
 */
export function tafqeet(
  amount: number | string,
  options?: {
    currency?: CurrencyType;
    prefix?: boolean; // إضافة "فقط"
    suffix?: boolean; // إضافة "لا غير"
  }
): string {
  const currency = options?.currency ?? 'IQD';
  const withPrefix = options?.prefix ?? true;
  const withSuffix = options?.suffix ?? true;

  const value = typeof amount === 'number' ? amount : parseAmount(amount);
  if (value === null || !Number.isFinite(value) || value < 0) return '';
  if (value > 999_999_999_999) return 'المبلغ خارج النطاق المدعوم';

  let whole = Math.floor(value);
  let result: string;
  if (currency === 'NONE') {
    if (whole === 0) return 'صفر';
    result = numberWords(whole, false);
  } else {
    const money = MONEY[currency];
    let part = Math.round((value - whole) * money.parts);
    // الكسر الذي يُدوَّر إلى وحدةٍ كاملة وحدةٌ تُضاف لا «ألف فلس»: ١٫٩٩٩٩ ديناران،
    // و٥٫٩٩٩ دولارًا ستّة (التدقيق المستقل).
    if (part >= money.parts) {
      whole += 1;
      part = 0;
      if (whole > 999_999_999_999) return 'المبلغ خارج النطاق المدعوم';
    }
    const unitWords = whole ? say(whole, money.unit) : '';
    const partWords = part ? say(part, money.part) : '';
    if (!unitWords && !partWords) return 'صفر';
    result = [unitWords, partWords].filter(Boolean).join(' و');
  }

  if (withPrefix) result = `فقط ${result}`;
  if (withSuffix) result = `${result} لا غير`;
  return result.trim();
}

/** العدد ومعدودُه: «دينار عراقي واحد»، «ألفا دينار عراقي»، «أحد عشر دينارًا عراقيًا». */
function say(n: number, noun: Noun): string {
  if (n === 1 || n === 2) return counted(n, noun, true);
  const last = n % 100;
  const form = last >= 3 && last <= 10 ? noun.few : last >= 11 ? noun.many : noun.single;
  return `${numberWords(n, true, noun.feminine)} ${form}`;
}

// ── المبلغ وحقلُ كتابته ──────────────────────────────────────────────

type NamedField = { id: string; token: string; label: string };

const WORDS_TOKEN = /_كتاب[ةه]$/;
const baseToken = (token: string) => token.replace(/_(رقما|رقماً|رقم|كتابة|كتابه)$/, '');

/**
 * حقلُ «الكتابة» الذي يقابل حقل المبلغ — أو `null`.
 *
 * يُطابَق بالوسم لا بأوّل حقلٍ فيه «كتابة»: كان التفقيط يُكتب في أوّل حقلٍ كهذا،
 * فيقع مبلغ الدين في خانة بدل الإيجار. ويكفي أن يكون أحد الأصلين بادئةً للآخر:
 * «بدل_الإيجار_الشهري_رقما» يقابل «بدل_الإيجار_كتابة». وأطولُ تطابقٍ يغلب.
 */
export function amountWordsField<T extends NamedField>(field: T, fields: T[]): T | null {
  if (WORDS_TOKEN.test(field.token)) return null;
  const own = baseToken(field.token);
  let best: T | null = null;
  for (const f of fields) {
    if (f.id === field.id || !WORDS_TOKEN.test(f.token)) continue;
    const other = baseToken(f.token);
    if (!(own.startsWith(other) || other.startsWith(own))) continue;
    if (!best || other.length > baseToken(best.token).length) best = f;
  }
  return best;
}

const AMOUNT_NAME = /مبلغ|بدل|سعر|ثمن|قيمة|دين|راتب|أجر|رسوم|سلفة/;

/** أهو حقلُ مبلغ؟ له حقلُ كتابةٍ يقابله، أو في اسمه ما يدلّ على المال. */
export function isAmountField<T extends NamedField>(field: T, fields: T[]): boolean {
  if (WORDS_TOKEN.test(field.token)) return false;
  return amountWordsField(field, fields) !== null || AMOUNT_NAME.test(`${field.label} ${field.token}`);
}

// ── الدرجات والمدد: العدد ومعدوده ────────────────────────────────────

/** ما يُعدّ في الشهادات والكتب غير المال — وكلٌّ بصيغه الخمس. */
export const UNITS = {
  درجة: { one: 'درجة واحدة', two: 'درجتان', twoBound: 'درجتان', few: 'درجات', many: 'درجة', manyBound: 'درجة', single: 'درجة', feminine: true },
  يوم: { one: 'يوم واحد', two: 'يومان', twoBound: 'يومان', few: 'أيام', many: 'يومًا', manyBound: 'يومًا', single: 'يوم' },
  أسبوع: { one: 'أسبوع واحد', two: 'أسبوعان', twoBound: 'أسبوعان', few: 'أسابيع', many: 'أسبوعًا', manyBound: 'أسبوعًا', single: 'أسبوع' },
  شهر: { one: 'شهر واحد', two: 'شهران', twoBound: 'شهران', few: 'أشهر', many: 'شهرًا', manyBound: 'شهرًا', single: 'شهر' },
  سنة: { one: 'سنة واحدة', two: 'سنتان', twoBound: 'سنتان', few: 'سنوات', many: 'سنة', manyBound: 'سنة', single: 'سنة', feminine: true },
  ساعة: { one: 'ساعة واحدة', two: 'ساعتان', twoBound: 'ساعتان', few: 'ساعات', many: 'ساعة', manyBound: 'ساعة', single: 'ساعة', feminine: true }
} satisfies Record<string, Noun>;

export type CountUnit = keyof typeof UNITS;

const FRACTIONS: [number, string][] = [
  [0.25, 'ربع'],
  [0.5, 'نصف'],
  [0.75, 'ثلاثة أرباع']
];

/**
 * العدد ومعدوده كلماتٍ: ٩٥ درجة ← «خمس وتسعون درجة»، ٥ أيام ← «خمسة أيام»،
 * ١٥ يومًا ← «خمسة عشر يومًا»، ٢ ← «يومان».
 *
 * والكسر نصفٌ أو ربعٌ أو ثلاثة أرباع (٨٧٫٥ ← «سبع وثمانون درجة ونصف»)؛ وما
 * سواه يعود فارغًا لا مقرَّبًا — فالدرجة لا تُقرَّب صامتة.
 */
export function countWords(value: string | number, unit: CountUnit): string {
  const n = typeof value === 'number' ? value : parseAmount(value);
  if (n === null || !Number.isFinite(n) || n < 0) return '';
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  const part = FRACTIONS.find(([f]) => f === frac)?.[1];
  if (frac && !part) return '';
  const noun = UNITS[unit];
  const words = whole ? say(whole, noun) : '';
  if (!part) return words || 'صفر';
  return words ? `${words} و${part}` : `${part} ${noun.single}`;
}

/** وحدةُ العدّ من اسم الحقل: «الدرجة_كتابة» درجة، و«مدة_الإجازة» أيام… — أو `null`. */
export function unitOf(name: string): CountUnit | 'money' | null {
  if (/مبلغ|بدل|سعر|ثمن|قيمة|دين|راتب|أجر|رسوم|سلفة/.test(name)) return 'money';
  if (/درج|معدل|علامة|مجموع/.test(name)) return 'درجة';
  if (/ساع/.test(name)) return 'ساعة';
  if (/أسبوع|اسبوع|أسابيع/.test(name)) return 'أسبوع';
  if (/شهر|أشهر/.test(name)) return 'شهر';
  if (/سنة|سنوات|سنين|أعوام|عام/.test(name)) return 'سنة';
  if (/يوم|أيام|ايام|مدة|مده|إجازة|اجازة/.test(name)) return 'يوم';
  return null;
}

/**
 * يملأ حقول «الكتابة» من أرقامها: «الدرجة» ٩٥ تملأ «الدرجة_كتابة»، و«المبلغ»
 * يملأ «المبلغ_كتابة» تفقيطًا. والحقل الذي كتبه الموظف بيده لا يُمسّ — يُملأ
 * الفارغ وحده، فيُرى في المعاينة ويُصحَّح إن شاء.
 */
export function derivedWords(values: Record<string, string>, keys: string[]): Record<string, string> {
  const fields = keys.map((key) => ({ id: key, token: key.replace(/\s+/g, '_'), label: key }));
  const out = { ...values };
  for (const field of fields) {
    if (!WORDS_TOKEN.test(field.token) || values[field.id]?.trim()) continue;
    const source = fields.find((f) => f.id !== field.id && amountWordsField(f, fields)?.id === field.id);
    const raw = source ? values[source.id] : undefined;
    if (!source || !raw?.trim()) continue;
    const unit = unitOf(`${source.label} ${field.label}`);
    const words = unit === 'money' ? tafqeet(raw) : unit ? countWords(raw, unit) : '';
    if (words) out[field.id] = words;
  }
  return out;
}

/**
 * كلماتُ حقلٍ رقميّ بوحدته: المال تفقيطًا، والدرجة والمدّة عددًا ومعدودًا —
 * أو فارغٌ إن لم يكن رقمًا أو لم تُعرف وحدته. فالدرجة ٩٥ لا تُفقَّط دنانير.
 */
export function wordsForField<T extends NamedField>(field: T, fields: T[]): string {
  if (WORDS_TOKEN.test(field.token) || !field.token.trim()) return '';
  const partner = amountWordsField(field, fields);
  const unit = unitOf(`${field.label} ${field.token} ${partner?.label ?? ''} ${partner?.token ?? ''}`);
  return unit === 'money' ? tafqeet((field as T & { value?: string }).value ?? '') : unit ? countWords((field as T & { value?: string }).value ?? '', unit) : '';
}
