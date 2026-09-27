/**
 * تنبيهٌ إملائيّ قبل الإصدار — اقتراحٌ يُعرض، لا تصحيحٌ صامت (المبدأ ٥).
 *
 * ثلاثة أخطاء تتكرّر في ورق المكاتب لأنّ لوحة المفاتيح تسهّلها:
 *   - الياء مكان الألف المقصورة: «الى» و«حتي» و«مستوي».
 *   - الهاء مكان التاء المربوطة: «المدرسه» و«الشهاده» و«الدراسيه».
 *   - الترقيم اللاتيني في نصٍّ عربي: «,» و«?» و«;»، ومسافةٌ قبل علامة الترقيم.
 *
 * والكلمة تُطابَق كاملةً (لا حرفٌ عربيّ قبلها ولا بعدها) — فـ«الىٰ» في وسط كلمةٍ
 * لا تُمسّ. وما قد يكون صوابًا («علي» اسمًا، «لدي» بمعنى عندي) لا يُقترح أصلًا.
 */
import type { Doc, Inline, ListItem } from './doc';

export type SpellIssue = {
  /** ما كُتب — والعلامة نفسها للترقيم. */
  word: string;
  fix: string;
  reason: string;
  count: number;
};

const L = '\\u0621-\\u064a';

const YA_TO_ALIF: Record<string, string> = {
  الى: 'إلى', حتي: 'حتى', متي: 'متى', مستشفي: 'مستشفى', المستشفي: 'المستشفى', مستوي: 'مستوى',
  المستوي: 'المستوى', مصطفي: 'مصطفى', موسي: 'موسى', عيسي: 'عيسى', يحيي: 'يحيى', مرتضي: 'مرتضى',
  مجتبي: 'مجتبى', ليلي: 'ليلى', سلمي: 'سلمى', الكبري: 'الكبرى', الصغري: 'الصغرى', العظمي: 'العظمى',
  الوسطي: 'الوسطى', الاخري: 'الأخرى', اخري: 'أخرى', الذكري: 'الذكرى', الاولي: 'الأولى', المثني: 'المثنى'
};

const HAMZA: Record<string, string> = { اذا: 'إذا', ايضا: 'أيضًا', لان: 'لأن', الان: 'الآن', انشاء: 'إنشاء' };

const HA_TO_TA = (
  'مدرسه المدرسه شهاده الشهاده مديريه المديريه وزاره الوزاره محافظه المحافظه جامعه الجامعه كليه ' +
  'الكليه دائره الدائره سنه السنه ماده الماده بطاقه البطاقه هويه الهويه معامله المعامله طالبه ' +
  'الطالبه موظفه الموظفه محترمه المحترمه دراسه الدراسه تربيه التربيه جمهوريه الجمهوريه شعبه ' +
  'الشعبه اداره الاداره اداره مؤسسه المؤسسه شركه الشركه قائمه القائمه ورقه الورقه صوره الصوره ' +
  'نسخه النسخه مده المده حاله الحاله خدمه الخدمه رساله الرساله درجه الدرجه نتيجه النتيجه مرحله ' +
  'المرحله ثانويه الثانويه متوسطه المتوسطه اعداديه الاعداديه ابتدائيه الابتدائيه'
)
  .split(/\s+/)
  .reduce<Record<string, string>>((all, w) => ({ ...all, [w]: `${w.slice(0, -1)}ة` }), {});

/** «ال…يه» صفةٌ منسوبة غالبًا: «الدراسيه» ← «الدراسية» — إلا مصادر «التفعيل» و«فعيل». */
const NISBA = new RegExp(`(?<![${L}])(ال[${L}]{2,}يه)(?![${L}])`, 'g');
const NISBA_KEEP = new Set(['التوجيه', 'التنبيه', 'التشبيه', 'الترفيه', 'التمويه', 'التنزيه', 'الفقيه', 'النبيه', 'الوجيه', 'السفيه', 'الكريه', 'الشبيه', 'البديه']);

const WORDS: Record<string, [string, string]> = {};
for (const [w, fix] of Object.entries(YA_TO_ALIF)) WORDS[w] = [fix, 'ألفٌ مقصورة لا ياء'];
for (const [w, fix] of Object.entries(HAMZA)) WORDS[w] = [fix, 'همزة'];
for (const [w, fix] of Object.entries(HA_TO_TA)) WORDS[w] = [fix, 'تاءٌ مربوطة لا هاء'];
const WORD_RE = new RegExp(`(?<![${L}])(${Object.keys(WORDS).join('|')})(?![${L}])`, 'g');

const PUNCT: { find: RegExp; word: string; fix: string; reason: string; replace: string }[] = [
  { find: new RegExp(`([${L}])\\s*,\\s*`, 'g'), word: ',', fix: '،', reason: 'فاصلةٌ لاتينية في نصٍّ عربي', replace: '$1، ' },
  { find: new RegExp(`([${L}])\\s*\\?`, 'g'), word: '?', fix: '؟', reason: 'علامة استفهامٍ لاتينية', replace: '$1؟' },
  { find: new RegExp(`([${L}])\\s*;\\s*`, 'g'), word: ';', fix: '؛', reason: 'فاصلةٌ منقوطة لاتينية', replace: '$1؛ ' },
  { find: new RegExp(`([${L}])\\s+([،؛؟:!.])(?!\\d)`, 'g'), word: ' ،', fix: '،', reason: 'مسافةٌ قبل علامة الترقيم', replace: '$1$2' }
];

/** الاقتراحات في نصٍّ واحد — مجموعةً بكلمتها وعددِ مرّاتها. */
export function spellingIssues(text: string): SpellIssue[] {
  const found = new Map<string, SpellIssue>();
  const add = (word: string, fix: string, reason: string) => {
    const key = `${word}→${fix}`;
    const prev = found.get(key);
    if (prev) prev.count++;
    else found.set(key, { word, fix, reason, count: 1 });
  };
  for (const m of text.matchAll(WORD_RE)) {
    const [fix, reason] = WORDS[m[1]!]!;
    add(m[1]!, fix, reason);
  }
  for (const m of text.matchAll(NISBA)) {
    if (!NISBA_KEEP.has(m[1]!) && !WORDS[m[1]!]) add(m[1]!, `${m[1]!.slice(0, -1)}ة`, 'تاءٌ مربوطة لا هاء');
  }
  for (const rule of PUNCT) {
    rule.find.lastIndex = 0;
    for (const _ of text.matchAll(rule.find)) add(rule.word, rule.fix, rule.reason);
  }
  return [...found.values()];
}

/** يطبّق الاقتراحات المختارة على نصّ — كلمةً كاملةً لا بعضَ كلمة. */
export function applySpelling(text: string, issues: SpellIssue[]): string {
  let out = text;
  for (const issue of issues) {
    const rule = PUNCT.find((p) => p.word === issue.word && p.fix === issue.fix);
    if (rule) {
      out = out.replace(rule.find, rule.replace);
      continue;
    }
    const escaped = issue.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![${L}])${escaped}(?![${L}])`, 'g'), issue.fix);
  }
  return out;
}

// ── في الوثيقة: نصُّها الثابت لا قيمُ حقولها ────────────────────────

function runsOf(list: Inline[] | undefined, visit: (text: string) => string): Inline[] | undefined {
  return list?.map((n) => (n.kind === 'run' ? { ...n, text: visit(n.text) } : n));
}

function items(list: ListItem[], visit: (text: string) => string): ListItem[] {
  return list.map((it) => ({
    ...it,
    inlines: runsOf(it.inlines, visit)!,
    answer: runsOf(it.answer, visit),
    items: it.items && items(it.items, visit)
  }));
}

/** يمرّ على كل نصٍّ ثابت في الوثيقة: الفقرات والجداول والأسئلة ونصوص اللوحة. */
function mapText(doc: Doc, visit: (text: string) => string): Doc {
  const block = (b: Doc['blocks'][number]): Doc['blocks'][number] => {
    switch (b.kind) {
      case 'paragraph':
        return { ...b, inlines: runsOf(b.inlines, visit)! };
      case 'list':
        return { ...b, items: items(b.items, visit) };
      case 'table':
        return {
          ...b,
          rows: b.rows.map((r) => ({
            ...r,
            cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map((p) => ({ ...p, inlines: runsOf(p.inlines, visit)! })) }))
          }))
        };
      case 'group':
        return { ...b, blocks: b.blocks.map(block) };
      default:
        return b;
    }
  };
  return {
    ...doc,
    blocks: doc.blocks.map(block),
    canvas: doc.canvas && {
      ...doc.canvas,
      elements: doc.canvas.elements.map((el) => (el.kind === 'text' ? { ...el, inlines: runsOf(el.inlines, visit)! } : el))
    }
  };
}

/** اقتراحات نصّ الوثيقة الثابت — ما كتبه المؤلّف في الورشة. */
export function docSpelling(doc: Doc): SpellIssue[] {
  const texts: string[] = [];
  mapText(doc, (t) => (texts.push(t), t));
  return spellingIssues(texts.join('\n'));
}

/** يصحّح نصّ الوثيقة الثابت بالاقتراحات المختارة — والحقول لا تُمسّ. */
export function fixDocSpelling(doc: Doc, issues: SpellIssue[]): Doc {
  return mapText(doc, (t) => applySpelling(t, issues));
}
