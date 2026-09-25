/**
 * الترتيب على الورق — كم بطاقةً في الورقة، وأين، وأين يُقصّ.
 *
 * المكتب لا يطبع هويةً واحدة على A4: يطبع عشرًا ويقصّ. فالهويات والملصقات
 * والبطاقات الامتحانية تُصفّ على ورقة A4 (عموديّة أو أفقيّة — أيّهما أوسع لها)،
 * **كلُّ خانةٍ لشخص** من القائمة، وخارج الشبكة علاماتُ قصٍّ عند كل حافّة.
 *
 * والوحدة الملّم. والبطاقة في خانتها بنزفها كاملًا: الخانات متلاصقة، فبين
 * حافّتي قصٍّ متجاورتين نزفان — قصّتان بالمقصلة، لا قصّةٌ تأكل من البطاقتين.
 */
import type { CanvasSize } from './canvas';
import { barcodeSvg } from './barcode';
import { qrSvg } from './qr';

export type Imposition = {
  sheet: CanvasSize;
  cols: number;
  rows: number;
  per: number;
  /** الخانة: البطاقة ونزفها. */
  cell: CanvasSize;
  /** ركن الشبكة الأيسر الأعلى. */
  origin: { x: number; y: number };
  bleed: number;
  trim: CanvasSize;
  /** ورقةٌ بمقاس التصميم نفسه (شهادة A4): لا شبكة ولا علامات. */
  single: boolean;
};

const A4P: CanvasSize = { w: 210, h: 297 };
const A4L: CanvasSize = { w: 297, h: 210 };

/** هامش الطابعة: أكثر الطابعات لا تطبع أقرب من ٥ ملم — و٧ تترك للعلامات مكانًا. */
export const PRINT_MARGIN = 7;

export function impose(trim: CanvasSize, bleed: number, margin = PRINT_MARGIN): Imposition {
  const cell = { w: trim.w + 2 * bleed, h: trim.h + 2 * bleed };
  let best: Imposition | null = null;
  for (const sheet of [A4P, A4L]) {
    const cols = Math.floor((sheet.w - 2 * margin + 0.01) / cell.w);
    const rows = Math.floor((sheet.h - 2 * margin + 0.01) / cell.h);
    const per = cols * rows;
    // الأكثر خاناتٍ يفوز، وعند التساوي العموديّة — فهي ما تحمله الطابعة افتراضًا.
    if (per > 0 && (!best || per > best.per)) {
      best = {
        sheet,
        cols,
        rows,
        per,
        cell,
        origin: { x: (sheet.w - cols * cell.w) / 2, y: (sheet.h - rows * cell.h) / 2 },
        bleed,
        trim,
        single: false
      };
    }
  }
  // أكبر من أن تُصفّ (شهادة A4 أو لوحة شرف A3): ورقةٌ بمقاسها، تصميمٌ واحد.
  return (
    best ?? { sheet: cell, cols: 1, rows: 1, per: 1, cell, origin: { x: 0, y: 0 }, bleed, trim, single: true }
  );
}

/**
 * موضع الخانة `i` في الورقة — من اليمين إلى اليسار ثم نزولًا، كما يُقرأ العربي.
 *
 * و`mirror` لظهر الورقة: الورقة تُقلب يمينًا ويسارًا، فالبطاقة التي في أقصى يمين
 * الوجه يقع ظهرها في أقصى يسار الظهر — فتُعكس الأعمدة وتبقى الصفوف.
 */
export function cellAt(imp: Imposition, i: number, mirror = false): { x: number; y: number } {
  const col = i % imp.cols;
  const row = Math.floor(i / imp.cols) % imp.rows;
  return {
    x: imp.origin.x + (mirror ? col : imp.cols - 1 - col) * imp.cell.w,
    y: imp.origin.y + row * imp.cell.h
  };
}

export const sheetCount = (imp: Imposition, cards: number): number => Math.max(1, Math.ceil(cards / imp.per));

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

/** علامات القصّ خارج الشبكة، عند كل حافّة قصٍّ لكل عمودٍ وصفّ. */
function marks(imp: Imposition): string {
  if (imp.single) return '';
  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 0; c < imp.cols; c++) {
    const x = imp.origin.x + c * imp.cell.w + imp.bleed;
    xs.push(x, x + imp.trim.w);
  }
  for (let r = 0; r < imp.rows; r++) {
    const y = imp.origin.y + r * imp.cell.h + imp.bleed;
    ys.push(y, y + imp.trim.h);
  }
  const top = imp.origin.y;
  const bottom = imp.origin.y + imp.rows * imp.cell.h;
  const left = imp.origin.x;
  const right = imp.origin.x + imp.cols * imp.cell.w;
  const len = Math.min(5, imp.origin.y - 1, imp.origin.x - 1);
  if (len <= 0.5) return '';
  const line = (x: number, y: number, w: number, h: number) =>
    `<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)};background:#000"></div>`;
  const out: string[] = [];
  for (const x of xs) {
    out.push(line(x - 0.1, top - len - 1, 0.2, len));
    out.push(line(x - 0.1, bottom + 1, 0.2, len));
  }
  for (const y of ys) {
    out.push(line(left - len - 1, y - 0.1, len, 0.2));
    out.push(line(right + 1, y - 0.1, len, 0.2));
  }
  return out.join('');
}

/**
 * الباركود مرسومًا في علامات الطباعة — لا مُؤجَّلًا إلى المتصفّح.
 *
 * رسّام اللوحة يترك موضع الرمز وقيمته فقط (`data-barcode`)؛ والورقة المطبوعة
 * لا يجري فيها كود الشاشة، فيُرسم الرمز هنا قبل أن تُرسَل.
 */
export function inlineBarcodes(html: string): string {
  return html.replace(
    /<div data-barcode="([^"]*)" data-value="([^"]*)" style="([^"]*)"><\/div>/g,
    (_all, kind: string, value: string, style: string) => {
      if (!value) return '';
      try {
        const svg = kind === 'qr' ? qrSvg(value) : barcodeSvg(value, { height: 40 });
        return `<div style="${style}">${svg}</div>`;
      } catch {
        return '';
      }
    }
  );
}

/**
 * أوراق الطباعة: كل ورقةٍ `per` خانة، وكل خانةٍ بطاقةُ شخصٍ بقيمه.
 *
 * `card(i)` يرسم البطاقة `i` (بنزفها، عند ٩٦ نقطة/إنش — أي بالملّم الحقيقي في
 * الطباعة). والورقة الأخيرة تُترك خاناتها الزائدة فارغة لا مكرّرة.
 */
export function sheetsHtml(
  imp: Imposition,
  count: number,
  card: (i: number) => string,
  opts: { mirror?: boolean } = {}
): string[] {
  const pages: string[] = [];
  for (let start = 0; start < count; start += imp.per) {
    const cells: string[] = [];
    for (let i = start; i < Math.min(count, start + imp.per); i++) {
      const at = cellAt(imp, i - start, opts.mirror);
      cells.push(
        `<div style="position:absolute;left:${mm(at.x)};top:${mm(at.y)};width:${mm(imp.cell.w)};height:${mm(imp.cell.h)};overflow:hidden">${inlineBarcodes(card(i))}</div>`
      );
    }
    pages.push(
      `<div class="print-page" style="position:relative;width:${mm(imp.sheet.w)};height:${mm(imp.sheet.h)};overflow:hidden;background:#fff;break-after:page;page-break-after:always">${cells.join('')}${marks(imp)}</div>`
    );
  }
  return pages;
}
