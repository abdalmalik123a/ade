/**
 * نواة الوثيقة: شجرة كتل، لا نصّ HTML.
 *
 * `body_html` نصٌّ واحد و`{الوسم}` تعبير نمطي — ولا جدول فيه ولا صفحة ولا ترقيم
 * تلقائي ولا كتلة شرطية ولا صفّ متكرر. والوسم يُكسر بنصف مسح فيخرج `{الاس}` على
 * الورق ولا يراه أحد.
 *
 * وهنا الحقل **عقدة** داخل الفقرة: يُحذف كوحدة، ويُسحب، ويُرسم صندوقًا في
 * التحرير وفراغًا في الطباعة. والحقل يُعرَّف مرّة في `fields` ويُشار إليه من
 * المتن بمفتاحه — فالاسم يُكتب مرّة ويملأ كل مواضعه.
 */

/** رقم صيغة الوثيقة: تُقرأ بصيغتها ثم تُرحَّل عند القراءة. */
export const DOC_SCHEMA = 1;

export type Uuid = string;

/**
 * معرّف ثابت لكل عنصر منذ السطر الأول.
 *
 * بغيره لا تصدير ولا استيراد ولا دمج ولا مشاركة بين مكتبين، وإضافته بعد أن
 * تنتشر النسخ تعني ترحيل بيانات كل مكتب.
 */
export function newUuid(): Uuid {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // بديلٌ لبيئات بلا `crypto` — الغرض التفرّد لا العشوائية المعمّاة.
  return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * الاقتراح بدرجته وسببه — لا قرارًا ثنائيًا.
 *
 * كل قاعدة كشف تعيد درجة، والقرار عتبةٌ عليها يسهل استبدالها بنموذج محلّي
 * لاحقًا. والسبب يُعرض للموظف فيقبل على بيّنة (§١٥ من الأساس).
 */
export type Confidence = number;
export type Suggestion<T> = { value: T; confidence: Confidence; reason: string };

/** ما فوقها يُطبَّق بلا سؤال، وما دونها يُعرض في المراجعة. */
export const APPLY_THRESHOLD = 0.8;

export type Dir = 'rtl' | 'ltr';
export type Align = 'right' | 'center' | 'left' | 'justify';

// ── الحقول ───────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'longText'
  | 'date'
  | 'number'
  | 'money'
  | 'choice'
  | 'bool'
  | 'citizen'
  | 'authority';

/** `hand` يطبع فراغًا يملؤه صاحب العلاقة بقلمه — وكثير من الاستمارات كذلك. */
export type FillMode = 'printed' | 'hand';

/** ما يُقيَّد في الأرشيف ولا يجوز أن يبقى مجهولًا. */
export type FieldRole = 'name' | 'nationalId' | 'destination' | 'purpose' | null;

export type DocField = {
  id: Uuid;
  /** المفتاح المستعمل في المتن — فريد داخل الوثيقة. */
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /**
   * عرض الفراغ بالحروف.
   *
   * الفراغ على الورق الرسمي له طولٌ مقصود، والحقل الفارغ يطبع فراغًا بطوله ولا
   * ينكمش فتتشوّه الورقة.
   */
  width: number;
  fillMode: FillMode;
  role: FieldRole;
  /** اسم حقل في ملف المواطن يملؤه بـF2 — أو عدم. */
  source: string | null;
  choices?: string[];
  hint?: string;
};

export const DEFAULT_FIELD_WIDTH = 14;

export function makeField(patch: Partial<DocField> & { key: string }): DocField {
  return {
    id: newUuid(),
    label: patch.key.replace(/_/g, ' '),
    type: 'text',
    required: false,
    width: DEFAULT_FIELD_WIDTH,
    fillMode: 'printed',
    role: null,
    source: null,
    ...patch
  };
}

// ── ما داخل الفقرة ───────────────────────────────────────────────────

export type Marks = { bold?: boolean; underline?: boolean; size?: number };

export type InlineRun = { kind: 'run'; text: string; marks?: Marks };
/** عقدة الحقل: تشير بمفتاحه، فلا تُكسر بالمسح ولا تُنسخ خطأً. */
export type InlineField = { kind: 'field'; id: Uuid; ref: string };
export type InlineBreak = { kind: 'break' };
export type Inline = InlineRun | InlineField | InlineBreak;

// ── الكتل: خمسٌ لا أكثر، وبهنّ تُعبَّر كل ورقة عراقية رسمية ──────────

type BlockBase = { id: Uuid; dir?: Dir };

export type ParagraphBlock = BlockBase & {
  kind: 'paragraph';
  align: Align;
  /** مسافة بادئة لأول سطر — والكتاب الرسمي يترك ٢ سم. */
  indent?: number;
  spaceAfter?: number;
  inlines: Inline[];
};

export type ListStyle = 'bullet' | 'number' | 'arabicLetter' | 'ordinal';
export type ListBlock = BlockBase & {
  kind: 'list';
  style: ListStyle;
  items: { id: Uuid; inlines: Inline[] }[];
};

export type TableCell = { id: Uuid; blocks: ParagraphBlock[]; colSpan?: number };
export type TableRow = { id: Uuid; cells: TableCell[] };
export type TableBlock = BlockBase & {
  kind: 'table';
  /** أوزان نسبية لا عرض ثابت — فالورقة تختلف. */
  columns: number[];
  /** صفّ عناوين يتكرّر في الصفحة التالية عند انقسام الجدول. */
  header: boolean;
  rows: TableRow[];
};

export type ImageBlock = BlockBase & {
  kind: 'image';
  /** مسار داخل مخزن التطبيق. */
  src: string;
  width: number;
  align: Align;
};

export type SpacerBlock = BlockBase & { kind: 'spacer'; height: number };
export type PageBreakBlock = BlockBase & { kind: 'pageBreak' };

/**
 * المجموعة: شرطية أو متكررة.
 *
 * «المرفقات» تُلغى إن لم توجد — فهي شرطية لا سطر ثابت. و«نسخة منه إلى» صفوف
 * تتكاثر بعدد الجهات.
 */
export type GroupBlock = BlockBase & {
  kind: 'group';
  mode: 'conditional' | 'repeat';
  /** مفتاح الحقل الذي يقرّر الظهور، أو الذي تتكرّر عليه الصفوف. */
  on: string;
  blocks: Block[];
};

export type Block =
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | SpacerBlock
  | PageBreakBlock
  | GroupBlock;

// ── الصفحة ───────────────────────────────────────────────────────────

export type PageSize = 'A4' | 'A5';
export type Orientation = 'portrait' | 'landscape';
/** `reserve` يترك مكان الترويسة فارغًا — لمن يطبع على ورق الدائرة المطبوع. */
export type LetterheadMode = 'print' | 'reserve' | 'none';
export type Numerals = 'arabic' | 'indic';

export type PageSetup = {
  size: PageSize;
  orientation: Orientation;
  margins: { top: number; right: number; bottom: number; left: number };
  letterheadMode: LetterheadMode;
  /** تتكرّر الترويسة في كل صفحة، أو في الأولى وحدها. */
  repeatLetterhead: boolean;
  pageNumbers: boolean;
  numerals: Numerals;
};

/** مقاسات الورق بالمليمتر. */
export const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 }
};

export const DEFAULT_PAGE: PageSetup = {
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  letterheadMode: 'print',
  repeatLetterhead: false,
  pageNumbers: false,
  numerals: 'arabic'
};

/** مقاس الورقة بعد الاتجاه، بالمليمتر. */
export function pageMm(setup: PageSetup): { w: number; h: number } {
  const { w, h } = PAGE_MM[setup.size];
  return setup.orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

// ── الوثيقة ──────────────────────────────────────────────────────────

export type Doc = {
  id: Uuid;
  schemaVersion: number;
  pageSetup: PageSetup;
  blocks: Block[];
  /** ترتيبها هو ترتيب شاشة الإدخال في الشبّاك. */
  fields: DocField[];
  meta: { title?: string; subject?: string; category?: string };
};

export function emptyDoc(): Doc {
  return {
    id: newUuid(),
    schemaVersion: DOC_SCHEMA,
    pageSetup: { ...DEFAULT_PAGE, margins: { ...DEFAULT_PAGE.margins } },
    blocks: [],
    fields: [],
    meta: {}
  };
}

export function paragraph(inlines: Inline[], patch: Partial<ParagraphBlock> = {}): ParagraphBlock {
  return { id: newUuid(), kind: 'paragraph', align: 'right', inlines, ...patch };
}

export function run(text: string, marks?: Marks): InlineRun {
  return marks ? { kind: 'run', text, marks } : { kind: 'run', text };
}

export function fieldRef(key: string): InlineField {
  return { kind: 'field', id: newUuid(), ref: key };
}

// ── المشي في الشجرة ──────────────────────────────────────────────────

/** كل كتلة في الوثيقة، بما في داخل المجموعات — بترتيب الورقة. */
export function walkBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.kind === 'group') out.push(...walkBlocks(b.blocks));
  }
  return out;
}

function blockInlines(block: Block): Inline[] {
  if (block.kind === 'paragraph') return block.inlines;
  if (block.kind === 'list') return block.items.flatMap((i) => i.inlines);
  if (block.kind === 'table')
    return block.rows.flatMap((r) => r.cells.flatMap((c) => c.blocks.flatMap((p) => p.inlines)));
  return [];
}

/** مفاتيح الحقول المستعملة فعلًا في المتن — فلا تتعارض القائمة مع النصّ. */
export function usedKeys(doc: Doc): string[] {
  const seen = new Set<string>();
  for (const b of walkBlocks(doc.blocks)) {
    for (const i of blockInlines(b)) if (i.kind === 'field') seen.add(i.ref);
    if (b.kind === 'group' && b.on) seen.add(b.on);
  }
  return [...seen];
}

/**
 * يوفّق قائمة الحقول مع ما في المتن: يضيف الجديد ويحذف ما اختفى، ويحفظ ترتيب
 * ما بقي — فلا تُعاد شاشة الإدخال ترتيبها كلّما عُدِّلت كلمة.
 */
export function reconcileFields(doc: Doc, catalog?: (key: string) => Partial<DocField>): DocField[] {
  const used = new Set(usedKeys(doc));
  const kept = doc.fields.filter((f) => used.has(f.key));
  const have = new Set(kept.map((f) => f.key));
  const added = [...used]
    .filter((k) => !have.has(k))
    .map((key) => makeField({ key, ...(catalog ? catalog(key) : {}) }));
  return [...kept, ...added];
}

/**
 * اتحاد حقول عدّة وثائق بلا تكرار — وهو قلب شاشة الشبّاك.
 *
 * الزبون يطلب خمس أوراق، فتُعرض ورقةُ إدخال واحدة: الاسم يُكتب مرّة ويملأ
 * الخمس. والترتيب ترتيبُ أوّل ظهور، فلا تقفز الحقول بين اختيار واختيار.
 *
 * وإن اختلف وصفُ حقلٍ بين وثيقتين غلب الأوّل، إلا في ثلاث: الإلزام إن ألزمته
 * واحدة، والعرض أوسعَهما، والمصدر إن عرفه أحدهما — فلا يضيع ما يعرفه البرنامج.
 */
export function mergeFields(docs: Doc[]): DocField[] {
  const out = new Map<string, DocField>();
  for (const doc of docs) {
    for (const f of doc.fields) {
      const prev = out.get(f.key);
      if (!prev) {
        out.set(f.key, { ...f });
        continue;
      }
      out.set(f.key, {
        ...prev,
        required: prev.required || f.required,
        width: Math.max(prev.width, f.width),
        source: prev.source ?? f.source,
        role: prev.role ?? f.role
      });
    }
  }
  return [...out.values()];
}

/** يعيد تسمية حقل بلا أن يمسّ مفتاحه — فالمفتاح مرجع المتن، والعنوان للعين. */
export function renameField(doc: Doc, key: string, label: string): Doc {
  return {
    ...doc,
    fields: doc.fields.map((f) => (f.key === key ? { ...f, label } : f))
  };
}

/**
 * يردّ حقلًا إلى ما كان: فراغًا منقوطًا في النصّ.
 *
 * فما ظنّه المحرّك حقلًا قد لا يكون — «مع التقدير .....» نقاطٌ للزينة لا خانةٌ
 * تُملأ. وردُّه نصًّا أصدق من حذفه، فالورقة تبقى كما كتبها المكتب.
 */
export function unfield(doc: Doc, key: string): Doc {
  const field = doc.fields.find((f) => f.key === key);
  const dots = '.'.repeat(Math.max(3, field?.width ?? 6));

  const fix = (list: Inline[]): Inline[] =>
    list.map((i) => (i.kind === 'field' && i.ref === key ? run(dots) : i));

  const walk = (blocks: Block[]): Block[] =>
    blocks.map((b) => {
      if (b.kind === 'paragraph') return { ...b, inlines: fix(b.inlines) };
      if (b.kind === 'list') return { ...b, items: b.items.map((i) => ({ ...i, inlines: fix(i.inlines) })) };
      if (b.kind === 'table')
        return {
          ...b,
          rows: b.rows.map((r) => ({
            ...r,
            cells: r.cells.map((c) => ({
              ...c,
              blocks: c.blocks.map((p) => ({ ...p, inlines: fix(p.inlines) }))
            }))
          }))
        };
      if (b.kind === 'group') return { ...b, blocks: walk(b.blocks) };
      return b;
    });

  return {
    ...doc,
    blocks: walk(doc.blocks),
    fields: doc.fields.filter((f) => f.key !== key)
  };
}

/** نصّ الوثيقة مجرّدًا — للبصمة والبحث والتدقيق. */
export function docText(doc: Doc, values: Record<string, string> = {}): string {
  const lines: string[] = [];
  const inlineText = (list: Inline[]) =>
    list
      .map((i) =>
        i.kind === 'run' ? i.text : i.kind === 'break' ? ' ' : (values[i.ref] ?? `{${i.ref}}`)
      )
      .join('');

  for (const b of walkBlocks(doc.blocks)) {
    if (b.kind === 'paragraph') lines.push(inlineText(b.inlines));
    else if (b.kind === 'list') for (const it of b.items) lines.push(inlineText(it.inlines));
    else if (b.kind === 'table')
      for (const r of b.rows)
        lines.push(r.cells.map((c) => c.blocks.map((p) => inlineText(p.inlines)).join(' ')).join(' | '));
  }
  return lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── الترحيل ──────────────────────────────────────────────────────────

const TOKEN_RE = /\{([^{}\s][^{}]*)\}/g;

/**
 * يبني وثيقةً من المتن القديم: سطرٌ فقرة، و`{وسم}` عقدةَ حقل.
 *
 * فما بناه المكتب قبل النواة يُعرض عبرها بلا أن يُعاد بناؤه — ولا يُكتب فوقه:
 * الترحيل عند القراءة، كما تُرحَّل الترويسات.
 */
export function docFromLegacy(
  body: string,
  catalog?: (key: string) => Partial<DocField>
): Doc {
  const doc = emptyDoc();

  doc.blocks = body.split('\n').map((lineText) => {
    const inlines: Inline[] = [];
    let at = 0;
    for (const m of lineText.matchAll(TOKEN_RE)) {
      const start = m.index ?? 0;
      if (start > at) inlines.push(run(lineText.slice(at, start)));
      inlines.push(fieldRef(m[1]!.trim()));
      at = start + m[0].length;
    }
    if (at < lineText.length) inlines.push(run(lineText.slice(at)));
    return paragraph(inlines);
  });

  doc.fields = reconcileFields(doc, catalog);
  return doc;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function normalizePage(raw: unknown): PageSetup {
  const base: PageSetup = { ...DEFAULT_PAGE, margins: { ...DEFAULT_PAGE.margins } };
  if (!isObj(raw)) return base;
  const v = raw as Partial<PageSetup>;
  return {
    size: v.size === 'A5' ? 'A5' : 'A4',
    orientation: v.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: { ...base.margins, ...(isObj(v.margins) ? (v.margins as PageSetup['margins']) : {}) },
    letterheadMode:
      v.letterheadMode === 'reserve' || v.letterheadMode === 'none' ? v.letterheadMode : 'print',
    repeatLetterhead: v.repeatLetterhead === true,
    pageNumbers: v.pageNumbers === true,
    numerals: v.numerals === 'indic' ? 'indic' : 'arabic'
  };
}

/**
 * يقرأ أي وثيقة محفوظة ويعيدها بالصيغة الحالية.
 *
 * ما لا يُفهم يسقط بلا أن يُسقط الشاشة — فالكتاب الرسمي لا يحتمل التخمين، لكن
 * ورقةً واحدة تالفة لا يجوز أن تمنع المكتب من العمل.
 */
export function normalizeDoc(raw: unknown): Doc {
  if (!isObj(raw)) return emptyDoc();
  const v = raw as Partial<Doc>;

  const doc: Doc = {
    id: typeof v.id === 'string' && v.id ? v.id : newUuid(),
    schemaVersion: DOC_SCHEMA,
    pageSetup: normalizePage(v.pageSetup),
    blocks: Array.isArray(v.blocks) ? v.blocks.filter(isBlock) : [],
    fields: Array.isArray(v.fields) ? v.fields.filter(isObj).map(normalizeField) : [],
    meta: isObj(v.meta) ? (v.meta as Doc['meta']) : {}
  };

  // الحقول تتبع المتن دائمًا: ما اختفى من النصّ لا يبقى في شاشة الإدخال.
  doc.fields = reconcileFields(doc);
  return doc;
}

const BLOCK_KINDS = new Set([
  'paragraph',
  'list',
  'table',
  'image',
  'spacer',
  'pageBreak',
  'group'
]);

function isBlock(v: unknown): v is Block {
  return isObj(v) && typeof v.kind === 'string' && BLOCK_KINDS.has(v.kind) && typeof v.id === 'string';
}

function normalizeField(raw: Record<string, unknown>): DocField {
  const key = typeof raw.key === 'string' ? raw.key : '';
  return {
    ...makeField({ key }),
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : newUuid(),
    key,
    width: typeof raw.width === 'number' && raw.width > 0 ? raw.width : DEFAULT_FIELD_WIDTH,
    fillMode: raw.fillMode === 'hand' ? 'hand' : 'printed',
    required: raw.required === true
  } as DocField;
}

// ── توزيع الصفحات: بالقياس لا بالتدفّق ───────────────────────────────

export type Measured = {
  id: Uuid;
  /** ارتفاعها المقيس في DOM بالبكسل. */
  height: number;
  /** فاصل صفحة صريح قبلها. */
  breakBefore?: boolean;
};

/**
 * يوزّع كتلًا مقيسة على صفحات.
 *
 * دالّة نقيّة: القياس يجري في DOM والقرار هنا — فيُختبر التوزيع بلا متصفّح.
 * وكتلة أطول من الصفحة تُفرد وحدها بدل أن تدور إلى الأبد.
 */
export function paginate(
  items: Measured[],
  pageHeight: number,
  firstPageHeight = pageHeight
): Uuid[][] {
  if (pageHeight <= 0) return items.length ? [items.map((i) => i.id)] : [];

  const pages: Uuid[][] = [];
  let page: Uuid[] = [];
  let used = 0;
  let limit = firstPageHeight > 0 ? firstPageHeight : pageHeight;

  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
    limit = pageHeight;
  };

  for (const item of items) {
    if (item.breakBefore && page.length) flush();
    if (used > 0 && used + item.height > limit) flush();
    page.push(item.id);
    used += item.height;
  }
  flush();
  return pages;
}
