/**
 * عمليات تحرير الوثيقة — نقيّةً، فتُختبر بلا متصفّح.
 *
 * كل دالّة تأخذ وثيقة وتعيد أخرى ولا تمسّ الأولى: عليه يقوم التراجع بلقطات،
 * وهو أبسط من تتبّع الفروق ويكفي لوثائقنا الصغيرة.
 *
 * والمفتاح مرجع المتن: تغيير العنوان لا يمسّه، وحذف الحقل يردّه نقاطًا
 * (`unfield`) لا يمحو ما كُتب.
 */
import {
  makeField,
  newUuid,
  paragraph,
  reconcileFields,
  run,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type ListBlock,
  type ListItem,
  type ParagraphBlock,
  type TableBlock,
  type TableCell,
  type TableRow
} from './doc';

/** محرف يشغل موضع الحقل عند حساب المواضع — الحقل وحدةٌ لا تُقسم. */
export const FIELD_CHAR = '￼';

/** نصّ الفقرة بمواضعه: الحقل محرفٌ واحد، وكسر السطر سطر. */
export function paragraphText(inlines: Inline[]): string {
  return inlines
    .map((i) => (i.kind === 'run' ? i.text : i.kind === 'field' ? FIELD_CHAR : '\n'))
    .join('');
}

// ── الكتل ────────────────────────────────────────────────────────────

const mapBlocks = (blocks: Block[], fn: (b: Block) => Block | null): Block[] =>
  blocks.flatMap((b) => {
    const next = fn(b.kind === 'group' ? { ...b, blocks: mapBlocks(b.blocks, fn) } : b);
    return next ? [next] : [];
  });

export function insertBlock(doc: Doc, block: Block, afterId?: string | null): Doc {
  const at = afterId ? doc.blocks.findIndex((b) => b.id === afterId) : -1;
  const blocks = [...doc.blocks];
  blocks.splice(at < 0 ? blocks.length : at + 1, 0, block);
  return reconciled({ ...doc, blocks });
}

export function removeBlock(doc: Doc, id: string): Doc {
  return reconciled({ ...doc, blocks: mapBlocks(doc.blocks, (b) => (b.id === id ? null : b)) });
}

/** يحرّك كتلةً خطوةً — والحدود تردّ الوثيقة كما هي بلا انهيار. */
export function moveBlock(doc: Doc, id: string, dir: -1 | 1): Doc {
  const blocks = [...doc.blocks];
  const at = blocks.findIndex((b) => b.id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= blocks.length) return doc;
  [blocks[at], blocks[to]] = [blocks[to]!, blocks[at]!];
  return { ...doc, blocks };
}

export function patchBlock<T extends Block>(doc: Doc, id: string, patch: Partial<T>): Doc {
  return reconciled({
    ...doc,
    blocks: mapBlocks(doc.blocks, (b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))
  });
}

/** يستبدل مضمون فقرة — ما يكتبه المحرّر في الكتلة الواحدة. */
export function setInlines(doc: Doc, blockId: string, inlines: Inline[]): Doc {
  return patchBlock<ParagraphBlock>(doc, blockId, { inlines });
}

// ── النصّ ← حقل (F4) ────────────────────────────────────────────────

/** يقصّ مدى نصّي من الأجزاء، ويعيد ما قبله وما فيه وما بعده. */
function splitAt(inlines: Inline[], start: number, end: number) {
  const before: Inline[] = [];
  const after: Inline[] = [];
  let taken = '';
  let at = 0;
  let clean = true;

  for (const node of inlines) {
    const len = node.kind === 'run' ? node.text.length : 1;
    const from = at;
    const to = at + len;
    at = to;

    if (to <= start) {
      before.push(node);
      continue;
    }
    if (from >= end) {
      after.push(node);
      continue;
    }
    // متداخل: لا يُقسم إلا النصّ — والحقل وكسر السطر وحدتان لا تُشقّان.
    if (node.kind !== 'run') {
      clean = false;
      after.push(node);
      continue;
    }
    const head = node.text.slice(0, Math.max(0, start - from));
    const mid = node.text.slice(Math.max(0, start - from), Math.min(len, end - from));
    const tail = node.text.slice(Math.min(len, end - from));
    if (head) before.push(run(head, node.marks));
    taken += mid;
    if (tail) after.push(run(tail, node.marks));
  }

  return { before, taken, after, clean };
}

/**
 * يحوّل نصًّا مظلَّلًا إلى حقل باسمه — وهو أسرع طريق من نصّ إلى نموذج.
 *
 * وعرض الحقل من طول ما كان مكتوبًا، فلا تنكمش الورقة عن شكلها الأول. وما
 * تداخل مع حقلٍ قائم يُترك كما هو: الحقل وحدةٌ لا تُشقّ.
 */
export function fieldify(
  doc: Doc,
  blockId: string,
  start: number,
  end: number,
  patch: Partial<DocField> = {}
): Doc {
  if (end <= start) return doc;
  const block = doc.blocks.find((b) => b.id === blockId);
  if (!block || block.kind !== 'paragraph') return doc;

  const cut = splitAt(block.inlines, start, end);
  const label = (patch.label ?? cut.taken).trim();
  if (!cut.clean || !label) return doc;

  const key = uniqueKey(doc, keyOf(label));
  const field = makeField({
    key,
    label,
    width: Math.max(6, cut.taken.trim().length),
    ...patch
  });

  const inlines = [...cut.before, { kind: 'field' as const, id: newUuid(), ref: key }, ...cut.after];
  const next = setInlines({ ...doc, fields: [...doc.fields, field] }, blockId, inlines);
  return next;
}

const keyOf = (label: string) => label.trim().replace(/\s+/g, '_').replace(/[{}]/g, '') || 'حقل';

function uniqueKey(doc: Doc, base: string): string {
  if (!doc.fields.some((f) => f.key === base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}_${i}`;
    if (!doc.fields.some((f) => f.key === candidate)) return candidate;
  }
  return `${base}_${newUuid().slice(0, 4)}`;
}

/** يُدرج حقلًا قائمًا في موضع — الحقل الواحد يظهر في مواضع ويُملأ مرّة. */
export function insertField(doc: Doc, blockId: string, at: number, key: string): Doc {
  const block = doc.blocks.find((b) => b.id === blockId);
  if (!block || block.kind !== 'paragraph') return doc;
  if (!doc.fields.some((f) => f.key === key)) return doc;

  const cut = splitAt(block.inlines, at, at);
  return setInlines(doc, blockId, [
    ...cut.before,
    { kind: 'field', id: newUuid(), ref: key },
    ...cut.after
  ]);
}

// ── لوحة الحقول ──────────────────────────────────────────────────────

export function patchField(doc: Doc, key: string, patch: Partial<DocField>): Doc {
  return {
    ...doc,
    // المفتاح لا يُمسّ من هنا: هو مرجع المتن، وتغييره يقطع الحقل عن مواضعه.
    fields: doc.fields.map((f) => (f.key === key ? { ...f, ...patch, key: f.key } : f))
  };
}

/**
 * يعيد ترتيب الحقول — وهو **نفسه** ترتيب شاشة الإدخال في الشبّاك.
 *
 * وما لم يُذكر يلحق بآخر القائمة، فلا يضيع حقلٌ بسهو.
 */
export function reorderFields(doc: Doc, keys: string[]): Doc {
  const byKey = new Map(doc.fields.map((f) => [f.key, f]));
  const ordered = keys.map((k) => byKey.get(k)).filter(Boolean) as DocField[];
  const rest = doc.fields.filter((f) => !keys.includes(f.key));
  return { ...doc, fields: [...ordered, ...rest] };
}

// ── الجداول ──────────────────────────────────────────────────────────

const cell = (text = ''): TableCell => ({
  id: newUuid(),
  blocks: [paragraph(text ? [run(text)] : [])]
});

export function makeTable(rows: number, cols: number, header = true): TableBlock {
  return {
    id: newUuid(),
    kind: 'table',
    columns: Array.from({ length: cols }, () => 1),
    header,
    rows: Array.from({ length: Math.max(1, rows) }, () => ({
      id: newUuid(),
      cells: Array.from({ length: Math.max(1, cols) }, () => cell())
    }))
  };
}

function withTable(doc: Doc, id: string, fn: (t: TableBlock) => TableBlock): Doc {
  return reconciled({
    ...doc,
    blocks: mapBlocks(doc.blocks, (b) => (b.id === id && b.kind === 'table' ? fn(b) : b))
  });
}

export function setCell(doc: Doc, tableId: string, r: number, c: number, inlines: Inline[]): Doc {
  return withTable(doc, tableId, (t) => ({
    ...t,
    rows: t.rows.map((row, ri) =>
      ri !== r
        ? row
        : {
            ...row,
            cells: row.cells.map((cel, ci) =>
              ci !== c ? cel : { ...cel, blocks: [{ ...cel.blocks[0]!, inlines }] }
            )
          }
    )
  }));
}

export function addRow(doc: Doc, tableId: string, at?: number): Doc {
  return withTable(doc, tableId, (t) => {
    const rows = [...t.rows];
    const row: TableRow = {
      id: newUuid(),
      cells: Array.from({ length: t.columns.length }, () => cell())
    };
    rows.splice(at ?? rows.length, 0, row);
    return { ...t, rows };
  });
}

export function removeRow(doc: Doc, tableId: string, at: number): Doc {
  return withTable(doc, tableId, (t) =>
    // صفٌّ واحد على الأقل: جدولٌ بلا صفوف ليس جدولًا.
    t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((_, i) => i !== at) }
  );
}

export function addColumn(doc: Doc, tableId: string, at?: number): Doc {
  return withTable(doc, tableId, (t) => {
    const columns = [...t.columns];
    const where = at ?? columns.length;
    columns.splice(where, 0, 1);
    return {
      ...t,
      columns,
      rows: t.rows.map((row) => {
        const cells = [...row.cells];
        cells.splice(where, 0, cell());
        return { ...row, cells };
      })
    };
  });
}

export function removeColumn(doc: Doc, tableId: string, at: number): Doc {
  return withTable(doc, tableId, (t) =>
    t.columns.length <= 1
      ? t
      : {
          ...t,
          columns: t.columns.filter((_, i) => i !== at),
          rows: t.rows.map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== at) }))
        }
  );
}

/** الحقول تتبع المتن بعد كل تحرير: ما اختفى من الورقة يختفي من شاشة الإدخال. */
function reconciled(doc: Doc): Doc {
  return { ...doc, fields: reconcileFields(doc) };
}

// ── القوائم: الأسئلة وفروعها ────────────────────────────────────────

/** قائمة أسئلة جاهزة: س١ ثم أ ثم ١ — وهي صورة ورقة المدرسة. */
export function makeQuestionList(): ListBlock {
  return {
    id: newUuid(),
    kind: 'list',
    styles: ['question', 'arabicLetter', 'number'],
    items: [{ id: newUuid(), inlines: [] }]
  };
}

/** يمشي على شجرة العناصر ويطبّق تحويلًا على واحدٍ بمعرّفه. */
function mapItems(items: ListItem[], id: string, fn: (i: ListItem) => ListItem | null): ListItem[] {
  return items.flatMap((it) => {
    if (it.id === id) {
      const next = fn(it);
      return next ? [next] : [];
    }
    if (!it.items?.length) return [it];
    return [{ ...it, items: mapItems(it.items, id, fn) }];
  });
}

function withList(doc: Doc, blockId: string, fn: (b: ListBlock) => ListBlock): Doc {
  return reconciled({
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === blockId && b.kind === 'list' ? fn(b) : b))
  });
}

export function setItemInlines(doc: Doc, blockId: string, id: string, inlines: Inline[]): Doc {
  return withList(doc, blockId, (b) => ({
    ...b,
    items: mapItems(b.items, id, (it) => ({ ...it, inlines }))
  }));
}

export function patchItem(doc: Doc, blockId: string, id: string, patch: Partial<ListItem>): Doc {
  return withList(doc, blockId, (b) => ({
    ...b,
    items: mapItems(b.items, id, (it) => ({ ...it, ...patch }))
  }));
}

/** سؤالٌ جديد في آخر القائمة. */
export function addItem(doc: Doc, blockId: string): Doc {
  return withList(doc, blockId, (b) => ({
    ...b,
    items: [...b.items, { id: newUuid(), inlines: [] }]
  }));
}

/** فرعٌ جديد تحت سؤال — وهذا كل ما يعنيه «بفروع». */
export function addBranch(doc: Doc, blockId: string, parentId: string): Doc {
  return withList(doc, blockId, (b) => ({
    ...b,
    items: mapItems(b.items, parentId, (it) => ({
      ...it,
      items: [...(it.items ?? []), { id: newUuid(), inlines: [] }]
    }))
  }));
}

export function removeItem(doc: Doc, blockId: string, id: string): Doc {
  return withList(doc, blockId, (b) => {
    const items = mapItems(b.items, id, () => null);
    // لا تبقى قائمةٌ بلا عنصر — وإلا اختفت من الشاشة ولا سبيل إلى إعادتها.
    return items.length ? { ...b, items } : b;
  });
}

// ── التراجع بلقطات ───────────────────────────────────────────────────

export type History = { past: Doc[]; present: Doc; future: Doc[] };

/** عمقٌ يكفي جلسة تحرير ولا يُثقل الذاكرة — والوثيقة صغيرة. */
export const HISTORY_DEPTH = 60;

export const startHistory = (doc: Doc): History => ({ past: [], present: doc, future: [] });

export function commit(history: History, next: Doc): History {
  if (next === history.present) return history;
  const past = [...history.past, history.present].slice(-HISTORY_DEPTH);
  return { past, present: next, future: [] };
}

export function undo(history: History): History {
  const prev = history.past[history.past.length - 1];
  if (!prev) return history;
  return {
    past: history.past.slice(0, -1),
    present: prev,
    future: [history.present, ...history.future]
  };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  };
}
