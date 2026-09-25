/**
 * الصور الشخصية — قصٌّ بمقاس، وتصفيفٌ على ورقٍ يُقصّ.
 *
 * طلبٌ يوميٌّ في المكتب: صورةٌ من هاتف الزبون تُقصّ على وجهه بمقاس ٣×٤ أو غيره،
 * وتُطبع ستّ نسخٍ على ورق صورٍ ١٠×١٥ أو ثلاثون على A4. والحساب كلّه هنا خالصًا
 * بالملّم: موضع الصورة في إطارها، وكم إطارًا في الورقة وأين — فيُختبر بالأرقام،
 * وتُرسم المعاينة والطباعة من الحساب نفسه.
 */

export type Size = { w: number; h: number };

export const PHOTO_SIZES: { key: string; label: string; size: Size }[] = [
  { key: '2x3', label: '٢ × ٣ سم', size: { w: 20, h: 30 } },
  { key: '3x4', label: '٣ × ٤ سم', size: { w: 30, h: 40 } },
  { key: '35x45', label: '٣٫٥ × ٤٫٥ سم', size: { w: 35, h: 45 } },
  { key: '4x6', label: '٤ × ٦ سم', size: { w: 40, h: 60 } }
];

export const PAPERS: { key: string; label: string; size: Size }[] = [
  { key: 'photo', label: 'ورق صور ١٠ × ١٥', size: { w: 101.6, h: 152.4 } },
  { key: 'a4', label: 'A4', size: { w: 210, h: 297 } }
];

/**
 * القصّ: `zoom` تكبيرٌ فوق «الملء» (١ = الصورة تملأ الإطار بالكاد)، و`x` و`y`
 * مركز الإطار نسبةً من الصورة (٠..١). بالنِّسَب لا بالبكسل — فالإطار نفسه يُرسم
 * على الشاشة بالبكسل وعلى الورق بالملّم فيتطابقان.
 */
export type Crop = { zoom: number; x: number; y: number };

export const CENTER: Crop = { zoom: 1, x: 0.5, y: 0.5 };

/**
 * موضع الصورة داخل إطارها — بوحدة الإطار أيًّا كانت.
 *
 * والمركز يُحصر فلا يظهر فراغٌ أبيض عند حافّة الإطار: الصورة تغطّيه دائمًا.
 */
export function cropBox(frame: Size, natural: Size, crop: Crop): { left: number; top: number; width: number; height: number; x: number; y: number } {
  const zoom = Math.max(1, Math.min(6, crop.zoom || 1));
  const scale = Math.max(frame.w / natural.w, frame.h / natural.h) * zoom;
  const width = natural.w * scale;
  const height = natural.h * scale;
  const clamp = (v: number, half: number) => Math.min(1 - half, Math.max(half, v));
  const x = clamp(crop.x, frame.w / (2 * width));
  const y = clamp(crop.y, frame.h / (2 * height));
  return { left: frame.w / 2 - x * width, top: frame.h / 2 - y * height, width, height, x, y };
}

export type PhotoLayout = { cols: number; rows: number; per: number; cells: { x: number; y: number }[] };

/**
 * كم صورةً في الورقة وأين: هامشٌ للطابعة، وفجوةٌ بين الصور يمرّ فيها المقصّ.
 * والشبكة في وسط الورقة — والخانات من اليمين كما يُقرأ العربي.
 */
export function photoLayout(paper: Size, photo: Size, gap = 2, margin = 5): PhotoLayout {
  const cols = Math.max(0, Math.floor((paper.w - 2 * margin + gap + 0.01) / (photo.w + gap)));
  const rows = Math.max(0, Math.floor((paper.h - 2 * margin + gap + 0.01) / (photo.h + gap)));
  const gridW = cols * photo.w + (cols - 1) * gap;
  const gridH = rows * photo.h + (rows - 1) * gap;
  const x0 = (paper.w - gridW) / 2;
  const y0 = (paper.h - gridH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push({ x: x0 + (cols - 1 - c) * (photo.w + gap), y: y0 + r * (photo.h + gap) });
  return { cols, rows, per: cols * rows, cells };
}

export type PhotoSheet = {
  src: string;
  natural: Size;
  crop: Crop;
  photo: Size;
  paper: Size;
  count: number;
  /** سطوعٌ وتباين (١ = كما هي) — صور الهواتف في الغرف معتمةٌ غالبًا. */
  brightness?: number;
  contrast?: number;
};

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

/**
 * أوراق الطباعة بالملّم الحقيقي. وحول كل صورةٍ خطٌّ رماديٌّ رفيع خارجها يدلّ
 * المقصّ، والنسخ تتوزّع على ما يلزم من أوراق.
 */
export function photoSheetsHtml(sheet: PhotoSheet, url: (src: string) => string): string[] {
  const layout = photoLayout(sheet.paper, sheet.photo);
  if (!layout.per) return [];
  const box = cropBox(sheet.photo, sheet.natural, sheet.crop);
  const filter = `brightness(${sheet.brightness ?? 1}) contrast(${sheet.contrast ?? 1})`;
  const cell = (x: number, y: number) =>
    `<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(sheet.photo.w)};height:${mm(sheet.photo.h)};overflow:hidden;outline:0.1mm solid #bbb;outline-offset:0.4mm">` +
    `<img alt="" src="${url(sheet.src)}" style="position:absolute;left:${mm(box.left)};top:${mm(box.top)};width:${mm(box.width)};height:${mm(box.height)};max-width:none;filter:${filter}"/></div>`;
  const pages: string[] = [];
  for (let start = 0; start < Math.max(1, sheet.count); start += layout.per) {
    const n = Math.min(layout.per, sheet.count - start);
    pages.push(
      `<div class="print-page" style="position:relative;width:${mm(sheet.paper.w)};height:${mm(sheet.paper.h)};overflow:hidden;background:#fff;break-after:page;page-break-after:always">` +
        layout.cells
          .slice(0, n)
          .map((c) => cell(c.x, c.y))
          .join('') +
        `</div>`
    );
  }
  return pages;
}
