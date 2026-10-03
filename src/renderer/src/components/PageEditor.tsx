/**
 * المحرّر الجديد — الورقة وثيقةٌ واحدة (خطّة الترقية، المرحلة ١: المحرّر يساوي Word).
 *
 * المحرّر الأوّل (`DocEditor`) جعل كلّ كتلةٍ مساحة تحريرٍ وحدها، فلا يُحدَّد النصّ عبر
 * الفقرات ولا يُنسَّق دفعةً واحدة — وهذا أكثر ما شكا منه الموظفون. وهنا ProseMirror:
 * التحديد بالحرف أينما امتدّ وCtrl+A، والتنسيق على المحدَّد، والتراجع واللصق من Word
 * بتنسيقه، والكتابة العربية — من مكتبةٍ مجرَّبة لا من كودٍ يُكتب لها.
 *
 * **والوثيقة لا تتغيّر.** ما يُحفظ `Doc` بكتلها كما كان (`shared/docPm.ts` جسرٌ في
 * الاتجاهين)، والحقل عقدةٌ ذرّية: تُحذف كلّها أو تبقى، ولا يُكتب داخلها. والخصائص هي
 * خصائص `DocEditor` نفسها، فيحلّ محلّه في الشاشتين بلا أن تتغيّرا.
 *
 * ويُبنى بجانب الأوّل حتى يثبت: الإعدادات تختار بينهما (`newEditor`).
 */
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-tables/style/tables.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node as PMNode, MarkType } from 'prosemirror-model';
import { AllSelection, EditorState, Plugin, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView, type NodeView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands, selectAll, splitBlockAs, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { gapCursor } from 'prosemirror-gapcursor';
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable,
  mergeCells,
  splitCell,
  tableEditing
} from 'prosemirror-tables';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { blocksToPm, docSchema, pmBlocks } from '@shared/docPm';
import {
  MARGIN_PRESETS,
  PAGE_NAMES,
  marginPreset,
  newUuid,
  pageMm,
  paragraph,
  reconcileFields,
  run,
  type Align,
  type Block,
  type Doc,
  type DocField,
  type MarginPreset,
  type PageSetup,
  type PageSize
} from '@shared/doc';
import { watermarkHtml } from '@shared/docHtml';
import { fieldFromText, makeTable } from '@shared/docEdit';
import {
  BASE_SIZE,
  FieldPanel,
  InsertMenu,
  OFFICIAL_INDENT_MM,
  SIZES,
  Tool,
  ToolSep,
  type DocEditorProps,
  type MenuClip
} from './DocEditor';
import { MM_PX, measurePages, pageFlowKey, pageFlowPlugin, sameBreaks } from './pageFlow';

const S = docSchema;
const N = S.nodes as Record<string, NonNullable<(typeof S.nodes)[string]>>;
const M = S.marks as Record<string, MarkType>;

/** خطوط Windows العربية التي تكتب بها المكاتب في Word، والمحزومة مع البرنامج. والفارغ خطّ الورقة. */
const FONTS = ['Simplified Arabic', 'Traditional Arabic', 'Sakkal Majalla', 'Arial', 'Times New Roman', 'Tahoma', 'Amiri', 'Cairo', 'IBM Plex Sans Arabic'];
/** تباعد الأسطر كما في Word: مفرد، و١٫١٥، ونصف، ومزدوج. */
const LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5];
/** الفجوة بين ورقتين على الشاشة. */
const SHEET_GAP = 24;

/** «صفحة واحدة»، «صفحتان»، «٣ صفحات» — كما تُقال. */
function pagesLabel(n: number): string {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتان';
  return n <= 10 ? `${n} صفحات` : `${n} صفحة`;
}
const indicDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

// ── الأوامر ─────────────────────────────────────────────────────────────

/** فقرات التحديد كلّها — في المتن والخلايا والأعمدة. */
function selectedParagraphs(state: EditorState): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = [];
  for (const r of state.selection.ranges) {
    state.doc.nodesBetween(r.$from.pos, r.$to.pos, (node, pos) => {
      if (node.type === N.paragraph) out.push({ node, pos });
      return true;
    });
  }
  return out;
}

/** صفةٌ لكلّ فقرةٍ في التحديد: المحاذاة والتباعد والبادئة. */
const setParagraphAttr =
  (attr: 'align' | 'lineHeight' | 'indent', value: unknown): Command =>
  (state, dispatch) => {
    const paras = selectedParagraphs(state);
    if (!paras.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of paras) tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attr]: value });
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

/**
 * علامةٌ ذات قيمة (الحجم، الخطّ) على التحديد — أو على ما سيُكتب إن لم يُحدَّد شيء، كما في Word.
 * والفقرة المحدَّدة كلّها تأخذ الحجم صفةً لها أيضًا، فيتبعه السطر الفارغ فيها.
 */
const setValueMark =
  (type: MarkType, attrs: Record<string, unknown> | null): Command =>
  (state, dispatch) => {
    const { selection } = state;
    if (!dispatch) return true;
    const tr = state.tr;
    if (selection.empty) {
      tr.removeStoredMark(type);
      if (attrs) tr.addStoredMark(type.create(attrs));
      dispatch(tr);
      return true;
    }
    for (const r of selection.ranges) {
      tr.removeMark(r.$from.pos, r.$to.pos, type);
      if (attrs) tr.addMark(r.$from.pos, r.$to.pos, type.create(attrs));
    }
    if (type === M.size) {
      for (const { node, pos } of selectedParagraphs(state)) {
        const whole = pos >= selection.from - 1 && pos + node.nodeSize <= selection.to + 1;
        if (whole) tr.setNodeMarkup(pos, undefined, { ...node.attrs, size: attrs ? attrs.px : null });
      }
    }
    dispatch(tr.scrollIntoView());
    return true;
  };

const clearMarks: Command = (state, dispatch) => {
  if (state.selection.empty) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const r of state.selection.ranges) for (const t of Object.values(M)) tr.removeMark(r.$from.pos, r.$to.pos, t);
    dispatch(tr);
  }
  return true;
};

/** Enter: الفقرة تنشطر، والجديدة ترث تنسيقها كما في Word — بمعرّفٍ جديد. */
const splitParagraph = splitBlockAs((node) => ({ type: node.type, attrs: { ...node.attrs, id: null } }));

/** القائمة: تُلفّ الفقرات فيها، أو تُفكّ إن كانت فيها بالنمط نفسه. */
const toggleList =
  (style: 'bullet' | 'number'): Command =>
  (state, dispatch, view) => {
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type === N.list) {
        if ((n.attrs.styles as string[])[0] === style) return liftListItem(N.list_item)(state, dispatch, view);
        if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(d), undefined, { ...n.attrs, styles: [style] }));
        return true;
      }
    }
    return wrapInList(N.list, { id: null, styles: [style] })(state, dispatch, view);
  };

const markActive = (state: EditorState, type: MarkType): boolean => {
  const { from, to, empty, $from } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks || $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
};

/** قيمة علامةٍ في التحديد إن كانت واحدة فيه — وإلا لا شيء. */
function markValue(state: EditorState, type: MarkType, attr: string): unknown {
  const { from, to, empty, $from } = state.selection;
  if (empty) return type.isInSet(state.storedMarks || $from.marks())?.attrs[attr] ?? null;
  let value: unknown = undefined;
  let mixed = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return true;
    const v = type.isInSet(node.marks)?.attrs[attr] ?? null;
    if (value === undefined) value = v;
    else if (value !== v) mixed = true;
    return false;
  });
  return mixed ? null : (value ?? null);
}

function paragraphValue(state: EditorState, attr: string): unknown {
  const values = new Set(selectedParagraphs(state).map((p) => p.node.attrs[attr] ?? null));
  return values.size === 1 ? [...values][0] : undefined;
}

// ── الإضافات ────────────────────────────────────────────────────────────

/**
 * لكلّ كتلةٍ وحقلٍ معرّفٌ واحد: الانشطار واللصق ينسخان الصفات ومعها المعرّف، فيُعطى
 * المكرَّر والمفقود معرّفًا جديدًا. وفقرة عنصر القائمة معرّفها لعنصرها لا لها.
 */
const uniqueIds = new Plugin({
  appendTransaction(trs, _old, state) {
    if (!trs.some((t) => t.docChanged)) return null;
    const seen = new Set<string>();
    let tr: Transaction | null = null;
    state.doc.descendants((node, pos, parent) => {
      if (!('id' in node.attrs)) return true;
      if (node.type === N.paragraph && parent?.type === N.list_item) return true;
      if (node.type === N.list && node.attrs.nested) return true;
      const id = node.attrs.id as string | null;
      if (id && !seen.has(id)) {
        seen.add(id);
        return true;
      }
      const fresh = newUuid();
      seen.add(fresh);
      tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, id: fresh });
      return true;
    });
    return tr;
  }
});

/** ورقةٌ فارغة تقول ما يُفعل فيها. */
const placeholder = new Plugin({
  props: {
    decorations(state) {
      const first = state.doc.firstChild;
      if (state.doc.childCount !== 1 || !first || first.type !== N.paragraph || first.content.size) return null;
      return DecorationSet.create(state.doc, [Decoration.node(0, first.nodeSize, { class: 'pm-empty', 'data-placeholder': 'اكتب هنا، أو الصق من Word…' })]);
    }
  }
});

/** ما يلصقه Word من تعليقاتٍ شرطية ووسوم مكتبه لا معنى له هنا. */
function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\/?o:p>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

// ── عرض العقد ───────────────────────────────────────────────────────────

const FIELD_CHIP =
  'px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/15 text-amber-950 border border-amber-500/40 font-semibold font-label-sm text-label-sm shadow-xs';
const FIELD_FILLED = 'px-0.5 rounded bg-secondary-fixed/60 text-on-surface font-semibold';

class FieldView implements NodeView {
  dom: HTMLElement;
  constructor(
    private node: PMNode,
    private labelOf: (key: string) => string
  ) {
    this.dom = document.createElement('span');
    this.dom.contentEditable = 'false';
    this.render();
  }
  private render() {
    const ref = this.node.attrs.ref as string;
    const shown = this.labelOf(ref);
    this.dom.dataset.field = ref;
    if (shown.startsWith('=')) {
      this.dom.className = FIELD_FILLED;
      this.dom.textContent = shown.slice(1);
      this.dom.dataset.filled = '';
    } else {
      this.dom.className = FIELD_CHIP;
      this.dom.textContent = `[ ${shown} ]`;
      delete this.dom.dataset.filled;
    }
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  selectNode() {
    this.dom.classList.add('ring-2', 'ring-secondary');
  }
  deselectNode() {
    this.dom.classList.remove('ring-2', 'ring-secondary');
  }
  ignoreMutation() {
    return true;
  }
}

function button(icon: string, title: string, onClick: () => void, danger = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = title;
  b.className = `w-7 h-7 rounded flex items-center justify-center ${danger ? 'text-error hover:bg-error-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`;
  b.innerHTML = `<span class="material-symbols-outlined text-[16px]">${icon}</span>`;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** الصورة والشعار: حجمٌ ومحاذاة وحذف — كما في المحرّر الأوّل. */
class ImageView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  constructor(
    private node: PMNode,
    private view: EditorView,
    private getPos: () => number | undefined
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'group/img relative';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.style.display = 'inline-block';
    this.img.style.maxWidth = '100%';
    const bar = document.createElement('div');
    bar.className =
      'absolute top-1 right-1 hidden group-hover/img:flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container-lowest shadow border border-outline-variant/50';
    bar.contentEditable = 'false';
    const set = (patch: Record<string, unknown>) => {
      const pos = this.getPos();
      if (pos == null) return;
      this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, ...patch }));
    };
    const width = (w: number) => {
      const next = Math.min(800, Math.max(20, w));
      const a = this.node.attrs;
      set({ width: next, ...(a.height ? { height: Math.max(1, Math.round(((a.height as number) * next) / (a.width as number))) } : {}) });
    };
    bar.append(
      button('remove', 'أصغر', () => width((this.node.attrs.width as number) - 20)),
      button('add', 'أكبر', () => width((this.node.attrs.width as number) + 20)),
      button('format_align_right', 'يمين', () => set({ align: 'right' })),
      button('format_align_center', 'وسط', () => set({ align: 'center' })),
      button('format_align_left', 'يسار', () => set({ align: 'left' })),
      button(
        'delete',
        'حذف',
        () => {
          const pos = this.getPos();
          if (pos != null) this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
        },
        true
      )
    );
    this.dom.append(this.img, bar);
    this.render();
  }
  private render() {
    const a = this.node.attrs;
    this.dom.style.textAlign = a.align === 'justify' ? 'center' : (a.align as string);
    this.img.src = a.src ? `diwan://store/${a.src as string}` : '';
    this.img.style.width = `${a.width as number}px`;
    this.img.style.height = a.height ? `${a.height as number}px` : '';
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  stopEvent(e: Event) {
    return (e.target as HTMLElement).closest('button') !== null;
  }
  ignoreMutation() {
    return true;
  }
}

/** المسافة ومساحة الإجابة — ارتفاعها كما يُطبع، وزرّ السطور. */
class SpacerView implements NodeView {
  dom: HTMLElement;
  private label: HTMLElement;
  constructor(
    private node: PMNode,
    private view: EditorView,
    private getPos: () => number | undefined
  ) {
    this.dom = document.createElement('div');
    this.dom.className =
      'rounded border border-dashed border-outline-variant flex items-center justify-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant';
    this.label = document.createElement('span');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'h-6 px-2 rounded bg-surface-container-low hover:bg-surface-container-high';
    toggle.addEventListener('mousedown', (e) => e.preventDefault());
    toggle.addEventListener('click', () => {
      const pos = this.getPos();
      if (pos != null) this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, lines: !this.node.attrs.lines }));
    });
    this.dom.append(this.label, toggle);
    this.render();
  }
  private render() {
    const a = this.node.attrs;
    this.dom.style.height = `${Math.max(28, a.height as number)}px`;
    this.label.textContent = `${a.lines ? 'مساحة إجابة' : 'مسافة'} ${a.height as number}px`;
    (this.dom.lastChild as HTMLElement).textContent = a.lines ? 'بلا سطور' : 'بسطور';
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  stopEvent(e: Event) {
    return (e.target as HTMLElement).closest('button') !== null;
  }
  ignoreMutation() {
    return true;
  }
}

function pageBreakView(): NodeView {
  const dom = document.createElement('div');
  dom.className = 'my-space-xs border-t-2 border-dashed border-secondary text-center';
  dom.dataset.pageBreak = '';
  dom.innerHTML = '<span class="px-2 -mt-2 inline-block bg-surface-container-lowest font-label-sm text-label-sm text-secondary">فاصل صفحة</span>';
  return { dom, ignoreMutation: () => true };
}

/** الجدول بأوزان أعمدته كما يُطبع، وبلا حدودٍ إن كان رأسًا مخفيّ الخطوط. */
class TableView implements NodeView {
  dom: HTMLTableElement;
  contentDOM: HTMLElement;
  private colgroup: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('table');
    this.colgroup = document.createElement('colgroup');
    this.contentDOM = document.createElement('tbody');
    this.dom.append(this.colgroup, this.contentDOM);
    this.render();
  }
  private render() {
    const cols = (this.node.attrs.columns as number[] | null) ?? [];
    const total = cols.reduce((a, b) => a + b, 0) || 1;
    this.colgroup.innerHTML = cols.map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`).join('');
    this.dom.className = this.node.attrs.borders === false ? 'pm-table pm-noborder' : 'pm-table';
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  ignoreMutation(m: { type: string; target: Node }) {
    return m.type === 'attributes' || this.colgroup.contains(m.target);
  }
}

/** عمودان جنبًا إلى جنب بأوزانهما — يُكتب في كلٍّ منهما. */
class ColumnsView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.className = 'pm-columns flex';
    this.contentDOM = this.dom;
    this.render();
  }
  private render() {
    this.dom.style.gap = `${(this.node.attrs.gap as number | null) ?? 16}px`;
    const widths = (this.node.attrs.widths as number[] | null) ?? [];
    requestAnimationFrame(() => {
      Array.from(this.dom.children).forEach((c, i) => {
        (c as HTMLElement).style.flex = `${widths[i] ?? 1} 1 0`;
      });
    });
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  ignoreMutation(m: { type: string; target: Node }) {
    return m.type === 'attributes' && m.target !== this.dom;
  }
}

/** المجموعة الشرطية أو المتكرّرة: إطارٌ يقول شرطها، ويُكتب فيها. */
class GroupView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private tag: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.className = 'relative rounded border border-dashed border-secondary/50 px-1 pt-3 my-1';
    this.tag = document.createElement('span');
    this.tag.contentEditable = 'false';
    this.tag.className = 'absolute -top-2 right-2 px-1.5 rounded bg-surface-container-lowest font-label-sm text-label-sm text-secondary';
    this.contentDOM = document.createElement('div');
    this.dom.append(this.tag, this.contentDOM);
    this.render();
  }
  private render() {
    const on = this.node.attrs.on as string;
    this.tag.textContent = this.node.attrs.mode === 'repeat' ? `يتكرّر لكلّ: ${on}` : `يظهر إن وُجد: ${on}`;
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  ignoreMutation(m: { target: Node }) {
    return this.tag.contains(m.target);
  }
}

// ── المحرّر ─────────────────────────────────────────────────────────────

export default function PageEditor({ doc, onChange, clips = [], header, values, aside, apiRef }: DocEditorProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  /** آخر كتلٍ صدرت من المحرّر — وما سواها وثيقةٌ جاءت من الخارج فتُعاد إليه. */
  const ownBlocks = useRef<Block[] | null>(null);
  /** حقولٌ عُرّفت قبل أن تقع على الورقة (F4 وكتالوج المعاملات) — تُضمّ في أوّل حفظ. */
  const pendingFields = useRef<DocField[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [menu, setMenu] = useState(false);
  const [, setTick] = useState(0);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState(1);
  const [customMargins, setCustomMargins] = useState(false);

  const labelOf = useCallback(
    (key: string) => {
      const value = values?.[key]?.trim();
      return value ? `=${value}` : doc.fields.find((f) => f.key === key)?.label || key;
    },
    [doc.fields, values]
  );
  const labelRef = useRef(labelOf);
  labelRef.current = labelOf;

  /** ما في المحرّر إلى الوثيقة — والحقول تتبع ما على الورقة. */
  const emit = useCallback((pm: PMNode) => {
    const blocks = pmBlocks(pm);
    ownBlocks.current = blocks;
    const base = docRef.current;
    const withPending = { ...base, blocks, fields: [...base.fields, ...pendingFields.current.filter((f) => !base.fields.some((x) => x.key === f.key))] };
    pendingFields.current = [];
    const next: Doc = { ...withPending, fields: reconcileFields(withPending) };
    docRef.current = next;
    onChangeRef.current(next);
  }, []);

  const nodeViews = useCallback(
    () => ({
      field: (node: PMNode) => new FieldView(node, (k) => labelRef.current(k)),
      image: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new ImageView(node, view, getPos),
      spacer: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new SpacerView(node, view, getPos),
      page_break: () => pageBreakView(),
      table: (node: PMNode) => new TableView(node),
      columns: (node: PMNode) => new ColumnsView(node),
      group: (node: PMNode) => new GroupView(node)
    }),
    []
  );

  /** F4: ما ظُلِّل يصير خانةً باسمه — نصًّا متّصلًا في سطرٍ واحد، بلا حقلٍ داخله. */
  const toField: Command = useCallback((state, dispatch) => {
    const { $from, $to, from, to, empty } = state.selection;
    if (empty || !$from.sameParent($to) || !$from.parent.isTextblock) return false;
    let hasField = false;
    state.doc.nodesBetween(from, to, (n) => {
      if (n.type === N.field) hasField = true;
    });
    if (hasField) return false;
    const base = docRef.current;
    const known = { ...base, fields: [...base.fields, ...pendingFields.current] };
    const field = fieldFromText(known, state.doc.textBetween(from, to));
    if (!field) return false;
    if (dispatch) {
      pendingFields.current.push(field);
      dispatch(state.tr.replaceWith(from, to, N.field.create({ ref: field.key, id: newUuid() })));
    }
    return true;
  }, []);

  /** كتلٌ بعد الكتلة التي فيها المؤشّر — والمؤشّر في أوّل سطرٍ يُكتب فيه منها. */
  const insertBlocks = useCallback((blocks: Block[]) => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const $from = state.selection.$from;
    const at = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
    const nodes = blocksToPm(blocks).content;
    const tr = state.tr.insert(at, nodes);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(at + 1, tr.doc.content.size))));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    setMenu(false);
  }, []);

  const run_ = useCallback((cmd: Command) => {
    const view = viewRef.current;
    if (!view) return false;
    const done = cmd(view.state, view.dispatch, view);
    view.focus();
    return done;
  }, []);

  // المحرّر يُنشأ مرّة؛ وما بعدها يمرّ بالحالة.
  useEffect(() => {
    if (!mountRef.current) return;
    const keys = keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Shift-Mod-z': redo,
      'Mod-b': toggleMark(M.bold),
      'Mod-i': toggleMark(M.italic),
      'Mod-u': toggleMark(M.underline),
      Enter: chainCommands(splitListItem(N.list_item), splitParagraph),
      'Shift-Enter': (state, dispatch) => {
        if (dispatch) dispatch(state.tr.replaceSelectionWith(N.hard_break.create()).scrollIntoView());
        return true;
      },
      'Mod-Enter': (state, dispatch) => {
        const $from = state.selection.$from;
        const at = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
        if (dispatch) {
          const tr = state.tr.insert(at, [N.page_break.create({ id: newUuid() }), N.paragraph.create({ id: newUuid(), align: $from.parent.attrs.align ?? 'right' })]);
          tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)));
          dispatch(tr.scrollIntoView());
        }
        return true;
      },
      F4: (state, dispatch) => toField(state, dispatch),
      Tab: chainCommands(goToNextCell(1), sinkListItem(N.list_item)),
      'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(N.list_item))
    });
    const view = new EditorView(mountRef.current, {
      state: EditorState.create({
        doc: blocksToPm(docRef.current.blocks),
        plugins: [history({ depth: 200 }), keys, keymap(baseKeymap), gapCursor(), tableEditing(), uniqueIds, placeholder, pageFlowPlugin()]
      }),
      nodeViews: nodeViews(),
      attributes: { class: 'pm-page outline-none', dir: 'rtl', 'data-page-editor': '' },
      transformPastedHTML: cleanPastedHtml,
      dispatchTransaction(tr) {
        const v = viewRef.current!;
        const before = v.state.doc;
        const next = v.state.apply(tr);
        v.updateState(next);
        if (next.doc !== before) emit(next.doc);
        setTick((t) => t + 1);
      }
    });
    viewRef.current = view;
    ownBlocks.current = docRef.current.blocks;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [emit, nodeViews, toField]);

  // وثيقةٌ جاءت من الخارج (فتحُ نموذجٍ آخر، أو حذف حقلٍ من اللوح) تحلّ في المحرّر.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || doc.blocks === ownBlocks.current) return;
    ownBlocks.current = doc.blocks;
    view.updateState(EditorState.create({ doc: blocksToPm(doc.blocks), plugins: view.state.plugins }));
    setTick((t) => t + 1);
  }, [doc.blocks]);

  // قيم الحقول وأسماؤها تتغيّر بلا أن تتغيّر الورقة — فتُعاد رسم الصناديق. وبالبصمة لا
  // بالمرجع: قائمة الحقول تُبنى من جديد مع كلّ حرف، وإعادة الرسم مع كلّ حرف تُربك الكتابة.
  const labelSig = useMemo(
    () => JSON.stringify([doc.fields.map((f) => [f.key, f.label]), values ?? {}]),
    [doc.fields, values]
  );
  const firstSig = useRef(labelSig);
  useEffect(() => {
    if (labelSig === firstSig.current) return;
    firstSig.current = labelSig;
    viewRef.current?.setProps({ nodeViews: nodeViews() });
  }, [labelSig, nodeViews]);

  // ── الصفحات ─────────────────────────────────────────────────────────
  const page = pageMm(doc.pageSetup);
  const margins = doc.pageSetup.margins;
  // كما في `pageCss`: الترقيم يحتاج هامشًا سفليًّا لا يقلّ عن ١٤ ملم.
  const bottomMm = doc.pageSetup.pageNumbers ? Math.max(margins.bottom, 14) : margins.bottom;
  const repeatHead = doc.pageSetup.repeatLetterhead && Boolean(header);
  const geo = useRef({ pageW: 0, pageH: 0, top: 0, bottom: 0, repeat: false });
  geo.current = { pageW: page.w * MM_PX, pageH: page.h * MM_PX, top: margins.top * MM_PX, bottom: bottomMm * MM_PX, repeat: repeatHead };
  const frame = useRef(0);

  /** يقيس الورقة بعد أن تُرسم، ويضع الفواصل حيث تقسمها الطابعة. */
  const remeasure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const view = viewRef.current;
      const paper = paperRef.current;
      const mount = mountRef.current;
      if (!view || !paper || !mount) return;
      const g = geo.current;
      const scale = paper.getBoundingClientRect().width / g.pageW || 1;
      const head = g.repeat && headRef.current ? headRef.current.getBoundingClientRect().height / scale : 0;
      const { breaks, pages: n } = measurePages(view, paper, mount, { pageW: g.pageW, pageH: g.pageH, gap: SHEET_GAP, top: g.top, bottom: g.bottom, repeatHead: head });
      setPages(n);
      if (!sameBreaks(pageFlowKey.getState(view.state)?.breaks ?? [], breaks)) {
        view.dispatch(view.state.tr.setMeta(pageFlowKey, breaks).setMeta('addToHistory', false));
      }
    });
  }, []);

  // بعد كلّ رسم: كتابةٌ أو تنسيقٌ أو مقاسٌ أو هوامش. والقياس الذي لا يغيّر شيئًا لا يُرسل شيئًا.
  useEffect(() => {
    remeasure();
  });
  // والخطوط حين تكتمل، وكلّ تغيّرٍ في ارتفاع المتن لم يمرّ بالمحرّر.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(mount);
    void document.fonts?.ready.then(() => remeasure());
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [remeasure]);

  /** ضبط الورقة من شريطها — والمتن كما هو. */
  const setPage = (patch: Partial<PageSetup>) => {
    const next: Doc = { ...docRef.current, pageSetup: { ...docRef.current.pageSetup, ...patch } };
    docRef.current = next;
    onChangeRef.current(next);
  };
  const preset = marginPreset(margins);

  if (apiRef)
    apiRef.current = {
      insertField: (key) =>
        run_((state, dispatch) => {
          if (dispatch) dispatch(state.tr.replaceSelectionWith(N.field.create({ ref: key, id: newUuid() }), false).scrollIntoView());
          return true;
        }),
      insertText: (text) =>
        run_((state, dispatch) => {
          if (dispatch) dispatch(state.tr.insertText(text).scrollIntoView());
          return true;
        }),
      insertNewField: (f) =>
        run_((state, dispatch) => {
          if (dispatch) {
            pendingFields.current.push(f);
            dispatch(state.tr.replaceSelectionWith(N.field.create({ ref: f.key, id: newUuid() }), false).scrollIntoView());
          }
          return true;
        })
    };

  function insertClip(clip: MenuClip) {
    insertBlocks(clip.body.split('\n').map((line) => paragraph(line ? [run(line)] : [])));
    void window.diwan.clips.touch(clip.id);
  }

  // ── حال الأدوات ─────────────────────────────────────────────────────
  const state = viewRef.current?.state ?? null;
  const all = state?.selection instanceof AllSelection;
  const curFont = state ? (markValue(state, M.font, 'family') as string | null) : null;
  const curSizeMark = state ? (markValue(state, M.size, 'px') as number | null) : null;
  const curParaSize = state ? (paragraphValue(state, 'size') as number | null | undefined) : null;
  const curSize = Math.round(curSizeMark ?? curParaSize ?? BASE_SIZE);
  const curAlign = state ? (paragraphValue(state, 'align') as Align | undefined) : undefined;
  const curLh = state ? (paragraphValue(state, 'lineHeight') as number | null | undefined) : undefined;
  const curIndent = state ? paragraphValue(state, 'indent') : undefined;
  const inTable = state ? isInTable(state) : false;
  const selChars = state && !state.selection.empty ? state.doc.textBetween(state.selection.from, state.selection.to, ' ').length : 0;

  const pageH = page.h * MM_PX;
  const stride = pageH + SHEET_GAP;
  const pageNumber = (n: number) => (doc.pageSetup.numerals === 'indic' ? indicDigits(n) : String(n));

  return (
    <div className="flex gap-space-md h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto flex flex-col bg-surface-dim/40" data-doc-editor="" data-editor="v2">
        {/* الأدوات وشريط الورقة معًا في أعلى الشاشة، والورقة تمرّ تحتهما. */}
        <div className="sticky top-0 z-10">
          <div className="bg-surface-container-lowest px-space-sm py-1 flex items-center gap-0.5 flex-wrap border-b border-outline-variant/30">
            <Tool act="undo" icon="undo" title="تراجع (Ctrl+Z)" onRun={() => run_(undo)} />
            <Tool act="redo" icon="redo" title="إعادة (Ctrl+Y)" onRun={() => run_(redo)} />
            <ToolSep />
            <select
              aria-label="الخطّ"
              className="h-8 w-40 rounded-lg bg-surface-container-low px-2 font-label-md text-label-md text-on-surface"
              data-act="font"
              title="الخطّ — لما حُدِّد، أو لما سيُكتب"
              value={curFont ?? ''}
              onChange={(e) => run_(setValueMark(M.font, e.target.value ? { family: e.target.value } : null))}
            >
              <option value="">خطّ الورقة</option>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>
                  {f}
                </option>
              ))}
            </select>
            <select
              aria-label="حجم الخطّ"
              className="h-8 w-16 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface tabular"
              data-act="size"
              title="حجم الخطّ — لما حُدِّد، أو لما سيُكتب"
              value={String(curSize)}
              onChange={(e) => {
                const px = Number(e.target.value);
                run_(setValueMark(M.size, px === BASE_SIZE ? null : { px }));
              }}
            >
              {[...new Set([...SIZES, curSize])].sort((a, b) => a - b).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ToolSep />
            <Tool act="bold" icon="format_bold" title="عريض (Ctrl+B)" active={state ? markActive(state, M.bold) : false} onRun={() => run_(toggleMark(M.bold))} />
            <Tool act="italic" icon="format_italic" title="مائل (Ctrl+I)" active={state ? markActive(state, M.italic) : false} onRun={() => run_(toggleMark(M.italic))} />
            <Tool act="underline" icon="format_underlined" title="تحته خطّ (Ctrl+U)" active={state ? markActive(state, M.underline) : false} onRun={() => run_(toggleMark(M.underline))} />
            <ToolSep />
            {(
              [
                { align: 'right', icon: 'format_align_right', title: 'محاذاة يمين' },
                { align: 'center', icon: 'format_align_center', title: 'توسيط' },
                { align: 'left', icon: 'format_align_left', title: 'محاذاة يسار' },
                { align: 'justify', icon: 'format_align_justify', title: 'ضبط الطرفين' }
              ] as const
            ).map((a) => (
              <Tool key={a.align} act={`align-${a.align}`} icon={a.icon} title={a.title} active={curAlign === a.align} onRun={() => run_(setParagraphAttr('align', a.align))} />
            ))}
            <select
              aria-label="تباعد الأسطر"
              className="h-8 w-16 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface tabular"
              data-act="line-height"
              title="تباعد الأسطر"
              value={curLh == null ? '' : String(curLh)}
              onChange={(e) => run_(setParagraphAttr('lineHeight', e.target.value ? Number(e.target.value) : null))}
            >
              <option value="">تلقائي</option>
              {LINE_HEIGHTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <Tool
              act="indent"
              icon="format_indent_increase"
              title="مسافة بادئة ٢ سم لأوّل السطر — كما يُكتب متن الكتاب الرسمي"
              active={Boolean(curIndent)}
              onRun={() => run_(setParagraphAttr('indent', curIndent ? null : OFFICIAL_INDENT_MM))}
            />
            <Tool act="bullets" icon="format_list_bulleted" title="تعداد نقطي" onRun={() => run_(toggleList('bullet'))} />
            <Tool act="numbers" icon="format_list_numbered" title="ترقيم" onRun={() => run_(toggleList('number'))} />
            <ToolSep />
            <button
              className="h-8 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 hover:bg-secondary transition-all shadow-xs"
              type="button"
              data-act="insert"
              title="إدراج جدول أو صورة أو كليشة أو فاصل صفحة"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMenu(true)}
            >
              <span className="material-symbols-outlined text-[16px]">post_add</span>
              <span>إدراج</span>
            </button>
            <Tool act="select-all" icon="select_all" title="تحديد الكلّ (Ctrl+A)" active={all} onRun={() => run_(selectAll)}>
              <span className="font-label-sm text-label-sm">تحديد الكلّ</span>
            </Tool>
            <Tool act="clear" icon="format_clear" title="مسح التنسيق" onRun={() => run_(clearMarks)} />
            <Tool act="field" icon="data_object" title="اجعل المظلَّل خانة (F4)" onRun={() => run_(toField)}>
              <span className="font-label-sm text-label-sm">خانة</span>
            </Tool>

            {inTable && (
              <>
                <ToolSep />
                <Tool act="row-add" icon="table_rows" title="صفٌّ بعد هذا" onRun={() => run_(addRowAfter)} />
                <Tool act="col-add" icon="view_column" title="عمودٌ بعد هذا" onRun={() => run_(addColumnAfter)} />
                <Tool act="row-del" icon="remove_road" title="احذف الصفّ" onRun={() => run_(deleteRow)} />
                <Tool act="col-del" icon="splitscreen_left" title="احذف العمود" onRun={() => run_(deleteColumn)} />
                <Tool act="merge" icon="call_merge" title="ادمج الخلايا المحدَّدة" onRun={() => run_(mergeCells)} />
                <Tool act="split" icon="call_split" title="افصل الخليّة" onRun={() => run_(splitCell)} />
                <Tool act="table-del" icon="delete" title="احذف الجدول كلّه" onRun={() => run_(deleteTable)} />
              </>
            )}
          </div>

          {/* شريط الورقة: المقاس والاتجاه والهوامش — بكلمةٍ لا بأرقام، والأرقام لمن أرادها. */}
          <div className="flex items-center gap-1 flex-wrap px-space-sm py-1 bg-surface-container-low border-b border-outline-variant/30" data-page-bar="">
            <span className="font-label-sm text-label-sm text-on-surface-variant ms-1">الورقة</span>
            <select
              aria-label="مقاس الورقة"
              className="h-8 rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
              data-act="page-size"
              value={doc.pageSetup.size}
              onChange={(e) => setPage({ size: e.target.value as PageSize })}
            >
              {(Object.keys(PAGE_NAMES) as PageSize[]).map((s) => (
                <option key={s} value={s}>
                  {PAGE_NAMES[s]}
                </option>
              ))}
            </select>
            <Tool act="portrait" icon="crop_portrait" title="عمودية" active={doc.pageSetup.orientation === 'portrait'} onRun={() => setPage({ orientation: 'portrait' })} />
            <Tool act="landscape" icon="crop_landscape" title="أفقية" active={doc.pageSetup.orientation === 'landscape'} onRun={() => setPage({ orientation: 'landscape' })} />
            <ToolSep />
            <span className="font-label-sm text-label-sm text-on-surface-variant">الهوامش</span>
            {(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((k) => (
              <button
                key={k}
                className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors ${
                  preset === k && !customMargins ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
                }`}
                data-margins={k}
                title={`${MARGIN_PRESETS[k].mm} ملم من كلّ جانب`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCustomMargins(false);
                  const mm = MARGIN_PRESETS[k].mm;
                  setPage({ margins: { top: mm, right: mm, bottom: mm, left: mm } });
                }}
              >
                {MARGIN_PRESETS[k].label}
              </button>
            ))}
            <button
              className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors ${
                preset === null || customMargins ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
              }`}
              data-margins="custom"
              title="هامشٌ لكلّ جانبٍ بالملّيمتر"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCustomMargins((v) => !v)}
            >
              مخصّصة
            </button>
            {(customMargins || preset === null) &&
              (
                [
                  ['top', 'أعلى'],
                  ['right', 'يمين'],
                  ['bottom', 'أسفل'],
                  ['left', 'يسار']
                ] as const
              ).map(([side, label]) => (
                <label key={side} className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                  {label}
                  <input
                    className="h-8 w-14 rounded-lg bg-surface-container-lowest px-1.5 text-center font-label-md text-label-md text-on-surface tabular"
                    data-margin={side}
                    max={60}
                    min={0}
                    type="number"
                    value={margins[side]}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                      setPage({ margins: { ...margins, [side]: v } });
                    }}
                  />
                </label>
              ))}
            <span className="ms-auto font-label-sm text-label-sm text-on-surface-variant tabular" data-page-count={pages}>
              {pagesLabel(pages)}
            </span>
          </div>
        </div>

        {/* الورقة بمقاسها الحقيقي وهوامشها، وصفحاتها كما تقسمها الطابعة (`pageFlow.ts`). */}
        <div
          ref={paperRef}
          className="relative isolate mx-auto my-space-md shrink-0 flex flex-col"
          data-paper=""
          style={{
            width: `${page.w}mm`,
            minHeight: `${pages * pageH + (pages - 1) * SHEET_GAP}px`,
            paddingTop: `${margins.top}mm`,
            paddingRight: `${margins.right}mm`,
            paddingLeft: `${margins.left}mm`
          }}
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 pointer-events-none" style={{ zIndex: -2 }}>
            {Array.from({ length: pages }, (_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 bg-surface-container-lowest shadow-[0_1px_3px_rgba(24,33,29,0.06),0_16px_32px_-4px_rgba(24,33,29,0.10)]"
                data-sheet={i + 1}
                style={{ top: i * stride, height: pageH }}
              />
            ))}
          </div>
          <div className="contents" dangerouslySetInnerHTML={{ __html: watermarkHtml(doc) }} />
          {header ? <div ref={headRef}>{header}</div> : null}
          <div ref={mountRef} className="flex-1 font-body-md text-body-md leading-8 text-on-surface" />
          {repeatHead &&
            Array.from({ length: pages - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="absolute pointer-events-none"
                data-repeat-head={i + 2}
                style={{ top: (i + 1) * stride + margins.top * MM_PX, right: `${margins.right}mm`, left: `${margins.left}mm` }}
              >
                {header}
              </div>
            ))}
          {doc.pageSetup.pageNumbers &&
            Array.from({ length: pages }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="absolute inset-x-0 text-center text-[10pt] leading-none text-on-surface-variant pointer-events-none"
                data-page-number={i + 1}
                style={{ top: i * stride + pageH - (bottomMm * MM_PX) / 2 - 6 }}
              >
                صفحة {pageNumber(i + 1)} من {pageNumber(pages)}
              </div>
            ))}
        </div>

        <div className="mx-auto my-space-sm font-label-sm text-label-sm text-on-surface-variant" data-selection-status="">
          {all ? 'المحدَّد: الورقة كلّها — كلّ تنسيقٍ يقع عليها' : selChars ? `محدَّد ${selChars} حرفًا` : 'ظلّل عبارةً واضغط F4 لتصير خانة · Shift+Enter سطرٌ في الفقرة نفسها · Ctrl+Enter صفحةٌ جديدة'}
        </div>
      </div>

      {aside === undefined ? (
        <FieldPanel doc={doc} onChange={onChange} onInsert={(key) => apiRef?.current?.insertField(key) ?? insertFieldFallback(viewRef.current, key)} />
      ) : (
        aside
      )}

      {menu && (
        <InsertMenu
          addressing={doc.meta.addressing ?? null}
          clips={clips}
          onClose={() => setMenu(false)}
          onClip={insertClip}
          onTable={(rows, cols) => insertBlocks([makeTable(rows, cols)])}
          onImage={(src, align) => insertBlocks([{ id: newUuid(), kind: 'image', src, width: 140, align }])}
          onPick={(what) => {
            if (what === 'copies')
              insertBlocks([paragraph([run('نسخة منه إلى :-', { bold: true, underline: true })]), paragraph([run('- ')]), paragraph([run('- ')])]);
            else if (what === 'columns') insertBlocks([{ id: newUuid(), kind: 'columns', columns: [[paragraph([])], [paragraph([])]] }]);
            else if (what === 'answer') insertBlocks([{ id: newUuid(), kind: 'spacer', height: 112, lines: true }]);
            else if (what === 'spacer') insertBlocks([{ id: newUuid(), kind: 'spacer', height: 24 }]);
            else if (what === 'pageBreak') insertBlocks([{ id: newUuid(), kind: 'pageBreak' }, paragraph([])]);
          }}
        />
      )}
    </div>
  );
}

/** حقلٌ في موضع المؤشّر — للوح الحقول في مصمّم النماذج حين لا تمرّ الشاشة بـ`apiRef`. */
function insertFieldFallback(view: EditorView | null, key: string) {
  if (!view) return;
  view.dispatch(view.state.tr.replaceSelectionWith(N.field.create({ ref: key, id: newUuid() }), false).scrollIntoView());
  view.focus();
}
