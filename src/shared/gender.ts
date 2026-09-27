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

/** رجالٌ بأسماءٍ على هيئة المؤنّث — فلا تغلبهم اللاحقة. */
const MALE = new Set(
  (
    'حمزة حمزه طلحة اسامة أسامة عبيدة معاوية قتيبة حذيفة عكرمة عطية علاء ضياء بهاء رضا زكريا ' +
    'مصطفى مرتضى مجتبى موسى عيسى يحيى مثنى هادي علي'
  ).split(/\s+/)
);

const TITLES = /^(السيد|السيدة|الست|الآنسة|الانسة|الطالب|الطالبة|التلميذ|التلميذة|الأستاذ|الاستاذ|الأستاذة|الاستاذة|الدكتور|الدكتورة|الحاج|الحاجة|المرحوم|المرحومة)$/;

/**
 * اقتراح الجنس من الاسم الأول — للمراجعة لا للحكم.
 *
 * قائمة الأسماء أولًا، ثم اللاحقة: ما انتهى بتاءٍ مربوطة أو «اء» أو ألفٍ مقصورة
 * أنثى في الغالب، إلا أسماء رجالٍ معروفة (حمزة، علاء، مصطفى). ويعود «ذكر» لما
 * سوى ذلك مع `sure: false`، والموظف يقلبه بضغطة.
 */
export function guessGender(fullName: string): { gender: Gender; sure: boolean } | null {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  let first = words.find((w) => !TITLES.test(w));
  if (!first) return null;
  // «عبد الله» و«أم البنين» كلمتان.
  if (/^(أم|ام)$/.test(first)) return { gender: 'أنثى', sure: true };
  if (/^(عبد|عبد)$/.test(first)) return { gender: 'ذكر', sure: true };
  first = first.replace(/[ًٌٍَُِّْ]/g, '');
  if (MALE.has(first)) return { gender: 'ذكر', sure: true };
  if (FEMALE.has(first)) return { gender: 'أنثى', sure: true };
  if (/(ة|اء|ى)$/.test(first)) return { gender: 'أنثى', sure: false };
  return { gender: 'ذكر', sure: false };
}

/**
 * أفي الوثيقة خيارُ تذكيرٍ وتأنيث — نصًّا أو عقدةَ حقل، في المتن أو اللوحة؟
 * فالبحث في صورتها المخزّنة كلّها: الجداول والأسئلة والمجموعات لا تفوته.
 */
export function docHasChoices(doc: { blocks?: unknown; canvas?: unknown }): boolean {
  const json = JSON.stringify([doc.blocks ?? null, doc.canvas ?? null]);
  return /"ref":"[^"]*\|[^"]*"/.test(json) || hasChoiceText(json);
}
