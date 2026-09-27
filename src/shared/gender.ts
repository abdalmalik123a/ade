/**
 * التذكير والتأنيث في النصّ — «{الطالب|الطالبة}» و«{ـه|ـها}» و«{المحترم|المحترمة}».
 *
 * الشهادة والتأييد يُكتبان مرّةً للجنسين، ويُطبع كلٌّ لصاحبه صحيحًا: الوسم
 * بخيارين، الأوّل للمذكّر والثاني للمؤنّث، ويُختار عند الرسم بقيمة «الجنس». ومن
 * لم يُحدَّد جنسه يُرسم الخياران «الطالب/الطالبة» — ظاهرًا لا مخمَّنًا — فيُرى
 * قبل الطباعة.
 *
 * واللاحقة بالتطويل («ـه|ـها») تلتصق بالكلمة قبلها: «تأييد{ـه|ـها}» ← «تأييدها».
 */

import { normalizeFold } from './arabic';

/** اسم القيمة التي تحمل الجنس في كل ورقة: «ذكر» أو «أنثى». */
export const GENDER_KEY = 'الجنس';

export type Gender = 'ذكر' | 'أنثى';

/** وسمُ خيارين في نصٍّ خام — والوسم في المتن الجديد عقدةُ حقلٍ مرجعها «أ|ب». */
const CHOICE_RE = /\{([^{}|]*)\|([^{}]*)\}/g;

export const isChoiceKey = (key: string): boolean => key.includes('|');

const tidy = (s: string) => s.replace(/^ـ/, '').trim();

/** الخيار بحسب الجنس — والمجهول يُرسم بالخيارين معًا ليُرى. */
export function pickChoice(ref: string, gender: string | undefined): string {
  const [male = '', female = ''] = ref.split('|');
  if (gender === 'أنثى') return tidy(female);
  if (gender === 'ذكر') return tidy(male);
  return `${tidy(male)}/${tidy(female)}`;
}

/** يحلّ وسوم الخيارين في نصٍّ خام. */
export function resolveChoices(text: string, gender: string | undefined): string {
  return text.replace(CHOICE_RE, (_all, a: string, b: string) => pickChoice(`${a}|${b}`, gender));
}

/** أفي النصّ وسمُ خيارين؟ — فيُسأل عن الجنس في الشبّاك. */
export function hasChoiceText(text: string): boolean {
  CHOICE_RE.lastIndex = 0;
  const found = CHOICE_RE.test(text);
  CHOICE_RE.lastIndex = 0;
  return found;
}

/**
 * أسماء نساءٍ شائعة في العراق لا تُعرف بلاحقتها: «زينب» و«مريم» و«نور».
 * والقائمة اقتراحٌ يصحّحه الموظف بضغطة — لا حكم.
 */
const FEMALE = new Set(
  (
    'زينب مريم نور سارة ساره هند رند ريم رهف رغد سجى هدى منى نهى ضحى ليلى سلمى لمى مها ندى تقى ' +
    'رسل نبأ دعاء اسراء إسراء ايات آيات اية آية امل أمل ايمان إيمان حنان وفاء صفاء سناء هيفاء شيماء علياء ' +
    'بتول البتول غدير كوثر نرجس رباب بنين سكينة خديجة فاطمة عائشة حوراء زهراء الزهراء زهرة زينة شهد تبارك ' +
    'رحاب هبة هبه رنا دينا لينا روان رشا رانيا غادة سعاد سهى شذى عفاف لبنى لقاء ميس ميساء نغم ولاء ' +
    'أريج اريج آمنة امنة أسيل اسيل ياسمين سماح نادية عبير أنوار انوار إخلاص اخلاص حلا غفران فرح نجلاء ' +
    'هالة وسن يقين أزهار ازهار بشرى تغريد جميلة حسناء دلال كريمة ملاك جنان طيبة رقية رقيه سرى مروة ' +
    'مروه زهور سلوى نوال نسرين شيرين جيهان رحمة رحمه نعمة نعمه'
  ).split(/\s+/)
);

/**
 * أسماء رجالٍ شائعة في العراق — يقينًا لا اقتراحًا.
 *
 * وكانت القائمة رجالًا على هيئة المؤنّث وحدهم (حمزة، علاء، مصطفى)، و«أحمد» و«محمد»
 * «ذكرٌ بلا يقين». فلمّا صار ما لا يقين فيه يُسأل قبل الطباعة (ج٤) كان كل صفٍّ من
 * ثلاثين يُسأل عن أولاده جميعًا. فالشائع هنا، والنادر يُسأل مرّةً ويُحفظ جوابه.
 */
const MALE = new Set(
  (
    // على هيئة المؤنّث — فلا تغلبهم اللاحقة
    'حمزة حمزه طلحة اسامة أسامة عبيدة معاوية قتيبة حذيفة عكرمة عطية علاء ضياء بهاء رضا زكريا ' +
    'مصطفى مرتضى مجتبى موسى عيسى يحيى مثنى هادي علي ' +
    // الشائع
    'محمد أحمد احمد محمود حامد حميد حمود حسن حسين حسان حسام عباس جعفر كاظم كريم جاسم قاسم ' +
    'منتظر مهدي صادق باقر جواد يوسف يعقوب إبراهيم ابراهيم إسماعيل اسماعيل نوح آدم ادم سليم سالم ' +
    'سعد سعيد سعدون ماجد مجيد رشيد خالد وليد فراس فارس ياسر ياسين عمار عمر عثمان زيد زياد سيف ليث ' +
    'حيدر كرار أمير امير منير نبيل جميل جمال كمال عادل عدنان عماد فاضل فيصل ناصر منصور أسعد اسعد ' +
    'ثامر ثائر رعد صلاح فلاح طارق مهند مؤيد مؤمن سجاد همام عصام هشام بشار بشير مازن مالك مراد مصعب ' +
    'نزار هاني هيثم وائل يزن يونس غسان غانم غازي فؤاد قصي لؤي معتز منذر ميثم نادر ناظم نجم نعمان نوري ' +
    'هاشم هلال وحيد رائد رامي رياض زهير سامر سامي ستار سلمان شاكر شهاب طه ظافر عامر عقيل علوان عمران ' +
    'غيث فالح فرحان قحطان كامل لطيف ماهر محسن مشتاق مظفر معاذ جبار عبود عدي قيس أيمن ايمن أنس انس ' +
    'أيوب ايوب إدريس ادريس داود سليمان عبدالله عبدالرحمن رسول سرمد ضرغام'
  ).split(/\s+/)
);

/**
 * اللقب يحسم: «الطالبة» و«السيدة» أنثى، و«السيد» و«الطالب» ذكر — كتبه الموظف بنفسه.
 * وما لا يُذكّر ولا يؤنّث («الدكتور» يُقال للاثنين في بعض الكتب) لا يحسم.
 */
const FEMALE_TITLE = /^(السيدة|الست|الآنسة|الانسة|الطالبة|التلميذة|الأستاذة|الاستاذة|الدكتورة|الحاجة|المرحومة)$/;
const MALE_TITLE = /^(السيد|الطالب|التلميذ|الأستاذ|الاستاذ|الحاج|المرحوم)$/;

const MALE_FOLDED = new Set([...MALE].map((n) => normalizeFold(n)));
const FEMALE_FOLDED = new Set([...FEMALE].map((n) => normalizeFold(n)));

const TITLES = /^(السيد|السيدة|الست|الآنسة|الانسة|الطالب|الطالبة|التلميذ|التلميذة|الأستاذ|الاستاذ|الأستاذة|الاستاذة|الدكتور|الدكتورة|الحاج|الحاجة|المرحوم|المرحومة)$/;

/**
 * مفتاح الاسم فيما تعلّمه المكتب (ج٤): الاسم الأوّل بعد اللقب، مطويًّا — «رُسُل» و«رسل»
 * واحد. و«عبد الله» و«أم البنين» كلمتان تُحفظان معًا.
 */
export function firstNameKey(fullName: string): string | null {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const at = words.findIndex((w) => !TITLES.test(w));
  if (at < 0) return null;
  const first = words[at]!;
  const pair = /^(عبد|أم|ام)$/.test(first) && words[at + 1] ? `${first} ${words[at + 1]}` : first;
  return normalizeFold(pair);
}

/** ما تعلّمه المكتب: مفتاح الاسم ← جنسه (services/genderMemory.ts). */
export type LearnedGenders = Record<string, Gender>;

/**
 * اقتراح الجنس من الاسم الأول — للمراجعة لا للحكم.
 *
 * ما تعلّمه المكتب أولًا (سُئل عنه فأجاب)، ثم قائمة الأسماء، ثم اللاحقة: ما انتهى
 * بتاءٍ مربوطة أو «اء» أو ألفٍ مقصورة أنثى في الغالب، إلا أسماء رجالٍ معروفة (حمزة،
 * علاء، مصطفى). ويعود «ذكر» لما سوى ذلك مع `sure: false` — فيُسأل عنه قبل الطباعة.
 */
export function guessGender(
  fullName: string,
  learned: LearnedGenders = {}
): { gender: Gender; sure: boolean; learned?: boolean } | null {
  const key = firstNameKey(fullName);
  if (key && learned[key]) return { gender: learned[key]!, sure: true, learned: true };
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const title = words.find((w) => TITLES.test(w));
  let first = words.find((w) => !TITLES.test(w));
  if (!first) return null;
  if (title && FEMALE_TITLE.test(title)) return { gender: 'أنثى', sure: true };
  if (title && MALE_TITLE.test(title)) return { gender: 'ذكر', sure: true };
  // «عبد الله» و«أم البنين» كلمتان.
  if (/^(أم|ام)$/.test(first)) return { gender: 'أنثى', sure: true };
  if (/^(عبد|عبد)$/.test(first)) return { gender: 'ذكر', sure: true };
  first = first.replace(/[ًٌٍَُِّْ]/g, '');
  // القائمتان مطويّتان (الهمزة والتاء المربوطة): «احمد» و«أحمد» واحد.
  const folded = normalizeFold(first);
  if (MALE_FOLDED.has(folded)) return { gender: 'ذكر', sure: true };
  if (FEMALE_FOLDED.has(folded)) return { gender: 'أنثى', sure: true };
  if (/(ة|اء|ى)$/.test(first)) return { gender: 'أنثى', sure: false };
  return { gender: 'ذكر', sure: false };
}

/**
 * الأسماء التي لم يُعرف جنسها يقينًا — تُسأل قبل الطباعة (ج٤، المبدأ ٥: لا تخمين).
 * وما حُسم لها (`decided`) أو عُرف من المكتب لا يُسأل عنه. بلا تكرار، بترتيبها.
 */
export function unsureNames(names: string[], learned: LearnedGenders = {}, decided: Record<string, Gender> = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const n = name.trim();
    if (!n || seen.has(n) || decided[n]) continue;
    seen.add(n);
    const g = guessGender(n, learned);
    if (g && !g.sure) out.push(n);
  }
  return out;
}

/**
 * أفي الوثيقة خيارُ تذكيرٍ وتأنيث — نصًّا أو عقدةَ حقل، في المتن أو اللوحة؟
 * فالبحث في صورتها المخزّنة كلّها: الجداول والأسئلة والمجموعات لا تفوته.
 */
export function docHasChoices(doc: { blocks?: unknown; canvas?: unknown }): boolean {
  const json = JSON.stringify([doc.blocks ?? null, doc.canvas ?? null]);
  return /"ref":"[^"]*\|[^"]*"/.test(json) || hasChoiceText(json);
}
