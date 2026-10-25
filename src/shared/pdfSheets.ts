/**
 * صفحاتٌ في ورقة (S27، D178) — كما في PDF24: ٢ أو ٤ أو ٦ أو ٨ أو ٩ أو ١٢ أو ١٦ صفحةً على ورقة A4، للملازم وتوفير الورق.
 *
 * الشبكة من أزواج قواسم العدد وباتّجاه الورقة (عموديّةً أو أفقيّة) **التي تكبّر الصفحة أكثر**: صفحاتٌ عموديّة على ٢ ← أفقيّة ٢×١، و٤ ← عموديّة
 * ٢×٢، و٦ ← أفقيّة ٣×٢، و٨ ← أفقيّة ٤×٢، و٩ و١٢ و١٦ ← عموديّة ٣×٣ و٣×٤ و٤×٤. **والترتيب من اليمين** ثمّ إلى أسفل (كتابٌ عربيّ)، بهامش ٥ ملم وفراغ ٣.
 * وكلّ صفحةٍ في خانتها بنسبتها كما تُرى (بدورانها) وسطها. حسابٌ خالص بالنقاط (الأصل أسفل الورقة يسارًا كما في PDF)؛ والرسم في `main/services/pdfSheets.ts`،
 * والمعاينة في الواجهة من هذا الحساب نفسه.
 */
import { mmToPt, type Rotation } from './pdfEdit';

export const SHEET_COUNTS = [1, 2, 4, 6, 8, 9, 12, 16] as const;

export const A4 = { w: mmToPt(210), h: mmToPt(297) };
const MARGIN = mmToPt(5);
const GAP = mmToPt(3);

type Size = { w: number; h: number };
export type Cell = { x: number; y: number; w: number; h: number };
export type SheetLayout = { sheet: Size; cols: number; rows: number; cells: Cell[] };

/** الورقة وشبكتها وخاناتها لـ`n` صفحةٍ بمقاس `page` (كما تُرى) — والخانة الأولى أعلى اليمين. */
export function sheetLayout(n: number, page: Size, paper: Size = A4): SheetLayout {
  let best: { sheet: Size; cols: number; rows: number; scale: number } | null = null;
  for (const sheet of [paper, { w: paper.h, h: paper.w }]) {
    for (let cols = 1; cols <= n; cols++) {
      if (n % cols) continue;
      const rows = n / cols;
      const cw = (sheet.w - 2 * MARGIN - (cols - 1) * GAP) / cols;
      const ch = (sheet.h - 2 * MARGIN - (rows - 1) * GAP) / rows;
      const scale = Math.min(cw / page.w, ch / page.h);
      // والتعادل للعموديّة ولأقلّ الأعمدة: الأوّل يبقى.
      if (!best || scale > best.scale + 1e-9) best = { sheet, cols, rows, scale };
    }
  }
  const { sheet, cols, rows } = best!;
  const cw = (sheet.w - 2 * MARGIN - (cols - 1) * GAP) / cols;
  const ch = (sheet.h - 2 * MARGIN - (rows - 1) * GAP) / rows;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ x: sheet.w - MARGIN - (c + 1) * cw - c * GAP, y: sheet.h - MARGIN - (r + 1) * ch - r * GAP, w: cw, h: ch });
  return { sheet, cols, rows, cells };
}

/** عدد الأوراق لـ`pages` صفحةً و`n` في كلّ ورقة. */
export const sheetsCount = (pages: number, n: number): number => Math.ceil(pages / Math.max(1, n));

/**
 * أين تُرسم الصفحة في خانتها: صفحةٌ مقاسها في ملفّها `size` (بلا دوران) ودورانها `rotation` (مع عقارب الساعة كـ`/Rotate`) تُرسم كما تُرى، بنسبتها
 * وسط الخانة — نقطة الرسم ومقياسه ودورانه بعكس عقارب الساعة كما يأخذه `drawPage` في pdf-lib (حول نقطة الرسم).
 */
export function placeInCell(cell: Cell, size: Size, rotation: Rotation): { x: number; y: number; scale: number; rotate: number } {
  const shown = rotation % 180 ? { w: size.h, h: size.w } : size;
  const scale = Math.min(cell.w / shown.w, cell.h / shown.h);
  // أسفل يسار الصفحة كما تُرى وسط الخانة.
  const x = cell.x + (cell.w - shown.w * scale) / 2;
  const y = cell.y + (cell.h - shown.h * scale) / 2;
  switch (rotation) {
    case 90:
      return { x, y: y + size.w * scale, scale, rotate: -90 };
    case 180:
      return { x: x + size.w * scale, y: y + size.h * scale, scale, rotate: 180 };
    case 270:
      return { x: x + size.h * scale, y, scale, rotate: 90 };
    default:
      return { x, y, scale, rotate: 0 };
  }
}
