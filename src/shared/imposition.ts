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
import { sealSvg } from './securitySeal';

/** يرسم الرمز بنوعه — المعاينة والطباعة من هنا وحده. */
export function drawCode(kind: string, value: string): string {
  if (!value) return '';
  if (kind === 'seal') return sealSvg(value);
  return kind === 'qr' ? qrSvg(value) : barcodeSvg(value, { height: 40 });
}

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
        return `<div style="${style}">${drawCode(kind, value)}</div>`;
      } catch {
        return '';
      }
    }
  );
}

/** ورقةٌ في الخطّة: خاناتٌ فيها بطاقاتٌ بأرقامها، أو ورقةٌ فاصلة بين مجموعتين. */
export type SheetLayout =
  | { kind: 'cards'; cells: { slot: number; item: number }[] }
  | { kind: 'separator'; label: string; count: number };

export type SheetOptions = {
  /**
   * أوّلُ خانةٍ فارغة في الورقة الأولى (من ٠): ورقة ملصقاتٍ أو كرتونٍ استُعمل
   * نصفها تُكمَل ولا تُرمى. وتسري على الورقة الأولى وحدها.
   */
  startSlot?: number;
  /**
   * مجموعةُ كلّ بطاقة (الصفّ والشعبة): كلّ مجموعةٍ تبدأ ورقةً جديدة تسبقها
   * ورقةٌ فاصلة باسمها وعددها — فتُسلَّم الرزم للمدرسة مفروزة.
   */
  groupOf?: (item: number) => string | null;
};

/**
 * خطّة الأوراق: أين تقع كلّ بطاقةٍ من `items` (أرقامها في القائمة، بترتيب
 * الطباعة) — وهي ما يُرسم، وما يُعاد منه عند الاستئناف.
 *
 * والمجموعات تُرتَّب متّصلةً بترتيب أوّل ظهورها (ترتيبًا ثابتًا): قائمةٌ خُلطت
 * فيها الشُّعب لا تخرج رزمًا مخلوطة.
 */
export function planSheets(imp: Imposition, items: number[], opts: SheetOptions = {}): SheetLayout[] {
  const { groupOf } = opts;
  let order = items;
  const counts = new Map<string, number>();
  if (groupOf) {
    const first = new Map<string, number>();
    items.forEach((item, k) => {
      const g = groupOf(item) ?? '';
      if (!first.has(g)) first.set(g, k);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    });
    order = [...items].sort((a, b) => first.get(groupOf(a) ?? '')! - first.get(groupOf(b) ?? '')!);
  }

  const out: SheetLayout[] = [];
  let slot = groupOf ? 0 : Math.max(0, Math.min(imp.per - 1, Math.floor(opts.startSlot ?? 0)));
  let cells: { slot: number; item: number }[] = [];
  let group: string | undefined;
  const flush = () => {
    if (cells.length) out.push({ kind: 'cards', cells });
    cells = [];
  };
  for (const item of order) {
    if (groupOf) {
      const g = groupOf(item) ?? '';
      if (g !== group) {
        flush();
        slot = 0;
        out.push({ kind: 'separator', label: g || 'بلا مجموعة', count: counts.get(g) ?? 0 });
        group = g;
      }
    }
    cells.push({ slot, item });
    slot++;
    if (slot >= imp.per) {
      flush();
      slot = 0;
    }
  }
  flush();
  return out;
}

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

const pageDiv = (imp: Imposition, inner: string) =>
  `<div class="print-page" style="position:relative;width:${mm(imp.sheet.w)};height:${mm(imp.sheet.h)};overflow:hidden;background:#fff;break-after:page;page-break-after:always">${inner}</div>`;

/** الورقة الفاصلة: اسم المجموعة وعددها بخطٍّ يُقرأ من بعيد فوق الرزمة. */
function separatorHtml(imp: Imposition, label: string, count: number, unit: string): string {
  return pageDiv(
    imp,
    `<div dir="rtl" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6mm;font-family:'Cairo','IBM Plex Sans Arabic',sans-serif;color:#000">` +
      `<div style="font-size:15mm;font-weight:800;text-align:center;line-height:1.3">${label.replace(/[<>&]/g, '')}</div>` +
      `<div style="font-size:9mm;font-weight:600">${toIndic(count)} ${unit}</div>` +
      `<div style="margin-top:10mm;font-size:4mm;color:#555">ورقةٌ فاصلة — لا تُقصّ</div>` +
      `</div>`
  );
}

/**
 * أوراق الطباعة من خطّتها: كل ورقةٍ `per` خانة، وكل خانةٍ بطاقةُ شخصٍ بقيمه.
 *
 * `card(i)` يرسم البطاقة `i` (بنزفها، عند ٩٦ نقطة/إنش — أي بالملّم الحقيقي في
 * الطباعة). والخانات الفارغة تبقى فارغة لا مكرّرة. و`mirror` لظهر الورقة،
 * وظهرُ الورقة الفاصلة أبيض — فيبقى كلُّ وجهٍ مع ظهره في الطباعة على الوجهين.
 */
export function renderPlan(
  imp: Imposition,
  plan: SheetLayout[],
  card: (i: number) => string,
  opts: { mirror?: boolean; unit?: string } = {}
): string[] {
  return plan.map((sheet) => {
    if (sheet.kind === 'separator') {
      return opts.mirror ? pageDiv(imp, '') : separatorHtml(imp, sheet.label, sheet.count, opts.unit ?? 'بطاقة');
    }
    const cells = sheet.cells.map(({ slot, item }) => {
      const at = cellAt(imp, slot, opts.mirror);
      return `<div style="position:absolute;left:${mm(at.x)};top:${mm(at.y)};width:${mm(imp.cell.w)};height:${mm(imp.cell.h)};overflow:hidden">${inlineBarcodes(card(item))}</div>`;
    });
    return pageDiv(imp, cells.join('') + marks(imp));
  });
}

/** كلّ البطاقات بالترتيب من أوّل خانة — الطريق القديم، وهو خطّةٌ بلا خيارات. */
export function sheetsHtml(
  imp: Imposition,
  count: number,
  card: (i: number) => string,
  opts: { mirror?: boolean } = {}
): string[] {
  return renderPlan(imp, planSheets(imp, Array.from({ length: count }, (_, i) => i)), card, opts);
}

/**
 * يقرأ «٥، ١٢-١٤» أرقامَ بطاقاتٍ (من ١) — لإعادة ما تلف وحده. وما خرج عن
 * القائمة يُهمل، والمكرّر يُطبع مرّة. ويعود `null` لنصٍّ لا يُفهم.
 */
export function parseCardList(text: string, total: number): number[] | null {
  const clean = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
  if (!clean) return null;
  const out = new Set<number>();
  for (const part of clean.split(/[،,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) if (n >= 1 && n <= total) out.add(n - 1);
  }
  return [...out].sort((x, y) => x - y);
}
