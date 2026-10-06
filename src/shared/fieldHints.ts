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
import { citizenLink, detectBlanks, suggestFieldName } from './blanks';
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

function countIn(texts: string[], needle: string): number {
  let n = 0;
  for (const t of texts) {
    for (let at = t.indexOf(needle); at >= 0; at = t.indexOf(needle, at + needle.length)) if (wholeAt(t, at, needle.length)) n++;
  }
  return n;
}

// ── الفراغات ─────────────────────────────────────────────────────────────

/** خاتمة الكتاب — والنقاط بعدها زخرفة. */
const CLOSING = /(التقدير|الشكر|الاحترام|التحية|التحيات|والسلام)$/;

/** فراغاتٌ باسمٍ واحد، ودرجة الاجتهاد في اسمها وسببه — للمراجعة في «استورد مجلدي». */
type BlankGroup = { hint: FieldHint; confidence: number; reason: string };

/**
 * الفراغات المنقوطة بأسمائها من الكلام قبلها (`blanks.ts`) — واسمٌ واحد لفراغين خانةٌ واحدة:
 * «ولي امر التلميذ ......» و«غيابات التلميذ ......» اسم التلميذ نفسه، يُكتب مرّة.
 * و`skip` فقراتٌ لا يُبحث فيها: رأس الورقة الذي يصير ترويسة.
 */
function blankGroups(doc: Doc, skip: ReadonlySet<string> = new Set()): BlankGroup[] {
  const byLabel = new Map<string, BlankGroup>();
  for (const p of paragraphs(doc)) {
    if (skip.has(p.id)) continue;
    let before = '';
    p.inlines.forEach((inline, run) => {
      if (inline.kind !== 'run') return;
      for (const b of detectBlanks(inline.text)) {
        // «مع التقدير .....» زخرفة الخاتمة لا فراغ.
        if (b.kind === 'dots' && !inline.text.slice(b.end).trim() && CLOSING.test((before + inline.text.slice(0, b.start)).trim())) continue;
        const guess =
          b.kind === 'date' ? { value: 'التاريخ', confidence: 0.95, reason: 'صيغة «/ / 20»' } : suggestFieldName(before + inline.text.slice(0, b.start));
        // «عدد غياباته ( )» عددُ الغيابات لا «غياباته».
        const counted = (before + inline.text.slice(0, b.start)).trim().match(/عدد\s+(?:ال)?([ء-ي]+?)(?:ه|ها|هم)?$/);
        const label = counted ? `عدد ال${counted[1]}` : guess.value === 'حقل' ? 'خانة' : guess.value;
        const group = byLabel.get(label) ?? {
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
        byLabel.set(label, group);
      }
      before += inline.text;
    });
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
const GENDER_PAIRS: [string, string][] = [
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
  ['ابننا', 'ابنتنا'],
  ...(
    'له عنه منه عليه لديه بحقه اسمه عمره ولده غياباته وانذاره انذاره وحثه حثه دوامه خدمته عمله راتبه ' +
    'اجازته إجازته تأييده تاييده مسؤوليته وظيفته درجته معدله نتيجته تولده سكنه طلبه بطلبه'
  )
    .split(/\s+/)
    .map((w): [string, string] => [w, w === 'له' ? 'لها' : `${w}ا`])
];

/** الخيار الذي يكشفه «جرّب باسمٍ آخر»: كلمة المذكّر حين يُختار المؤنّث، والعكس. */
export function wrongGenderWords(gender: 'ذكر' | 'أنثى'): string[] {
  return GENDER_PAIRS.map(([m, f]) => (gender === 'أنثى' ? m : f));
}

/** الاقتراحات كلّها — مرتّبةً: ما يكشف خطأً أوّلًا، ثم الفراغات، ثم الاسم، ثم الباقي. */
export function fieldHints(doc: Doc): FieldHint[] {
  const texts = runTexts(doc);
  const hints: FieldHint[] = [];
  const push = (h: Omit<FieldHint, 'count'>) => {
    const count = countIn(texts, h.text);
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

  // الصياغة مع الجنس — لكتابٍ له صاحب علاقة: اسمٌ مقترح، أو فراغٌ لاسم شخص، أو خانة اسم.
  const hasSubject =
    hints.some((h) => h.kind === 'name' || (h.kind === 'blank' && h.field?.role === 'name')) ||
    doc.fields.some((f) => f.role === 'name' || f.source === 'fullName');
  if (hasSubject) {
    for (const [m, f] of GENDER_PAIRS) {
      for (const word of [m, f]) push({ kind: 'gender', text: word, label: `${word} ← ${m}/${f}`, key: `${m}|${f}` });
    }
  }
  return hints;
}

// ── التطبيق ──────────────────────────────────────────────────────────────

/** يستبدل النصّ في كلّ مواضعه بعقدة خانة — في الفقرات والجداول والأعمدة والمجموعات. */
function replaceInBlocks(blocks: Block[], text: string, ref: string): Block[] {
  const inlines = (list: Inline[]): Inline[] => {
    const out: Inline[] = [];
    const next = (s: string, from: number) => {
      let at = s.indexOf(text, from);
      while (at >= 0 && !wholeAt(s, at, text.length)) at = s.indexOf(text, at + 1);
      return at;
    };
    for (const i of list) {
      if (i.kind !== 'run') {
        out.push(i);
        continue;
      }
      let rest = i.text;
      let at = next(rest, 0);
      if (at < 0) {
        out.push(i);
        continue;
      }
      while (at >= 0) {
        if (at > 0) out.push({ ...i, text: rest.slice(0, at) });
        out.push({ kind: 'field', id: newUuid(), ref });
        rest = rest.slice(at + text.length);
        at = next(rest, 0);
      }
      if (rest) out.push({ ...i, text: rest });
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
  const blocks = hint.spots ? replaceSpots(doc.blocks, hint.spots, key) : replaceInBlocks(doc.blocks, hint.text, key);
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
