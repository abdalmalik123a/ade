/**
 * أوامر الجدول في المحرّر الجديد تحفظ ما تصنعه (الموجة ١، المجموعة ب).
 *
 * وكانت تجربةٌ على الجسر قد أظهرت: «ادمج» رأسيًّا يُرى في المحرّر ويضيع في المحفوظ، وإضافة عمودٍ أو
 * حذفه تصفّر أوزان الأعمدة.
 */
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { CellSelection, TableMap, mergeCells, tableEditing } from 'prosemirror-tables';
import { blocksToPm, pmBlocks } from '../src/shared/docPm';
import { makeTable } from '../src/shared/docEdit';
import {
  addColumnKeepWidths,
  deleteColumnKeepWidths,
  mergeCellsInRow,
  resizeColumnBy,
  selectionSpansRows,
  tableState,
  toggleHeaderRow,
  toggleTableBorders
} from '../src/shared/docPmTable';
import type { TableBlock } from '../src/shared/doc';

/** جدولٌ بثلاثة صفوفٍ وأوزانٍ مقصودة، في محرّرٍ بأوامر الجداول. */
function editor(weights = [1, 3, 1]) {
  const t = makeTable(3, weights.length, false);
  t.columns = weights;
  return EditorState.create({ doc: blocksToPm([t]), plugins: [tableEditing()] });
}

/** موضع خليّةٍ بصفّها وعمودها في الشبكة. */
function cellPos(state: EditorState, row: number, col: number): number {
  const table = state.doc.firstChild!;
  const map = TableMap.get(table);
  return 1 + map.map[row * map.width + col]!;
}

const inCell = (state: EditorState, row: number, col: number) =>
  state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(cellPos(state, row, col) + 1))));

const cells = (state: EditorState, a: [number, number], b: [number, number]) =>
  state.apply(state.tr.setSelection(CellSelection.create(state.doc, cellPos(state, ...a), cellPos(state, ...b))));

/** يشغّل الأمر ويعيد الحال بعده — أو `null` إن رفضه. */
function run(state: EditorState, cmd: Command): EditorState | null {
  const out: { next: EditorState | null } = { next: null };
  const ok = cmd(state, (tr) => {
    out.next = state.apply(tr);
  });
  return ok ? out.next : null;
}

/** الجدول كما تحفظه الوثيقة. */
const saved = (state: EditorState) => pmBlocks(state.doc)[0] as TableBlock;

describe('الدمج', () => {
  it('الدمج الرأسي يُمنع — والوثيقة لا تمثّله', () => {
    const s = cells(editor(), [0, 0], [1, 0]);
    expect(selectionSpansRows(s)).toBe(true);
    expect(run(s, mergeCellsInRow)).toBeNull();
    // وكان أمر المكتبة يدمجه فيضيع في المحفوظ: صفوفٌ بخلايا ٣ و٢ و٣.
    const lost = run(s, mergeCells)!;
    expect(saved(lost).rows.map((r) => r.cells.length)).toEqual([3, 2, 3]);
  });

  it('ودمج خلايا الصفّ الواحد يُحفظ بأوزانه', () => {
    const s = run(cells(editor(), [0, 0], [0, 1]), mergeCellsInRow)!;
    const t = saved(s);
    expect(t.rows[0]!.cells.map((c) => c.colSpan ?? 1)).toEqual([2, 1]);
    expect(t.columns).toEqual([1, 3, 1]);
  });
});

describe('الأعمدة تحفظ أوزانها', () => {
  it('عمودٌ بعد الأوسط يأخذ وزنه، وقبل الأوّل وزنَ الأوّل', () => {
    const after = run(inCell(editor(), 0, 1), addColumnKeepWidths('after'))!;
    expect(saved(after).columns).toEqual([1, 3, 3, 1]);
    expect(saved(after).rows.every((r) => r.cells.length === 4)).toBe(true);
    const before = run(inCell(editor(), 0, 0), addColumnKeepWidths('before'))!;
    expect(saved(before).columns).toEqual([1, 1, 3, 1]);
  });

  it('وحذف عمودٍ يُبقي أوزان ما بقي — ولا يُحذف الجدول كلّه من هنا', () => {
    expect(saved(run(inCell(editor(), 1, 1), deleteColumnKeepWidths)!).columns).toEqual([1, 1]);
    expect(saved(run(inCell(editor(), 1, 2), deleteColumnKeepWidths)!).columns).toEqual([1, 3]);
    const two = run(cells(editor(), [0, 1], [0, 2]), deleteColumnKeepWidths)!;
    expect(saved(two).columns).toEqual([1]);
    expect(run(cells(editor(), [0, 0], [0, 2]), deleteColumnKeepWidths)).toBeNull();
  });

  it('«أوسع» و«أضيق» بنصف درجة، من ٠٫٤ إلى ٦', () => {
    expect(saved(run(inCell(editor(), 0, 1), resizeColumnBy(0.5))!).columns).toEqual([1, 3.5, 1]);
    expect(saved(run(inCell(editor(), 0, 0), resizeColumnBy(-0.5))!).columns).toEqual([0.5, 3, 1]);
    expect(saved(run(inCell(editor([0.4, 1]), 0, 0), resizeColumnBy(-0.5)) ?? editor([0.4, 1])).columns).toEqual([0.4, 1]);
    expect(saved(run(inCell(editor([5.8, 1]), 0, 0), resizeColumnBy(0.5))!).columns).toEqual([6, 1]);
  });

  it('وما حُفظ يعود إلى المحرّر كما هو — لا شيء يضيع في الذهاب والإياب', () => {
    const s = run(inCell(editor(), 0, 1), addColumnKeepWidths('after'))!;
    // الخلايا الجديدة تأخذ معرّفاتها حين تُحفظ أوّل مرّة (وفي المحرّر من إضافة المعرّفات الفريدة).
    const once = pmBlocks(s.doc);
    expect(pmBlocks(blocksToPm(once))).toEqual(once);
  });
});

describe('الحدود وصفّ العناوين', () => {
  it('تُخفى الحدود وتُعاد، ويُشعل صفّ العناوين ويُطفأ — وتحفظهما الوثيقة', () => {
    let s = inCell(editor(), 1, 1);
    expect(tableState(s)).toEqual({ borders: true, header: false, spansRows: false });
    s = run(s, toggleTableBorders)!;
    expect(saved(s).borders).toBe(false);
    s = run(s, toggleHeaderRow)!;
    expect(saved(s).header).toBe(true);
    expect(tableState(s)).toMatchObject({ borders: false, header: true });
    s = run(s, toggleTableBorders)!;
    expect(saved(s).borders).toBeUndefined();
  });

  it('وخارج الجدول لا تعمل', () => {
    const plain = EditorState.create({ doc: blocksToPm([]) });
    expect(tableState(plain)).toBeNull();
    for (const cmd of [mergeCellsInRow, addColumnKeepWidths('after'), deleteColumnKeepWidths, resizeColumnBy(0.5), toggleTableBorders, toggleHeaderRow]) {
      expect(cmd(plain)).toBe(false);
    }
  });
});
