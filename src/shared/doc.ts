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

import type { Canvas } from './canvas';
import { mapInlines } from './docTree';
import type { Uuid, DocField, PageSize, PageSetup, Doc, Inline, ParagraphBlock, Marks, InlineRun, InlineField, Block, ListItem, ListBlock } from './docTypes';
export type * from './docTypes';
export { paginate, keepTogetherFrom, type Measured } from './docPaginate';

/** رقم صيغة الوثيقة: تُقرأ بصيغتها ثم تُرحَّل عند القراءة. */
export const DOC_SCHEMA = 1;

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

/** ما فوقها يُطبَّق بلا سؤال، وما دونها يُعرض في المراجعة. */
export const APPLY_THRESHOLD = 0.8;

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

/** حقل تاريخ: بنوعه — أو باسمه في نماذج سبقت النوع («تاريخ الولادة»). */
export function isDateField(f: DocField): boolean {
  return f.type === 'date' || /تاريخ/.test(f.label);
}

/** مقاسات الورق بالمليمتر. */
export const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  FS: { w: 210, h: 330 },
  // المقاسات الشائعة في العراق غير الثلاثة: شهاداتٌ ولوحات على A3، وبطاقاتٌ وإيصالات على A6،
  // وورقٌ أمريكيّ (Letter وLegal) تأتي به الطابعات والمطابع (قرار المالك ٨ ت١: «يشمل الأغلب»).
  A3: { w: 297, h: 420 },
  A6: { w: 105, h: 148 },
  LT: { w: 216, h: 279 },
  LG: { w: 216, h: 356 }
};

export const isPageSize = (v: unknown): v is PageSize => typeof v === 'string' && Object.prototype.hasOwnProperty.call(PAGE_MM, v);

/** أسماء المقاسات كما يقولها المكتب. */
export const PAGE_NAMES: Record<PageSize, string> = { A4: 'A4', A5: 'A5', FS: 'فولسكاب', A3: 'A3', A6: 'A6', LT: 'Letter', LG: 'Legal' };

/**
 * الهوامش بثلاث درجات (قرار ٣ تشرين الأول): ما يختاره الموظف بكلمة لا بأربعة أرقام.
 * والأرقام باقيةٌ لمن أرادها («مخصّصة»).
 */
export const MARGIN_PRESETS = {
  narrow: { label: 'ضيّقة', mm: 12 },
  medium: { label: 'متوسّطة', mm: 20 },
  wide: { label: 'واسعة', mm: 30 }
} as const;
export type MarginPreset = keyof typeof MARGIN_PRESETS;

/** درجة الهوامش إن تساوت جوانبها الأربعة على إحداها — وإلا فهي مخصّصة. */
export function marginPreset(m: PageSetup['margins']): MarginPreset | null {
  for (const [k, p] of Object.entries(MARGIN_PRESETS) as [MarginPreset, (typeof MARGIN_PRESETS)[MarginPreset]][]) {
    if (m.top === p.mm && m.right === p.mm && m.bottom === p.mm && m.left === p.mm) return k;
  }
  return null;
}

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

export function emptyDoc(): Doc {
  return {
    id: newUuid(),
    schemaVersion: DOC_SCHEMA,
    kind: 'flow',
    issuing: 'registered',
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
    else if (b.kind === 'columns') for (const col of b.columns) out.push(...walkBlocks(col));
  }
  return out;
}

/** كل عنصر ترقيم بفروعه — والعمق لا يحدّه شيء. */
export function walkItems(items: ListItem[]): ListItem[] {
  return items.flatMap((i) => [i, ...walkItems(i.items ?? [])]);
}

function blockInlines(block: Block): Inline[] {
  if (block.kind === 'paragraph') return block.inlines;
  if (block.kind === 'list')
    return walkItems(block.items).flatMap((i) => [...i.inlines, ...(i.answer ?? [])]);
  if (block.kind === 'table')
    return block.rows.flatMap((r) => r.cells.flatMap((c) => c.blocks.flatMap((p) => p.inlines)));
  return [];
}

/** مفاتيح الحقول المستعملة فعلًا في المتن وفي اللوحة — فلا تتعارض القائمة معهما. */
export function usedKeys(doc: Doc): string[] {
  const seen = new Set<string>();
  for (const b of walkBlocks(doc.blocks)) {
    for (const i of blockInlines(b)) if (i.kind === 'field') seen.add(i.ref);
    if (b.kind === 'group' && b.on) seen.add(b.on);
  }
  const canvases = [doc.canvas, doc.backCanvas].filter(Boolean) as Canvas[];
  for (const c of canvases) {
    for (const el of c.elements) {
      if (el.kind === 'text') {
        for (const node of el.inlines) if (node.kind === 'field') seen.add(node.ref);
      } else if ((el.kind === 'image' || el.kind === 'barcode') && el.ref) {
        seen.add(el.ref);
      } else if (el.kind === 'table') {
        for (const row of el.rows) {
          for (const cell of row) {
            if (cell.field) seen.add(cell.field);
            const matches = cell.text.matchAll(/\{([^{}]+)\}/g);
            for (const m of matches) if (m[1]?.trim()) seen.add(m[1].trim());
          }
        }
      }
    }
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

  // في كلّ عمق: العمودان وفروع القائمة وإجاباتها كالفقرة (`docTree.ts`، D50).
  return {
    ...doc,
    blocks: mapInlines(doc.blocks, fix),
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
    else if (b.kind === 'list')
      for (const it of walkItems(b.items)) lines.push(inlineText(it.inlines));
    else if (b.kind === 'table')
      for (const r of b.rows)
        lines.push(r.cells.map((c) => c.blocks.map((p) => inlineText(p.inlines)).join(' ')).join(' | '));
  }

  // ونصّ اللوحة معه: الشهادة تُبحث باسم صاحبها كما يُبحث الكتاب.
  const canvases = [doc.canvas, doc.backCanvas].filter(Boolean) as Canvas[];
  for (const c of canvases) {
    for (const el of c.elements) {
      if (el.kind === 'text') lines.push(inlineText(el.inlines));
      else if (el.kind === 'table') {
        for (const r of el.rows) lines.push(r.map((cell) => cell.text).join(' | '));
      }
    }
  }
  return lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── الدرجات ──────────────────────────────────────────────────────────

/** مجموعٌ يحترم «أجب عن ن»: أكبرُ ن درجةً، وهو أقصى ما يناله الطالب. */
function sumTop(values: number[], pick?: number): number {
  if (!pick || pick >= values.length) return values.reduce((a, b) => a + b, 0);
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, pick)
    .reduce((a, b) => a + b, 0);
}

/** درجة العنصر: ما كُتب له، وإلا فمجموع فروعه. */
export function itemScore(item: ListItem): number {
  if (typeof item.score === 'number') return item.score;
  if (!item.items?.length) return 0;
  return sumTop(item.items.map(itemScore), item.pick);
}

export function listScore(block: ListBlock): number {
  return sumTop(block.items.map(itemScore), block.pick);
}

/**
 * مجموع درجات الورقة وعدد أسئلتها.
 *
 * ويُنبَّه المدرّس إن لم يبلغ المئة — وهو أكثر ما يُخطئ فيه في ورقة اختيارية،
 * لأن الحساب على الكل لا على المطلوب.
 */
export function tallyScores(doc: Doc): { total: number; questions: number } {
  let total = 0;
  let questions = 0;
  for (const b of walkBlocks(doc.blocks)) {
    if (b.kind !== 'list') continue;
    total += listScore(b);
    questions += b.items.length;
  }
  return { total, questions };
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
  doc.blocks = body.split('\n').map((lineText) => paragraph(tokenInlines(lineText)));
  doc.fields = reconcileFields(doc, catalog);
  return doc;
}

/**
 * سطرٌ فيه `{الوسم}` يصير عقدًا: نصًّا وحقولًا.
 *
 * وهذه صيغةُ المتغيّر في كل مكان — في المتن القديم، وفي مربّع نصٍّ مستورَدٍ من
 * Word، وفيما يكتبه المكتب في صندوق اللوحة. ومُرمِّزٌ واحدٌ لها: نسختان تختلفان
 * في حرفٍ تعنيان حقلًا يُقرأ هنا ولا يُقرأ هناك.
 */
export function tokenInlines(text: string): Inline[] {
  const inlines: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > at) inlines.push(run(text.slice(at, start)));
    inlines.push(fieldRef(m[1]!.trim()));
    at = start + m[0].length;
  }
  if (at < text.length) inlines.push(run(text.slice(at)));
  return inlines;
}
