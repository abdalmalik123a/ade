/**
 * استيراد التصاميم — الوحدات إلى الملّم، وما يعود من كلّ مصدر (DESIGNS.md ٠٫٩).
 */
import type { Box, CanvasSize } from '@shared/canvas';
import type { Align, Inline, Suggestion } from '@shared/doc';
import type { Gradient } from '@shared/design/paint';
import type { ImageShape } from '@shared/design/shapes';

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
    // مؤثّرات Photoshop (DESIGNS.md ٢٫١) — الأطوال نِسَبًا من ارتفاع التصميم كـ`sizeFrac`، فتصير نقاطًا وملّمات بمقاسه.
    shadowFrac?: { color: string; dx: number; dy: number; blur: number };
    outlineFrac?: { color: string; width: number };
    gradient?: Gradient;
    arc?: number;
    opacity?: number;
    shape?: ImageShape;
    frameFrac?: { color: string; width: number };
    /** مجموعة Photoshop: ما فيها معًا يُحدَّد ويُنقل معًا. */
    group?: string;
  }[];
  warnings: string[];
};
