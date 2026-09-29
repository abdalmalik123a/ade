/**
 * اللوحة — الوثيقة المصمَّمة.
 *
 * الشهادة والهوية والملصق والدعوة ليست وثائق متدفّقة. نموذج الكتل يتدفّق:
 * الفقرة تدفع التي تحتها، والصفحة تمتدّ. واللوحة عكسه: مقاسٌ ثابت وصفحةٌ واحدة
 * وعناصرُ بمواضعها لا تدفع شيئًا، وخلفيةٌ تملأ الورقة.
 *
 * وثلاث قواعد تمنع الهشاشة التي تصيب هذا الصنف من البرامج:
 *
 * ١. **المقاس بالملّم لا بالبكسل** — البكسل مشتقٌّ منه بالدقّة المطلوبة. فالورقة
 *    نفسها تُعاين على الشاشة بـ٩٦ وتُطبع بـ٣٠٠، ولا يتغيّر شيء.
 * ٢. **المواضع نِسَب (٠..١) لا بكسلات** — فتغيير المقاس لا يزيح حقلًا، وهو أكثر
 *    ما يكسر التصاميم المستوردة.
 * ٣. **الحقل هو هو** — عقدةُ `field` نفسها التي في الكتاب. فالدمج يعمل بلا
 *    تغيير: ثلاثون هويةً بثلاثين اسمًا بضغطة، ولا شاشةَ إدخالٍ جديدة.
 */
import { emptyDoc, newUuid, type Align, type Dir, type Doc, type Inline, type Uuid } from './doc';

/** ملّمٌ — وهو وحدة القياس الوحيدة في اللوحة. */
export type Mm = number;

export type CanvasSize = { w: Mm; h: Mm };

/** النزف: ثلاثة ملّمات من كل جهة، فالقصّ لا يأكل الحواف. */
export const BLEED_MM = 3;

/** دقّة الطباعة التي تطلبها المطابع — والمعاينة على الشاشة ٩٦. */
export const PRINT_DPI = 300;
export const SCREEN_DPI = 96;

export type SizePreset = {
  key: string;
  label: string;
  size: CanvasSize;
  /** ما يُطبع على ورقٍ يُقصّ — فالنزف أصلٌ فيه. */
  bleed: boolean;
};

/**
 * المقاسات المعيارية.
 *
 * وهي اقتراحٌ لا حصر: المقاس الحقّ يأتي من الملف المستورَد، وإن غاب سُئل المكتب
 * ولم يُخمَّن.
 */
export const SIZE_PRESETS: SizePreset[] = [
  { key: 'id-card', label: 'هوية CR80', size: { w: 85.6, h: 54 }, bleed: true },
  { key: 'a4-landscape', label: 'شهادة A4 أفقي', size: { w: 297, h: 210 }, bleed: false },
  { key: 'a4-portrait', label: 'ملصق A4 عمودي', size: { w: 210, h: 297 }, bleed: false },
  { key: 'a5-portrait', label: 'دعوة A5', size: { w: 148, h: 210 }, bleed: true },
  { key: 'a5-landscape', label: 'دعوة A5 أفقي', size: { w: 210, h: 148 }, bleed: true },
  { key: 'a3-portrait', label: 'لوحة شرف A3', size: { w: 297, h: 420 }, bleed: false }
];

// ── العناصر ──────────────────────────────────────────────────────────

/** صندوقٌ نِسَبًا من قياس التصميم (بلا النزف) — لا بكسلات. */
export type Box = { x: number; y: number; w: number; h: number };

export type ElementBase = {
  id: Uuid;
  box: Box;
  /** بالدرجات، حول مركز الصندوق. */
  rotate?: number;
  /** ترتيب الطبقة: الأكبر أمام. */
  z: number;
  dir?: Dir;
  /** المقفل لا يُحرَّك ولا يُحرَّر — وبه تُحمى الزخرفة من السحب بالخطأ. */
  locked?: boolean;
  /** اسمٌ يُرى في قائمة الطبقات. */
  name?: string;
};

export type VAlign = 'top' | 'middle' | 'bottom';

/**
 * نصٌّ في صندوق.
 *
 * و`inlines` هي عقد المتن نفسها: `run` و`field` و`break`. فما يُكتب `{اسم الطالب}`
 * في شهادةٍ هو ما يُكتب في كتاب — ويملؤه الشبّاك والدمج بلا أن يعرفا أنها لوحة.
 */
export type TextElement = ElementBase & {
  kind: 'text';
  inlines: Inline[];
  align: Align;
  vAlign: VAlign;
  /** بالنقاط (pt) — لا بكسلات، فالبكسل يتغيّر بالدقّة والنقطة لا تتغيّر. */
  size: number;
  color: string;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  lineHeight?: number;
  /**
   * `shrink`: سطرٌ واحد يصغر خطّه حتى يسع صندوقه ولا يُقصّ.
   *
   * «عبد الرحمن محمد عبد الكريم الجبوري» في هويةٍ صُمّمت على «زينب علي» كانت
   * تُقصّ صامتةً — وفي دفعةٍ من أربعمئة هوية لا يراها أحد حتى يشكو الزبون.
   */
  fit?: 'shrink';
  /** تباعد الكلمات بوحدة em — بعض الخطوط الكوفية مسافتها ثُمن حرف فتلتصق الكلمات. */
  wordSpacing?: number;
  /** تباعد الحروف بوحدة em — كما يكتبه Photoshop في «Tracking» للعناوين المتباعدة. */
  letterSpacing?: number;
};

/** صورةٌ ثابتة، أو صورةُ حقلٍ من سجل المستمسكات والماسح (`ref`). */
export type ImageElement = ElementBase & {
  kind: 'image';
  src: string;
  ref?: string;
  fit: 'cover' | 'contain';
  radius?: number;
};

/** الباركود: Code128 للأرقام، وQR لما يُقرأ بالهاتف. */
export type BarcodeElement = ElementBase & {
  kind: 'barcode';
  /**
   * `seal` نقشُ أمانٍ فريد بذرتُه قيمته (`securitySeal.ts`) — و`value` فيه
   * وسومٌ تُملأ: «{اسم الطالب} {الرقم}»، فلكلّ بطاقةٍ نقشها.
   */
  symbology: 'code128' | 'qr' | 'seal';
  value: string;
  ref?: string;
};

export type ShapeElement = ElementBase & {
  kind: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
};

export type CanvasElement =
  | TextElement
  | ImageElement
  | BarcodeElement
  | ShapeElement;

export type Background =
  | { kind: 'none' }
  | { kind: 'color'; color: string }
  /** `dpi` دقّةُ الصورة الأصلية — تُحفظ فلا تُطبع خلفيةٌ ضبابية بلا علم. */
  | { kind: 'image'; src: string; dpi?: number }
  /** تدرجات CSS وخلفيات الويب المتطورة. */
  | { kind: 'css'; style: string };

export type Canvas = {
  size: CanvasSize;
  bleed: Mm;
  cropMarks: boolean;
  background: Background;
  elements: CanvasElement[];
};

// ── الحساب ───────────────────────────────────────────────────────────

export const mmToPx = (mm: Mm, dpi: number): number => (mm / 25.4) * dpi;
/** النقطة الطباعية ١/٧٢ إنش — وهي وحدة حجم الخط في كل مكان. */
export const ptToPx = (pt: number, dpi: number): number => (pt / 72) * dpi;

/** مقاس الورقة كاملةً بالبكسل عند دقّةٍ ما — بالنزف إن وُجد. */
export function canvasPx(canvas: Canvas, dpi: number): { w: number; h: number } {
  return {
    w: mmToPx(canvas.size.w + canvas.bleed * 2, dpi),
    h: mmToPx(canvas.size.h + canvas.bleed * 2, dpi)
  };
}

/** العناصر مرتّبةً بطبقاتها — الأصغر `z` أولًا، والمتساوي بترتيب إضافته. */
export function byLayer(elements: CanvasElement[]): CanvasElement[] {
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => a.el.z - b.el.z || a.i - b.i)
    .map((p) => p.el);
}

/** أعلى طبقة — لما يُضاف جديدًا فيستقرّ أمام ما قبله. */
export function topZ(elements: CanvasElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.z), 0);
}

/** مفاتيح الحقول المستعملة في اللوحة — نصًّا وصورةً وباركودًا. */
export function canvasKeys(canvas: Canvas): string[] {
  const seen = new Set<string>();
  for (const el of canvas.elements) {
    if (el.kind === 'text') {
      for (const node of el.inlines) if (node.kind === 'field') seen.add(node.ref);
    } else if ((el.kind === 'image' || el.kind === 'barcode') && el.ref) {
      seen.add(el.ref);
    }
  }
  return [...seen];
}

/** نصّ اللوحة مجرّدًا — للبحث والبصمة، كما يفعل `docText` بالمتن. */
export function canvasText(canvas: Canvas, values: Record<string, string> = {}): string {
  return byLayer(canvas.elements)
    .filter((el): el is TextElement => el.kind === 'text')
    .map((el) =>
      el.inlines
        .map((n) =>
          n.kind === 'run' ? n.text : n.kind === 'break' ? ' ' : (values[n.ref] ?? `{${n.ref}}`)
        )
        .join('')
    )
    .filter((line) => line.trim())
    .join('\n');
}

// ── البناء ───────────────────────────────────────────────────────────

export function emptyCanvas(size: CanvasSize, bleed = 0): Canvas {
  return {
    size: { ...size },
    bleed,
    cropMarks: bleed > 0,
    background: { kind: 'none' },
    elements: []
  };
}

/**
 * لوحةٌ فارغة بمقاسها.
 *
 * وحكمها `print-only` دائمًا: الشهادة تُطبع بعدد الطلاب ولا تحرق رقم صادر —
 * كورقة الأسئلة، وللسبب نفسه (§٨).
 */
export function canvasDoc(canvas: Canvas, meta: Doc['meta'] = {}): Doc {
  const doc = emptyDoc();
  doc.kind = 'canvas';
  doc.issuing = 'print-only';
  doc.blocks = [];
  doc.canvas = canvas;
  doc.meta = { ...meta };
  return doc;
}

export function textElement(patch: Partial<TextElement> & { box: Box }): TextElement {
  return {
    id: newUuid(),
    kind: 'text',
    inlines: [],
    align: 'center',
    vAlign: 'middle',
    size: 14,
    color: '#111111',
    z: 1,
    dir: 'rtl',
    ...patch
  };
}

export function imageElement(patch: Partial<ImageElement> & { box: Box }): ImageElement {
  return { id: newUuid(), kind: 'image', src: '', fit: 'cover', z: 1, ...patch };
}

export function barcodeElement(patch: Partial<BarcodeElement> & { box: Box }): BarcodeElement {
  return { id: newUuid(), kind: 'barcode', symbology: 'code128', value: '', z: 1, ...patch };
}

export function shapeElement(patch: Partial<ShapeElement> & { box: Box }): ShapeElement {
  return { id: newUuid(), kind: 'shape', shape: 'rect', z: 1, ...patch };
}

// ── التقويم ──────────────────────────────────────────────────────────

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** الصندوق يبقى داخل الورقة نِسَبًا — فلا عنصر يهرب خارج ما يُطبع. */
export function clampBox(box: Box): Box {
  const w = Math.min(1, Math.max(0.005, num(box.w, 0.2)));
  const h = Math.min(1, Math.max(0.005, num(box.h, 0.1)));
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, num(box.x, 0))),
    y: Math.min(1 - h, Math.max(0, num(box.y, 0)))
  };
}

/**
 * `svg` و`html` عنصران قديمان من التصميم بالذكاء الاصطناعي، وقد حُذف (المبدأ ٣):
 * فالرسمة المحفوظة تصير صورةً بمحتواها نفسه — لا يتغيّر شكل تصميمٍ حُفظ —
 * وعنصر الويب يسقط، إذ لا يُرسم إلا بتنفيذ كودٍ لم يعد البرنامج يقبله.
 */
const ELEMENT_KINDS = new Set(['text', 'image', 'barcode', 'shape', 'svg']);

/** رسمة SVG صورةً مضمَّنة — والرموز بعد التشفير لا تكسر السمة. */
function svgImageSrc(svg: string): string {
  const body = svg.includes('<svg') ? svg : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function normalizeElement(raw: unknown, index: number): CanvasElement | null {
  if (!isObj(raw) || typeof raw.kind !== 'string' || !ELEMENT_KINDS.has(raw.kind)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newUuid();
  const box = clampBox(isObj(raw.box) ? (raw.box as unknown as Box) : ({} as Box));
  const z = num(raw.z, index + 1);
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  const locked = raw.locked === true;
  const rotate = typeof raw.rotate === 'number' ? raw.rotate : undefined;
  const dir = raw.dir === 'ltr' ? 'ltr' : 'rtl';

  switch (raw.kind) {
    case 'text': {
      const rawInlines = Array.isArray(raw.inlines)
        ? raw.inlines
        : typeof (raw as Record<string, unknown>).text === 'string'
          ? [{ kind: 'run', text: (raw as Record<string, unknown>).text as string }]
          : [];
      const inlines = rawInlines.map((i) =>
        isObj(i) && typeof i.kind === 'string'
          ? (i as unknown as Inline)
          : { kind: 'run' as const, text: String(i ?? '') }
      );
      return {
        id,
        kind: 'text',
        name,
        box,
        z,
        locked,
        rotate,
        dir,
        inlines,
        align: raw.align === 'left' ? 'left' : raw.align === 'right' ? 'right' : 'center',
        vAlign: raw.vAlign === 'top' ? 'top' : raw.vAlign === 'bottom' ? 'bottom' : 'middle',
        size: typeof raw.size === 'number' && raw.size > 0 ? raw.size : 14,
        color: typeof raw.color === 'string' && raw.color ? raw.color : '#111111',
        font: typeof raw.font === 'string' ? raw.font : undefined,
        bold: raw.bold === true,
        italic: raw.italic === true,
        lineHeight: typeof raw.lineHeight === 'number' ? raw.lineHeight : undefined,
        fit: raw.fit === 'shrink' ? 'shrink' : undefined,
        wordSpacing: typeof raw.wordSpacing === 'number' ? raw.wordSpacing : undefined,
        letterSpacing: typeof raw.letterSpacing === 'number' ? raw.letterSpacing : undefined
      };
    }
    case 'svg': {
      const svg = typeof raw.svg === 'string' ? raw.svg.trim() : '';
      if (!svg) return null;
      return { id, kind: 'image', name, box, z, locked, rotate, dir, src: svgImageSrc(svg), fit: 'contain' };
    }
    case 'image': {
      return {
        id,
        kind: 'image',
        name,
        box,
        z,
        locked,
        rotate,
        dir,
        src: typeof raw.src === 'string' ? raw.src : '',
        ref: typeof raw.ref === 'string' ? raw.ref : undefined,
        fit: raw.fit === 'contain' ? 'contain' : 'cover',
        radius: typeof raw.radius === 'number' ? raw.radius : undefined
      };
    }
    case 'barcode': {
      return {
        id,
        kind: 'barcode',
        name,
        box,
        z,
        locked,
        rotate,
        dir,
        symbology: raw.symbology === 'qr' ? 'qr' : raw.symbology === 'seal' ? 'seal' : 'code128',
        value: typeof raw.value === 'string' ? raw.value : '',
        ref: typeof raw.ref === 'string' ? raw.ref : undefined
      };
    }
    case 'shape': {
      return {
        id,
        kind: 'shape',
        name,
        box,
        z,
        locked,
        rotate,
        dir,
        shape: raw.shape === 'ellipse' || raw.shape === 'line' ? raw.shape : 'rect',
        fill: typeof raw.fill === 'string' ? raw.fill : undefined,
        stroke: typeof raw.stroke === 'string' ? raw.stroke : undefined,
        strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : undefined,
        radius: typeof raw.radius === 'number' ? raw.radius : undefined
      };
    }
    default:
      return null;
  }
}

function normalizeBackground(raw: unknown): Background {
  if (!isObj(raw)) return { kind: 'none' };
  if (raw.kind === 'color' && typeof raw.color === 'string') {
    return { kind: 'color', color: raw.color };
  }
  if (raw.kind === 'image' && typeof raw.src === 'string') {
    const dpi = typeof raw.dpi === 'number' && raw.dpi > 0 ? raw.dpi : undefined;
    return dpi ? { kind: 'image', src: raw.src, dpi } : { kind: 'image', src: raw.src };
  }
  if (raw.kind === 'css' && typeof raw.style === 'string') {
    return { kind: 'css', style: raw.style };
  }
  return { kind: 'none' };
}

/** لوحةٌ قُرئت من القرص: ما فسد منها يُردّ إلى حدّه ولا يُسقط الورقة كلّها. */
export function normalizeCanvas(raw: unknown): Canvas {
  const fallback = SIZE_PRESETS[1]!.size;
  if (!isObj(raw)) return emptyCanvas(fallback);
  const size = isObj(raw.size) ? (raw.size as unknown as CanvasSize) : fallback;
  const bleed = Math.max(0, num(raw.bleed, 0));
  return {
    size: { w: Math.max(1, num(size.w, fallback.w)), h: Math.max(1, num(size.h, fallback.h)) },
    bleed,
    cropMarks: raw.cropMarks === true,
    background: normalizeBackground(raw.background),
    elements: Array.isArray(raw.elements)
      ? raw.elements.map(normalizeElement).filter((el): el is CanvasElement => el !== null)
      : []
  };
}
