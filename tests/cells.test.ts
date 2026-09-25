import { describe, expect, it } from 'vitest';
import { emptyDoc, paragraph, run, type Doc, type TableBlock, type TableCell } from '../src/shared/doc';
import {
  addColumn,
  fieldify,
  findParagraph,
  gridColumn,
  makeTable,
  mergeCells,
  patchBlock,
  removeColumn,
  setInlines,
  splitCell
} from '../src/shared/docEdit';
import type { ParagraphBlock } from '../src/shared/doc';

const text = (c: TableCell) =>
  c.blocks.map((p) => p.inlines.map((i) => (i.kind === 'run' ? i.text : `{${i.kind}}`)).join('')).join('|');

function withTable(rows = 2, cols = 3): { doc: Doc; t: TableBlock } {
  const t = makeTable(rows, cols);
  t.rows.forEach((row, r) =>
    row.cells.forEach((c, i) => {
      c.blocks = [paragraph([run(`${r}${i}`)])];
    })
  );
  return { doc: { ...emptyDoc(), blocks: [t] }, t };
}
const table = (doc: Doc) => doc.blocks[0] as TableBlock;

describe('الخلايا', () => {
  it('فقرة الخليّة فقرةٌ كغيرها: تُحاذى ويُكتب فيها', () => {
    const { doc, t } = withTable();
    const id = t.rows[0]!.cells[1]!.blocks[0]!.id;
    expect(findParagraph(doc, id)?.inlines).toEqual([run('01')]);
    const aligned = patchBlock<ParagraphBlock>(doc, id, { align: 'center' });
    expect(table(aligned).rows[0]!.cells[1]!.blocks[0]!.align).toBe('center');
    const typed = setInlines(aligned, id, [run('نص')]);
    expect(text(table(typed).rows[0]!.cells[1]!)).toBe('نص');
  });

  it('F4 في الخليّة يصنع حقلًا — والاستمارات جداول', () => {
    const { doc, t } = withTable();
    const id = t.rows[1]!.cells[0]!.blocks[0]!.id;
    const withName = setInlines(doc, id, [run('أحمد علي')]);
    const next = fieldify(withName, id, 0, 8);
    expect(next.fields.map((f) => f.label)).toEqual(['أحمد علي']);
    expect(table(next).rows[1]!.cells[0]!.blocks[0]!.inlines[0]).toMatchObject({ kind: 'field' });
  });

  it('الدمج يجمع ما في الخليّتين ويغطّي عموديهما', () => {
    const { doc } = withTable();
    const merged = table(mergeCells(doc, doc.blocks[0]!.id, 0, 0));
    expect(merged.rows[0]!.cells).toHaveLength(2);
    expect(merged.rows[0]!.cells[0]!.colSpan).toBe(2);
    expect(text(merged.rows[0]!.cells[0]!)).toBe('00|01');
    expect(gridColumn(merged.rows[0]!, 1)).toBe(2);
  });

  it('الخليّة الفارغة لا تترك سطرًا زائدًا عند الدمج', () => {
    const { doc, t } = withTable();
    const empty = setInlines(doc, t.rows[0]!.cells[0]!.blocks[0]!.id, []);
    expect(text(table(mergeCells(empty, t.id, 0, 0)).rows[0]!.cells[0]!)).toBe('01');
  });

  it('فكّ الدمج يعيد الخلايا وما كُتب في الأولى', () => {
    const { doc, t } = withTable();
    const back = table(splitCell(mergeCells(doc, t.id, 0, 0), t.id, 0, 0));
    expect(back.rows[0]!.cells).toHaveLength(3);
    expect(back.rows[0]!.cells[0]!.colSpan).toBeUndefined();
    expect(text(back.rows[0]!.cells[0]!)).toBe('00|01');
    expect(text(back.rows[0]!.cells[1]!)).toBe('');
  });

  it('عمودٌ يُضاف داخل خليّةٍ مدموجة فتتّسع له ولا تنشقّ', () => {
    const { doc, t } = withTable();
    const merged = mergeCells(doc, t.id, 0, 0); // الصفّ الأول: [00|01] ، 02
    const next = table(addColumn(merged, t.id, 1));
    expect(next.columns).toHaveLength(4);
    expect(next.rows[0]!.cells.map((c) => c.colSpan ?? 1)).toEqual([3, 1]);
    expect(next.rows[1]!.cells.map(text)).toEqual(['10', '', '11', '12']);
  });

  it('حذف عمودٍ تحت خليّةٍ مدموجة يضيّقها ولا يحذفها', () => {
    const { doc, t } = withTable();
    const merged = mergeCells(doc, t.id, 0, 0);
    const next = table(removeColumn(merged, t.id, 1));
    expect(next.columns).toHaveLength(2);
    expect(next.rows[0]!.cells.map(text)).toEqual(['00|01', '02']);
    expect(next.rows[0]!.cells[0]!.colSpan).toBeUndefined();
    expect(next.rows[1]!.cells.map(text)).toEqual(['10', '12']);
  });

  it('عمودٌ في آخر الشبكة يُلحق بكل صفّ', () => {
    const { doc, t } = withTable();
    const next = table(addColumn(mergeCells(doc, t.id, 0, 1), t.id));
    expect(next.rows.map((r) => r.cells.reduce((n, c) => n + (c.colSpan ?? 1), 0))).toEqual([4, 4]);
  });
});
