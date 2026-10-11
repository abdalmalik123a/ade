/**
 * عرض أعمدة الجدول وارتفاع صفوفه في التصاميم (محادثة «التصاميم»، البند ٢) — بالسحب على اللوحة أو برقمٍ في لوحه، وكلاهما
 * يتقاسم بين جارين فلا يتغيّر صندوق الجدول (`shared/shares.ts`). وكانت الأعمدة بعرضها يوم صُنعت (والعمود الجديد ٢٠٪ أبدًا
 * فيتجاوز المجموع مئة)، والصفوف تتقاسم الارتفاع بالتساوي ولا يُغيَّر شيءٌ منها.
 */
import { dragShare } from '../shares';
import type { Canvas, TableElement } from './model/types';

type Size = Pick<Canvas, 'size'>;

/** أضيق ما يصير إليه عمودٌ أو صفٌّ بالسحب أو بالرقم: ٤٪ من الجدول — ولجدولٍ كثير الصفوف (ثلاثون يومًا) نصف متوسّطها. */
export const minShare = (count: number): number => Math.min(0.04, 0.5 / Math.max(1, count));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 1);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** أوزانٌ مجموعها مئة. */
const toHundred = (xs: number[]) => {
  const total = sum(xs) || 1;
  return xs.map((x) => (x * 100) / total);
};

/** صفوف الجدول الظاهرة: العناوين إن ظهرت، ثم الصفوف. */
export const visibleRows = (el: TableElement): number => el.rows.length + (el.hideHeader ? 0 : 1);

/** أوزان الصفوف الظاهرة بترتيبها — العناوين أوّلًا إن ظهرت — أو لا أوزان: صفوفٌ تتقاسم الارتفاع بلا ضبط. */
export function rowWeights(el: TableElement): number[] | null {
  if (!el.rowHeights) return null;
  return el.hideHeader ? [...el.rowHeights] : [el.headerHeight ?? avg(el.rowHeights), ...el.rowHeights];
}

/** أوزان الصفوف الظاهرة تُكتب في الجدول: وزن العناوين ووزن كلّ صفّ. */
export function withRowWeights(el: TableElement, weights: number[]): Pick<TableElement, 'rowHeights' | 'headerHeight'> {
  const w = weights.map(round2);
  return el.hideHeader ? { rowHeights: w, headerHeight: el.headerHeight } : { headerHeight: w[0], rowHeights: w.slice(1) };
}

/** ارتفاع كلّ صفٍّ ظاهرٍ في صندوقٍ بهذا الارتفاع — للرسم — أو لا شيء بلا أوزان. */
export function rowPixels(el: TableElement, boxPx: number): number[] | null {
  const w = rowWeights(el);
  if (!w) return null;
  const total = sum(w) || 1;
  return w.map((x) => (boxPx * x) / total);
}

/** عرض الأعمدة بالملّم في هذا التصميم. */
export function columnsMm(el: TableElement, canvas: Size): number[] {
  const width = el.box.w * canvas.size.w;
  return toHundred(el.columns.map((c) => c.widthPercent)).map((p) => (width * p) / 100);
}

/** ارتفاع الصفوف الظاهرة بالملّم — وبلا أوزانٍ تتقاسمه بالتساوي. */
export function rowsMm(el: TableElement, canvas: Size): number[] {
  const height = el.box.h * canvas.size.h;
  return toHundred(rowWeights(el) ?? Array<number>(visibleRows(el)).fill(1)).map((p) => (height * p) / 100);
}

/** جزءٌ يصير بهذه الحصّة من مجموعه: يأخذ من جاره التالي — أو السابق إن كان الأخير — كما يُسحب الحدّ بينهما. */
function resizePart(weights: number[], index: number, share: number): number[] {
  const w = toHundred(weights);
  if (w.length < 2 || index < 0 || index >= w.length) return w;
  const gain = Math.max(0, share) - w[index]! / 100;
  const min = minShare(w.length);
  return index < w.length - 1 ? dragShare(w, index + 1, gain, min) : dragShare(w, index, -gain, min);
}

/** عرض عمودٍ بالملّم — من جاره، فلا يتغيّر عرض الجدول. */
export function setColumnMm(el: TableElement, canvas: Size, index: number, mm: number): Pick<TableElement, 'columns'> {
  const width = el.box.w * canvas.size.w || 1;
  const next = resizePart(el.columns.map((c) => c.widthPercent), index, mm / width);
  return { columns: el.columns.map((c, i) => ({ ...c, widthPercent: round2(next[i]!) })) };
}

/** ارتفاع صفٍّ ظاهرٍ بالملّم — من جاره كذلك؛ والجدول بلا أوزانٍ يبدأ بصفوفٍ متساوية. */
export function setRowMm(el: TableElement, canvas: Size, index: number, mm: number): Pick<TableElement, 'rowHeights' | 'headerHeight'> {
  const height = el.box.h * canvas.size.h || 1;
  return withRowWeights(el, resizePart(rowWeights(el) ?? Array<number>(visibleRows(el)).fill(1), index, mm / height));
}

/** عمودٌ جديد بعرض متوسّط الأعمدة، والبقيّة تفسح له بنسبتها — فمجموعها مئة. */
export function withColumnAdded(el: TableElement): Pick<TableElement, 'columns' | 'rows'> {
  const n = el.columns.length;
  const kept = toHundred(el.columns.map((c) => c.widthPercent)).map((p) => (p * n) / (n + 1));
  return {
    columns: [...el.columns.map((c, i) => ({ ...c, widthPercent: round2(kept[i]!) })), { title: 'عمود', widthPercent: round2(100 / (n + 1)), align: 'center' }],
    rows: el.rows.map((r) => [...r, { text: '' }])
  };
}

/** آخر عمودٍ يُحذف، وما بقي يتّسع لمكانه بنسبته. */
export function withColumnRemoved(el: TableElement): Pick<TableElement, 'columns' | 'rows'> {
  const columns = el.columns.slice(0, -1);
  const w = toHundred(columns.map((c) => c.widthPercent));
  return { columns: columns.map((c, i) => ({ ...c, widthPercent: round2(w[i]!) })), rows: el.rows.map((r) => r.slice(0, -1)) };
}

/** صفٌّ جديد — بوزن متوسّط الصفوف إن كانت لها أوزان. */
export function withRowAdded(el: TableElement): Pick<TableElement, 'rows' | 'rowHeights'> {
  return {
    rows: [...el.rows, el.columns.map(() => ({ text: '' }))],
    ...(el.rowHeights ? { rowHeights: [...el.rowHeights, round2(avg(el.rowHeights))] } : {})
  };
}

/** آخر صفٍّ يُحذف، ووزنه ولونه معه. */
export function withRowRemoved(el: TableElement): Pick<TableElement, 'rows' | 'rowHeights' | 'rowStyles'> {
  const n = el.rows.length - 1;
  return {
    rows: el.rows.slice(0, -1),
    ...(el.rowHeights ? { rowHeights: el.rowHeights.slice(0, n) } : {}),
    ...(el.rowStyles ? { rowStyles: el.rowStyles.slice(0, n) } : {})
  };
}
