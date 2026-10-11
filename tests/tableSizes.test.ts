/**
 * عرض أعمدة جدول التصاميم وارتفاع صفوفه (محادثة «التصاميم»، البند ٢): من الجار فلا يتغيّر صندوق الجدول، والعمود الجديد
 * بعرض متوسّطها، والصفوف بأوزانها تُرسم بحصصها — وبلا أوزانٍ تُرسم كما كانت حرفًا.
 */
import { describe, expect, it } from 'vitest';
import { SCREEN_DPI, designPackLevel, emptyCanvas, normalizeCanvas, tableElement, type Canvas, type TableElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { canvasDoc } from '../src/shared/canvas';
import {
  columnsMm,
  rowWeights,
  rowsMm,
  setColumnMm,
  setRowMm,
  withColumnAdded,
  withColumnRemoved,
  withRowAdded,
  withRowRemoved
} from '../src/shared/design/tableSizes';

/** لوحةٌ ١٠٠×٥٠ ملم وجدولٌ يملأ نصفها: ٥٠×٢٥ ملم. */
const canvas: Canvas = { ...emptyCanvas({ w: 100, h: 50 }, 0) };
const table = (patch: Partial<TableElement> = {}) => tableElement({ box: { x: 0, y: 0, w: 0.5, h: 0.5 }, ...patch });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('عرض الأعمدة', () => {
  it('بالملّم من الجار — وعرض الجدول كما هو', () => {
    const t = table(); // ١٢ و٥٨ و٣٠ ٪
    expect(columnsMm(t, canvas).map((x) => Math.round(x * 10) / 10)).toEqual([6, 29, 15]);
    const next = { ...t, ...setColumnMm(t, canvas, 0, 10) };
    expect(columnsMm(next, canvas).map((x) => Math.round(x * 10) / 10)).toEqual([10, 25, 15]);
    // والأخير يأخذ من السابق.
    const last = { ...t, ...setColumnMm(t, canvas, 2, 20) };
    expect(columnsMm(last, canvas).map((x) => Math.round(x * 10) / 10)).toEqual([6, 24, 20]);
    expect(sum(last.columns.map((c) => c.widthPercent))).toBeCloseTo(100, 1);
  });

  it('ولا يضيق عمودٌ عن حدّه ولو كُتب صفر', () => {
    const t = table();
    const next = { ...t, ...setColumnMm(t, canvas, 1, 0.1) };
    expect(columnsMm(next, canvas)[1]).toBeGreaterThanOrEqual(2); // ٤٪ من ٥٠ ملم
  });

  it('العمود الجديد بعرض متوسّطها والبقيّة تفسح له — والمحذوف يُردّ مكانه لما بقي', () => {
    const t = table();
    const added = { ...t, ...withColumnAdded(t) };
    expect(added.columns).toHaveLength(4);
    expect(added.columns[3]!.widthPercent).toBe(25);
    expect(sum(added.columns.map((c) => c.widthPercent))).toBeCloseTo(100, 1);
    expect(added.rows.every((r) => r.length === 4)).toBe(true);
    const removed = { ...added, ...withColumnRemoved(added) };
    expect(removed.columns.map((c) => c.widthPercent)).toEqual([12, 58, 30]);
  });
});

describe('ارتفاع الصفوف', () => {
  it('بلا أوزانٍ تتقاسم الارتفاع، وأوّل رقمٍ يبدأ بها متساوية ثم من الجار', () => {
    const t = table(); // العناوين وثلاثة صفوف: ٢٥ ملم
    expect(rowWeights(t)).toBeNull();
    expect(rowsMm(t, canvas).map((x) => Math.round(x * 100) / 100)).toEqual([6.25, 6.25, 6.25, 6.25]);
    const next = { ...t, ...setRowMm(t, canvas, 1, 10) };
    expect(rowsMm(next, canvas).map((x) => Math.round(x * 100) / 100)).toEqual([6.25, 10, 2.5, 6.25]);
    expect(next.headerHeight).toBe(25);
    expect(next.rowHeights).toHaveLength(3);
  });

  it('والصفّ الجديد بوزن متوسّطها، والمحذوف يأخذ وزنه ولونه معه', () => {
    const t = { ...table(), rowHeights: [10, 20, 30], headerHeight: 10, rowStyles: [null, { bold: true }, null] };
    const added = { ...t, ...withRowAdded(t) };
    expect(added.rowHeights).toEqual([10, 20, 30, 20]);
    const removed = { ...added, ...withRowRemoved(added) };
    expect(removed.rowHeights).toEqual([10, 20, 30]);
    expect(removed.rows).toHaveLength(3);
  });

  it('تُرسم بحصصها من ارتفاع الصندوق — والعناوين أوّلًا — وبلا أوزانٍ كما كانت حرفًا', () => {
    const plain = table();
    const c = { ...canvas, elements: [plain] };
    const before = renderCanvasHtml(canvasDoc(c), {}, { dpi: SCREEN_DPI, missing: 'blank' });
    expect(before).not.toMatch(/<tr style="height:/);
    const sized = { ...plain, rowHeights: [1, 2, 1], headerHeight: 1 };
    const html = renderCanvasHtml(canvasDoc({ ...canvas, elements: [sized] }), {}, { dpi: SCREEN_DPI, missing: 'blank' });
    const boxPx = (25 / 25.4) * SCREEN_DPI;
    const heights = [...html.matchAll(/<tr style="height:([\d.]+)px/g)].map((m) => Number(m[1]));
    // العناوين ١ ثم الصفوف ١ و٢ و١ — من خمسة.
    expect(heights.map((h) => Math.round(h))).toEqual([boxPx / 5, boxPx / 5, (boxPx * 2) / 5, boxPx / 5].map(Math.round));
  });

  it('وتُقرأ مقوَّمةً: وزنٌ موجبٌ لكلّ صفّ — وإلا فلا أوزان', () => {
    const read = (raw: Record<string, unknown>) => normalizeCanvas({ ...canvas, elements: [{ ...table(), ...raw }] }).elements[0] as TableElement;
    expect(read({ rowHeights: [1, 2, 3], headerHeight: 2 })).toMatchObject({ rowHeights: [1, 2, 3], headerHeight: 2 });
    expect(read({ rowHeights: [1, 2] }).rowHeights).toBeUndefined();
    expect(read({ rowHeights: [1, -2, 3] }).rowHeights).toBeUndefined();
    expect(read({ headerHeight: 3 }).headerHeight).toBeUndefined();
  });

  it('وحزمةٌ فيها جدولٌ بارتفاع صفوفه صيغتها ٤ — فالإصدار الأقدم يقول «حدّث البرنامج»', () => {
    expect(designPackLevel(canvasDoc({ ...canvas, elements: [table({ rowHeights: [1, 1, 1] })] }))).toBe(4);
    expect(designPackLevel(canvasDoc({ ...canvas, elements: [table()] }))).toBe(1);
  });
});
