/**
 * المحرّر — الورقة وثيقةٌ واحدة (خطّة الترقية، المرحلة ١: المحرّر يساوي Word).
 *
 * المحرّر الأوّل جعل كلّ كتلةٍ مساحة تحريرٍ وحدها، فلا يُحدَّد النصّ عبر الفقرات ولا
 * يُنسَّق دفعةً واحدة — وهذا أكثر ما شكا منه الموظفون. وهنا ProseMirror: التحديد بالحرف
 * أينما امتدّ وCtrl+A، والتنسيق على المحدَّد، والتراجع واللصق من Word بتنسيقه، والكتابة
 * العربية — من مكتبةٍ مجرَّبة لا من كودٍ يُكتب لها.
 *
 * **والوثيقة لا تتغيّر.** ما يُحفظ `Doc` بكتلها كما كان (`shared/docPm.ts` جسرٌ في
 * الاتجاهين)، والحقل عقدةٌ ذرّية: تُحذف كلّها أو تبقى، ولا يُكتب داخلها. وأوامر الجدول
 * تحفظ ما تصنعه (`shared/docPmTable.ts`).
 *
 * بُني بجانب الأوّل حتى ثبت في الميدان (٤ تشرين الأول ٢٠٢٦)، ثم صار المحرّر الوحيد وحُذف الأوّل
 * (الموجة ١، المجموعة ج). وأدواته المشتركة — الشريط وقائمة الإدراج ولوحة الحقول — في `editorKit.tsx`.
 */
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-tables/style/tables.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node as PMNode, MarkType } from 'prosemirror-model';
import { AllSelection, EditorState, Plugin, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands, selectAll, splitBlockAs, toggleMark } from 'prosemirror-commands';
import { history, redo, undo, undoDepth } from 'prosemirror-history';
import { gapCursor } from 'prosemirror-gapcursor';
import { addRowAfter, addRowBefore, deleteRow, deleteTable, goToNextCell, splitCell, tableEditing } from 'prosemirror-tables';
import {
  addColumnKeepWidths,
  deleteColumnKeepWidths,
  mergeCellsInRow,
  resizeColumnBy,
  selectionSpansRows,
  tableState,
  toggleHeaderRow,
  toggleTableBorders
} from '@shared/docPmTable';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { listStyleAt, setListStyle, toggleList } from '@shared/docPmList';
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
  type ListStyle,
  type MarginPreset,
  type Numerals,
  type PageSetup,
  type PageSize
} from '@shared/doc';
import { marker, watermarkHtml } from '@shared/docHtml';
import { fieldFromText, makeTable } from '@shared/docEdit';
import { HEAD_MAX, findSheetHead } from '@shared/sheetHead';
import { WORD_SIZES_PT, ptToPx, pxToPt } from '@shared/fontSize';
import {
  BASE_SIZE,
  FieldPanel,
  InsertMenu,
  OFFICIAL_INDENT_MM,
  Tool,
  ToolSep,
  type EditorProps,
  type MenuClip
} from './editorKit';
import { MM_PX, measurePages, pageFlowKey, pageFlowPlugin, sameBreaks } from './pageFlow';
import { ColumnsView, FieldView, GroupView, ImageView, SpacerView, TableView, pageBreakView } from './pageViews';
import { listMarkersKey, listMarkersPlugin, tableResizing } from './editorPlugins';
import ColorTool from './ColorTool';
import { adoptPastedImages, caretAfterPaste, cleanPastedHtml, pasteImages } from './editorPaste';
import FieldHints from './FieldHints';
import FontSelect from './FontSelect';
import { fontsIn } from '../lib/fonts';
import { wrongGenderWords } from '@shared/fieldHints';
import { GENDER_KEY, isChoiceKey, pickChoice } from '@shared/gender';
import { sampleValues } from '@shared/letterDraft';
import { toIndic, count } from '@shared/arabic';

/** «جرّب باسمٍ آخر»: امرأةٌ وقيمٌ تجريبية — فيُرى ما بقي مذكّرًا أو نصًّا وهو خانة. */
function trialValues(fields: DocField[], values: Record<string, string> = {}): Record<string, string> {
  const named: Record<string, string> = { [GENDER_KEY]: 'أنثى' };
  for (const f of fields) if (f.role === 'name' || f.source === 'fullName') named[f.key] = 'زينب علي حسين';
  return sampleValues(fields, { ...values, ...named });
}

/** يعلّم الكلمات على الورقة — كلمةً كاملة لا جزءَ كلمة. */
function markWords(doc: PMNode, words: string[]): DecorationSet {
  if (!words.length) return DecorationSet.empty;
  const letter = /[ء-يٱ-ۓـ\u064B-\u0652]/;
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const text = node.text;
    for (const w of words) {
      for (let at = text.indexOf(w); at >= 0; at = text.indexOf(w, at + w.length)) {
        const before = text[at - 1];
        const after = text[at + w.length];
        if ((before && letter.test(before)) || (after && letter.test(after))) continue;
        out.push(Decoration.inline(pos + at, pos + at + w.length, { class: 'pm-wrong', 'data-wrong': '' }));
      }
    }
    return false;
  });
  return DecorationSet.create(doc, out);
}

/**
 * ما فوق المتن (قرار ٣ تشرين الأول، ن١٧): ترويسةٌ رسمية من المكتبة، أو أسطرٌ تُكتب في أعلى
 * الورقة نفسها كما في Word، أو لا شيء — ومعها الخطّ الفاصل. وكان الطريقان موجودين ولا يعرفهما
 * الموظفون: فصارا على شريط الورقة. والشاشة تملك الترويسة، والمحرّر يعرض الاختيار.
 */
export type HeadChoice = {
  mode: 'formal' | 'lines' | 'none';
  letterheads: { id: number; name: string }[];
  letterheadId: number | null;
  onChoose: (choice: { mode: 'formal'; id: number } | { mode: 'lines' } | { mode: 'none' }) => void;
  /** خطّ الترويسة الرسمية الفاصل — حيث يملكه الكتاب (نسخته من الترويسة). */
  divider?: { on: boolean; set: (on: boolean) => void };
  /** «صمّم ترويسة» أو «حرّر الترويسة». */
  onEdit?: () => void;
};

export type PageEditorProps = EditorProps & { head?: HeadChoice };

const S = docSchema;
const N = S.nodes as Record<string, NonNullable<(typeof S.nodes)[string]>>;
const M = S.marks as Record<string, MarkType>;

/** تباعد الأسطر كما في Word: مفرد، و١٫١٥، ونصف، ومزدوج. */
const LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5];
/** أشكال الترقيم كما في Word (البند ٣): النقطيّ والرقميّ والحروف «أ)» والترتيبيّ «أولًا:» واللاتينيّ «a)». */
const LIST_STYLES: ListStyle[] = ['bullet', 'number', 'arabicLetter', 'ordinal', 'latinLetter'];
/** الفجوة بين ورقتين على الشاشة. */
const SHEET_GAP = 24;

/** «صفحة واحدة»، «صفحتان»، «٣ صفحات» — كما تُقال. */
function pagesLabel(n: number): string {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتان';
  return n <= 10 ? `${n} صفحات` : `${n} صفحة`;
}

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

// ── المحرّر ─────────────────────────────────────────────────────────────

export default function PageEditor({ doc, onChange, clips = [], header, values, aside, apiRef, head }: PageEditorProps) {
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
  /** كلمةٌ عابرة في سطر الحال — لما لا يُفعل ولماذا (دمجٌ رأسيّ). */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const [customMargins, setCustomMargins] = useState(false);

  const [trying, setTrying] = useState(false);
  const shownValues = useMemo(() => (trying ? trialValues(doc.fields, values) : values), [trying, doc.fields, values]);
  const labelOf = useCallback(
    (key: string) => {
      // خيار التذكير والتأنيث: بالجنس إن عُرف، وبالخيارين معًا إن لم يُعرف.
      if (isChoiceKey(key)) {
        const g = shownValues?.[GENDER_KEY];
        return g ? `=${pickChoice(key, g)}` : pickChoice(key, undefined);
      }
      const value = shownValues?.[key]?.trim();
      return value ? `=${value}` : doc.fields.find((f) => f.key === key)?.label || key;
    },
    [doc.fields, shownValues]
  );
  /** ما يُعلَّم على الورقة في «جرّب باسمٍ آخر»: المذكّر الباقي نصًّا، وقيم الخانات المكتوبة نصًّا. */
  const wrongRef = useRef<string[]>([]);
  wrongRef.current = trying
    ? [
        ...wrongGenderWords('أنثى'),
        ...doc.fields.filter((f) => !isChoiceKey(f.key) && f.label.trim().split(/\s+/).length >= 2).map((f) => f.label.trim())
      ]
    : [];
  const labelRef = useRef(labelOf);
  labelRef.current = labelOf;

  /** ما في المحرّر إلى الوثيقة — والحقول تتبع ما على الورقة. */
  /**
   * كلّ خانةٍ عُرفت في هذه الجلسة بوصفها: التراجع يرفع الخانة من الورقة فتسقط من القائمة،
   * والإعادة تردّها — فتعود باسمها ودورها لا مفتاحًا عاريًا.
   */
  const fieldMemory = useRef(new Map<string, DocField>());
  const emit = useCallback((pm: PMNode) => {
    const blocks = pmBlocks(pm);
    ownBlocks.current = blocks;
    const base = docRef.current;
    for (const f of [...base.fields, ...pendingFields.current]) fieldMemory.current.set(f.key, f);
    const withPending = { ...base, blocks, fields: [...base.fields, ...pendingFields.current.filter((f) => !base.fields.some((x) => x.key === f.key))] };
    pendingFields.current = [];
    const next: Doc = { ...withPending, fields: reconcileFields(withPending, (key) => fieldMemory.current.get(key) ?? {}) };
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
        plugins: [
          history({ depth: 200 }),
          keys,
          keymap(baseKeymap),
          gapCursor(),
          tableResizing(),
          tableEditing(),
          listMarkersPlugin(() => docRef.current.pageSetup.numerals),
          uniqueIds,
          placeholder,
          caretAfterPaste,
          pageFlowPlugin(),
          new Plugin({ props: { decorations: (state) => markWords(state.doc, wrongRef.current) } })
        ]
      }),
      nodeViews: nodeViews(),
      attributes: { class: 'pm-page outline-none', dir: 'rtl', 'data-page-editor': '' },
      transformPastedHTML: cleanPastedHtml,
      handlePaste(v, event) {
        // صورةٌ وحدها في الحافظة (لقطة شاشة، أو صورةٌ نُسخت): تُحفظ وتُدرج. ونصٌّ من Word يحمل
        // معه صورةً لما نُسخ — فالنصّ أولى، ويُلصق كما هو.
        const data = event.clipboardData;
        const files = data ? [...data.files].filter((f) => f.type.startsWith('image/')) : [];
        if (!data || !files.length) return false;
        const html = data.getData('text/html');
        const words = (data.getData('text/plain') + html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).trim();
        if (words) return false;
        event.preventDefault();
        void pasteImages(v, files, contentWidth.current);
        return true;
      },
      dispatchTransaction(tr) {
        const v = viewRef.current!;
        const before = v.state.doc;
        const next = v.state.apply(tr);
        v.updateState(next);
        if (next.doc !== before) emit(next.doc);
        if (tr.getMeta('paste')) void adoptPastedImages(v);
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
    () => JSON.stringify([doc.fields.map((f) => [f.key, f.label]), shownValues ?? {}]),
    [doc.fields, shownValues]
  );
  // وأرقام الورقة (هندية أو عربية) تُعيد رسم علامات القوائم كما تُطبع — والمتن لم يتغيّر.
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(listMarkersKey, true).setMeta('addToHistory', false));
  }, [doc.pageSetup.numerals]);
  // والعلامات الحمراء تُرسم حين يُجرَّب الاسم الآخر وتُمحى حين يُترك.
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta('trial', trying));
  }, [trying]);

  /** اقتراحاتٌ قُبلت: الوثيقة كلّها خطوةً واحدة في المحرّر — يتراجع عنها Ctrl+Z. */
  const applyDoc = (next: Doc) => {
    const view = viewRef.current;
    if (!view) return;
    const known = new Set(docRef.current.fields.map((f) => f.key));
    pendingFields.current.push(...next.fields.filter((f) => !known.has(f.key)));
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, blocksToPm(next.blocks).content));
    view.focus();
  };
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
  /** عرض المتن بالبكسل — أعرض ما تُلصق به صورة. */
  const contentWidth = useRef(0);
  contentWidth.current = (page.w - margins.left - margins.right) * MM_PX;
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

  /** الخطّ الفاصل تحت أسطر الرأس: أوّل خطٍّ في أعلى الورقة — أو صورة Word الممطوطة. */
  const topRule = (): { pos: number; size: number } | null => {
    const view = viewRef.current;
    if (!view) return null;
    let found: { pos: number; size: number } | null = null;
    let i = 0;
    view.state.doc.forEach((node, pos) => {
      if (found || i++ >= HEAD_MAX) return;
      const h = Number(node.attrs.height);
      const wordLine = node.type === N.image && h > 0 && h <= 20 && Number(node.attrs.width) >= 200;
      if (node.type === N.rule || wordLine) found = { pos, size: node.nodeSize };
    });
    return found;
  };

  /**
   * يضع الخطّ تحت أسطر الرأس أو يرفعه. وحدّ الرأس: ما يعرفه كاشف الرأس، وإلا فالأسطر
   * الأولى حتى أوّل فراغٍ أو جدولٍ أو فاصل (ستّةٌ على الأكثر)، وإلا فالسطر الأوّل.
   */
  const toggleLinesRule = () => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const existing = topRule();
    if (existing) {
      view.dispatch(state.tr.delete(existing.pos, existing.pos + existing.size));
      view.focus();
      return;
    }
    const blocks = pmBlocks(state.doc);
    let end = findSheetHead({ ...docRef.current, blocks });
    if (end <= 0) {
      // سطرٌ من الرأس: فقرةٌ فيها نصّ، أو صفٌّ بأعمدته — وما سواهما (فراغٌ أو جدولٌ أو فاصل) حدّه.
      const headish = (b: Block) =>
        b.kind === 'columns' || (b.kind === 'paragraph' && b.inlines.some((x) => x.kind !== 'run' || x.text.trim()));
      while (end < Math.min(6, blocks.length) && headish(blocks[end]!)) end += 1;
      if (end === 0 || end === 6) end = 1;
    }
    let at = 0;
    let i = 0;
    state.doc.forEach((node, pos) => {
      if (i++ < end) at = pos + node.nodeSize;
    });
    view.dispatch(state.tr.insert(at, N.rule.create({ id: newUuid() })).scrollIntoView());
    view.focus();
  };

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
  // يُعرض بالنقطة كما في Word (د٥)، ويبقى مخزَّنًا بالبكسل.
  const curPt = pxToPt(curSizeMark ?? curParaSize ?? BASE_SIZE);
  const curAlign = state ? (paragraphValue(state, 'align') as Align | undefined) : undefined;
  const curLh = state ? (paragraphValue(state, 'lineHeight') as number | null | undefined) : undefined;
  const curIndent = state ? paragraphValue(state, 'indent') : undefined;
  const curList = state ? listStyleAt(state) : null;
  const listLabel = (s: ListStyle) => [0, 1, 2].map((i) => marker(s, i, doc.pageSetup.numerals)).join(' ');
  /** الجدول الذي فيه المؤشّر — حدوده وصفّ عناوينه، وهل التحديد يعبر صفوفه. */
  const table = state ? tableState(state) : null;
  const selChars = state && !state.selection.empty ? state.doc.textBetween(state.selection.from, state.selection.to, ' ').length : 0;

  const pageH = page.h * MM_PX;
  const stride = pageH + SHEET_GAP;
  const pageNumber = (n: number) => (doc.pageSetup.numerals === 'indic' ? toIndic(n) : String(n));

  return (
    <div className="flex gap-space-md h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto flex flex-col bg-surface-dim/40" data-doc-editor="" data-editor="v2" data-undo-depth={state ? undoDepth(state) : 0}>
        {/* الأدوات وشريط الورقة معًا في أعلى الشاشة، والورقة تمرّ تحتهما. */}
        <div className="sticky top-0 z-10">
          <div className="bg-surface-container-lowest px-space-sm py-1 flex items-center gap-0.5 flex-wrap border-b border-outline-variant/30">
            <Tool act="undo" icon="undo" title="تراجع (Ctrl+Z)" onRun={() => run_(undo)} />
            <Tool act="redo" icon="redo" title="إعادة (Ctrl+Y)" onRun={() => run_(redo)} />
            <ToolSep />
            <FontSelect
              act="font"
              blank="خطّ الورقة"
              className="h-8 w-40 rounded-lg bg-surface-container-low px-2 font-label-md text-label-md text-on-surface"
              title="الخطّ من «خطوط ديوان» — لما حُدِّد، أو لما سيُكتب"
              used={state ? fontsIn(state.doc, M.font) : []}
              value={curFont}
              onChange={(family) => run_(setValueMark(M.font, family ? { family } : null))}
            />
            <select
              aria-label="حجم الخطّ"
              className="h-8 w-16 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface tabular"
              data-act="size"
              title="حجم الخطّ بالنقطة كما في Word — لما حُدِّد، أو لما سيُكتب"
              value={String(curPt)}
              onChange={(e) => {
                const px = ptToPx(Number(e.target.value));
                run_(setValueMark(M.size, px === BASE_SIZE ? null : { px }));
              }}
            >
              {[...new Set([...WORD_SIZES_PT, curPt])].sort((a, b) => a - b).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ToolSep />
            <Tool act="bold" icon="format_bold" title="عريض (Ctrl+B)" active={state ? markActive(state, M.bold) : false} onRun={() => run_(toggleMark(M.bold))} />
            <Tool act="italic" icon="format_italic" title="مائل (Ctrl+I)" active={state ? markActive(state, M.italic) : false} onRun={() => run_(toggleMark(M.italic))} />
            <Tool act="underline" icon="format_underlined" title="تحته خطّ (Ctrl+U)" active={state ? markActive(state, M.underline) : false} onRun={() => run_(toggleMark(M.underline))} />
            {/* وما كان ينقص عن Word (البند ٣): الشطب، وأعلى السطر وأسفله (لا يجتمعان)، ولون النصّ — بلا اختصاراتٍ جديدة. */}
            <Tool act="strike" icon="format_strikethrough" title="يتوسّطه خطّ" active={state ? markActive(state, M.strike) : false} onRun={() => run_(toggleMark(M.strike))} />
            <Tool act="sup" icon="superscript" title="أعلى السطر" active={state ? markActive(state, M.sup) : false} onRun={() => run_(toggleMark(M.sup))} />
            <Tool act="sub" icon="subscript" title="أسفل السطر" active={state ? markActive(state, M.sub) : false} onRun={() => run_(toggleMark(M.sub))} />
            <ColorTool value={state ? (markValue(state, M.color, 'hex') as string | null) : null} onPick={(hex) => run_(setValueMark(M.color, hex ? { hex } : null))} />
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
            <Tool act="bullets" icon="format_list_bulleted" title="تعداد نقطي" active={curList === 'bullet'} onRun={() => run_(toggleList('bullet'))} />
            <Tool act="numbers" icon="format_list_numbered" title="ترقيم" active={curList === 'number'} onRun={() => run_(toggleList('number'))} />
            <select
              aria-label="شكل الترقيم"
              className="h-8 w-24 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface"
              data-act="list-style"
              title="شكل الترقيم — كما يُطبع، ولمستوى القائمة الذي فيه المؤشّر"
              value={curList ?? ''}
              onChange={(e) => e.target.value && run_(setListStyle(e.target.value as ListStyle))}
            >
              <option value="">شكل الترقيم</option>
              {[...LIST_STYLES, ...(curList && !LIST_STYLES.includes(curList) ? [curList] : [])].map((s) => (
                <option key={s} value={s}>
                  {listLabel(s)}
                </option>
              ))}
            </select>
            <ToolSep />
            <button
              className="h-8 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 hover:bg-primary transition-all shadow-xs"
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

            {table && (
              <>
                <ToolSep />
                {/* أوامر الجدول تحفظ ما تصنعه في الوثيقة (`shared/docPmTable.ts`): الأوزان مع الأعمدة، ولا دمج رأسيّ. */}
                <Tool act="row-above" icon="add_row_above" title="صفٌّ فوق هذا" onRun={() => run_(addRowBefore)} />
                <Tool act="row-add" icon="add_row_below" title="صفٌّ تحت هذا" onRun={() => run_(addRowAfter)} />
                <Tool act="col-right" icon="add_column_right" title="عمودٌ يمين هذا — بعرضه" onRun={() => run_(addColumnKeepWidths('before'))} />
                <Tool act="col-add" icon="add_column_left" title="عمودٌ يسار هذا — بعرضه" onRun={() => run_(addColumnKeepWidths('after'))} />
                <Tool act="row-del" icon="remove_road" title="احذف الصفّ" onRun={() => run_(deleteRow)} />
                <Tool act="col-del" icon="splitscreen_left" title="احذف العمود" onRun={() => run_(deleteColumnKeepWidths)} />
                <Tool act="col-wider" icon="width_wide" title="وسّع العمود" onRun={() => run_(resizeColumnBy(0.5))} />
                <Tool act="col-narrower" icon="width_normal" title="ضيّق العمود" onRun={() => run_(resizeColumnBy(-0.5))} />
                <Tool
                  act="merge"
                  icon="call_merge"
                  title={table.spansRows ? 'تُدمج خلايا الصفّ الواحد — الدمج الرأسي لا تحفظه الورقة' : 'ادمج الخلايا المحدَّدة'}
                  onRun={() => {
                    const view = viewRef.current;
                    if (view && selectionSpansRows(view.state)) {
                      setNotice('الدمج الرأسي لا تحفظه الورقة ولا يُطبع — تُدمج خلايا الصفّ الواحد');
                      return;
                    }
                    run_(mergeCellsInRow);
                  }}
                />
                <Tool act="split" icon="call_split" title="افصل الخليّة" onRun={() => run_(splitCell)} />
                <Tool
                  act="table-borders"
                  icon={table.borders ? 'border_clear' : 'border_all'}
                  title={table.borders ? 'أخفِ حدود الجدول — لجدولٍ يرتّب الرأس أو التواقيع لا يُرى' : 'أظهر حدود الجدول'}
                  active={!table.borders}
                  onRun={() => run_(toggleTableBorders)}
                />
                <Tool act="table-header" icon="title" title="صفّ عناوين يتكرّر في أعلى كلّ صفحة" active={table.header} onRun={() => run_(toggleHeaderRow)} />
                <Tool act="table-del" icon="delete" title="احذف الجدول كلّه" onRun={() => run_(deleteTable)} />
              </>
            )}
          </div>

          {/* شريط الورقة: المقاس والاتجاه والهوامش — بكلمةٍ لا بأرقام، والأرقام لمن أرادها. */}
          <div className="flex items-center gap-1 flex-wrap px-space-sm py-1 bg-surface-container-low border-b border-outline-variant/30" data-page-bar="">
            {head && (
            <>
              <span className="font-label-sm text-label-sm text-on-surface-variant ms-1">الترويسة</span>
              {(
                [
                  ['formal', 'رسمية', 'ترويسةٌ من المكتبة تُطبع فوق المتن'],
                  ['lines', 'أسطرٌ في أعلى الورقة', 'تكتب الرأس على الورقة نفسها كما في Word'],
                  ['none', 'بلا', 'لا شيء فوق المتن']
                ] as const
              ).map(([m, label, hint]) => {
                const noLibrary = m === 'formal' && head.letterheads.length === 0 && !head.onEdit;
                return (
                  <button
                    key={m}
                    className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors disabled:opacity-40 ${
                      head.mode === m ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                    data-head={m}
                    disabled={noLibrary}
                    title={noLibrary ? 'لا ترويسة في المكتبة بعد — صمّمها من «الترويسات والشعارات»' : hint}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (m === 'formal') {
                        if (head.mode === 'formal') return;
                        const first = head.letterheads[0];
                        if (first) head.onChoose({ mode: 'formal', id: first.id });
                        else head.onEdit?.();
                      } else head.onChoose({ mode: m });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              {head.mode === 'formal' && head.letterheads.length > 1 && (
                <select
                  aria-label="الترويسة الرسمية"
                  className="h-8 max-w-[11rem] rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
                  data-act="letterhead"
                  value={head.letterheadId ?? ''}
                  onChange={(e) => e.target.value && head.onChoose({ mode: 'formal', id: Number(e.target.value) })}
                >
                  {head.letterheadId === null && <option value="">ترويسة هذا الكتاب</option>}
                  {head.letterheads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
              {(head.mode === 'lines' || (head.mode === 'formal' && head.divider)) && (
                <label className="flex items-center gap-1 px-1 font-label-md text-label-md text-on-surface cursor-pointer" title="خطٌّ أفقيّ بين الرأس والمتن">
                  <input
                    checked={head.mode === 'lines' ? Boolean(topRule()) : Boolean(head.divider?.on)}
                    className="w-4 h-4 accent-secondary"
                    data-act="head-divider"
                    type="checkbox"
                    onChange={(e) => (head.mode === 'lines' ? toggleLinesRule() : head.divider?.set(e.target.checked))}
                  />
                  خطّ فاصل
                </label>
              )}
              {head.mode === 'formal' && head.onEdit && (
                <button
                  className="h-8 px-2 rounded-lg font-label-md text-label-md text-secondary hover:bg-surface-container-high"
                  data-act="head-edit"
                  type="button"
                  onClick={head.onEdit}
                >
                  حرّر الترويسة
                </button>
              )}
              <ToolSep />
            </>
          )}
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
            {/* أرقام الورقة كما في ورقة الأسئلة: الترقيم و«صفحة ١ من ٢» — ونصّ الكتاب كما كُتب (ما بعد البند ٣). */}
            <select
              aria-label="أرقام الترقيم والصفحات"
              className="h-8 rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
              data-act="numerals"
              title="أرقام الترقيم وأرقام الصفحات — ونصّ الكتاب يبقى كما كُتب"
              value={doc.pageSetup.numerals}
              onChange={(e) => setPage({ numerals: e.target.value as Numerals })}
            >
              <option value="arabic">1 2 3</option>
              <option value="indic">١ ٢ ٣</option>
            </select>
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
          {notice && (
            <div className="px-space-sm py-1 bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm" data-editor-notice="" role="status">
              {notice}
            </div>
          )}
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
                className="paper absolute inset-x-0 bg-surface-container-lowest shadow-[0_1px_3px_rgba(24,33,29,0.06),0_16px_32px_-4px_rgba(24,33,29,0.10)]"
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
          {all
            ? 'المحدَّد: الورقة كلّها — كلّ تنسيقٍ يقع عليها'
            : selChars
              ? `محدَّد ${count(selChars, 'حرف')}`
              : head?.mode === 'lines' && !topRule()
                ? 'اكتب أسطر الترويسة في أعلى الورقة، ثم «خطّ فاصل» يضع الخطّ تحتها'
                : 'ظلّل عبارةً واضغط F4 لتصير خانة · Shift+Enter سطرٌ في الفقرة نفسها · Ctrl+Enter صفحةٌ جديدة'}
        </div>
      </div>

      {aside === undefined ? (
        <FieldPanel
          doc={doc}
          top={<FieldHints doc={doc} trying={trying} onApply={applyDoc} onTry={setTrying} />}
          onChange={onChange}
          onInsert={(key) => apiRef?.current?.insertField(key) ?? insertFieldFallback(viewRef.current, key)}
        />
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
            else if (what === 'rule') insertBlocks([{ id: newUuid(), kind: 'rule' }]);
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
