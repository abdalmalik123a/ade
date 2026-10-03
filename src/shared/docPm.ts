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
import { Schema, type Mark, type Node as PMNode, type NodeSpec, type MarkSpec } from 'prosemirror-model';
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

// ── قراءة الأنماط من HTML ملصوق (Word والمتصفّح) ─────────────────────────

/** حجمٌ مكتوبٌ في CSS إلى بكسل: Word يكتب `14.0pt`، والمتصفّح `18.6667px`. */
export function cssSizeToPx(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(px|pt)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const px = (m[2] ?? 'px').toLowerCase() === 'pt' ? (n * 4) / 3 : n;
  return Math.round(px * 10) / 10;
}

/** أوّل خطٍّ في القائمة بلا علامات اقتباس — `"Simplified Arabic",serif` ← Simplified Arabic. */
export function firstFontFamily(value: string): string | null {
  const first = value.split(',')[0]?.trim().replace(/^["']|["']$/g, '').trim();
  if (!first || /^(serif|sans-serif|monospace|inherit|initial)$/i.test(first)) return null;
  return first;
}

/**
 * ما يقرؤه المخطّط من عنصر HTML ملصوق — بنيةً لا نوعَ المتصفّح، فالملف يُبنى أيضًا مع
 * العملية الرئيسة التي لا تعرف DOM (ولا يُستدعى فيها).
 */
type DomEl = {
  getAttribute(name: string): string | null;
  style: { textAlign: string; textIndent: string; lineHeight: string; fontSize: string; fontWeight: string };
};
const dom = (el: unknown) => el as DomEl;

const ALIGNS: Align[] = ['right', 'center', 'left', 'justify'];

/** بادئة السطر بالملّم: Word يكتبها `1.0cm` أو `36.0pt`، والمحرّر `20mm`. */
export function cssIndentToMm(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(mm|cm|pt|px)\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]!.toLowerCase();
  const mm = unit === 'mm' ? n : unit === 'cm' ? n * 10 : unit === 'pt' ? n * 0.3528 : n * 0.2646;
  return Math.round(mm * 10) / 10;
}

/** تباعد الأسطر مضاعفًا: `1.5` أو `150%` — والمطلق بالنقاط («18pt») لا يُعرف مضاعفه فيُترك. */
export function cssLineHeight(value: string): number | null {
  const v = value.trim();
  const pct = /^([\d.]+)%$/.exec(v);
  const n = pct ? Number(pct[1]) / 100 : /^[\d.]+$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0.8 && n <= 4 ? Math.round(n * 100) / 100 : null;
}

function paragraphAttrsFromDom(el: DomEl): Record<string, unknown> {
  const s = el.style;
  const align = ALIGNS.includes(s.textAlign as Align) ? (s.textAlign as Align) : el.getAttribute('align') ?? 'right';
  return {
    id: el.getAttribute('data-id') || null,
    align: ALIGNS.includes(align as Align) ? align : 'right',
    indent: cssIndentToMm(s.textIndent ?? ''),
    lineHeight: cssLineHeight(s.lineHeight ?? ''),
    size: s.fontSize ? cssSizeToPx(s.fontSize) : null,
    dir: el.getAttribute('dir') === 'ltr' ? 'ltr' : null
  };
}

function paragraphDomAttrs(node: PMNode): Record<string, string> {
  const a = node.attrs;
  const style = [
    `text-align:${a.align}`,
    a.size ? `font-size:${a.size}px` : '',
    a.lineHeight ? `line-height:${a.lineHeight}` : '',
    a.indent ? `text-indent:${a.indent}mm` : '',
    a.spaceAfter ? `margin-bottom:${a.spaceAfter}px` : ''
  ]
    .filter(Boolean)
    .join(';');
  const out: Record<string, string> = { style };
  if (a.id) out['data-id'] = a.id;
  if (a.dir) out.dir = a.dir;
  return out;
}

// ── المخطّط ─────────────────────────────────────────────────────────────

const blockAttrs = { id: { default: null }, dir: { default: null } };

const nodes: Record<string, NodeSpec> = {
  doc: { content: 'block+' },

  paragraph: {
    group: 'block',
    content: 'inline*',
    attrs: {
      ...blockAttrs,
      align: { default: 'right' },
      indent: { default: null },
      spaceAfter: { default: null },
      size: { default: null },
      lineHeight: { default: null }
    },
    parseDOM: [
      { tag: 'p', getAttrs: (el) => paragraphAttrsFromDom(dom(el)) },
      { tag: 'h1', getAttrs: (el) => paragraphAttrsFromDom(dom(el)) },
      { tag: 'h2', getAttrs: (el) => paragraphAttrsFromDom(dom(el)) },
      { tag: 'h3', getAttrs: (el) => paragraphAttrsFromDom(dom(el)) }
    ],
    toDOM: (node) => ['p', paragraphDomAttrs(node), 0]
  },

  text: { group: 'inline' },

  /** الحقل: صندوقٌ ذرّي يُحذف كلّه أو لا يُحذف — ولا يُكتب داخله. */
  field: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: { ref: {}, id: { default: null } },
    parseDOM: [{ tag: 'span[data-field]', getAttrs: (el) => ({ ref: dom(el).getAttribute('data-field') }) }],
    toDOM: (node) => ['span', { 'data-field': node.attrs.ref, contenteditable: 'false' }, `{${node.attrs.ref}}`]
  },

  hard_break: {
    group: 'inline',
    inline: true,
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br']
  },

  /** القائمة بأنماط مستوياتها؛ والقائمة المتداخلة فرعٌ من عنصرها لا كتلةٌ قائمة. */
  list: {
    group: 'block',
    content: 'list_item+',
    attrs: { ...blockAttrs, styles: { default: ['bullet'] }, pick: { default: null }, nested: { default: false } },
    parseDOM: [
      { tag: 'ul', getAttrs: () => ({ styles: ['bullet'] }) },
      { tag: 'ol', getAttrs: () => ({ styles: ['number'] }) }
    ],
    toDOM: (node) => [(node.attrs.styles as ListStyle[])[0] === 'bullet' ? 'ul' : 'ol', 0]
  },

  list_item: {
    content: 'paragraph list?',
    defining: true,
    attrs: { id: { default: null }, score: { default: null }, answer: { default: null }, pick: { default: null } },
    parseDOM: [{ tag: 'li' }],
    toDOM: () => ['li', 0]
  },

  table: {
    group: 'block',
    content: 'table_row+',
    tableRole: 'table',
    isolating: true,
    attrs: { ...blockAttrs, columns: { default: null }, header: { default: false }, borders: { default: null } },
    parseDOM: [{ tag: 'table' }],
    toDOM: () => ['table', ['tbody', 0]]
  },

  table_row: {
    content: 'table_cell+',
    tableRole: 'row',
    attrs: { id: { default: null } },
    parseDOM: [{ tag: 'tr' }],
    toDOM: () => ['tr', 0]
  },

  table_cell: {
    content: 'paragraph+',
    tableRole: 'cell',
    isolating: true,
    attrs: { id: { default: null }, colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
    parseDOM: [
      {
        tag: 'td',
        getAttrs: (el) => ({ colspan: Number(dom(el).getAttribute('colspan') || 1) })
      },
      {
        tag: 'th',
        getAttrs: (el) => ({ colspan: Number(dom(el).getAttribute('colspan') || 1) })
      }
    ],
    toDOM: (node) => ['td', node.attrs.colspan > 1 ? { colspan: node.attrs.colspan } : {}, 0]
  },

  /** الصورة من مخزن البرنامج وحده: صورةٌ ملصوقة من خارجه لا مسار لها هنا. */
  image: {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: { ...blockAttrs, src: {}, width: { default: 140 }, height: { default: null }, align: { default: 'center' } },
    parseDOM: [
      {
        tag: 'img[data-src]',
        getAttrs: (el) => ({
          src: dom(el).getAttribute('data-src'),
          width: Number(dom(el).getAttribute('width')) || 140
        })
      }
    ],
    toDOM: (node) => ['img', { 'data-src': node.attrs.src, width: String(node.attrs.width) }]
  },

  spacer: {
    group: 'block',
    atom: true,
    attrs: { ...blockAttrs, height: { default: 24 }, lines: { default: false } },
    parseDOM: [{ tag: 'div[data-spacer]', getAttrs: (el) => ({ height: Number(dom(el).getAttribute('data-spacer')) || 24 }) }],
    toDOM: (node) => ['div', { 'data-spacer': String(node.attrs.height) }]
  },

  page_break: {
    group: 'block',
    atom: true,
    attrs: { ...blockAttrs },
    parseDOM: [{ tag: 'div[data-page-break]' }],
    toDOM: () => ['div', { 'data-page-break': '' }]
  },

  columns: {
    group: 'block',
    content: 'column+',
    isolating: true,
    attrs: { ...blockAttrs, gap: { default: null }, widths: { default: null } },
    parseDOM: [{ tag: 'div[data-columns]' }],
    toDOM: () => ['div', { 'data-columns': '' }, 0]
  },

  column: {
    content: 'block+',
    isolating: true,
    parseDOM: [{ tag: 'div[data-column]' }],
    toDOM: () => ['div', { 'data-column': '' }, 0]
  },

  /** مجموعةٌ شرطية أو متكرّرة — تُحرَّر بما فيها، وشرطها صفةٌ لها. */
  group: {
    group: 'block',
    content: 'block+',
    attrs: { ...blockAttrs, mode: { default: 'conditional' }, on: { default: '' } },
    parseDOM: [{ tag: 'div[data-group]' }],
    toDOM: () => ['div', { 'data-group': '' }, 0]
  }
};

const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (el) => (dom(el).style.fontWeight !== 'normal' ? null : false) },
      { style: 'font-weight', getAttrs: (v) => (/^(bold(er)?|[6-9]\d\d)$/.test(v as string) ? null : false) }
    ],
    toDOM: () => ['strong', 0]
  },
  italic: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0]
  },
  underline: {
    parseDOM: [
      { tag: 'u' },
      { style: 'text-decoration', getAttrs: (v) => (/underline/.test(v as string) ? null : false) },
      { style: 'text-decoration-line', getAttrs: (v) => (/underline/.test(v as string) ? null : false) }
    ],
    toDOM: () => ['u', 0]
  },
  size: {
    attrs: { px: {} },
    parseDOM: [
      {
        style: 'font-size',
        getAttrs: (v) => {
          const px = cssSizeToPx(v as string);
          return px ? { px } : false;
        }
      }
    ],
    toDOM: (mark) => ['span', { style: `font-size:${mark.attrs.px}px`, 'data-size': String(mark.attrs.px) }, 0]
  },
  font: {
    attrs: { family: {} },
    parseDOM: [
      {
        style: 'font-family',
        getAttrs: (v) => {
          const family = firstFontFamily(v as string);
          return family ? { family } : false;
        }
      }
    ],
    toDOM: (mark) => ['span', { style: `font-family:'${mark.attrs.family}'`, 'data-font': mark.attrs.family }, 0]
  }
};

export const docSchema = new Schema({ nodes, marks });
const S = docSchema;

// ── Doc ← → ProseMirror ─────────────────────────────────────────────────

function marksOf(m: Marks | undefined): Mark[] {
  if (!m) return [];
  const out: Mark[] = [];
  if (m.bold) out.push(S.marks.bold!.create());
  if (m.italic) out.push(S.marks.italic!.create());
  if (m.underline) out.push(S.marks.underline!.create());
  if (m.size) out.push(S.marks.size!.create({ px: m.size }));
  if (m.font) out.push(S.marks.font!.create({ family: m.font }));
  return out;
}

function marksFrom(list: readonly Mark[]): Marks | undefined {
  const out: Marks = {};
  for (const mk of list) {
    if (mk.type.name === 'bold') out.bold = true;
    else if (mk.type.name === 'italic') out.italic = true;
    else if (mk.type.name === 'underline') out.underline = true;
    else if (mk.type.name === 'size') out.size = mk.attrs.px as number;
    else if (mk.type.name === 'font') out.font = mk.attrs.family as string;
  }
  return Object.keys(out).length ? out : undefined;
}

export function inlinesToPm(inlines: Inline[]): PMNode[] {
  const out: PMNode[] = [];
  for (const i of inlines) {
    if (i.kind === 'run') {
      if (i.text) out.push(S.text(i.text, marksOf(i.marks)));
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
        { id: b.id, dir: b.dir ?? null, columns: b.columns, header: b.header, borders: b.borders ?? null },
        b.rows.map((r) =>
          S.nodes.table_row!.create(
            { id: r.id },
            r.cells.map((c) =>
              S.nodes.table_cell!.create(
                { id: c.id, colspan: c.colSpan ?? 1 },
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
          cells.push(c);
        });
        rows.push({ id: (row.attrs.id as string) || newUuid(), cells });
      });
      const width = Math.max(1, ...rows.map((r) => r.cells.reduce((n, c) => n + (c.colSpan ?? 1), 0)));
      const columns = Array.isArray(a.columns) && a.columns.length === width ? (a.columns as number[]) : Array(width).fill(1);
      const b: TableBlock = { id, kind: 'table', columns, header: Boolean(a.header), rows };
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
