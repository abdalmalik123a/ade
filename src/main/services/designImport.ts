/**
 * استيراد التصاميم — المقاس والمواضع من الملف لا من تخميننا.
 *
 * عند المكتب آلافُ التصاميم: شهاداتٌ في Word، وهوياتٌ في Photoshop، وملصقاتٌ
 * PDF، وصورٌ جاهزة. وهذه المسارات الأربعة تُدخلها كلّها — وكلٌّ منها يحمل مقاسه
 * بوحدةٍ أخرى، فتُقرأ ولا تُخمَّن:
 *
 * | المصدر | الوحدة | أين |
 * |---|---|---|
 * | Word | twip (١٤٤٠/إنش) | `w:sectPr > w:pgSz`، والمواضع EMU (٩١٤٤٠٠/إنش) |
 * | Photoshop | بكسل + DPI | ترويسة PSD، و`ResolutionInfo` (المورد ١٠٠٥) |
 * | PDF | نقطة (٧٢/إنش) | `MediaBox` في صفحة المستند |
 * | صورة | بكسل + DPI | `pHYs` أو EXIF (§`imageSize.ts`) |
 *
 * **ولا يُبنى تصميمٌ بمقاسٍ مخمَّن**: ما سكت ملفُّه عن مقاسه يعود بـ`size: null`
 * فيُسأل المكتب.
 */
import { basename, extname } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import {
  BLEED_MM,
  barcodeElement,
  clampBox,
  emptyCanvas,
  imageElement,
  textElement,
  type Box,
  type Canvas,
  type CanvasElement,
  type CanvasSize
} from '@shared/canvas';
import { tokenInlines, type Align, type Inline, type Suggestion } from '@shared/doc';
import { fieldFromLayerName } from '@shared/layerFields';
import type { FieldSuggestion } from '@shared/api';
import { FONT } from '@shared/designKit/styles';
import { imageMeta } from './imageSize';
import { writePng } from './png';
import { readPsd } from './psd';
import { eraseLayers, parsePsdLayers, psdItems, type PsdItem, type Rect } from './psdLayers';

/** الوحدات إلى الملّم — وكلٌّ منها من معيار صاحبه. */
export const TWIP_MM = 25.4 / 1440;
export const EMU_MM = 25.4 / 914400;
export const POINT_MM = 25.4 / 72;

export type DesignSource = 'image' | 'word' | 'psd' | 'pdf';

export type DesignImport = {
  source: DesignSource;
  name: string;
  /** المقاس بالملّم، أو `null` إن سكت الملف — فيُسأل المكتب. */
  size: CanvasSize | null;
  /** دقّةُ الأصل إن ذكرها. */
  dpi: number | null;
  /** صورٌ تُحفظ في المخزن: الخلفية أولها إن وُجدت. */
  images: { name: string; bytes: Uint8Array }[];
  /** ما استُخرج من عناصر بمواضعها — نِسَبًا من المقاس. */
  elements: {
    box: Box;
    inlines?: Inline[];
    imageIndex?: number;
    /** حجم الخطّ بالنقاط — أو `sizeFrac`: نسبةً من ارتفاع التصميم حين لا تُعرف دقّته. */
    size?: number;
    sizeFrac?: number;
    ref?: string;
    kind?: 'text' | 'image' | 'barcode';
    /** اسم طبقة Photoshop، والحقل المقترح منه — يؤكّده المكتب (هـ٤). */
    layerName?: string;
    suggest?: Suggestion<string>;
    symbology?: 'qr' | 'code128';
    // شكلُ النصّ كما في ملفه (Photoshop).
    color?: string;
    align?: Align;
    bold?: boolean;
    italic?: boolean;
    dir?: 'rtl' | 'ltr';
    font?: string;
    letterSpacing?: number;
    lineHeight?: number;
    vAlign?: 'top' | 'middle' | 'bottom';
    fit?: 'shrink' | 'cover' | 'contain';
    radius?: number;
  }[];
  warnings: string[];
};

// ── Word ─────────────────────────────────────────────────────────────

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const attr = (xml: string, name: string): string | null =>
  new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? null;

const numAttr = (xml: string, name: string): number | null => {
  const raw = attr(xml, name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** نصّ فقرات Word داخل مقطعٍ ما، بلا وسومها. */
function paragraphText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .split(/<w:p\b/)
    .map((chunk) => decodeEntities([...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')))
    .filter((line) => line.trim())
    .join('\n');
}

/**
 * لوحةٌ من ملف Word.
 *
 * والشهادة في Word ليست فقرات: هي مربّعاتُ نصٍّ وصورٌ **مثبّتةٌ بمواضعها**
 * (`wp:anchor`) فوق خلفية. ولذلك تُقرأ مواضعها لا نصّها وحده — وبغير ذلك تخرج
 * الشهادة كومةَ أسطرٍ في أعلى الورقة.
 */
export function wordDesign(bytes: Uint8Array, name: string): DesignImport {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new Error('تعذّر فتح ملف Word — قد يكون تالفًا أو مقطوعًا، أو بصيغة .doc القديمة (احفظه .docx)');
  }
  const doc = zip['word/document.xml'];
  const warnings: string[] = [];
  if (!doc) throw new Error('الملف ليس مستند Word — لا مستند فيه');
  const xml = strFromU8(doc);

  // ── المقاس: twips ────────────────────────────────────────────────
  const pgSz = /<w:pgSz\b[^>]*\/?>/.exec(xml)?.[0] ?? '';
  const twW = numAttr(pgSz, 'w:w');
  const twH = numAttr(pgSz, 'w:h');
  const landscape = attr(pgSz, 'w:orient') === 'landscape';
  let size: CanvasSize | null = null;
  if (twW && twH) {
    const w = twW * TWIP_MM;
    const h = twH * TWIP_MM;
    // `w:orient` وصفٌ لا مقاس: الأبعاد نفسها مبدَّلةٌ في بعض الملفات ومستقيمةٌ في غيرها.
    size = landscape && w < h ? { w: h, h: w } : { w, h };
  } else {
    warnings.push('الملف لا يذكر مقاس الصفحة — اختر المقاس');
  }

  // ── العلاقات والصور ──────────────────────────────────────────────
  const relsRaw = zip['word/_rels/document.xml.rels'];
  const rels = new Map<string, string>();
  if (relsRaw) {
    for (const m of strFromU8(relsRaw).matchAll(/<Relationship\b[^>]*\/>/g)) {
      const id = attr(m[0], 'Id');
      const target = attr(m[0], 'Target');
      if (id && target) rels.set(id, target.replace(/^\.?\/?/, '').replace(/^word\//, ''));
    }
  }

  const images: DesignImport['images'] = [];
  const imageIndex = new Map<string, number>();
  const putImage = (rel: string): number | undefined => {
    if (imageIndex.has(rel)) return imageIndex.get(rel);
    const target = rels.get(rel);
    const file = target ? zip[`word/${target}`] : undefined;
    if (!file) return undefined;
    const at = images.length;
    images.push({ name: basename(target!), bytes: file });
    imageIndex.set(rel, at);
    return at;
  };

  // ── العناصر المثبَّتة بمواضعها ───────────────────────────────────
  const elements: DesignImport['elements'] = [];
  if (size) {
    for (const m of xml.matchAll(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g)) {
      const anchor = m[0];
      const offsets = [...anchor.matchAll(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/g)].map((o) =>
        Number(o[1])
      );
      const extent = /<wp:extent\b[^>]*\/?>/.exec(anchor)?.[0] ?? '';
      const cx = numAttr(extent, 'cx');
      const cy = numAttr(extent, 'cy');
      if (offsets.length < 2 || !cx || !cy) continue;

      const box = clampBox({
        // المحور الأفقي في Word يُقاس من اليسار، وعندنا من اليمين.
        x: 1 - (offsets[0]! * EMU_MM + cx * EMU_MM) / size.w,
        y: (offsets[1]! * EMU_MM) / size.h,
        w: (cx * EMU_MM) / size.w,
        h: (cy * EMU_MM) / size.h
      });

      const blip = /<a:blip\b[^>]*\/?>/.exec(anchor)?.[0] ?? '';
      const rel = attr(blip, 'r:embed');
      if (rel) {
        const at = putImage(rel);
        if (at !== undefined) elements.push({ box, imageIndex: at });
        continue;
      }

      const text = paragraphText(anchor);
      if (text.trim()) {
        elements.push({
          box,
          // و`{الوسم}` في مربّع نصّ Word يصير حقلًا — فما كتبه المكتب في قالبه
          // يبقى متغيّرًا عندنا، ولا يُعاد تعريفه باليد.
          inlines: tokenInlines(text.replace(/\n/g, ' ').trim()),
          // ارتفاعُ الصندوق بالملّم يقارب حجم سطرٍ واحد — تقديرٌ أوّليّ يُعدَّل باليد.
          size: Math.max(8, Math.round(((cy * EMU_MM) / 25.4) * 72 * 0.6))
        });
      }
    }
  }

  if (!elements.length) {
    warnings.push('لا مربّعات نصٍّ ولا صورٍ مثبّتةً بمواضعها — أُدرج نصُّ المستند فقط');
    const text = paragraphText(xml);
    if (text.trim()) {
      elements.push({
        box: clampBox({ x: 0.1, y: 0.35, w: 0.8, h: 0.3 }),
        inlines: tokenInlines(text.split('\n')[0]!)
      });
    }
  }

  return { source: 'word', name, size, dpi: null, images, elements, warnings };
}

// ── Photoshop ────────────────────────────────────────────────────────

/**
 * خطّ النصّ من اسم خطّه في Photoshop — إلى أقرب ما عندنا محزومًا.
 *
 * فخطوط القوالب (Poppins، Montserrat…) ليست عندنا ولا تُحزم بلا ترخيصها؛
 * والعائلة أهمّ من الاسم: نسخٌ لما كان نسخًا، وكوفيٌّ لما كان كوفيًّا، والباقي
 * القاهرة — وحروفها اللاتينية هندسيّةٌ كخطوط هذه القوالب.
 */
function fontFor(name: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (/ruq|رقعة/.test(n)) return FONT.ruqaa;
  if (/kufi|كوفي/.test(n)) return FONT.kufiText;
  if (/naskh|amiri|lotus|traditional|badr|mudir|times|georgia|garamond|serif(?!.*sans)|playfair|merriweather|نسخ/.test(n)) {
    return FONT.naskh;
  }
  return FONT.cairo;
}

const ARABIC = /[؀-ۿ]/;

/**
 * صندوق النصّ من موضع حبره: الارتفاع سطرٌ كامل حول وسط الحبر، والعرض يزيد
 * قليلًا من جهة المحاذاة — فخطّنا ليس خطّ التصميم، والاسم الأطول يصغر ولا يُقصّ.
 */
function textBox(item: Extract<PsdItem, { kind: 'text' }>, W: number, H: number): Box {
  const s = item.style.sizePx;
  const { top, bottom, left, right } = item.rect;
  const toBox = (x0: number, y0: number, x1: number, y1: number) =>
    // المواضع نِسَبٌ من اليمين: اللوحة عربية.
    clampBox({ x: (W - Math.min(W, x1)) / W, y: y0 / H, w: (Math.min(W, x1) - Math.max(0, x0)) / W, h: (y1 - y0) / H });
  // الصندوق الملتفّ كما رسمه المصمّم، والنصّ يلتفّ فيه بخطّنا.
  if (!item.single) return toBox(left, top, right, bottom + s * 0.3);
  const h = Math.max(bottom - top, s * 1.3);
  const cy = (top + bottom) / 2;
  const w = (right - left) * 1.12 + s * 0.4;
  let x0 =
    item.style.align === 'left'
      ? left - s * 0.05
      : item.style.align === 'right'
        ? right + s * 0.05 - w
        : (left + right) / 2 - w / 2;
  x0 = Math.max(0, Math.min(W - Math.min(w, W), x0));
  return toBox(x0, cy - h / 2, x0 + w, cy + h / 2);
}

/**
 * Photoshop: الخلفيةُ صورتُه المسطَّحة، والنصوصُ والصورةُ والرمز عناصرُ فوقها.
 *
 * وكلُّ ما صار عنصرًا يُمحى من الخلفية (`psdLayers.eraseLayers`) — وإلا ظهر
 * الاسم مرّتين: المطبوعُ في الصورة، والمحرَّرُ فوقه بخطٍّ آخر.
 */
export function psdDesign(bytes: Uint8Array, name: string): DesignImport {
  const read = readPsd(bytes);
  // ملفٌّ لا يُقرأ يُقال — لا لوحةٌ فارغة تسأل عن مقاس ملفٍّ لم يُفتح.
  if (!read) throw new Error('تعذّر قراءة ملف Photoshop — قد يكون تالفًا أو مقطوعًا');
  const warnings = [...read.warnings];
  if (!read.dpi) warnings.push('الملف لا يذكر دقّته — اختر المقاس');
  const W = read.width;
  const H = read.height;

  const doc = parsePsdLayers(bytes);
  const items = doc ? psdItems(bytes, doc) : [];
  if (!read.rgba && !items.length) throw new Error('ملف Photoshop مبتور — لم تُقرأ صورته ولا طبقاته');
  const background = doc ? eraseLayers(bytes, doc, read.rgba, read.planes ?? null, items.map((i) => i.layer), read.dpi) : null;
  const rgba = background?.rgba ?? read.rgba;
  const images = rgba
    ? [{ name: `${basename(name, extname(name))}.png`, bytes: writePng(rgba, W, H, read.dpi ?? 300) }]
    : [];

  const elements: DesignImport['elements'] = items.map((item) => {
    const box = (r: Rect) =>
      clampBox({ x: (W - r.right) / W, y: r.top / H, w: (r.right - r.left) / W, h: (r.bottom - r.top) / H });
    if (item.kind === 'photo') {
      return { kind: 'image', box: box(item.rect), ref: 'صورة الموظف', fit: 'cover', radius: item.round ? 50 : undefined };
    }
    if (item.kind === 'barcode') {
      return { kind: 'barcode', box: box(item.rect), symbology: 'qr', ref: 'الرقم' };
    }
    const arabic = ARABIC.test(item.text);
    const suggest = fieldFromLayerName(item.name, item.text) ?? undefined;
    return {
      kind: 'text',
      layerName: item.name,
      suggest,
      box: textBox(item, W, H),
      // أسطر الصندوق فواصلُ في النصّ نفسه، والحقول `{…}` عُقدٌ في كلّ سطر.
      inlines: item.text
        .split('\n')
        .flatMap((line, i): Inline[] => [...(i ? [{ kind: 'break' as const }] : []), ...tokenInlines(line)]),
      sizeFrac: item.style.sizePx / H,
      color: item.style.color,
      align: item.style.align,
      bold: item.style.bold,
      italic: item.style.italic || undefined,
      dir: arabic ? 'rtl' : 'ltr',
      font: fontFor(item.style.font),
      letterSpacing: item.style.tracking || undefined,
      fit: item.single ? 'shrink' : undefined,
      vAlign: item.single ? undefined : 'top',
      lineHeight: item.single ? 1.2 : item.style.lineHeight
    };
  });

  if (items.length) {
    const texts = items.filter((i) => i.kind === 'text').length;
    warnings.push(`صار ${texts} نصًّا${items.length > texts ? ' والصورة والرمز' : ''} عناصرَ تُحرَّر، ومُحيت من الخلفية`);
  }
  if (background?.filledAreas) {
    warnings.push(`${background.filledAreas} موضعًا تحته مؤثّرٌ لا يُرسم فمُلئ ممّا حوله — راجعه في المعاينة`);
  }
  if (background?.recomposed) {
    warnings.push('الصورة المسطَّحة في الملف فارغة (حُفظ بلا «توافقٍ أقصى») — رُكّبت الخلفية من طبقاته بلا مؤثّراتها');
  }

  return {
    source: 'psd',
    name,
    size: read.dpi ? { w: (W / read.dpi) * 25.4, h: (H / read.dpi) * 25.4 } : null,
    dpi: read.dpi,
    images,
    elements,
    warnings
  };
}

// ── PDF ──────────────────────────────────────────────────────────────

/**
 * مقاسُ صفحة PDF من `MediaBox` بالنقاط.
 *
 * ولا تُفكّ بنيةُ الملف كاملةً: أولُ `MediaBox` هو مقاس الصفحة الأولى في كل
 * ملفٍ رأيناه، وما نريده المقاسُ لا المحتوى — فالصفحة تُرسم خلفيةً.
 */
export function pdfSize(bytes: Uint8Array): CanvasSize | null {
  const head = Buffer.from(bytes).toString('latin1', 0, Math.min(bytes.length, 4 << 20));
  const m = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(head);
  if (!m) return null;
  const w = (Number(m[3]) - Number(m[1])) * POINT_MM;
  const h = (Number(m[4]) - Number(m[2])) * POINT_MM;
  return w > 0 && h > 0 ? { w, h } : null;
}

export function pdfDesign(bytes: Uint8Array, name: string): DesignImport {
  if (!Buffer.from(bytes.subarray(0, 1024)).toString('latin1').includes('%PDF-')) {
    throw new Error('الملف ليس PDF — قد يكون تالفًا أو أُعيدت تسميته');
  }
  const size = pdfSize(bytes);
  return {
    source: 'pdf',
    name,
    size,
    dpi: null,
    images: [],
    elements: [],
    warnings: size
      ? ['صفحة PDF تُرسم خلفيةً بدقّة الطباعة']
      : ['الملف لا يذكر مقاس صفحته — اختر المقاس']
  };
}

// ── صورة ─────────────────────────────────────────────────────────────

/** أصورةٌ هي؟ — من توقيع أوّل بايتاتها لا من امتداد اسمها. */
function isImage(bytes: Uint8Array): boolean {
  const b = Buffer.from(bytes.subarray(0, 12));
  return (
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) || // PNG
    b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || // JPEG
    b.toString('latin1', 0, 4) === 'GIF8' ||
    b.toString('latin1', 0, 2) === 'BM' ||
    (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') ||
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || // TIFF (II)
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a) // TIFF (MM)
  );
}

export function imageDesign(bytes: Uint8Array, name: string): DesignImport {
  if (!isImage(bytes)) throw new Error('الملف ليس صورةً تُقرأ (PNG أو JPEG أو WebP أو BMP) — قد يكون تالفًا أو أُعيدت تسميته');
  const meta = imageMeta(bytes);
  return {
    source: 'image',
    name,
    size: meta?.mm ?? null,
    dpi: meta?.dpi ?? null,
    images: [{ name, bytes }],
    elements: [],
    warnings: meta?.mm ? [] : ['الصورة لا تذكر دقّتها — اختر المقاس']
  };
}

// ── الباب الواحد ─────────────────────────────────────────────────────

export function readDesign(bytes: Uint8Array, name: string): DesignImport {
  switch (extname(name).toLowerCase()) {
    case '.docx':
      return wordDesign(bytes, name);
    case '.psd':
      return psdDesign(bytes, name);
    case '.pdf':
      return pdfDesign(bytes, name);
    default:
      return imageDesign(bytes, name);
  }
}

/**
 * الحقول المقترحة من أسماء الطبقات، بمعرّفات عناصرها في اللوحة (هـ٤) — تُعرض ليقبلها
 * المكتب أو يرفضها. وكلّ عنصرٍ مستورد صار عنصرًا واحدًا في اللوحة بترتيبه.
 */
export function layerSuggestions(imported: DesignImport, canvas: Canvas | null): FieldSuggestion[] {
  if (!canvas || canvas.elements.length !== imported.elements.length) return [];
  return imported.elements.flatMap((el, i) => {
    const target = canvas.elements[i];
    if (!el.suggest || !target || target.kind !== 'text') return [];
    const sample = (el.inlines ?? [])
      .map((n) => (n.kind === 'run' ? n.text : n.kind === 'break' ? ' ' : ''))
      .join('')
      .trim();
    return [{ elementId: target.id, layer: el.layerName ?? '', sample, key: el.suggest.value, confidence: el.suggest.confidence, reason: el.suggest.reason }];
  });
}

export function canvasFromImport(
  imported: DesignImport,
  stored: string[],
  fallback?: CanvasSize
): Canvas | null {
  const size = imported.size ?? fallback;
  if (!size) return null;

  // ما صغُر يُقصّ: الهوية والدعوة تُطبع على ورقةٍ ثم تُقصّ، فالنزف أصلٌ فيها.
  // والحكمُ بالمقاس لا بالمصدر — فهويةٌ من Photoshop كهويةٍ من صورة.
  const bleed = size.w < 120 ? BLEED_MM : 0;
  const canvas = emptyCanvas(size, bleed);

  // صورةٌ واحدة لا موضع لها = خلفية. وما كان له موضعٌ فعنصرٌ فوقها.
  const backgroundAt = imported.elements.some((el) => el.imageIndex === 0) ? -1 : 0;
  if (stored[0] && backgroundAt === 0) {
    canvas.background = imported.dpi
      ? { kind: 'image', src: stored[0], dpi: imported.dpi }
      : { kind: 'image', src: stored[0] };
  }

  canvas.elements = imported.elements.flatMap<CanvasElement>((el, i) => {
    if (el.kind === 'barcode' || el.symbology) {
      return [
        barcodeElement({
          box: el.box,
          symbology: el.symbology ?? 'qr',
          ref: el.ref ?? 'الرقم',
          z: i + 1
        })
      ];
    }
    if (el.kind === 'image' || el.imageIndex !== undefined || el.ref?.includes('صورة')) {
      const src = el.imageIndex !== undefined ? stored[el.imageIndex] : '';
      return [
        imageElement({
          box: el.box,
          src: src ?? '',
          ref: el.ref,
          fit: el.fit === 'cover' ? 'cover' : 'contain',
          radius: el.radius,
          z: i + 1
        })
      ];
    }
    // النسبة تصير نقاطًا بمقاس الورقة الذي عُرف — من الملف أو من اختيار المكتب.
    const size = el.sizeFrac ? Math.round(((el.sizeFrac * canvas.size.h) / POINT_MM) * 100) / 100 : (el.size ?? 14);
    return [
      textElement({
        box: el.box,
        inlines: el.inlines ?? [],
        size,
        ...(el.color && { color: el.color }),
        ...(el.align && { align: el.align }),
        ...(el.dir && { dir: el.dir }),
        ...(el.font && { font: el.font }),
        ...(el.bold && { bold: true }),
        ...(el.italic && { italic: true }),
        ...(el.letterSpacing && { letterSpacing: el.letterSpacing }),
        ...(el.lineHeight && { lineHeight: el.lineHeight }),
        ...(el.vAlign && { vAlign: el.vAlign }),
        ...(el.fit === 'shrink' && { fit: 'shrink' as const }),
        z: i + 1
      })
    ];
  });

  return canvas;
}
