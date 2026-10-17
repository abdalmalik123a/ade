/**
 * المشي في شجرة الوثيقة وتقويمها في كلّ عمق (A05، D50).
 *
 * الكتلة تحمل كتلًا (المجموعة والعمودان، والجدول بخلاياه) والقائمة تحمل فروعًا وإجابات — فما يُفحص أو يُبدَّل في
 * المستوى الأوّل وحده يفوته ما تحته: مجموعةٌ بلا `blocks` كانت تُسقط فتح الوثيقة كلّها، و«ردّ الحقل نصًّا» كان يُبقيه
 * في العمود وفي فرع السؤال وإجابته.
 *
 * فهنا مشيٌ واحد: ما لا يصحّ يسقط وحده في أيّ عمق وما حوله باقٍ، والسليم يعود هو نفسه (الكائن لا نسخته) — فالوثيقة
 * السليمة تُقرأ كما كانت بايتًا ببايت. ولا يستورد من `doc.ts` إلا الأنواع، فلا حلقة.
 */
import type { Block, Inline, ListBlock, ListItem, ListStyle, ParagraphBlock } from './doc';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const BLOCK_KINDS = new Set(['paragraph', 'list', 'table', 'image', 'spacer', 'pageBreak', 'rule', 'columns', 'group']);

/** المصفوفة نفسها إن لم يتغيّر منها شيء — وإلا الجديدة. */
function same<T>(before: readonly unknown[], after: T[]): T[] {
  return after.length === before.length && after.every((v, i) => v === before[i]) ? (before as T[]) : after;
}

/** الكائن بلا مفتاحٍ فسدت قيمته — لا مفتاحٌ بقيمةٍ فارغة. */
function without<T extends object>(obj: T, key: string): T {
  const out = { ...obj } as Raw;
  delete out[key];
  return out as T;
}

function validInline(v: unknown): v is Inline {
  if (!isObj(v)) return false;
  if (v.kind === 'run') return typeof v.text === 'string';
  if (v.kind === 'field') return typeof v.ref === 'string';
  return v.kind === 'break';
}

const inlines = (list: unknown[]): Inline[] => same(list, list.filter(validInline));

/** بنية الكتلة بنوعها: ما يحمل غيره يحمله مصفوفةً، وإلا فهي تالفة. */
export function validBlock(v: unknown): v is Block {
  if (!isObj(v) || typeof v.kind !== 'string' || !BLOCK_KINDS.has(v.kind) || typeof v.id !== 'string') return false;
  if (v.kind === 'paragraph') return Array.isArray(v.inlines);
  if (v.kind === 'list') return Array.isArray(v.items);
  if (v.kind === 'table') return Array.isArray(v.rows);
  if (v.kind === 'group') return Array.isArray(v.blocks);
  if (v.kind === 'columns') return Array.isArray(v.columns) && v.columns.every(Array.isArray);
  return true;
}

/** عنصر القائمة بفروعه وإجابته — وفرعٌ أو إجابةٌ ليسا مصفوفةً يسقطان وحدهما. */
function items(list: unknown[]): ListItem[] {
  const out: ListItem[] = [];
  for (const v of list) {
    if (!isObj(v) || !Array.isArray(v.inlines)) continue;
    let item = v as ListItem;
    const ins = inlines(v.inlines);
    if (ins !== v.inlines) item = { ...item, inlines: ins };
    if (v.answer !== undefined) {
      if (!Array.isArray(v.answer)) item = without(item, 'answer');
      else if (inlines(v.answer) !== v.answer) item = { ...item, answer: inlines(v.answer) };
    }
    if (v.items !== undefined) {
      if (!Array.isArray(v.items)) item = without(item, 'items');
      else if (items(v.items) !== v.items) item = { ...item, items: items(v.items) };
    }
    out.push(item);
  }
  return same(list, out);
}

/** الكتلة السليمة بنيتُها مقوَّمةٌ في داخلها — والقائمة التي حُفظت بنمطٍ واحد تُقرأ بمستوًى واحد فلا يفقد المكتب ترقيمه. */
function fixBlock(b: Block): Block {
  if (b.kind === 'paragraph') {
    const ins = inlines(b.inlines);
    return ins === b.inlines ? b : { ...b, inlines: ins };
  }
  if (b.kind === 'list') {
    const legacy = b as ListBlock & { style?: ListStyle };
    let list: ListBlock = Array.isArray(legacy.styles) ? b : ({ ...legacy, styles: [legacy.style ?? 'bullet'] } as ListBlock);
    const its = items(b.items);
    if (its !== b.items) list = { ...list, items: its };
    return list;
  }
  if (b.kind === 'table') {
    const rows = same(
      b.rows,
      b.rows
        .filter((r) => isObj(r) && Array.isArray(r.cells))
        .map((r) => {
          const cells = same(
            r.cells,
            r.cells
              .filter((c) => isObj(c) && Array.isArray(c.blocks))
              .map((c) => {
                const paras = tree(c.blocks).filter((p): p is ParagraphBlock => p.kind === 'paragraph');
                return same(c.blocks, paras) === c.blocks ? c : { ...c, blocks: paras };
              })
          );
          return cells === r.cells ? r : { ...r, cells };
        })
    );
    return rows === b.rows ? b : { ...b, rows };
  }
  if (b.kind === 'group') {
    const blocks = tree(b.blocks);
    return blocks === b.blocks ? b : { ...b, blocks };
  }
  if (b.kind === 'columns') {
    const columns = same(b.columns, b.columns.map(tree));
    return columns === b.columns ? b : { ...b, columns };
  }
  return b;
}

function tree(list: unknown[]): Block[] {
  return same(list, list.filter(validBlock).map(fixBlock));
}

/** كتل الوثيقة مقوَّمةً في كلّ عمق — مصفوفةٌ جديدة دائمًا، وكلّ كتلةٍ سليمة هي نفسها. */
export function normalizeTree(blocks: unknown[]): Block[] {
  const out = tree(blocks);
  return out === blocks ? out.slice() : out;
}

/**
 * يمرّ على كلّ قائمة مقاطع في الشجرة — الفقرة، وعنصر القائمة بفروعه وإجابته، وفقرات خلايا الجدول، وما في المجموعة
 * والعمودين — ويضع ما يعيده `fn` مكانها.
 */
export function mapInlines(blocks: Block[], fn: (list: Inline[]) => Inline[]): Block[] {
  const mapItems = (list: ListItem[]): ListItem[] =>
    list.map((i) => {
      const out: ListItem = { ...i, inlines: fn(i.inlines) };
      if (i.answer) out.answer = fn(i.answer);
      if (i.items) out.items = mapItems(i.items);
      return out;
    });
  return blocks.map((b): Block => {
    if (b.kind === 'paragraph') return { ...b, inlines: fn(b.inlines) };
    if (b.kind === 'list') return { ...b, items: mapItems(b.items) };
    if (b.kind === 'table')
      return {
        ...b,
        rows: b.rows.map((r) => ({
          ...r,
          cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map((p) => ({ ...p, inlines: fn(p.inlines) })) }))
        }))
      };
    if (b.kind === 'group') return { ...b, blocks: mapInlines(b.blocks, fn) };
    if (b.kind === 'columns') return { ...b, columns: b.columns.map((col) => mapInlines(col, fn)) };
    return b;
  });
}
