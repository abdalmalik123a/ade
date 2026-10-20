/**
 * أوامر الجدول في المحرّر الجديد — فوق أوامر prosemirror-tables، بما تحفظه الوثيقة (الموجة ١، المجموعة ب).
 *
 * الوثيقة تحفظ الجدول بأوزان أعمدته (`columns`) ودمجٍ أفقيّ وحده (`colSpan`): الدمج الرأسي لا يُمثَّل
 * فيها، واستيراد Word يفكّه ويقول ذلك. وكانت أوامر المكتبة تخالفها: «ادمج» يدمج رأسيًّا فيُرى في المحرّر
 * ويضيع في المحفوظ (صفوفٌ بخلايا ٣ و٢ و٣)، وإضافة عمودٍ أو حذفه تصفّر الأوزان لأنّ المكتبة لا تعرفها.
 * فهنا تُعدَّل الأوزان في الخطوة نفسها (فيتراجع عنها Ctrl+Z معًا)، ويُمنع ما لا يُحفظ.
 *
 * وبلا DOM: تُختبر الأوامر على حالة المحرّر وحدها (`tests/docPmTable.test.ts`).
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import { CellSelection, TableMap, addColumn, isInTable, mergeCells, removeColumn, selectedRect, selectionCell, setCellAttr } from 'prosemirror-tables';
import { dragShare } from './shares';

type Rect = ReturnType<typeof selectedRect>;

/** أوزان الجدول كما يحفظها — وإلا متساويةً بعرضه (جدولٌ لُصق من Word بلا أوزان). */
export function weightsOf(table: PMNode, width: number): number[] {
  const cols = table.attrs.columns as number[] | null;
  return Array.isArray(cols) && cols.length === width ? [...cols] : Array<number>(width).fill(1);
}

/** موضع الجدول نفسه — قبل أوّل ما فيه. */
const tablePos = (rect: Rect) => rect.tableStart - 1;

/** صفات الجدول بعد تغييرها في المعاملة نفسها. */
function setTableAttrs(tr: Transaction, pos: number, patch: Record<string, unknown>): Transaction {
  const table = tr.doc.nodeAt(pos);
  if (!table) return tr;
  return tr.setNodeMarkup(pos, undefined, { ...table.attrs, ...patch });
}

/** تحديد خلايا الجدول من (r1, c1) إلى (r2, c2) لاختبارات وسيناريوهات الجداول. */
export function selectCellsInTable(state: EditorState, tableIdx = 0, r1 = 0, c1 = 0, r2 = 0, c2 = 0): Transaction | null {
  let tCount = 0;
  let targetTable: PMNode | null = null;
  let targetPos = 0;
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      if (tCount === tableIdx) {
        targetTable = node;
        targetPos = pos;
        return false;
      }
      tCount++;
    }
    return true;
  });
  if (!targetTable) return null;
  const map = TableMap.get(targetTable);
  const posA = targetPos + 1 + map.map[r1 * map.width + c1]!;
  const posB = targetPos + 1 + map.map[r2 * map.width + c2]!;
  return state.tr.setSelection(CellSelection.create(state.doc, posA, posB));
}

/** أيمسّ تحديد الخلايا أكثر من صفّ؟ */
export function selectionSpansRows(state: EditorState): boolean {
  if (!(state.selection instanceof CellSelection)) return false;
  const rect = selectedRect(state);
  return rect.bottom - rect.top > 1;
}

/** «ادمج»: دمج الخلايا المحدَّدة (أفقيًّا أو رأسيًّا). */
export const mergeCellsInRow: Command = (state, dispatch) => {
  if (!(state.selection instanceof CellSelection)) return false;
  return mergeCells(state, dispatch);
};
export const mergeCellsCommand: Command = mergeCellsInRow;

/**
 * عمودٌ قبل الخليّة أو بعدها — في الورقة العربية يمينها أو يسارها — بوزن العمود الذي بجانبه،
 * كما يُدرج Word عمودًا بعرض جاره.
 */
export const addColumnKeepWidths =
  (side: 'before' | 'after'): Command =>
  (state, dispatch) => {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const rect = selectedRect(state);
      const at = side === 'after' ? rect.right : rect.left;
      const weights = weightsOf(rect.table, rect.map.width);
      weights.splice(at, 0, weights[side === 'after' ? rect.right - 1 : rect.left] ?? 1);
      dispatch(setTableAttrs(addColumn(state.tr, rect, at), tablePos(rect), { columns: weights }).scrollIntoView());
    }
    return true;
  };

/** حذف الأعمدة المحدَّدة — وتبقى أوزان ما بقي. والجدول كلّه لا يُحذف من هنا. */
export const deleteColumnKeepWidths: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  if (rect.left === 0 && rect.right === rect.map.width) return false;
  if (dispatch) {
    const weights = weightsOf(rect.table, rect.map.width);
    weights.splice(rect.left, rect.right - rect.left);
    const tr = state.tr;
    let r: Rect = { ...rect };
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, r, i);
      if (i === rect.left) break;
      const table = tr.doc.nodeAt(tablePos(rect));
      if (!table) return false;
      r = { ...r, table, map: TableMap.get(table) };
    }
    dispatch(setTableAttrs(tr, tablePos(rect), { columns: weights }).scrollIntoView());
  }
  return true;
};

/** «أوسع» و«أضيق»: وزن العمود الذي فيه المؤشّر بنصف درجة، من ٠٫٤ إلى ٦ — كما كان في المحرّر الأوّل. */
export const resizeColumnBy =
  (delta: number): Command =>
  (state, dispatch) => {
    if (!isInTable(state)) return false;
    const rect = selectedRect(state);
    const weights = weightsOf(rect.table, rect.map.width);
    const at = rect.left;
    const next = Math.min(6, Math.max(0.4, Math.round(((weights[at] ?? 1) + delta) * 10) / 10));
    if (next === weights[at]) return false;
    if (dispatch) {
      weights[at] = next;
      dispatch(setTableAttrs(state.tr, tablePos(rect), { columns: weights }));
    }
    return true;
  };

/** أضيق ما يصير إليه عمودٌ بالسحب: ٤٪ من عرض الجدول (نحو ٧ ملم في متن A4) — فلا يختفي عمودٌ تحت حدّه. */
export const MIN_COLUMN_SHARE = 0.04;

/**
 * سحب الحدّ بين عمودين بالفأرة كما في Word (البند ١): الحدّ `border` بين العمود `border - 1` والعمود `border`، و`gain` ما يكسبه
 * الأوّل من عرض الجدول كلّه (٠٫١ = عُشره) ويخسره جاره — فلا يتغيّر عرض الجدول ولا سائر أعمدته. ولا يضيق أحدهما عن الحدّ.
 * والحساب نفسه لجدول التصاميم (`shared/shares.ts`).
 */
export const dragColumnBorder = (weights: number[], border: number, gain: number): number[] => dragShare(weights, border, gain, MIN_COLUMN_SHARE);

/** أوزان الجدول الذي في `pos` — خطوةً واحدة يتراجع عنها Ctrl+Z (نهاية السحب). */
export const setTableColumns =
  (pos: number, columns: number[]): Command =>
  (state, dispatch) => {
    if (state.doc.nodeAt(pos)?.type.spec.tableRole !== 'table') return false;
    if (dispatch) dispatch(setTableAttrs(state.tr, pos, { columns }));
    return true;
  };

/** حدود الجدول تُطبع أو تُخفى — لجدولٍ يرتّب الرأس أو التواقيع لا يُرى. */
export const toggleTableBorders: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(setTableAttrs(state.tr, tablePos(rect), { borders: rect.table.attrs.borders === false ? null : false }));
  }
  return true;
};

/** صفّ العناوين: يُطبع رأسًا يتكرّر في أعلى كلّ صفحةٍ ينقسم إليها الجدول. */
export const toggleHeaderRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(setTableAttrs(state.tr, tablePos(rect), { header: !rect.table.attrs.header }));
  }
  return true;
};

/** تظليل صفّ العناوين: لون خفيف (#f1f5f9) يميّز ترويسة الجدول. */
export const toggleHeaderShading: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(setTableAttrs(state.tr, tablePos(rect), { headerShading: !rect.table.attrs.headerShading }));
  }
  return true;
};

/** محاذاة محتوى الخلايا المحدَّدة عموديًّا (أعلى أو وسط أو أسفل). */
export const setCellVAlign = (value: 'top' | 'middle' | 'bottom'): Command => setCellAttr('vAlign', value);

/** حال الجدول الذي فيه المؤشّر — لتُضاء أزراره. */
export function tableState(state: EditorState): {
  borders: boolean;
  header: boolean;
  headerShading: boolean;
  spansRows: boolean;
  vAlign: 'top' | 'middle' | 'bottom' | null;
} | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  let vAlign: 'top' | 'middle' | 'bottom' | null = null;
  if (state.selection instanceof CellSelection) {
    state.selection.forEachCell((cell) => {
      const v = (cell.attrs.vAlign as 'top' | 'middle' | 'bottom' | null) ?? 'top';
      if (vAlign === null) vAlign = v;
      else if (vAlign !== v) vAlign = null;
    });
  } else {
    try {
      const $cell = selectionCell(state);
      vAlign = ($cell.nodeAfter?.attrs.vAlign as 'top' | 'middle' | 'bottom' | null) ?? 'top';
    } catch {
      vAlign = null;
    }
  }
  return {
    borders: rect.table.attrs.borders !== false,
    header: Boolean(rect.table.attrs.header),
    headerShading: Boolean(rect.table.attrs.headerShading),
    spansRows: selectionSpansRows(state),
    vAlign
  };
}
