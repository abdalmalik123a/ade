/**
 * الخانات المقترحة من الورقة (خطّة الترقية، المرحلة ١): ملفّ Word يُفتح كما هو، والمتغيّر فيه
 * فراغٌ منقوط («التلميذ ......»، «( )»، «/ / 20») أو نصٌّ مكتوب — اسم صاحب العلاقة وصفّه
 * وسنته وتاريخه — وصياغةٌ تتبع جنسه. فيُقترح كلٌّ منها خانةً بضغطة، في كلّ مواضعه معًا،
 * بدل أن يُظلَّل ويُضغط F4 في كلّ موضع.
 *
 * ومعها ما يكشفه «جرّب باسمٍ آخر»: قيمة خانةٍ ما زالت مكتوبةً نصًّا في موضعٍ آخر (الاسم صار
 * خانةً في السطر الأوّل وبقي في الثالث) — فيُطبع الكتاب باسمين.
 *
 * اقتراحٌ لا قرار (الأساس §١٥): لا يُغيَّر شيءٌ حتى يضغط الموظف.
 */
import { citizenLink, detectBlanks, nearText, stripTatweel, suggestDateName, suggestFieldName, trailingText } from './blanks';
import {
  makeField,
  walkBlocks,
  newUuid,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type ParagraphBlock,
  type Suggestion
} from './doc';
import { fieldFromText } from './docEdit';
import { guessGender, isChoiceKey } from './gender';

/** فراغٌ بعينه: في أيّ فقرة، وأيّ مقطع، ومن أين إلى أين. */
type Spot = { para: string; run: number; start: number; end: number; raw: string };

export type FieldHint = {
  kind: 'blank' | 'name' | 'class' | 'year' | 'date' | 'gender' | 'repeat';
  /** النصّ كما هو على الورقة. */
  text: string;
  /** ما يُقال للموظف: «اسم التلميذ»، «الصف»، «المذكور ← المذكور/المذكورة». */
  label: string;
  /** كم موضعًا فيه. */
  count: number;
  /** الخانة التي يصيرها: موجودةٌ (`key`) أو تُصنع بهذا الوصف. */
  key?: string;
  field?: Partial<DocField>;
  /** الفراغات: مواضعها بأعيانها — فالنقاط نفسها في مواضع أخرى لخاناتٍ أخرى. */
  spots?: Spot[];
};

const AR = 'ء-يٱ-ۓ';
const LETTER = new RegExp(`[${AR}ـ\\u064B-\\u0652]`);
const DIGIT = '[0-9٠-٩]';

/** النصّ في موضعه حرفًا لا جزءَ كلمةٍ أطول: «الطالب» لا تقع في «الطالبة». */
function wholeAt(text: string, at: number, len: number): boolean {
  const before = text[at - 1];
  const after = text[at + len];
  return !(before && LETTER.test(before)) && !(after && LETTER.test(after));
}

/** فقرات الورقة كلّها: المتن والأعمدة والمجموعات وخلايا الجداول. */
function paragraphs(doc: Doc): ParagraphBlock[] {
  const out: ParagraphBlock[] = [];
  for (const b of walkBlocks(doc.blocks)) {
    if (b.kind === 'paragraph') out.push(b);
    else if (b.kind === 'table') for (const r of b.rows) for (const c of r.cells) out.push(...c.blocks);
  }
  return out;
}

function runTexts(doc: Doc): string[] {
  return paragraphs(doc).flatMap((p) => p.inlines.flatMap((i) => (i.kind === 'run' ? [i.text] : [])));
}

/** موضعٌ يُترك: الكلمة فيه جزءُ عبارةٍ ثابتة لا تخصّ صاحب العلاقة. */
type Skip = (text: string, at: number, word: string) => boolean;

function countIn(texts: string[], needle: string, skip?: Skip): number {
  let n = 0;
  for (const t of texts) {
    for (let at = t.indexOf(needle); at >= 0; at = t.indexOf(needle, at + needle.length)) if (wholeAt(t, at, needle.length) && !skip?.(t, at, needle)) n++;
  }
  return n;
}

// ── الفراغات ─────────────────────────────────────────────────────────────

/** خاتمة الكتاب و«المحترم» بعد المخاطَب — والنقاط بعدها زخرفة. */
const CLOSING = /(التقدير|الشكر|الاحترام|التحية|التحيات|والسلام|المحترم|المحترمة|المحترمين|المحترمون)$/;
/**
 * و«للتفضل بالعلم والاطلاع ...... مع التقدير» و«ولكم الأمر ...... مع فائق الشكر»: النقاط قبل الخاتمة وقفةٌ لا
 * فراغ — ونقاطٌ قصيرة قبلها كذلك («في / / 20 .... للتفضل بالعلم»).
 */
const CLOSING_LEAD = /(?:الاطلاع|بالعلم|للعلم|للتفضل|يلزم|بموجبه|الامر|الأمر)$/;
const CLOSING_NEXT = /^\s*(?:(?:لل|ل)?(?:تفضل|اطلاع|علم)|و?لكم|و?مع)[^.…_]{0,40}?(?:التقدير|الشكر|الاحترام|التحية|التحيات)/;

/** ما يلي «العدد» ولا يُعدّ: «كتابكم ذو العدد في …» عددُ الكتاب لا عدد شيء. */
const NOT_COUNTED = new Set(['في', 'من', 'على', 'الى', 'إلى', 'عن', 'لدى', 'مع']);

/** فراغاتٌ باسمٍ واحد، ودرجة الاجتهاد في اسمها وسببه — للمراجعة في «استورد مجلدي». */
type BlankGroup = { hint: FieldHint; confidence: number; reason: string };

/**
 * الفراغات المنقوطة بأسمائها من الكلام قبلها (`blanks.ts`) — واسمٌ واحد لفراغين خانةٌ واحدة:
 * «ولي امر التلميذ ......» و«غيابات التلميذ ......» اسم التلميذ نفسه، يُكتب مرّة.
 * و`skip` فقراتٌ لا يُبحث فيها: رأس الورقة الذي يصير ترويسة.
 */
function blankGroups(doc: Doc, skip: ReadonlySet<string> = new Set()): BlankGroup[] {
  const byLabel = new Map<string, BlankGroup>();
  // آخر كلامٍ في الفقرة السابقة: سطر Excel جزءٌ من جملةٍ قبله («…بموجب الوثيقة الصادرة من ⏎ ( ...... ) والمرقمة»)،
  // وخليّة الجدول عنوانها في الخليّة قبلها.
  let carried = '';
  let lone = 0;
  for (const p of paragraphs(doc)) {
    if (skip.has(p.id)) {
      carried = '';
      continue;
    }
    let before = '';
    let lastLabel = '';
    p.inlines.forEach((inline, run) => {
      if (inline.kind !== 'run') {
        // كسر السطر (وخانةٌ قائمة) حدٌّ بين كلامين: خليّةٌ فيها «مدير المدرسة ⏎ التوقيع: ....» اسم فراغها
        // «التوقيع» — وكان السطران يلتصقان فيصير «…المدرسةالتوقيع».
        before += '\n';
        return;
      }
      for (const b of detectBlanks(inline.text)) {
        // اسم الفراغ من سطره، وإلا من السطر قبله — وفراغٌ قبله حدٌّ كذلك: «المحافظة ...... قضاء ......» اسم
        // الثاني «قضاء» لا نقاط الأوّل.
        const context = before + inline.text.slice(0, b.start);
        const own = nearText(context);
        const near = own || carried;
        // «مع التقدير .....» زخرفة الخاتمة لا فراغ — و«والاطلاع ...... مع التقدير» وقفةٌ قبلها. والمدّ لا يُخفيها:
        // «والتقديـــر .....» خاتمةٌ كذلك.
        const after = stripTatweel(inline.text.slice(b.end));
        const closing =
          (!after.trim() && CLOSING.test(stripTatweel(near).trim())) ||
          (CLOSING_NEXT.test(after) && (CLOSING_LEAD.test(stripTatweel(own).trim()) || b.raw.length <= 5));
        if (b.kind === 'dots' && closing) continue;
        let guess = b.kind === 'date' ? suggestDateName(own ? context : near, lastLabel) : suggestFieldName(near);
        let fromPrev = !own && Boolean(carried);
        // «في ......» أوّل السطر: ما يُسمّيه في آخر السطر قبله («حصل على درجة ⏎ في ......»).
        if (b.kind !== 'date' && own && guess.value === 'حقل' && carried) {
          guess = suggestFieldName(`${carried} ${own}`);
          fromPrev = true;
        }
        if (fromPrev && guess.value !== 'حقل') guess = { ...guess, confidence: Math.min(guess.confidence, 0.5), reason: `${guess.reason} — من السطر قبله` };
        // «عدد غياباته ( )» عددُ الغيابات لا «غياباته» — و«ذو العدد في …» ليس عددًا.
        const countedMatch = near.trim().match(/عدد\s+(?:ال)?([ء-ي]+?)(?:ه|ها|هم)?$/);
        const counted = countedMatch && !NOT_COUNTED.has(countedMatch[1]!) ? countedMatch : null;
        const label = counted ? `عدد ال${counted[1]}` : guess.value === 'حقل' ? 'خانة' : guess.value;
        lastLabel = label;
        // فراغٌ بلا اسم خانةٌ وحده — وكانت فراغات الورقة المجهولة خانةً واحدة يملؤها قولٌ واحد. و«التاريخ» بلا
        // ما يميّزه يلتقي بما كلامه قبله مثله وحده: تاريخ الكتاب في رأسه غير «بتاريخ / /» في متنه.
        const groupKey = label === 'خانة' ? `خانة ${++lone}` : label === 'التاريخ' ? `التاريخ ${own.trim().replace(/\s+/g, ' ')}` : label;
        const group = byLabel.get(groupKey) ?? {
          hint: {
            kind: 'blank' as const,
            text: b.raw,
            label,
            count: 0,
            field: { label, type: b.type, width: b.width, ...citizenLink(guess) },
            spots: []
          },
          confidence: guess.confidence,
          reason: guess.reason
        };
        group.hint.spots!.push({ para: p.id, run, start: b.start, end: b.end, raw: b.raw });
        group.hint.count = group.hint.spots!.length;
        group.hint.field = { ...group.hint.field, width: Math.max(group.hint.field?.width ?? 0, b.width) };
        // اسمٌ واحد من مواضع عدّة: أضعف اجتهادٍ فيها درجته — فلا يُخفى موضعٌ مشكوك.
        group.confidence = Math.min(group.confidence, guess.confidence);
        byLabel.set(groupKey, group);
      }
      before += inline.text;
    });
    carried = trailingText(before);
  }
  return [...byLabel.values()];
}

function blankHints(doc: Doc): FieldHint[] {
  return blankGroups(doc).map((g) => g.hint);
}

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

function names(texts: string[]): string[] {
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
const CLASS_RE = new RegExp(`(?:الصف|المرحلة)\\s+((?:${ORDINAL})(?:\\s+(?:${STAGE}))?)`, 'g');
const YEAR_RE = new RegExp(`(?:19|20|١٩|٢٠)${DIGIT}{2}\\s*[-/–]\\s*(?:19|20|١٩|٢٠)${DIGIT}{2}`, 'g');
const DATE_RE = new RegExp(`${DIGIT}{1,2}\\s*/\\s*${DIGIT}{1,2}\\s*/\\s*(?:19|20|١٩|٢٠)${DIGIT}{2}`, 'g');

function matches(texts: string[], re: RegExp, group = 0): string[] {
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
const SUBJECT_PAIRS: [string, string][] = [
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
const PRONOUN_PAIRS: [string, string][] = (
  'له عنه منه عليه لديه بحقه اسمه عمره ولده غياباته وانذاره انذاره وحثه حثه دوامه خدمته عمله راتبه ' +
  'اجازته إجازته تأييده تاييده مسؤوليته وظيفته درجته معدله نتيجته تولده سكنه طلبه بطلبه ' +
  'تبليغه تزويده صورته فحصه معالجته احالته إحالته مباشرته انفكاكه تخرجه غيابه تغيبه انقطاعه استمراره'
)
  .split(/\s+/)
  .map((w): [string, string] => [w, w === 'له' ? 'لها' : `${w}ا`]);
const GENDER_PAIRS: [string, string][] = [...SUBJECT_PAIRS, ...PRONOUN_PAIRS];

/** «السيد» قبل خانة اسم صاحب العلاقة له لا للجهة المخاطَبة: «بالسيد ( {الاسم} ) بعنوان…». */
const TITLE_BEFORE_NAME = /(?:^|[^ء-ي])((?:و|ب|ل|ف)?(?:ال)?سيد)\s*\(?\s*$/;

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
const notSubjectAt: Skip = (text, at, word) =>
  SLASH_AFTER.test(text.slice(at + word.length)) ||
  FIXED.some((f) => f.word === word && (f.before?.test(text.slice(0, at)) ?? true) && (f.after?.test(text.slice(at + word.length)) ?? true));

/** أفعالٌ ماضية تكتبها المدارس «/ة» وتأنيثها بالتاء: «باشر /ة» ← باشرت. */
const SLASH_VERBS = new Set(
  'باشر انقطع انفك تغيب غاب التحق نقل حضر تخرج نجح رسب قدم وقع تعهد سافر عاد استلم سلم حصل احيل أحيل اكمل أكمل'.split(' ')
);

/**
 * الجنسان بشرطة كما تكتبهما المدارس: «السيد / ة» و«احيلـ / ت» و«بذمته/ا» — خيارٌ للجنسين بدل الشرطة، فيُطبع كلٌّ لصاحبه.
 */
function slashChoices(texts: string[]): { text: string; male: string; female: string }[] {
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

/** الاقتراحات كلّها — مرتّبةً: ما يكشف خطأً أوّلًا، ثم الفراغات، ثم الاسم، ثم الباقي. */
export function fieldHints(doc: Doc): FieldHint[] {
  const texts = runTexts(doc);
  const hints: FieldHint[] = [];
  const push = (h: Omit<FieldHint, 'count'>) => {
    const count = countIn(texts, h.text, h.kind === 'gender' ? notSubjectAt : undefined);
    if (count > 0 && !hints.some((x) => x.text === h.text)) hints.push({ ...h, count });
  };

  // قيمة خانةٍ مكتوبةٌ نصًّا في موضعٍ آخر: الخانة صُنعت من ظلّ النصّ فاسمها نصّه.
  for (const f of doc.fields) {
    if (isChoiceKey(f.key) || !f.label) continue;
    const words = f.label.trim().split(/\s+/).length;
    if (words < 2 && f.role !== 'name') continue;
    push({ kind: 'repeat', text: f.label.trim(), label: `مكتوبٌ نصًّا وهو خانة «${f.label.trim()}»`, key: f.key });
  }

  const blanks = blankHints(doc);
  hints.push(...blanks);

  for (const name of names(texts)) {
    push({ kind: 'name', text: name, label: 'الاسم', field: { label: 'الاسم', source: 'fullName', role: 'name', width: Math.max(18, name.length) } });
  }
  for (const c of matches(texts, CLASS_RE, 1)) push({ kind: 'class', text: c, label: 'الصف', field: { label: 'الصف', width: Math.max(12, c.length) } });
  for (const y of matches(texts, YEAR_RE)) push({ kind: 'year', text: y, label: 'العام الدراسي', field: { label: 'العام الدراسي', width: 11 } });
  for (const d of matches(texts, DATE_RE)) push({ kind: 'date', text: d, label: 'التاريخ', field: { label: 'التاريخ', type: 'date', width: 12 } });

  // الجنسان بشرطة («السيد / ة») قالهما الكتاب صراحةً — فيُقترحان خيارًا ولو لم يُعرف صاحب العلاقة، وقبل الكلمة وحدها.
  for (const s of slashChoices(texts)) push({ kind: 'gender', text: s.text, label: `${s.text} ← ${s.male}/${s.female}`, key: `${s.male}|${s.female}` });

  // الصياغة مع الجنس — لكتابٍ له صاحب علاقة: اسمٌ مقترح، أو فراغٌ لاسم شخص، أو خانة اسم — أو جنسان قالهما الكتاب
  // بشرطة أو بخيار.
  const hasSubject =
    hints.some((h) => h.kind === 'name' || h.kind === 'gender' || (h.kind === 'blank' && h.field?.role === 'name')) ||
    doc.fields.some((f) => f.role === 'name' || f.source === 'fullName' || isChoiceKey(f.key));
  if (hasSubject) {
    for (const [m, f] of SUBJECT_PAIRS) {
      for (const word of [m, f]) push({ kind: 'gender', text: word, label: `${word} ← ${m}/${f}`, key: `${m}|${f}` });
    }
    // والكتاب مكتوبٌ لجنسٍ واحد — المذكّر غالبًا: فضمير الجنس الآخر فيه لاسمٍ غيره («المدرسة التي تخرج منها التلميذ»)
    // لا لصاحب العلاقة؛ ويُقترح ضمير جنس الكتاب وحده.
    const feminine = SUBJECT_PAIRS.some(([, f]) => countIn(texts, f) > 0) && !SUBJECT_PAIRS.some(([m]) => countIn(texts, m) > 0);
    // وبواو العطف: «فحصه ومعالجته».
    for (const [m, f] of PRONOUN_PAIRS.flatMap(([m, f]): [string, string][] => [[m, f], [`و${m}`, `و${f}`]])) {
      const word = feminine ? f : m;
      push({ kind: 'gender', text: word, label: `${word} ← ${m}/${f}`, key: `${m}|${f}` });
    }
    // و«السيد» قبل خانة اسم صاحب العلاقة — بمواضعها، فـ«السيد المدير المحترم» يبقى. ولصاحب علاقةٍ واحد: في «التسليم
    // بين المدير السابق والحالي» شخصان، وخيار الجنس واحد.
    const named = new Set(doc.fields.filter((f) => f.role === 'name' || f.source === 'fullName').map((f) => f.key));
    const byWord = new Map<string, Spot[]>();
    for (const p of named.size === 1 ? paragraphs(doc) : []) {
      p.inlines.forEach((inline, run) => {
        const next = p.inlines[run + 1];
        if (inline.kind !== 'run' || next?.kind !== 'field' || !named.has(next.ref)) return;
        const m = TITLE_BEFORE_NAME.exec(inline.text);
        if (!m) return;
        const start = m.index + m[0].length - m[0].replace(/^[^ء-ي]/, '').length;
        const end = start + m[1]!.length;
        byWord.set(m[1]!, [...(byWord.get(m[1]!) ?? []), { para: p.id, run, start, end, raw: m[1]! }]);
      });
    }
    for (const [word, spots] of byWord) {
      if (!hints.some((x) => x.text === word)) hints.push({ kind: 'gender', text: word, label: `${word} ← ${word}/${word}ة`, key: `${word}|${word}ة`, count: spots.length, spots });
    }
  }
  return hints;
}

// ── التطبيق ──────────────────────────────────────────────────────────────

/** يستبدل النصّ في كلّ مواضعه بعقدة خانة — في الفقرات والجداول والأعمدة والمجموعات. */
function replaceInBlocks(blocks: Block[], text: string, ref: string, skip?: Skip): Block[] {
  const inlines = (list: Inline[]): Inline[] => {
    const out: Inline[] = [];
    // المواضع في نصّ المقطع كاملًا — فتُرى العبارة حول الكلمة («نسخة منه») قبل أن يُقطع.
    const spots = (s: string) => {
      const at: number[] = [];
      for (let i = s.indexOf(text); i >= 0; i = s.indexOf(text, i + 1)) {
        if (wholeAt(s, i, text.length) && !skip?.(s, i, text) && (!at.length || i >= at[at.length - 1]! + text.length)) at.push(i);
      }
      return at;
    };
    for (const i of list) {
      if (i.kind !== 'run') {
        out.push(i);
        continue;
      }
      const found = spots(i.text);
      if (!found.length) {
        out.push(i);
        continue;
      }
      let from = 0;
      for (const at of found) {
        if (at > from) out.push({ ...i, text: i.text.slice(from, at) });
        out.push({ kind: 'field', id: newUuid(), ref });
        from = at + text.length;
      }
      if (from < i.text.length) out.push({ ...i, text: i.text.slice(from) });
    }
    return out;
  };
  return mapParagraphs(blocks, (p) => ({ ...p, inlines: inlines(p.inlines) }));
}

/** يمرّ على كلّ فقرة — في المتن والجداول والأعمدة والمجموعات. */
function mapParagraphs(blocks: Block[], fn: (p: ParagraphBlock) => ParagraphBlock): Block[] {
  return blocks.map((b): Block => {
    switch (b.kind) {
      case 'paragraph':
        return fn(b);
      case 'table':
        return { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map(fn) })) })) };
      case 'columns':
        return { ...b, columns: b.columns.map((col) => mapParagraphs(col, fn)) };
      case 'group':
        return { ...b, blocks: mapParagraphs(b.blocks, fn) };
      default:
        return b;
    }
  });
}

/** الفراغات بأعيانها خانةٌ واحدة. */
function replaceSpots(blocks: Block[], spots: Spot[], ref: string): Block[] {
  return replaceAllSpots(blocks, spots.map((s) => ({ ...s, ref })));
}

/** الفراغات بأعيانها، لكلٍّ خانته — في مرّةٍ واحدة، فلا يُزحزح استبدالٌ مواضع ما بعده في المقطع نفسه. */
function replaceAllSpots(blocks: Block[], spots: (Spot & { ref: string })[]): Block[] {
  return mapParagraphs(blocks, (p) => {
    const mine = spots.filter((s) => s.para === p.id);
    if (!mine.length) return p;
    const out: Inline[] = [];
    p.inlines.forEach((inline, run) => {
      const cuts = mine.filter((s) => s.run === run).sort((a, b) => a.start - b.start);
      if (inline.kind !== 'run' || !cuts.length) {
        out.push(inline);
        return;
      }
      let at = 0;
      for (const c of cuts) {
        // الورقة تغيّرت منذ الاقتراح: لا يُستبدل ما لم يعد فراغًا.
        if (inline.text.slice(c.start, c.end) !== c.raw) continue;
        if (c.start > at) out.push({ ...inline, text: inline.text.slice(at, c.start) });
        out.push({ kind: 'field', id: newUuid(), ref: c.ref });
        at = c.end;
      }
      if (at < inline.text.length) out.push({ ...inline, text: inline.text.slice(at) });
    });
    return { ...p, inlines: out };
  });
}

/** يجعل الاقتراح خانةً في كلّ مواضعه — خانةً موجودة، أو جديدةً بوصفه. */
export function applyHint(doc: Doc, hint: FieldHint): Doc {
  let key = hint.key;
  let fields = doc.fields;
  if (!key) {
    // كما يصنعها F4: مفتاحٌ فريد من اسمها، وعرضها طول ما كان مكتوبًا.
    const field = fieldFromText(doc, hint.text, hint.field);
    if (!field) return doc;
    key = field.key;
    fields = [...fields, field];
  } else if (!fields.some((f) => f.key === key)) {
    fields = [...fields, makeField({ key, label: key })];
  }
  const blocks = hint.spots
    ? replaceSpots(doc.blocks, hint.spots, key)
    : replaceInBlocks(doc.blocks, hint.text, key, hint.kind === 'gender' ? notSubjectAt : undefined);
  return { ...doc, blocks, fields };
}

/**
 * الفراغات كلّها خاناتٍ دفعةً واحدة — لـ«استورد مجلدي» (الموجة ٢): ما يقترحه المحرّر للملفّ الواحد بضغطة
 * يُطبَّق على مئات الملفّات بلا ضغطة، ولكلّ خانةٍ اقتراحٌ بدرجته وسببه تُراجَع به (`value`: «المفتاح — الاسم»
 * كما يكتبه `buildBody`). و`from` أوّل كتلةٍ يُبحث فيها: ما قبلها رأسٌ يصير ترويسة، وفراغاته (العدد والتاريخ)
 * تبقى نقاطًا يملؤها القلم.
 */
export function applyBlankFields(
  doc: Doc,
  opts: { from?: number; fillMode?: DocField['fillMode'] } = {}
): { doc: Doc; suggestions: Suggestion<string>[] } {
  const skip = new Set(
    walkBlocks(doc.blocks.slice(0, opts.from ?? 0)).flatMap((b) =>
      b.kind === 'paragraph' ? [b.id] : b.kind === 'table' ? b.rows.flatMap((r) => r.cells.flatMap((c) => c.blocks.map((p) => p.id))) : []
    )
  );
  const fields = [...doc.fields];
  const spots: (Spot & { ref: string })[] = [];
  const suggestions: Suggestion<string>[] = [];
  for (const g of blankGroups(doc, skip)) {
    // كما يصنعها F4: مفتاحٌ فريد من اسمها، وعرضها أعرض فراغاتها.
    const field = fieldFromText({ ...doc, fields }, g.hint.text, { ...g.hint.field, ...(opts.fillMode ? { fillMode: opts.fillMode } : {}) });
    if (!field) continue;
    fields.push(field);
    for (const s of g.hint.spots!) spots.push({ ...s, ref: field.key });
    suggestions.push({ value: `${field.key} — ${g.hint.label}`, confidence: g.confidence, reason: g.reason });
  }
  return { doc: { ...doc, blocks: replaceAllSpots(doc.blocks, spots), fields }, suggestions };
}
