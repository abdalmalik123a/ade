/**
 * محرّر PDF (خدمات التقديم الإلكتروني — المرحلة الأولى): النموذج والحساب، خالصًا بلا Electron.
 *
 * الملف يُفتح صفحاتٍ مرتّبة، لكلٍّ مصدرُها ودورانها وقصّها؛ وفوقها طبقاتٌ تُضاف — نصٌّ
 * وشعارٌ وعلامة مائية — بمواضع نسبيةٍ من الصفحة **كما تُرى** (بعد الدوران والقصّ). والحفظ
 * يكتب ملفًّا جديدًا دائمًا: الأصل يبقى كما وصل (قرار المالك).
 */

export type Rotation = 0 | 90 | 180 | 270;

/** صندوقٌ نسبيّ في الصفحة كما تُرى: من أعلاها يمينًا ويسارًا — ٠..١. */
export type FracBox = { x: number; y: number; w: number; h: number };

/** صندوقٌ بنقاط PDF في فضاء الصفحة الأصلي (الأصل أسفلها يسارًا). */
export type PtBox = { x: number; y: number; width: number; height: number };

export type PdfSourceKind = 'pdf' | 'image';

/** صفحةٌ في الملف الناتج: من أيّ مصدر، وأيّ صفحةٍ منه، وكيف تُدار وتُقصّ. */
export type PageRef = {
  id: string;
  source: string;
  /** رقم الصفحة في مصدرها من ٠ — والصورة صفحةٌ واحدة. */
  index: number;
  /** دورانٌ يضيفه الموظف فوق دوران الصفحة في ملفّها. */
  rotate: Rotation;
  /** القصّ نسبيًّا من الصفحة كما تُرى قبله. */
  crop?: FracBox;
};

type OverlayBase = {
  id: string;
  box: FracBox;
  /** الصفحات التي يُختم عليها: كلّها، أو بمعرّفاتها. */
  pages: 'all' | string[];
  /** ٠..١ */
  opacity: number;
  /** ميلٌ بالدرجات — العلامة المائية مائلة. */
  angle: number;
};

export type TextOverlay = OverlayBase & {
  kind: 'text';
  text: string;
  font: string;
  /** بالنقطة. */
  size: number;
  color: string;
  bold: boolean;
  align: 'right' | 'center' | 'left';
};

export type ImageOverlay = OverlayBase & {
  kind: 'image';
  /** مسارٌ في المخزن (`diwan://store/…`). */
  src: string;
};

export type Overlay = TextOverlay | ImageOverlay;

export type PdfPlan = { pages: PageRef[]; overlays: Overlay[] };

/** الخطوط التي تُعرض — من خطوط ويندوز؛ وما غاب عن جهازٍ يُبدَّل بما يقاربه. */
export const PDF_FONTS = ['Arial', 'Tahoma', 'Simplified Arabic', 'Traditional Arabic', 'Sakkal Majalla', 'Arabic Typesetting'] as const;

const PT_PER_MM = 72 / 25.4;
export const ptToMm = (pt: number) => pt / PT_PER_MM;
export const mmToPt = (mm: number) => mm * PT_PER_MM;

/**
 * «1-3، 5، 8-» صفحاتٌ بأرقامها من ١ — كما يكتبها الموظف. والعربية والفاصلة العربية
 * والمسافات تُقبل، وما خرج عن الملف يُترك. ويعود بفهارس من ٠ بترتيب ما كُتب بلا تكرار.
 */
export function parseRanges(text: string, count: number): number[] {
  const digits = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
  const out: number[] = [];
  for (const part of digits.split(/[,،\s]+/).filter(Boolean)) {
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part);
    let from: number;
    let to: number;
    if (m) {
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : count;
    } else if (/^\d+$/.test(part)) {
      from = to = Number(part);
    } else continue;
    const step = from <= to ? 1 : -1;
    for (let n = from; step > 0 ? n <= to : n >= to; n += step) {
      if (n >= 1 && n <= count && !out.includes(n - 1)) out.push(n - 1);
    }
  }
  return out;
}

/** الدوران الكلّي: ما في الملف وما أضافه الموظف. */
export const totalRotation = (base: number, extra: number): Rotation => ((((base + extra) % 360) + 360) % 360) as Rotation;

/** مقاس الصفحة كما تُرى: عرضها وارتفاعها بعد الدوران. */
export function shownSize(box: { width: number; height: number }, rotation: Rotation): { w: number; h: number } {
  return rotation % 180 ? { w: box.height, h: box.width } : { w: box.width, h: box.height };
}

/**
 * نقطةٌ من الصفحة كما تُرى (u يمينًا، v نزولًا، ٠..١) إلى فضاء الصفحة الأصلي.
 *
 * و`/Rotate 90` في PDF يدير الصفحة مع عقارب الساعة عند العرض: حافّتها اليسرى تصير أعلاها،
 * فأسفلها الأيسر يصير أعلاها الأيسر.
 */
export function shownToUser(box: PtBox, rotation: Rotation, u: number, v: number): { x: number; y: number } {
  const { x, y, width: w, height: h } = box;
  switch (rotation) {
    case 90:
      return { x: x + v * w, y: y + u * h };
    case 180:
      return { x: x + (1 - u) * w, y: y + v * h };
    case 270:
      return { x: x + (1 - v) * w, y: y + (1 - u) * h };
    default:
      return { x: x + u * w, y: y + (1 - v) * h };
  }
}

/** عكس `shownToUser`: نقطةٌ من فضاء الصفحة الأصلي إلى الصفحة كما تُرى (u يمينًا، v نزولًا). */
export function userToShown(box: PtBox, rotation: Rotation, x: number, y: number): { u: number; v: number } {
  const a = (x - box.x) / box.width;
  const b = (y - box.y) / box.height;
  switch (rotation) {
    case 90:
      return { u: b, v: a };
    case 180:
      return { u: 1 - a, v: b };
    case 270:
      return { u: 1 - b, v: 1 - a };
    default:
      return { u: a, v: 1 - b };
  }
}

/** حقلٌ في استمارة PDF قابلةٍ للتعبئة — بموضعه في صفحته (فضاء الصفحة الأصلي). */
export type FormFieldInfo = {
  name: string;
  kind: 'text' | 'choice' | 'check';
  /** رقم الصفحة في ملفّها من ٠. */
  page: number;
  rect: PtBox;
  /** ما فيه من قبل — يبقى كما هو في الملف الناتج. */
  value: string;
};

/** صندوق الحقل نسبيًّا من الصفحة كما تُرى — فيصير طبقة نصٍّ في موضعه. */
export function fieldBox(pageBox: PtBox, rotation: Rotation, rect: PtBox): FracBox {
  const a = userToShown(pageBox, rotation, rect.x, rect.y);
  const b = userToShown(pageBox, rotation, rect.x + rect.width, rect.y + rect.height);
  const x = Math.min(a.u, b.u);
  const y = Math.min(a.v, b.v);
  return { x, y, w: Math.abs(a.u - b.u), h: Math.abs(a.v - b.v) };
}

/** القصّ النسبيّ (كما يُرى) صندوقًا بنقاط الصفحة الأصلية — ما يُكتب في CropBox. */
export function cropToUser(box: PtBox, rotation: Rotation, crop: FracBox): PtBox {
  const a = shownToUser(box, rotation, crop.x, crop.y);
  const b = shownToUser(box, rotation, crop.x + crop.w, crop.y + crop.h);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/**
 * أين تُختم الطبقة: الطبقة صفحةٌ بمقاس ما يُرى، وتُرسم في فضاء الصفحة الأصلي مدارةً
 * عكس دورانها — فتُرى مستقيمةً فوقها. والدوران في مكتبة PDF حول الزاوية التي تُرسم منها،
 * عكس عقارب الساعة.
 */
export function stampPlacement(box: PtBox, rotation: Rotation): { x: number; y: number; rotate: Rotation } {
  const { x, y, width: w, height: h } = box;
  switch (rotation) {
    case 90:
      return { x: x + w, y, rotate: 90 };
    case 180:
      return { x: x + w, y: y + h, rotate: 180 };
    case 270:
      return { x, y: y + h, rotate: 270 };
    default:
      return { x, y, rotate: 0 };
  }
}

/**
 * الصورة صفحةً: A4 باتجاهها (عموديةً للطويلة وأفقيةً للعريضة)، والصورة في وسطها بهامش
 * ١٠ ملم لا تُمطّ. ومنها تُرسم المعاينة ويُبنى الملف — فلا يختلفان.
 *
 * وما جاء من الماسح بدقّته (`dpi`) صفحةٌ بمقاسه الحقيقي كاملةً بلا هامش: ورقة A4 ممسوحة
 * تبقى A4، لا تُصغَّر داخل A4 أخرى.
 */
export function imagePage(img: { width: number; height: number; dpi?: number }): { page: { width: number; height: number }; draw: PtBox } {
  if (img.dpi) {
    const page = { width: (img.width / img.dpi) * 72, height: (img.height / img.dpi) * 72 };
    return { page, draw: { x: 0, y: 0, ...page } };
  }
  const landscape = img.width > img.height;
  const page = landscape ? { width: mmToPt(297), height: mmToPt(210) } : { width: mmToPt(210), height: mmToPt(297) };
  const m = mmToPt(10);
  const scale = Math.min((page.width - 2 * m) / img.width, (page.height - 2 * m) / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { page, draw: { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height } };
}

/** الطبقات التي تُختم على صفحةٍ بعينها. */
export const overlaysFor = (plan: PdfPlan, pageId: string): Overlay[] =>
  plan.overlays.filter((o) => o.pages === 'all' || o.pages.includes(pageId));

/** علامة مائية: كبيرةٌ في وسط الصفحة مائلة، على الصفحات كلّها. */
export function watermarkText(id: string, text: string): TextOverlay {
  return {
    id,
    kind: 'text',
    text,
    font: 'Arial',
    size: 54,
    color: '#b3261e',
    bold: true,
    align: 'center',
    opacity: 0.16,
    angle: -30,
    box: { x: 0.05, y: 0.4, w: 0.9, h: 0.2 },
    pages: 'all'
  };
}

/**
 * ترقيم الصفحات: «{رقم}» و«{عدد}» في نصّ الطبقة يصيران رقمَ الصفحة وعددَ الصفحات
 * بالأرقام العربية (٣)، و«{n}» و«{N}» باللاتينية (3) — فالطبقة الواحدة على الصفحات كلّها
 * تُرى في كلّ صفحةٍ برقمها.
 */
export function pageTokens(text: string, n: number, total: number): string {
  const indic = (v: number) => String(v).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
  return text.replace(/\{رقم\}/g, indic(n)).replace(/\{عدد\}/g, indic(total)).replace(/\{n\}/g, String(n)).replace(/\{N\}/g, String(total));
}

/** رقم الصفحة أسفلها في الوسط، على الصفحات كلّها. */
export function numberingText(id: string): TextOverlay {
  return {
    id,
    kind: 'text',
    text: 'صفحة {رقم} من {عدد}',
    font: 'Arial',
    size: 11,
    color: '#000000',
    bold: false,
    align: 'center',
    opacity: 1,
    angle: 0,
    box: { x: 0.3, y: 0.94, w: 0.4, h: 0.035 },
    pages: 'all'
  };
}

// ── الحجم للرفع ──────────────────────────────────────────────────────────
//
// خانات الرفع في منصّة أور (١٨٦٣ خانة في ٣٣٢ استمارة، أيلول ٢٠٢٦) لكلٍّ حدٌّ: ٥ ميغا أكثرها،
// ثم ٢ و٣ و١، وقليلٌ دون الميغا حتى ١٠٠ ك.ب. والحدّ هنا بالعشري (الميغا مليون بايت) — أصغر
// الحسابين، فيقبله الموقع أيًّا كان حسابه.

const KB = 1000;
const MB = 1000 * KB;

export const SIZE_LIMITS: readonly { bytes: number; label: string }[] = [
  { bytes: 0, label: 'بلا حدّ' },
  { bytes: 5 * MB, label: '٥ ميغا' },
  { bytes: 3 * MB, label: '٣ ميغا' },
  { bytes: 2 * MB, label: '٢ ميغا' },
  { bytes: 1 * MB, label: '١ ميغا' },
  { bytes: 500 * KB, label: '٥٠٠ ك.ب' },
  { bytes: 200 * KB, label: '٢٠٠ ك.ب' },
  { bytes: 100 * KB, label: '١٠٠ ك.ب' }
];

/** «٨٤٠ ك.ب»، «١٫٢ ميغا» — حجمٌ يقرؤه الموظف. */
export function sizeText(bytes: number): string {
  const indic = (s: string) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!).replace('.', '٫');
  if (bytes >= MB) return `${indic((Math.round(bytes / (MB / 10)) / 10).toString())} ميغا`;
  return `${indic(Math.max(1, Math.round(bytes / KB)).toString())} ك.ب`;
}

export type RasterStep = { dpi: number; quality: number };

/**
 * درجات تصغير الملف صورًا — من الأجود إلى الأصغر. ١٥٠ نقطة تُقرأ وتُطبع، و٥٠ آخر ما يُقرأ
 * فيه نصّ مستمسك.
 */
export const RASTER_STEPS: readonly RasterStep[] = [
  { dpi: 150, quality: 0.85 },
  { dpi: 150, quality: 0.7 },
  { dpi: 120, quality: 0.7 },
  { dpi: 120, quality: 0.55 },
  { dpi: 100, quality: 0.55 },
  { dpi: 100, quality: 0.45 },
  { dpi: 85, quality: 0.45 },
  { dpi: 72, quality: 0.45 },
  { dpi: 72, quality: 0.35 },
  { dpi: 60, quality: 0.35 },
  { dpi: 50, quality: 0.3 }
];

/**
 * درجات تصغير صور الملف **ونصّه باقٍ** — تُجرَّب قبل أن تصير الصفحات صورًا: كتابٌ فيه صورة
 * مستمسكٍ كبيرة يبلغ الحدّ بتصغيرها وحدها، ونصّه يبقى يُحدَّد ويُنسخ. والنسبة من أبعاد
 * الصورة في الملف، ولا تُصغَّر صورةٌ دون ٥٠٠ بكسل في ضلعها الأقصر.
 */
export const IMAGE_STEPS: readonly { scale: number; quality: number }[] = [
  { scale: 1, quality: 0.75 },
  { scale: 0.8, quality: 0.7 },
  { scale: 0.65, quality: 0.65 },
  { scale: 0.5, quality: 0.6 },
  { scale: 0.4, quality: 0.55 },
  { scale: 0.3, quality: 0.5 }
];

/** ما يضيفه غلاف PDF فوق صوره — تقديرًا يُتحقَّق منه بعد البناء. */
export const pdfOverhead = (pages: number) => 1200 + 450 * pages;

/**
 * يجرّب الدرجات بالترتيب ويقف عند أوّل ما بلغ الحدّ. و`attempt` يعيد الحجم، ومعه الناتج إن
 * بُني (فالتقدير الذي تجاوز الحدّ لا يُبنى). وإن لم تبلغه درجةٌ عاد بأصغر ما بلغ.
 */
export async function fitSearch<T>(
  limit: number,
  steps: readonly RasterStep[],
  attempt: (step: RasterStep) => Promise<{ size: number; value: T | null }>
): Promise<{ value: T; size: number; step: RasterStep } | { smallest: number }> {
  let smallest = Infinity;
  for (const step of steps) {
    const { size, value } = await attempt(step);
    smallest = Math.min(smallest, size);
    if (value !== null && (!limit || size <= limit)) return { value, size, step };
  }
  return { smallest };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * الطبقة ورقةَ HTML بمقاس الصفحة كما تُرى — يرسمها محرّك الطباعة PDF شفّافًا (`renderLayerPdf`).
 * والنصّ باتجاهه (`dir="auto"`): العربيّ من اليمين، والإنكليزيّ من اليسار، والمختلط يُرتَّب.
 */
export function layerHtml(overlays: Overlay[], pageMm: { w: number; h: number }): string {
  const items = overlays.map((o) => {
    const pos =
      `position:absolute;left:${(o.box.x * pageMm.w).toFixed(2)}mm;top:${(o.box.y * pageMm.h).toFixed(2)}mm;` +
      `width:${(o.box.w * pageMm.w).toFixed(2)}mm;height:${(o.box.h * pageMm.h).toFixed(2)}mm;` +
      `opacity:${Math.max(0, Math.min(1, o.opacity))};transform:rotate(${o.angle}deg);transform-origin:center`;
    if (o.kind === 'image') {
      return `<div style="${pos}"><img alt="" src="diwan://store/${esc(o.src)}" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    const justify = o.align === 'center' ? 'center' : o.align === 'left' ? 'flex-end' : 'flex-start';
    return (
      `<div dir="auto" style="${pos};display:flex;align-items:center;justify-content:${justify};` +
      `font-family:'${o.font}',Arial,sans-serif;font-size:${o.size}pt;line-height:1.3;color:${o.color};` +
      `font-weight:${o.bold ? 700 : 400};text-align:${o.align};white-space:pre-wrap;overflow:visible">` +
      `<span style="width:100%">${esc(o.text)}</span></div>`
    );
  });
  return `<div style="position:relative;width:${pageMm.w}mm;height:${pageMm.h}mm">${items.join('')}</div>`;
}
