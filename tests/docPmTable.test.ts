/**
 * أوامر الجدول في المحرّر الجديد تحفظ ما تصنعه (الموجة ١، المجموعة ب).
 *
 * وكانت تجربةٌ على الجسر قد أظهرت: «ادمج» رأسيًّا يُرى في المحرّر ويضيع في المحفوظ، وإضافة عمودٍ أو
 * حذفه تصفّر أوزان الأعمدة.
 */
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { CellSelection, TableMap, splitCell, tableEditing } from 'prosemirror-tables';
import { blocksToPm, pmBlocks } from '../src/shared/docPm';
import { makeTable } from '../src/shared/docEdit';
import {
  addColumnKeepWidths,
  deleteColumnKeepWidths,
  dragColumnBorder,
  mergeCellsInRow,
  resizeColumnBy,
  selectionSpansRows,
  setTableColumns,
  tableState,
  toggleHeaderRow,
  toggleHeaderShading,
  toggleTableBorders,
  setCellVAlign
} from '../src/shared/docPmTable';
import { emptyDoc, type TableBlock } from '../src/shared/doc';
import { renderDocHtml } from '../src/shared/docHtml';
import { docToDocx } from '../src/main/services/docDocx';
import { unzipSync, strFromU8 } from 'fflate';

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
  it('الدمج الرأسي مسموح — والوثيقة تمثّله بـ rowSpan وتستعيده', () => {
    const s = cells(editor(), [0, 0], [1, 0]);
    expect(selectionSpansRows(s)).toBe(true);
    const merged = run(s, mergeCellsInRow)!;
    expect(merged).not.toBeNull();
    const t = saved(merged);
    expect(t.rows.map((r) => r.cells.length)).toEqual([3, 2, 3]);
    expect(t.rows[0]!.cells[0]!.rowSpan).toBe(2);

    // التحقق من الاستعادة ذهابًا وإيابًا عبر blocksToPm
    const reloaded = EditorState.create({ doc: blocksToPm([t]), plugins: [tableEditing()] });
    const cellNode = reloaded.doc.firstChild!.firstChild!.firstChild!;
    expect(cellNode.attrs.rowspan).toBe(2);
    expect(saved(reloaded)).toEqual(t);
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

describe('العمود والخليّة المدموجة', () => {
  // كانت على عمليّات المحرّر الأوّل (cells.test.ts) وحُذفت معه؛ وهي هنا على أوامر المحرّر الجديد.
  const merged = () => run(cells(editor(), [0, 0], [0, 1]), mergeCellsInRow)!;

  it('عمودٌ يُضاف داخل خليّةٍ مدموجة فتتّسع له ولا تنشقّ', () => {
    const t = saved(run(inCell(merged(), 1, 0), addColumnKeepWidths('after'))!);
    expect(t.columns).toEqual([1, 1, 3, 1]);
    expect(t.rows[0]!.cells.map((c) => c.colSpan ?? 1)).toEqual([3, 1]);
    expect(t.rows.slice(1).every((r) => r.cells.length === 4)).toBe(true);
  });

  it('وحذف عمودٍ تحت خليّةٍ مدموجة يضيّقها ولا يحذفها', () => {
    const t = saved(run(inCell(merged(), 1, 1), deleteColumnKeepWidths)!);
    expect(t.columns).toEqual([1, 1]);
    expect(t.rows[0]!.cells.map((c) => c.colSpan ?? 1)).toEqual([1, 1]);
    expect(t.rows.slice(1).every((r) => r.cells.length === 2)).toBe(true);
  });

  it('وفكّ الدمج يعيد الخلايا', () => {
    const t = saved(run(inCell(merged(), 0, 0), splitCell)!);
    expect(t.rows[0]!.cells).toHaveLength(3);
    expect(t.rows[0]!.cells[0]!.colSpan).toBeUndefined();
    expect(t.columns).toEqual([1, 3, 1]);
  });
});

describe('الحدود وصفّ العناوين', () => {
  it('تُخفى الحدود وتُعاد، ويُشعل صفّ العناوين ويُطفأ — وتحفظهما الوثيقة', () => {
    let s = inCell(editor(), 1, 1);
    expect(tableState(s)).toEqual({ borders: true, header: false, headerShading: false, spansRows: false, vAlign: 'top' });
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
    for (const cmd of [mergeCellsInRow, addColumnKeepWidths('after'), deleteColumnKeepWidths, resizeColumnBy(0.5), toggleTableBorders, toggleHeaderRow, toggleHeaderShading]) {
      expect(cmd(plain)).toBe(false);
    }
  });
});

describe('تظليل صفّ العناوين ومحاذاة الخلايا عموديًّا (S12)', () => {
  it('تظليل صفّ العناوين يُشعل ويُطفأ وتتبعه حال tableState والوثيقة المحفوظة', () => {
    let s = inCell(editor(), 0, 0);
    expect(tableState(s)?.headerShading).toBe(false);
    s = run(s, toggleHeaderShading)!;
    expect(tableState(s)?.headerShading).toBe(true);
    expect(saved(s).headerShading).toBe(true);
    s = run(s, toggleHeaderShading)!;
    expect(tableState(s)?.headerShading).toBe(false);
    expect(saved(s).headerShading).toBeUndefined();
  });

  it('محاذاة الخليّة عموديًّا تضبط vAlign على الخليّة الحالية وتُحفظ في الوثيقة', () => {
    let s = inCell(editor(), 1, 1);
    expect(tableState(s)?.vAlign).toBe('top');
    s = run(s, setCellVAlign('middle'))!;
    expect(tableState(s)?.vAlign).toBe('middle');
    expect(saved(s).rows[1]!.cells[1]!.vAlign).toBe('middle');

    s = run(s, setCellVAlign('bottom'))!;
    expect(tableState(s)?.vAlign).toBe('bottom');
    expect(saved(s).rows[1]!.cells[1]!.vAlign).toBe('bottom');

    s = run(s, setCellVAlign('top'))!;
    expect(tableState(s)?.vAlign).toBe('top');
    expect(saved(s).rows[1]!.cells[1]!.vAlign).toBe('top');
  });

  it('محاذاة مجموعة خلايا محدّدة بـ CellSelection تضبط vAlign عليها معًا', () => {
    let s = cells(editor(), [0, 0], [0, 2]);
    s = run(s, setCellVAlign('middle'))!;
    const t = saved(s);
    expect(t.rows[0]!.cells.map((c) => c.vAlign)).toEqual(['middle', 'middle', 'middle']);
    expect(t.rows[1]!.cells.map((c) => c.vAlign)).toEqual([undefined, undefined, undefined]);
  });

  it('تصدير التظليل والمحاذاة العمودية إلى HTML والطباعة', () => {
    const t = makeTable(2, 2, true);
    t.headerShading = true;
    t.rows[0]!.cells[0]!.vAlign = 'middle';
    t.rows[1]!.cells[1]!.vAlign = 'bottom';
    const d = emptyDoc();
    d.blocks = [t];
    const html = renderDocHtml(d, {}, { paragraphs: 'blocks' });
    expect(html).toContain('background-color:#f1f5f9');
    expect(html).toContain('vertical-align:middle');
    expect(html).toContain('vertical-align:bottom');
  });

  it('تصدير التظليل والمحاذاة العمودية إلى Word (docx)', async () => {
    const t = makeTable(2, 2, true);
    t.headerShading = true;
    t.rows[0]!.cells[0]!.vAlign = 'middle';
    const d = emptyDoc();
    d.blocks = [t];
    const buf = await docToDocx(d, { title: 'جدول', blanks: true });
    const xml = strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']!);
    expect(xml).toMatch(/<w:shd[^>]*w:fill="f1f5f9"[^>]*\/>/i);
    expect(xml).toMatch(/<w:vAlign[^>]*w:val="center"[^>]*\/>/i);
  });

  it('تصدير الدمج الرأسي إلى HTML والطباعة كـ rowspan', () => {
    const t = makeTable(2, 2, false);
    t.rows[0]!.cells[0]!.rowSpan = 2;
    t.rows[1]!.cells = [t.rows[1]!.cells[1]!];
    const d = emptyDoc();
    d.blocks = [t];
    const html = renderDocHtml(d, {}, { paragraphs: 'blocks' });
    expect(html).toContain('rowspan="2"');
  });

  it('تصدير الدمج الرأسي إلى Word (docx) بـ w:vMerge', async () => {
    const t = makeTable(2, 2, false);
    t.rows[0]!.cells[0]!.rowSpan = 2;
    t.rows[1]!.cells = [t.rows[1]!.cells[1]!];
    const d = emptyDoc();
    d.blocks = [t];
    const buf = await docToDocx(d, { title: 'جدول', blanks: true });
    const xml = strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']!);
    expect(xml).toMatch(/<w:vMerge[^>]*w:val="restart"[^>]*\/>/i);
    expect(xml).toMatch(/<w:vMerge[^>]*w:val="continue"[^>]*\/>/i);
  });
});

describe('سحب حدّ العمود بالفأرة (محادثة «محرّر الكتاب»، البند ١)', () => {
  it('العمود يكسب ما يخسره جاره — وعرض الجدول وسائر أعمدته كما هي', () => {
    expect(dragColumnBorder([1, 1, 1], 1, 0.1)).toEqual([1.3, 0.7, 1]);
    expect(dragColumnBorder([2, 1, 1], 2, 0.125)).toEqual([2, 1.5, 0.5]);
    const w = dragColumnBorder([1, 3, 1], 2, 0.05);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(5, 5);
    expect(w[0]).toBe(1);
  });

  it('ولا يضيق عمودٌ عن ٤٪ من الجدول — فلا يختفي تحت حدّه', () => {
    expect(dragColumnBorder([1, 1, 1], 2, -1)).toEqual([1, 0.12, 1.88]);
    expect(dragColumnBorder([1, 1, 1], 1, 5)).toEqual([1.88, 0.12, 1]);
  });

  it('وحدّا الجدول الخارجيّان لا يُسحبان', () => {
    const w = [1, 2, 1];
    expect(dragColumnBorder(w, 0, 0.2)).toBe(w);
    expect(dragColumnBorder(w, 3, 0.2)).toBe(w);
  });

  it('ونهاية السحب خطوةٌ واحدة تحفظها الوثيقة — ولا تقع على غير جدول', () => {
    const s = editor([1, 1, 1]);
    const next = run(s, setTableColumns(0, [1.3, 0.7, 1]));
    expect(saved(next!).columns).toEqual([1.3, 0.7, 1]);
    expect(run(s, setTableColumns(2, [1, 1, 1]))).toBeNull();
  });
});
