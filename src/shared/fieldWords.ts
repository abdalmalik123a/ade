/**
 * ألفاظ الخانات المقترحة: لقب صاحب العلاقة واسمه وصفّه وسنته وتاريخه، والصياغة التي تتبع جنسه —
 * نُقل من `fieldHints.ts` (D86).
 */
import { guessGender } from './gender';
import { stripTatweel } from './blanks';

const AR = 'ء-يٱ-ۓ';

const LETTER = new RegExp(`[${AR}ـ\\u064B-\\u0652]`);

const DIGIT = '[0-9٠-٩]';

/** النصّ في موضعه حرفًا لا جزءَ كلمةٍ أطول: «الطالب» لا تقع في «الطالبة». */
export function wholeAt(text: string, at: number, len: number): boolean {
  const before = text[at - 1];
  const after = text[at + len];
  return !(before && LETTER.test(before)) && !(after && LETTER.test(after));
}

/** موضعٌ يُترك: الكلمة فيه جزءُ عبارةٍ ثابتة لا تخصّ صاحب العلاقة. */
export type Skip = (text: string, at: number, word: string) => boolean;

// ── النصّ المكتوب ────────────────────────────────────────────────────────

/** لقب صاحب العلاقة — وبعده اسمه. */
const SUBJECT_TITLE = /(?:^|[\s(«"])(?:و?)(السيد|السيدة|الطالب|الطالبة|التلميذ|التلميذة|المواطن|المواطنة|المدعو|المدعوة|الموظف|الموظفة|المنتسب|المنتسبة|الآنسة|الانسة|الست)\s+/g;

/** كلماتٌ تُنهي الاسم: حروف الجرّ والصلة وما يأتي بعد الاسم في الكتب. */
const NAME_STOP = new Set(
  (
    'من في على الى إلى عن مع هو هي الذي التي الذين المذكور المذكورة المذكورين المولود المولودة بتاريخ ' +
    'المحترم المحترمة مدير مديرة معاون رئيس عضو قسم شعبة لدى لدينا حيث كان كانت وهو وهي والد والدة ' +
    'بموجب حسب وفق المرقم المرقمة ذي ذو ذات ابن ابنة مستمر مستمرة ملتزم ملتزمة موظف موظفة طالب طالبة ' +
    'يعمل تعمل يدرس تدرس قد وقد كما والذي والتي'
  ).split(/\s+/)
);

const NAME_WORD = new RegExp(`^[${AR}ـ]+$`);

export function names(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(SUBJECT_TITLE)) {
      const rest = t.slice((m.index ?? 0) + m[0].length);
      const words: string[] = [];
      for (const w of rest.split(/\s+/)) {
        const word = w.replace(/[،,.:؛;)»"]+$/, '');
        if (!word || !NAME_WORD.test(word) || NAME_STOP.has(word) || /^(وال|بال|لل)/.test(word)) break;
        words.push(word);
        if (words.length === 4 || word !== w) break;
      }
      // اسمان على الأقلّ (الاسم واسم الأب)، وأوّلهما اسمٌ معروف: «تزويد الطالب بكتاب تأييد»
      // ليس فيها اسم — والاقتراح الخاطئ أسوأ من الفائت.
      if (words.length >= 2 && guessGender(words.join(' '))?.sure) found.add(words.join(' '));
    }
  }
  return [...found];
}

const ORDINAL = 'الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس';

const STAGE = 'الابتدائي|الإبتدائي|المتوسط|الإعدادي|الاعدادي|الثانوي';

export const CLASS_RE = new RegExp(`(?:الصف|المرحلة)\\s+((?:${ORDINAL})(?:\\s+(?:${STAGE}))?)`, 'g');

export const YEAR_RE = new RegExp(`(?:19|20|١٩|٢٠)${DIGIT}{2}\\s*[-/–]\\s*(?:19|20|١٩|٢٠)${DIGIT}{2}`, 'g');

export const DATE_RE = new RegExp(`${DIGIT}{1,2}\\s*/\\s*${DIGIT}{1,2}\\s*/\\s*(?:19|20|١٩|٢٠)${DIGIT}{2}`, 'g');

export function matches(texts: string[], re: RegExp, group = 0): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(re)) if (m[group]) found.add(m[group]!.trim());
  return [...found];
}

// ── الصياغة مع الجنس ────────────────────────────────────────────────────

/**
 * صياغةٌ تتبع جنس صاحب العلاقة: المذكّر وما يقابله. ولا «السيد» ولا «المحترم»: هما في الكتب
 * للجهة المخاطَبة غالبًا («السيد المدير المحترم»)، لا لصاحب العلاقة.
 *
 * وضمير الغائب («غياباته» ← «غياباتها») بقائمةٍ لا بقاعدة: كلماتٌ كثيرة آخرها هاءٌ أصلية
 * («توجيه»، «انتباه») — وما فات القائمة يكشفه «جرّب باسمٍ آخر».
 */
export const SUBJECT_PAIRS: [string, string][] = [
  ['المذكور', 'المذكورة'],
  ['الطالب', 'الطالبة'],
  ['التلميذ', 'التلميذة'],
  ['الموظف', 'الموظفة'],
  ['المواطن', 'المواطنة'],
  ['المدعو', 'المدعوة'],
  ['المنتسب', 'المنتسبة'],
  ['المولود', 'المولودة'],
  ['الساكن', 'الساكنة'],
  ['مستمر', 'مستمرة'],
  ['ملتزم', 'ملتزمة'],
  ['ابنه', 'ابنته'],
  ['ابننا', 'ابنتنا']
];

// وما تكتبه المدارس عن صاحب العلاقة (الموجة ٢): «تبليغه»، «تزويده بالوثيقة»، «صورته»، «فحصه ومعالجته»…
export const PRONOUN_PAIRS: [string, string][] = (
  'له عنه منه عليه لديه بحقه اسمه عمره ولده غياباته وانذاره انذاره وحثه حثه دوامه خدمته عمله راتبه ' +
  'اجازته إجازته تأييده تاييده مسؤوليته وظيفته درجته معدله نتيجته تولده سكنه طلبه بطلبه ' +
  'تبليغه تزويده صورته فحصه معالجته احالته إحالته مباشرته انفكاكه تخرجه غيابه تغيبه انقطاعه استمراره'
)
  .split(/\s+/)
  .map((w): [string, string] => [w, w === 'له' ? 'لها' : `${w}ا`]);

const GENDER_PAIRS: [string, string][] = [...SUBJECT_PAIRS, ...PRONOUN_PAIRS];

/** «السيد» قبل خانة اسم صاحب العلاقة له لا للجهة المخاطَبة: «بالسيد ( {الاسم} ) بعنوان…». */
export const TITLE_BEFORE_NAME = /(?:^|[^ء-ي])((?:و|ب|ل|ف)?(?:ال)?سيد)\s*\(?\s*$/;

/**
 * عبارةٌ ثابتة كلمتُها ليست لصاحب العلاقة — فلا يقلبها التأنيث: «نسخة منه الى» نسخةٌ من الكتاب، و«بناءً عليه»، و«الموظف
 * المختص». وكانت «اقبلها كلّها» تكتب «نسخة منها» في كتاب امرأة. والكلمة قبل شرطة الجنسين («التلميذ / ة») لخيار الشرطة.
 */
const FIXED: { word: string; before?: RegExp; after?: RegExp }[] = [
  { word: 'منه', before: /نسخ[ةه]\s*$/ },
  { word: 'عليه', before: /بناء[ًاٌ]*\s*$/ },
  { word: 'الموظف', after: /^\s*المختص/ }
];

const SLASH_AFTER = /^ـ*\s*\/\s*(?:ة|ت|ها|ا)(?![ء-ي])/;

export const notSubjectAt: Skip = (text, at, word) =>
  SLASH_AFTER.test(text.slice(at + word.length)) ||
  FIXED.some((f) => f.word === word && (f.before?.test(text.slice(0, at)) ?? true) && (f.after?.test(text.slice(at + word.length)) ?? true));

/** أفعالٌ ماضية تكتبها المدارس «/ة» وتأنيثها بالتاء: «باشر /ة» ← باشرت. */
const SLASH_VERBS = new Set(
  'باشر انقطع انفك تغيب غاب التحق نقل حضر تخرج نجح رسب قدم وقع تعهد سافر عاد استلم سلم حصل احيل أحيل اكمل أكمل'.split(' ')
);

/**
 * الجنسان بشرطة كما تكتبهما المدارس: «السيد / ة» و«احيلـ / ت» و«بذمته/ا» — خيارٌ للجنسين بدل الشرطة، فيُطبع كلٌّ لصاحبه.
 */
export function slashChoices(texts: string[]): { text: string; male: string; female: string }[] {
  const found = new Map<string, { text: string; male: string; female: string }>();
  for (const t of texts) {
    for (const m of t.matchAll(/([ء-يـ]+?)ـ*\s*\/\s*(ة|ت|ها|ا)(?![ء-ي])/g)) {
      const word = stripTatweel(m[1]!);
      if ((word.match(/[ء-ي]/g) ?? []).length < 2) continue;
      const mark = m[2]!;
      const stem = word.replace(/^[وف](?=[ء-ي]{3})/, '');
      const female =
        mark === 'ت'
          ? `${word}ت`
          : mark === 'ا'
            ? word.endsWith('ه') ? `${word}ا` : ''
            : mark === 'ها'
              ? word.endsWith('ه') ? `${word.slice(0, -1)}ها` : ''
              : SLASH_VERBS.has(stem)
                ? `${word}ت`
                : `${word}ة`;
      if (female && !found.has(m[0])) found.set(m[0], { text: m[0], male: word, female });
    }
  }
  return [...found.values()];
}

/** الخيار الذي يكشفه «جرّب باسمٍ آخر»: كلمة المذكّر حين يُختار المؤنّث، والعكس. */
export function wrongGenderWords(gender: 'ذكر' | 'أنثى'): string[] {
  return GENDER_PAIRS.map(([m, f]) => (gender === 'أنثى' ? m : f));
}
