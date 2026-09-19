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
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import {
  BLEED_MM,
  clampBox,
  emptyCanvas,
  imageElement,
  textElement,
  type Box,
  type Canvas,
  type CanvasElement,
  type CanvasSize
} from '@shared/canvas';
import { tokenInlines, type Inline } from '@shared/doc';
import { imageMeta } from './imageSize';
import { psdMeta } from './psd';

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
  elements: { box: Box; inlines?: Inline[]; imageIndex?: number; size?: number }[];
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
  const zip = unzipSync(bytes);
  const doc = zip['word/document.xml'];
  const warnings: string[] = [];
  if (!doc) {
    return { source: 'word', name, size: null, dpi: null, images: [], elements: [], warnings: ['لا يحوي الملف مستند Word'] };
  }
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

export function psdDesign(bytes: Uint8Array, name: string): DesignImport {
  const meta = psdMeta(bytes);
  const warnings: string[] = [];
  if (!meta) {
    return { source: 'psd', name, size: null, dpi: null, images: [], elements: [], warnings: ['ليس ملف Photoshop'] };
  }
  if (!meta.dpi) warnings.push('الملف لا يذكر دقّته — اختر المقاس');

  return {
    source: 'psd',
    name,
    size: meta.dpi ? { w: (meta.w / meta.dpi) * 25.4, h: (meta.h / meta.dpi) * 25.4 } : null,
    dpi: meta.dpi,
    images: [],
    elements: [],
    warnings: [
      ...warnings,
        // والصورة المسطَّحة تُقرأ في العملية الرئيسية — وهذا المقاس وحده.
      'طبقات Photoshop تُسطَّح خلفيةً واحدة'
    ]
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

export function imageDesign(bytes: Uint8Array, name: string): DesignImport {
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

export async function readDesignFile(path: string): Promise<DesignImport> {
  return readDesign(await readFile(path), basename(path));
}

/**
 * يبني لوحةً ممّا استُورد.
 *
 * والخلفيةُ أولُ صورةٍ إن ملأت الورقة، والباقي عناصرُ صور. و`fallback` مقاسٌ
 * يختاره المكتب حين يسكت الملف — فلا يُخمَّن هنا.
 */
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
    if (el.imageIndex !== undefined) {
      const src = stored[el.imageIndex];
      return src ? [imageElement({ box: el.box, src, fit: 'contain', z: i + 1 })] : [];
    }
    return [textElement({ box: el.box, inlines: el.inlines ?? [], size: el.size ?? 14, z: i + 1 })];
  });

  return canvas;
}
