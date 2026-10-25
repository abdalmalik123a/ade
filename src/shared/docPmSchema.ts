/**
 * مخطّط ProseMirror للوثيقة وقراءة الأنماط من HTML ملصوق — نُقل من `docPm.ts` (D78).
 */
import type { Align, ListStyle } from './doc';
import { cssSizeToPx, marks } from './docPmMarks';
import { KASHIDA_LEVELS, type KashidaLevel } from './kashida';
import { type Node as PMNode, type NodeSpec, Schema } from 'prosemirror-model';

/**
 * ما يقرؤه المخطّط من عنصر HTML ملصوق — بنيةً لا نوعَ المتصفّح، فالملف يُبنى أيضًا مع
 * العملية الرئيسة التي لا تعرف DOM (ولا يُستدعى فيها).
 */
export type DomEl = {
  getAttribute(name: string): string | null;
  className?: string;
  style: { textAlign: string; textIndent: string; lineHeight: string; fontSize: string; fontWeight: string; verticalAlign?: string };
};

export const dom = (el: unknown) => el as DomEl;

export const ALIGNS: Align[] = ['right', 'center', 'left', 'justify'];

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

export function paragraphAttrsFromDom(el: DomEl): Record<string, unknown> {
  const s = el.style;
  const align = ALIGNS.includes(s.textAlign as Align) ? (s.textAlign as Align) : el.getAttribute('align') ?? 'right';
  return {
    id: el.getAttribute('data-id') || null,
    align: ALIGNS.includes(align as Align) ? align : 'right',
    indent: cssIndentToMm(s.textIndent ?? ''),
    lineHeight: cssLineHeight(s.lineHeight ?? ''),
    size: s.fontSize ? cssSizeToPx(s.fontSize) : null,
    kashida: align === 'justify' && KASHIDA_LEVELS.includes(el.getAttribute('data-kashida') as KashidaLevel) ? el.getAttribute('data-kashida') : null,
    dir: el.getAttribute('dir') === 'ltr' ? 'ltr' : null
  };
}

export function paragraphDomAttrs(node: PMNode): Record<string, string> {
  const a = node.attrs;
  const style = [
    `text-align:${a.align}`,
    a.size ? `font-size:${a.size}px` : '',
    a.lineHeight ? `line-height:${a.lineHeight}` : '',
    a.indent ? `text-indent:${a.indent}mm` : '',
    a.spaceBefore ? `margin-top:${a.spaceBefore}px` : '',
    a.spaceAfter ? `margin-bottom:${a.spaceAfter}px` : ''
  ]
    .filter(Boolean)
    .join(';');
  const out: Record<string, string> = { style };
  if (a.id) out['data-id'] = a.id;
  if (a.dir) out.dir = a.dir;
  if (a.kashida && a.align === 'justify') out['data-kashida'] = a.kashida;
  return out;
}

// ── المخطّط ─────────────────────────────────────────────────────────────

export const blockAttrs = { id: { default: null }, dir: { default: null } };

export const nodes: Record<string, NodeSpec> = {
  doc: { content: 'block+' },

  paragraph: {
    group: 'block',
    content: 'inline*',
    attrs: {
      ...blockAttrs,
      align: { default: 'right' },
      indent: { default: null },
      spaceBefore: { default: null },
      spaceAfter: { default: null },
      size: { default: null },
      lineHeight: { default: null },
      kashida: { default: null }
    },
    parseDOM: [
      { tag: 'p',getAttrs: (el) => paragraphAttrsFromDom(dom(el)) },
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
    attrs: { ...blockAttrs, columns: { default: null }, header: { default: false }, headerShading: { default: false }, borders: { default: null } },
    parseDOM: [
      {
        tag: 'table',
        getAttrs: (el) => {
          const d = dom(el);
          return {
            headerShading: d.getAttribute('data-header-shading') === 'true' || Boolean(d.className?.includes('pm-header-shading'))
          };
        }
      }
    ],
    toDOM: (node) => ['table', node.attrs.headerShading ? { 'data-header-shading': 'true' } : {}, ['tbody', 0]]
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
    attrs: { id: { default: null }, colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null }, vAlign: { default: null } },
    parseDOM: [
      {
        tag: 'td',
        getAttrs: (el) => {
          const d = dom(el);
          const v = d.getAttribute('data-valign') || (d.style.verticalAlign && ['top', 'middle', 'bottom'].includes(d.style.verticalAlign) ? d.style.verticalAlign : null);
          return { colspan: Number(d.getAttribute('colspan') || 1), rowspan: Number(d.getAttribute('rowspan') || 1), vAlign: v || null };
        }
      },
      {
        tag: 'th',
        getAttrs: (el) => {
          const d = dom(el);
          const v = d.getAttribute('data-valign') || (d.style.verticalAlign && ['top', 'middle', 'bottom'].includes(d.style.verticalAlign) ? d.style.verticalAlign : null);
          return { colspan: Number(d.getAttribute('colspan') || 1), rowspan: Number(d.getAttribute('rowspan') || 1), vAlign: v || null };
        }
      }
    ],
    toDOM: (node) => {
      const attrs: Record<string, string | number> = {};
      if (node.attrs.colspan > 1) attrs.colspan = node.attrs.colspan;
      if (node.attrs.rowspan > 1) attrs.rowspan = node.attrs.rowspan;
      if (node.attrs.vAlign) {
        attrs['data-valign'] = node.attrs.vAlign;
        attrs.style = `vertical-align:${node.attrs.vAlign}`;
      }
      return ['td', attrs, 0];
    }
  },

  /** الصورة من مخزن البرنامج وحده: صورةٌ ملصوقة من خارجه لا مسار لها هنا. */
  image: {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: { ...blockAttrs, src: {}, field: { default: null }, width: { default: 140 }, height: { default: null }, align: { default: 'center' } },
    parseDOM: [
      {
        tag: 'img[data-src]',
        getAttrs: (el) => ({
          src: dom(el).getAttribute('data-src'),
          // حقل الصورة (S38) يُنسخ ويُلصق بحقله ومقاسه.
          field: dom(el).getAttribute('data-field') || null,
          width: Number(dom(el).getAttribute('width')) || 140,
          height: Number(dom(el).getAttribute('data-height')) || null
        })
      },
      {
        // صورةٌ لُصقت من Word (ملفٌّ مؤقّت `file:`) أو مضمّنة (`data:`): مصدرها كما جاء حتى
        // يحفظها المحرّر في المخزن (`PageEditor`). وما جاء من الشبكة لا يُلصق — البرنامج بلا إنترنت.
        tag: 'img[src]',
        getAttrs: (el) => {
          const src = dom(el).getAttribute('src') ?? '';
          // و`file:` ملفٌّ على قرصٍ محلّيّ (`file:///C:/…`) وحده — لا مضيفٌ ولا مسار شبكة (و٥؛ والقناة تتحقّق أيضًا).
          if (!/^(file:\/\/\/[a-z]:\/|data:image\/)/i.test(src)) return false;
          return { src, width: Math.min(640, Number(dom(el).getAttribute('width')) || 140) };
        }
      }
    ],
    toDOM: (node) => [
      'img',
      {
        'data-src': node.attrs.src,
        width: String(node.attrs.width),
        ...(node.attrs.field ? { 'data-field': node.attrs.field, ...(node.attrs.height ? { 'data-height': String(node.attrs.height) } : {}) } : {})
      }
    ]
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

  rule: {
    group: 'block',
    atom: true,
    attrs: { ...blockAttrs },
    parseDOM: [{ tag: 'div[data-rule]' }, { tag: 'hr' }],
    toDOM: () => ['div', { 'data-rule': '' }]
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

export const docSchema = new Schema({ nodes, marks });
