/**
 * أوامر محرّر الورقة ومساعداته (تقسيم PageEditor بعد ١٫٧٫٠) — منقولةٌ منه كما هي: المخطّط وعقده وعلاماته، وخصائص الفقرة والعلامات
 * وقراءتها، وتقسيم الفقرة، والقيم التجريبية وتعليم الكلمات، ومعرّفاتٌ فريدة، والنصّ البديل.
 */
import { type DocField, type ListStyle, newUuid } from '@shared/doc';
import { GENDER_KEY } from '@shared/gender';
import { sampleValues } from '@shared/letterDraft';
import type { Node as PMNode, MarkType } from 'prosemirror-model';
import { DecorationSet, Decoration, EditorView } from 'prosemirror-view';
import { docSchema } from '@shared/docPm';
import { EditorState, type Command, Plugin, type Transaction } from 'prosemirror-state';
import { splitBlockAs } from 'prosemirror-commands';

/** «جرّب باسمٍ آخر»: امرأةٌ وقيمٌ تجريبية — فيُرى ما بقي مذكّرًا أو نصًّا وهو خانة. */
export function trialValues(fields: DocField[], values: Record<string, string> = {}): Record<string, string> {
  const named: Record<string, string> = { [GENDER_KEY]: 'أنثى' };
  for (const f of fields) if (f.role === 'name' || f.source === 'fullName') named[f.key] = 'زينب علي حسين';
  return sampleValues(fields, { ...values, ...named });
}

/** يعلّم الكلمات على الورقة — كلمةً كاملة لا جزءَ كلمة. */
export function markWords(doc: PMNode, words: string[]): DecorationSet {
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

export const S = docSchema;

export const N = S.nodes as Record<string, NonNullable<(typeof S.nodes)[string]>>;

export const M = S.marks as Record<string, MarkType>;

/** تباعد الأسطر كما في Word: مفرد، و١٫١٥، ونصف، ومزدوج. */
export const LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5];

/** أشكال الترقيم كما في Word (البند ٣): النقطيّ والرقميّ والحروف «أ)» والترتيبيّ «أولًا:» واللاتينيّ «a)». */
export const LIST_STYLES: ListStyle[] = ['bullet', 'number', 'arabicLetter', 'ordinal', 'latinLetter'];

/** الفجوة بين ورقتين على الشاشة. */
export const SHEET_GAP = 24;

/** «صفحة واحدة»، «صفحتان»، «٣ صفحات» — كما تُقال. */
export function pagesLabel(n: number): string {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتان';
  return n <= 10 ? `${n} صفحات` : `${n} صفحة`;
}

// ── الأوامر ─────────────────────────────────────────────────────────────

/** فقرات التحديد كلّها — في المتن والخلايا والأعمدة. */
export function selectedParagraphs(state: EditorState): { node: PMNode; pos: number }[] {
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
export const setParagraphAttr =
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
export const setValueMark =
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

export const clearMarks: Command = (state, dispatch) => {
  if (state.selection.empty) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const r of state.selection.ranges) for (const t of Object.values(M)) tr.removeMark(r.$from.pos, r.$to.pos, t);
    dispatch(tr);
  }
  return true;
};

/** Enter: الفقرة تنشطر، والجديدة ترث تنسيقها كما في Word — بمعرّفٍ جديد. */
export const splitParagraph = splitBlockAs((node) => ({ type: node.type, attrs: { ...node.attrs, id: null } }));

export const markActive = (state: EditorState, type: MarkType): boolean => {
  const { from, to, empty, $from } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks || $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
};

/** قيمة علامةٍ في التحديد إن كانت واحدة فيه — وإلا لا شيء. */
export function markValue(state: EditorState, type: MarkType, attr: string): unknown {
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

export function paragraphValue(state: EditorState, attr: string): unknown {
  const values = new Set(selectedParagraphs(state).map((p) => p.node.attrs[attr] ?? null));
  return values.size === 1 ? [...values][0] : undefined;
}

// ── الإضافات ────────────────────────────────────────────────────────────

/**
 * لكلّ كتلةٍ وحقلٍ معرّفٌ واحد: الانشطار واللصق ينسخان الصفات ومعها المعرّف، فيُعطى
 * المكرَّر والمفقود معرّفًا جديدًا. وفقرة عنصر القائمة معرّفها لعنصرها لا لها.
 */
export const uniqueIds = new Plugin({
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
export const placeholder = new Plugin({
  props: {
    decorations(state) {
      const first = state.doc.firstChild;
      if (state.doc.childCount !== 1 || !first || first.type !== N.paragraph || first.content.size) return null;
      return DecorationSet.create(state.doc, [Decoration.node(0, first.nodeSize, { class: 'pm-empty', 'data-placeholder': 'اكتب هنا، أو الصق من Word…' })]);
    }
  }
});

/** حقلٌ في موضع المؤشّر — للوح الحقول في مصمّم النماذج حين لا تمرّ الشاشة بـ`apiRef`. */
export function insertFieldFallback(view: EditorView | null, key: string) {
  if (!view) return;
  view.dispatch(view.state.tr.replaceSelectionWith(N.field.create({ ref: key, id: newUuid() }), false).scrollIntoView());
  view.focus();
}
