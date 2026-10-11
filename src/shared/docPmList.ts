/**
 * القوائم في المحرّر (محادثة «محرّر الكتاب»، البند ٣): شكل الترقيم كما في Word — نقطيٌّ ورقميٌّ وحروفٌ «أ) ب) ج)» و«أولًا:»
 * — وعلامة كلّ عنصرٍ على الورقة **كما تُطبع** (`marker` في `docHtml`). وكان المحرّر يرسم ترقيم المتصفّح «1. 2.» فتُرى
 * «أ) ب)» والأرقام الهندية أرقامًا عادية، وتُطبع صحيحة.
 *
 * وشكل كلّ مستوى في القائمة العليا (`styles`): الوثيقة تحفظه هناك وحده (`pmBlock`)، والفرعيّة تُقرأ منها — والأعمق
 * يأخذ آخر شكل، كما تطبعه الورقة. وبلا DOM: يُختبر على حالة المحرّر وحدها (`tests/docPmList.test.ts`).
 */
import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import type { ListStyle, Numerals } from './doc';
import { marker } from './docHtml';
import { docSchema } from './docPm';

const N = docSchema.nodes;

/** شكل المستوى: الأعمق يأخذ آخر شكل. */
export const levelStyle = (styles: ListStyle[], level: number): ListStyle => styles[Math.min(level, styles.length - 1)] ?? 'bullet';

/** القائمة التي فيها المؤشّر: العليا وموضعها، ومستوى المؤشّر فيها (٠ للأعلى). */
function listAt(state: EditorState): { top: PMNode; pos: number; level: number } | null {
  const { $from } = state.selection;
  let found: { top: PMNode; pos: number } | null = null;
  let level = -1;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type !== N.list) continue;
    found = { top: n, pos: $from.before(d) };
    level += 1;
  }
  return found ? { ...found, level } : null;
}

/** شكل المستوى الذي فيه المؤشّر — أو لا قائمة. */
export function listStyleAt(state: EditorState): ListStyle | null {
  const at = listAt(state);
  return at ? levelStyle(at.top.attrs.styles as ListStyle[], at.level) : null;
}

/** أشكال المستويات بعد اختيار شكلٍ لمستوى: ما فوقه كما كان، وما تحته بلا شكلٍ له يتبعه. */
export function withLevelStyle(styles: ListStyle[], level: number, style: ListStyle): ListStyle[] {
  const out = Array.from({ length: Math.max(styles.length, level + 1) }, (_, i) => levelStyle(styles, i));
  out[level] = style;
  return out;
}

/**
 * الفقرات المحدَّدة تصير قائمةً واحدة، **كلّ فقرةٍ عنصر** — كما في Word. وعنصر القائمة هنا فقرةٌ وفرعها (`paragraph list?`)،
 * فكان `wrapInList` يرفض أكثر من فقرة: يُظلَّل سطران ويُضغط «ترقيم» فلا يحدث شيء. والتحديد يبقى على نصّه.
 */
function wrapParagraphs(style: ListStyle): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    const range = $from.blockRange($to);
    if (!range || !range.parent.canReplaceWith(range.startIndex, range.endIndex, N.list!)) return false;
    const items: PMNode[] = [];
    for (let i = range.startIndex; i < range.endIndex; i++) {
      const child = range.parent.child(i);
      if (child.type !== N.paragraph) return false;
      items.push(N.list_item!.create({ id: null }, child));
    }
    if (dispatch) {
      const tr = state.tr.replaceWith(range.start, range.end, N.list!.create({ id: null, styles: [style] }, items));
      // في الفقرة رقم k من التحديد: فتحة القائمة، وفتحة عنصرها وفتحتا وإغلاقا ما قبله.
      const shift = (pos: number, index: number) => pos + 2 + 2 * (index - range.startIndex);
      tr.setSelection(TextSelection.create(tr.doc, shift($from.pos, $from.index(range.depth)), shift($to.pos, $to.index(range.depth))));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** شكلٌ لمستوى القائمة التي فيها المؤشّر — أو قائمةٌ جديدة بهذا الشكل حول الفقرات المحدَّدة. */
export const setListStyle =
  (style: ListStyle): Command =>
  (state, dispatch, view) => {
    const at = listAt(state);
    if (!at) return wrapParagraphs(style)(state, dispatch) || wrapInList(N.list!, { id: null, styles: [style] })(state, dispatch, view);
    if (dispatch) {
      const styles = withLevelStyle(at.top.attrs.styles as ListStyle[], at.level, style);
      dispatch(state.tr.setNodeMarkup(at.pos, undefined, { ...at.top.attrs, styles }));
    }
    return true;
  };

/** «تعداد نقطي» و«ترقيم»: الفقرة تدخل القائمة بشكله، وتخرج منها إن كان شكلَ مستواها — كما يفعل الزرّ في Word. */
export const toggleList =
  (style: ListStyle): Command =>
  (state, dispatch, view) =>
    listStyleAt(state) === style ? liftListItem(N.list_item!)(state, dispatch, view) : setListStyle(style)(state, dispatch, view);

/** علامة كلّ عنصرٍ كما تُطبع: حدود فقرته الأولى وعلامتها — لزخرفة المحرّر. */
export function listMarkers(doc: PMNode, numerals: Numerals): { from: number; to: number; text: string }[] {
  const out: { from: number; to: number; text: string }[] = [];
  const walk = (list: PMNode, pos: number, styles: ListStyle[], level: number) => {
    list.forEach((item, offset, index) => {
      const itemPos = pos + 1 + offset;
      const first = item.firstChild;
      if (first) out.push({ from: itemPos + 1, to: itemPos + 1 + first.nodeSize, text: marker(levelStyle(styles, level), index, numerals) });
      item.forEach((child, off) => {
        if (child.type === N.list) walk(child, itemPos + 1 + off, styles, level + 1);
      });
    });
  };
  doc.descendants((node, pos) => {
    if (node.type === N.list) {
      walk(node, pos, node.attrs.styles as ListStyle[], 0);
      return false;
    }
    return !node.isTextblock;
  });
  return out;
}
