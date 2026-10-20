/**
 * الوثيقة في المحرّر: مخطّط ProseMirror وتحويلٌ في الاتجاهين.
 *
 * **لماذا ProseMirror (خطّة الترقية، المرحلة ١):** المحرّر الأوّل جعل كلّ كتلةٍ مساحة
 * تحريرٍ وحدها، فلا يُحدَّد النصّ عبر الفقرات ولا يُنسَّق دفعةً واحدة — وهذا أكثر ما
 * شكا منه الموظفون. وهنا الورقة وثيقةٌ واحدة: التحديد بالحرف أينما امتدّ، والتنسيق على
 * المحدَّد، والتراجع واللصق والكتابة العربية من مكتبةٍ مجرَّبة.
 *
 * **والتخزين لا يتغيّر.** الوثيقة تبقى `Doc` بكتلها، وهذا الملف جسرٌ بينها وبين
 * المحرّر: كلّ كتلةٍ عقدة، وكلّ حقلٍ عقدةٌ ذرّية لا تُكسر بنصف مسح، ومعرّفات الكتل
 * والحقول تعبر كما هي. والذهاب والإياب لا يفقدان شيئًا (`tests/docPm.test.ts`).
 */
import { type Node as PMNode } from 'prosemirror-model';
import { marksFrom, marksOf } from './docPmMarks';
import {
  newUuid,
  type Align,
  type Block,
  type ColumnsBlock,
  type Dir,
  type ImageBlock,
  type Inline,
  type ListBlock,
  type ListItem,
  type ListStyle,
  type Marks,
  type ParagraphBlock,
  type SpacerBlock,
  type TableBlock
} from './doc';
import { docSchema } from './docPmSchema';

// ── قراءة الأنماط من HTML ملصوق (Word والمتصفّح) ─────────────────────────

/** وقارئا الحجم والخطّ مع علاماتهما في `docPmMarks.ts` — ويُصدَّران من هنا كما كانا. */
export { cssSizeToPx, firstFontFamily } from './docPmMarks';
export { docSchema, cssIndentToMm, cssLineHeight } from './docPmSchema';

const S = docSchema;

// ── Doc ← → ProseMirror ─────────────────────────────────────────────────

export function inlinesToPm(inlines: Inline[]): PMNode[] {
  const out: PMNode[] = [];
  for (const i of inlines) {
    if (i.kind === 'run') {
      if (i.text) out.push(S.text(i.text, marksOf(i.marks, S)));
    } else if (i.kind === 'field') {
      out.push(S.nodes.field!.create({ ref: i.ref, id: i.id }));
    } else {
      out.push(S.nodes.hard_break!.create());
    }
  }
  return out;
}

const sameMarks = (a?: Marks, b?: Marks) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

export function pmInlines(node: PMNode): Inline[] {
  const out: Inline[] = [];
  node.forEach((child) => {
    if (child.isText) {
      const marks = marksFrom(child.marks);
      const last = out[out.length - 1];
      if (last?.kind === 'run' && sameMarks(last.marks, marks)) last.text += child.text ?? '';
      else out.push(marks ? { kind: 'run', text: child.text ?? '', marks } : { kind: 'run', text: child.text ?? '' });
    } else if (child.type.name === 'field') {
      out.push({ kind: 'field', id: (child.attrs.id as string) || newUuid(), ref: child.attrs.ref as string });
    } else if (child.type.name === 'hard_break') {
      out.push({ kind: 'break' });
    }
  });
  return out;
}

function paragraphToPm(b: ParagraphBlock): PMNode {
  return S.nodes.paragraph!.create(
    {
      id: b.id,
      dir: b.dir ?? null,
      align: b.align,
      indent: b.indent ?? null,
      spaceAfter: b.spaceAfter ?? null,
      size: b.size ?? null,
      lineHeight: b.lineHeight ?? null
    },
    inlinesToPm(b.inlines)
  );
}

const emptyParagraph = () => S.nodes.paragraph!.create({ id: newUuid() });

function itemsToPm(items: ListItem[], attrs: Record<string, unknown>): PMNode {
  return S.nodes.list!.create(
    attrs,
    items.map((it) => {
      const content: PMNode[] = [S.nodes.paragraph!.create({ id: null }, inlinesToPm(it.inlines))];
      if (it.items?.length) content.push(itemsToPm(it.items, { id: null, styles: attrs.styles, nested: true }));
      return S.nodes.list_item!.create(
        { id: it.id, score: it.score ?? null, answer: it.answer ?? null, pick: it.pick ?? null },
        content
      );
    })
  );
}

function blockToPm(b: Block): PMNode {
  switch (b.kind) {
    case 'paragraph':
      return paragraphToPm(b);
    case 'list':
      return itemsToPm(b.items, { id: b.id, dir: b.dir ?? null, styles: b.styles, pick: b.pick ?? null, nested: false });
    case 'table':
      return S.nodes.table!.create(
        { id: b.id, dir: b.dir ?? null, columns: b.columns, header: b.header, headerShading: b.headerShading ?? false, borders: b.borders ?? null },
        b.rows.map((r) =>
          S.nodes.table_row!.create(
            { id: r.id },
            r.cells.map((c) =>
              S.nodes.table_cell!.create(
                { id: c.id, colspan: c.colSpan ?? 1, vAlign: c.vAlign ?? null },
                c.blocks.length ? c.blocks.map(paragraphToPm) : [emptyParagraph()]
              )
            )
          )
        )
      );
    case 'image':
      return S.nodes.image!.create({
        id: b.id,
        dir: b.dir ?? null,
        src: b.src,
        width: b.width,
        height: b.height ?? null,
        align: b.align
      });
    case 'spacer':
      return S.nodes.spacer!.create({ id: b.id, dir: b.dir ?? null, height: b.height, lines: b.lines ?? false });
    case 'pageBreak':
      return S.nodes.page_break!.create({ id: b.id, dir: b.dir ?? null });
    case 'rule':
      return S.nodes.rule!.create({ id: b.id, dir: b.dir ?? null });
    case 'columns':
      return S.nodes.columns!.create(
        { id: b.id, dir: b.dir ?? null, gap: b.gap ?? null, widths: b.widths ?? null },
        b.columns.map((col) => S.nodes.column!.create(null, col.length ? col.map(blockToPm) : [emptyParagraph()]))
      );
    case 'group':
      return S.nodes.group!.create(
        { id: b.id, dir: b.dir ?? null, mode: b.mode, on: b.on },
        b.blocks.length ? b.blocks.map(blockToPm) : [emptyParagraph()]
      );
  }
}

/** الوثيقة إلى المحرّر. ورقةٌ بلا كتل تبدأ بسطرٍ فارغ يُكتب فيه. */
export function blocksToPm(blocks: Block[]): PMNode {
  return S.nodes.doc!.create(null, blocks.length ? blocks.map(blockToPm) : [emptyParagraph()]);
}

const withDir = <T extends Block>(b: T, dir: unknown): T => (dir ? { ...b, dir: dir as Dir } : b);

function pmParagraph(node: PMNode): ParagraphBlock {
  const a = node.attrs;
  const b: ParagraphBlock = { id: (a.id as string) || newUuid(), kind: 'paragraph', align: a.align as Align, inlines: pmInlines(node) };
  if (a.indent != null) b.indent = a.indent as number;
  if (a.spaceAfter != null) b.spaceAfter = a.spaceAfter as number;
  if (a.size != null) b.size = a.size as number;
  if (a.lineHeight != null) b.lineHeight = a.lineHeight as number;
  return withDir(b, a.dir);
}

function pmItems(list: PMNode): ListItem[] {
  const out: ListItem[] = [];
  list.forEach((li) => {
    const a = li.attrs;
    const para = li.firstChild;
    const item: ListItem = { id: (a.id as string) || newUuid(), inlines: para ? pmInlines(para) : [] };
    if (a.score != null) item.score = a.score as number;
    if (a.answer != null) item.answer = a.answer as Inline[];
    if (a.pick != null) item.pick = a.pick as number;
    const sub = li.childCount > 1 ? li.child(1) : null;
    if (sub && sub.type.name === 'list') item.items = pmItems(sub);
    out.push(item);
  });
  return out;
}

function pmBlock(node: PMNode): Block | null {
  const a = node.attrs;
  const id = (a.id as string) || newUuid();
  switch (node.type.name) {
    case 'paragraph':
      return pmParagraph(node);
    case 'list': {
      const b: ListBlock = { id, kind: 'list', styles: a.styles as ListStyle[], items: pmItems(node) };
      if (a.pick != null) b.pick = a.pick as number;
      return withDir(b, a.dir);
    }
    case 'table': {
      const rows: TableBlock['rows'] = [];
      node.forEach((row) => {
        const cells: TableBlock['rows'][number]['cells'] = [];
        row.forEach((cell) => {
          const blocks: ParagraphBlock[] = [];
          cell.forEach((p) => blocks.push(pmParagraph(p)));
          const c: TableBlock['rows'][number]['cells'][number] = { id: (cell.attrs.id as string) || newUuid(), blocks };
          if ((cell.attrs.colspan as number) > 1) c.colSpan = cell.attrs.colspan as number;
          if (cell.attrs.vAlign) c.vAlign = cell.attrs.vAlign as 'top' | 'middle' | 'bottom';
          cells.push(c);
        });
        rows.push({ id: (row.attrs.id as string) || newUuid(), cells });
      });
      const width = Math.max(1, ...rows.map((r) => r.cells.reduce((n, c) => n + (c.colSpan ?? 1), 0)));
      const columns = Array.isArray(a.columns) && a.columns.length === width ? (a.columns as number[]) : Array(width).fill(1);
      const b: TableBlock = { id, kind: 'table', columns, header: Boolean(a.header), rows };
      if (a.headerShading) b.headerShading = true;
      if (a.borders != null) b.borders = a.borders as boolean;
      return withDir(b, a.dir);
    }
    case 'image': {
      const b: ImageBlock = { id, kind: 'image', src: a.src as string, width: a.width as number, align: a.align as Align };
      if (a.height != null) b.height = a.height as number;
      return withDir(b, a.dir);
    }
    case 'spacer': {
      const b: SpacerBlock = { id, kind: 'spacer', height: a.height as number };
      if (a.lines) b.lines = true;
      return withDir(b, a.dir);
    }
    case 'page_break':
      return withDir<Block>({ id, kind: 'pageBreak' }, a.dir);
    case 'rule':
      return withDir<Block>({ id, kind: 'rule' }, a.dir);
    case 'columns': {
      const columns: Block[][] = [];
      node.forEach((col) => columns.push(pmBlocks(col)));
      const b: ColumnsBlock = { id, kind: 'columns', columns };
      if (a.gap != null) b.gap = a.gap as number;
      if (a.widths != null) b.widths = a.widths as number[];
      return withDir(b, a.dir);
    }
    case 'group':
      return withDir<Block>({ id, kind: 'group', mode: a.mode as 'conditional' | 'repeat', on: a.on as string, blocks: pmBlocks(node) }, a.dir);
    default:
      return null;
  }
}

/** ما في المحرّر إلى كتل الوثيقة — بمعرّفاتها كما دخلت. */
export function pmBlocks(node: PMNode): Block[] {
  const out: Block[] = [];
  node.forEach((child) => {
    const b = pmBlock(child);
    if (b) out.push(b);
  });
  return out;
}
