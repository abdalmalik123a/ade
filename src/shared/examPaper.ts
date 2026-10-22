/**
 * ورقة الأسئلة — رأسٌ ثابتٌ ومتنٌ يُركَّب.
 *
 * ورقة الامتحان ليست كتابًا رسميًا، ولا تُبنى كما يُبنى: لا تُقيَّد في الصادر،
 * ولا رقم لها، ولا كليشة، ولا شبّاك يملؤها لزبون. ولذلك عُزلت عن مكتبة الكتب
 * بالحكم `print-only` لا بالتصنيف.
 *
 * ورأسها **لا يُؤلَّف**. هو نصٌّ ثابتٌ تتغيّر فيه أسماءٌ معدودة: المدرسة والمادة
 * والصف والزمن. فالمدرّس لا يريد أن يبني رأسًا كتلةً كتلة — يريد أن يكتب أسئلة.
 * لذلك تُخزَّن القيم في `meta.head`، وتُولَّد كتلُ الرأس منها في كل مرّة: المصدر
 * هو السجلّ، والكتلُ صورته. وبهذا تُفتح ورقةٌ حُفظت فتعود القيم إلى خاناتها.
 *
 * والمتنُ قائمةُ ترقيمٍ واحدة بثلاثة مستويات — سؤالٌ ففرعٌ ففرعُ فرع. فليست
 * «بفروع» و«بلا فروع» نوعين، بل عمقًا واحدًا يزيد وينقص.
 */
import {
  emptyDoc,
  fieldRef,
  newUuid,
  paragraph,
  reconcileFields,
  run,
  type Block,
  type ColumnsBlock,
  type Dir,
  type Doc,
  type DocField,
  type GroupBlock,
  type ListBlock,
  type ListItem,
  type Numerals,
  type ParagraphBlock,
  type SpacerBlock
} from './doc';
import { toIndic } from './arabic';
import { escapeHtml } from './html';

/** تصنيفُ ورقة الأسئلة في المكتبة — واحدٌ لكل المواد. */
export const EXAM_CATEGORY = 'أسئلة';

/** مستويات الترقيم: سؤالٌ (س1:) ففرعٌ (أ)) ففرعُ فرعٍ (1-). */
export const EXAM_STYLES: ListBlock['styles'] = ['question', 'arabicLetter', 'number'];

/** أعمقُ ما يُسمح به — وثلاثةٌ تكفي كل ورقةٍ رأيناها. */
export const MAX_DEPTH = 3;

export type HeadInput = {
  key: string;
  label: string;
  width: number;
  hint: string;
};

/**
 * متغيّرات الرأس — وهذه كلّها. وما عداها ثابتٌ يبقى ثابتًا.
 *
 * ترتيبها هو ترتيب خاناتها على الشاشة، فما يُكتب أولًا يُقرأ أولًا.
 */
export const HEAD_INPUTS: HeadInput[] = [
  { key: 'المحافظة', label: 'المديرية العامة لتربية', width: 16, hint: 'بغداد / الرصافة الأولى' }, { key: 'القضاء', label: 'مديرية تربية', width: 16, hint: 'الأعظمية' },
  { key: 'المدرسة', label: 'المدرسة', width: 22, hint: 'ثانوية الرشيد للبنين' }, { key: 'المادة', label: 'المادة', width: 14, hint: 'الرياضيات' },
  { key: 'الصف', label: 'الصف', width: 14, hint: 'الثالث المتوسط' }, { key: 'الشعبة', label: 'الشعبة', width: 4, hint: 'أ' },
  { key: 'الزمن', label: 'الزمن', width: 10, hint: 'ساعتان' }, { key: 'التاريخ', label: 'التاريخ', width: 12, hint: '2026/1/12' },
  { key: 'نوع الامتحان', label: 'نوع الامتحان', width: 14, hint: 'نصف السنة' }, { key: 'العام الدراسي', label: 'العام الدراسي', width: 12, hint: '2025 - 2026' },
  { key: 'الدور', label: 'الدور', width: 8, hint: 'الأول' }, { key: 'الملاحظة', label: 'ملاحظةٌ تحت الرأس', width: 44, hint: 'أجب عن خمسة أسئلة فقط' },
  { key: 'التمنيات', label: 'تمنيات الختام', width: 32, hint: 'مع تمنياتنا لكم بالنجاح والتفوق' }, { key: 'مدرس المادة', label: 'مدرس المادة', width: 18, hint: 'أستاذ المادة' }
];

export type ExamPreset = {
  id: string;
  name: string;
  badge: string;
  description: string;
  head: Partial<Record<string, string>>;
};

/**
 * نماذج سريعة لرأس الامتحان — تملأ **ما يخصّ نوع الامتحان وحده**.
 *
 * وكانت تكتب «ثانوية المتميزين للبنين» و«بغداد / الكرخ الأولى» وتاريخًا
 * ثابتًا فوق ما كتبه المدرّس: يضغط «نصف السنة» فتصير مدرسته مدرسةً أخرى، ويطبع
 * ثلاثين نسخة باسمها — وهو خطأ «الاسم السابق» نفسه الذي وُجد البرنامج ليمنعه.
 * فالمدرسة والمادة والصف والتاريخ والعام لا يمسّها نموذج.
 */
export const EXAM_PRESETS: ExamPreset[] = [
  {
    id: 'midyear',
    name: 'امتحان نصف السنة',
    badge: 'نصف السنة',
    description: 'ساعتان، والإجابة عن خمسة أسئلة لكلٍّ منها ٢٠ درجة',
    head: {
      'نوع الامتحان': 'نصف السنة',
      'الدور': '',
      'الزمن': 'ساعتان',
      'الملاحظة': 'ملاحظة: الإجابة عن خمسة أسئلة فقط، ولكل سؤال ٢٠ درجة بالتساوي'
    }
  },
  {
    id: 'monthly',
    name: 'امتحان شهري',
    badge: 'شهري',
    description: 'ساعة واحدة، والإجابة عن جميع الأسئلة',
    head: {
      'نوع الامتحان': 'الامتحان الشهري الأول',
      'الدور': '',
      'الزمن': 'ساعة واحدة',
      'الملاحظة': 'ملاحظة: الإجابة عن جميع الأسئلة والدرجة من ١٠٠'
    }
  },
  {
    id: 'final_exam',
    name: 'امتحان نهاية السنة (الدور الأول)',
    badge: 'نهاية السنة',
    description: 'ساعتان ونصف، الدور الأول',
    head: {
      'نوع الامتحان': 'نهاية السنة',
      'الدور': 'الأول',
      'الزمن': 'ساعتان ونصف',
      'الملاحظة': 'ملاحظة: الإجابة عن خمسة أسئلة فقط، ولكل سؤال ٢٠ درجة بالتساوي'
    }
  }
];

const BOLD = { bold: true } as const;

export function emptyHead(): Record<string, string> {
  return Object.fromEntries(HEAD_INPUTS.map((i) => [i.key, '']));
}

function spacer(height: number): SpacerBlock {
  return { id: newUuid(), kind: 'spacer', height };
}

/** سطرٌ لا يُطبع إن خلا متغيّره — فلا تبقى خانةٌ منقّطةٌ بلا معنى. */
function whenFilled(on: string, blocks: Block[]): GroupBlock {
  return { id: newUuid(), kind: 'group', mode: 'conditional', on, blocks };
}

function pair(label: string, key: string, patch: Partial<ParagraphBlock> = {}): ParagraphBlock {
  return paragraph([run(`${label}: `, BOLD), fieldRef(key)], patch);
}

/**
 * كتلُ الرأس الثابت.
 *
 * عمودان لا يتدفّقان: الجهةُ يمينًا والمادةُ يسارًا، كما تُطبع في كل مدرسة.
 * ثم عنوان الامتحان في الوسط. والثابت فيها — «المديرية العامة لتربية» و«المادة»
 * و«الصف» — نصٌّ لا يُحرَّر؛ ولا يتغيّر إلا ما بعد النقطتين.
 */
export function examHeadBlocks(): Block[] {
  const right: Block[] = [paragraph([run('المديرية العامة لتربية ', BOLD), fieldRef('المحافظة')]), paragraph([run('مديرية تربية ', BOLD), fieldRef('القضاء')]), pair('المدرسة', 'المدرسة')];
  const left: Block[] = [pair('المادة', 'المادة', { align: 'left' }), pair('الصف', 'الصف', { align: 'left' }), whenFilled('الشعبة', [pair('الشعبة', 'الشعبة', { align: 'left' })]), pair('الزمن', 'الزمن', { align: 'left' }), pair('التاريخ', 'التاريخ', { align: 'left' })];
  const banner: ColumnsBlock = { id: newUuid(), kind: 'columns', dir: 'rtl', columns: [right, left], gap: 24 };

  return [
    banner, spacer(12),
    paragraph([run('أسئلة امتحان ', { bold: true, size: 20 }), fieldRef('نوع الامتحان'), run(' للعام الدراسي ', { bold: true, size: 20 }), fieldRef('العام الدراسي')], { align: 'center' }),
    whenFilled('الدور', [paragraph([run('الدور ', BOLD), fieldRef('الدور')], { align: 'center' })]),
    // «النموذج: أ» يظهر حين يُطبع نموذجان — ولا يُطبع سطرًا فارغًا في الورقة الواحدة.
    whenFilled(VERSION_KEY, [paragraph([run('النموذج: ', BOLD), fieldRef(VERSION_KEY)], { align: 'center' })]),
    spacer(8),
    whenFilled('الملاحظة', [paragraph([fieldRef('الملاحظة')], { align: 'center' })]),
    spacer(8)
  ];
}

/** وصفُ حقول الرأس — عرضُ الفراغ منه، فلا ينكمش سطرٌ فارغ فتتشوّه الورقة. */
export function headFieldMeta(key: string): Partial<DocField> {
  const input = HEAD_INPUTS.find((i) => i.key === key);
  return input ? { label: input.label, width: input.width, hint: input.hint } : {};
}

export function newQuestion(): ListItem {
  return { id: newUuid(), inlines: [] };
}

export function examList(items: ListItem[] = [newQuestion()], dir: Dir = 'rtl'): ListBlock {
  return { id: newUuid(), kind: 'list', dir, styles: [...EXAM_STYLES], items };
}

export function examFooterBlocks(): Block[] {
  return [
    spacer(12),
    whenFilled('التمنيات', [
      paragraph([run('— ', BOLD), fieldRef('التمنيات'), run(' —', BOLD)], {
        align: 'center'
      })
    ]),
    whenFilled('مدرس المادة', [
      paragraph([run('مدرس المادة: ', BOLD), fieldRef('مدرس المادة')], {
        align: 'left'
      })
    ])
  ];
}

/**
 * ورقةٌ كاملة: رأسٌ مولَّدٌ من القيم، ومتنٌ هو قائمة الأسئلة، وتذييلٌ بالتمنيات والتوقيع.
 *
 * والحكم `print-only` — فلا تظهر في مكتبة الكتب ولا في الشبّاك، ولا تحرق رقم
 * صادرٍ حين تُطبع ثلاثين نسخة.
 */
export function examDoc(head: Record<string, string>, body: ListBlock): Doc {
  const doc = emptyDoc();
  doc.issuing = 'print-only';
  doc.pageSetup = { ...doc.pageSetup, letterheadMode: 'none' };
  doc.blocks = [...examHeadBlocks(), body, ...examFooterBlocks()];
  doc.meta = {
    title: paperTitle(head),
    subject: head['المادة']?.trim() || undefined,
    category: EXAM_CATEGORY,
    head: { ...head }
  };
  doc.fields = reconcileFields(doc, headFieldMeta);
  return doc;
}

/** عنوانُ الورقة في المكتبة: المادة فالصف فنوع الامتحان — بما وُجد منها. */
export function paperTitle(head: Record<string, string>): string {
  const parts = ['المادة', 'الصف', 'نوع الامتحان']
    .map((k) => head[k]?.trim())
    .filter((v): v is string => Boolean(v));
  return parts.length ? `أسئلة ${parts.join(' — ')}` : 'ورقة أسئلة';
}

/** قائمةُ الأسئلة في ورقةٍ محفوظة — آخرُ كتلةِ ترقيمٍ فيها. */
export function questionsOf(doc: Doc): ListBlock | null {
  for (let i = doc.blocks.length - 1; i >= 0; i--) {
    const b = doc.blocks[i];
    if (b?.kind === 'list') return b;
  }
  return null;
}

/** قيمُ الرأس كما حُفظت، مكمَّلةً بالخانات الفارغة فلا تختفي خانةٌ من الشاشة. */
export function headOf(doc: Doc): Record<string, string> {
  return { ...emptyHead(), ...(doc.meta.head ?? {}) };
}

/** أعمقُ مستوًى بلغته الأسئلة — لمنع فرعٍ رابع. */
export function depthOf(items: ListItem[], depth = 1): number {
  return items.reduce(
    (max, it) => Math.max(max, it.items?.length ? depthOf(it.items, depth + 1) : depth),
    depth
  );
}

// ── نموذجا «أ» و«ب» ─────────────────────────────────────────────────

/** مفتاح سطر النموذج في الرأس — لا خانة له في لوح الرأس، يُملأ عند الطباعة وحدها. */
export const VERSION_KEY = 'النموذج';

/**
 * نموذجٌ ثانٍ من الورقة نفسها: الأسئلة بترتيبها (فالسؤال الأول إلزاميٌّ غالبًا،
 * و«أجب عن خمسة» يُحسب عليها)، وفروع كل سؤالٍ بترتيبٍ آخر — فلا ينقل الطالب عن
 * جاره «الفرع ب».
 *
 * والترتيب من بذرةٍ ثابتة لا عشوائيّ: يُطبع النموذج «ب» اليوم وغدًا بترتيبٍ واحد،
 * فتُصحَّح أوراقه بمفتاحٍ واحد. وما تساوى ترتيبُه بعد الخلط يُدار خطوةً فيختلف.
 */
export function versionItems(items: ListItem[], seed = 7): ListItem[] {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const shuffle = (list: ListItem[]): ListItem[] => {
    if (list.length < 2) return list;
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    if (out.every((it, i) => it.id === list[i]!.id)) out.push(out.shift()!);
    return out;
  };
  const walk = (list: ListItem[], depth: number): ListItem[] =>
    list.map((it) => {
      if (!it.items?.length) return it;
      const kids = walk(it.items, depth + 1);
      return { ...it, items: shuffle(kids) };
    });
  return walk(items, 1);
}

// ── الصفحات بالقياس (S14 · D133) ─────────────────────────────────────
/** رقم الصفحة بأرقام الورقة — لا الهندية دائمًا بجانب «س1» و«50 درجة». */
export function examPageFooterText(page: number, totalPages: number, numerals: Numerals = 'indic'): string {
  const n = (v: number) => (numerals === 'indic' ? toIndic(v) : String(v));
  return `الصفحة ${n(page)} من ${n(totalPages)}`;
}

export function examPageFooterBlocks(page: number, totalPages: number, numerals: Numerals = 'indic'): Block[] {
  if (totalPages <= 1) return [];
  const text = examPageFooterText(page, totalPages, numerals);
  const suffix = page < totalPages ? ' (اقلب الصفحة / يُتبع)' : '';
  return [spacer(12), paragraph([run(`${text}${suffix}`, { bold: true })], { align: 'center' })];
}

export const examContinuationBlocks = (head: Record<string, string>): Block[] => [paragraph([run(continuationText(head), { bold: true })], { align: 'center' }), spacer(8)];

/** «تابع أسئلة الفيزياء — النهائي» في رأس كلّ صفحةٍ بعد الأولى (ورقمها في تذييلها). */
function continuationText(head: Record<string, string>): string {
  const title = [head['المادة']?.trim(), head['نوع الامتحان']?.trim()].filter(Boolean).join(' — ');
  return title ? `تابع أسئلة ${title}` : 'تابع أسئلة الامتحان';
}

/** رأس المتابعة في الصفحة `page` (من الثانية). */
export function examContinuationHtml(head: Record<string, string>, page = 2): string {
  return `<div data-paper-page-header="${page}" style="text-align:center;font-weight:700;font-size:11pt;color:#475569;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px">${escapeHtml(continuationText(head))}</div>`;
}

/** تذييل الصفحة: «اقلب الصفحة / يُتبع» إلا الأخيرة، و«الصفحة ك من ن». */
export function examFooterHtml(page: number, totalPages: number, numerals: Numerals): string {
  const text = examPageFooterText(page, totalPages, numerals);
  const more = page < totalPages;
  return `<div data-paper-page-footer="${page}" style="display:flex;justify-content:${more ? 'space-between' : 'center'};align-items:center;border-top:1px dashed #cbd5e1;padding-top:8px;margin-top:16px;font-size:11pt;color:#334155;font-weight:700">${more ? '<span>اقلب الصفحة / يُتبع ⬅</span>' : ''}<span>${text}</span></div>`;
}

/** ما قيس من الورقة مرسومةً كاملة (بكسل): المتاح للمتن بعد الهامشين، والرأس، ورأس المتابعة، والتذييل، وما بعد الأسئلة، وكلّ سؤالٍ أمّ. */
export type ExamMeasure = { page: number; head: number; cont: number; footer: number; tail: number; heights: number[] };

/**
 * عدد الأسئلة في كلّ صفحة — بالقياس لا بالتقدير (`examPagination.ts` يقيس).
 *
 * ما يسعه وجهٌ واحد صفحةٌ واحدة بلا ترقيم. وإلا تُملأ الصفحات بالترتيب عند حدود الأسئلة: لكلٍّ تذييلها، ورأس المتابعة من
 * الثانية، وما بعد الأسئلة (التمنيات والتوقيع) في الأخيرة؛ والسؤال الأطول من صفحةٍ وحده في صفحته، ولا يُشطر سؤالٌ أمّ.
 * و`halves` («بوجهين»): ورقةٌ تسعها صفحةٌ وفيها سؤالان فأكثر تُقسم نصفين بالارتفاع.
 */
export function examPageCounts(m: ExamMeasure, halves = false): number[] {
  const n = m.heights.length;
  const total = m.heights.reduce((a, b) => a + b, 0);
  if (m.head + total + m.tail <= m.page) {
    if (!halves || n < 2) return [n];
    let [k, acc] = [1, m.heights[0]!];
    while (k < n - 1 && Math.abs(2 * (acc + m.heights[k]!) - total) < Math.abs(2 * acc - total)) acc += m.heights[k++]!;
    return [k, n - k];
  }
  const room = m.page - m.footer;
  const counts: number[] = [];
  let [used, count] = [m.head, 0];
  for (const h of m.heights) {
    if (count > 0 && used + h > room) {
      counts.push(count);
      count = 0;
      used = m.cont;
    }
    used += h;
    count++;
  }
  // ما بعد الأسئلة في الأخيرة: إن لم يسعه نزل آخر سؤالٍ إلى صفحةٍ تالية.
  if (count > 1 && used + m.tail > room) {
    counts.push(count - 1);
    count = 1;
  }
  counts.push(count);
  return counts;
}

/** ما يلزم من DOM لتقطيع الورقة — بلا أنواع المتصفّح، فالملفّ مشتركٌ مع الرئيسية. */
type El = {
  children: ArrayLike<El>;
  previousElementSibling: El | null;
  nextElementSibling: El | null;
  querySelector(selector: string): El | null;
  insertAdjacentHTML(position: string, html: string): void;
  remove(): void;
  innerHTML: string;
};

/**
 * صفحات الورقة بأعداد أسئلتها (`examPageCounts`): الرأس في الأولى، و«تابع أسئلة…» من الثانية، وما بعد الأسئلة في الأخيرة،
 * ولكلٍّ تذييلها. والأخيرة تأخذ ما بقي من الأسئلة (فأعدادٌ قيست قبل تعديلٍ لا تُسقط سؤالًا). وصفحةٌ واحدة تعود كما هي بلا ترقيم.
 */
export function splitExamPagesHtml(fullHtml: string, counts: number[], head: Record<string, string>, numerals: Numerals): string[] {
  const total = counts.length;
  const Parser = (globalThis as unknown as { DOMParser?: new () => { parseFromString(html: string, type: string): { body: El } } }).DOMParser;
  if (total <= 1 || !Parser) return [fullHtml];
  const parser = new Parser();
  let start = 0;
  return counts.map((count, i) => {
    const body = parser.parseFromString(fullHtml, 'text/html').body;
    const list = body.querySelector('[data-flow="lines"]');
    const last = i === total - 1;
    if (list) {
      Array.from(list.children).forEach((el, j) => {
        if (j < start || (!last && j >= start + count)) el.remove();
      });
      if (i > 0) {
        while (list.previousElementSibling) list.previousElementSibling.remove();
        list.insertAdjacentHTML('beforebegin', examContinuationHtml(head, i + 1));
      }
      if (!last) while (list.nextElementSibling) list.nextElementSibling.remove();
    }
    start += count;
    body.insertAdjacentHTML('beforeend', examFooterHtml(i + 1, total, numerals));
    return body.innerHTML;
  });
}
