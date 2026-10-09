/**
 * الوحدات والمقاسات: الملّم أصلٌ والبكسل مشتقٌّ منه بدقّته، والنقطة وحدة الخطّ، والمقاسات المعيارية اقتراحٌ لا حصر.
 */
import type { Canvas, CanvasSize, Mm } from './types';

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
  /** للشاشة لا للورق (DESIGNS.md ١٫٧): بالبكسل كما يطلبه المنشور والستوري — والملّم منه على ٩٦ نقطة، فيُحفظ صورةً بمقاسه تمامًا. */
  px?: { w: number; h: number };
};

/**
 * المقاسات المعيارية.
 *
 * وهي اقتراحٌ لا حصر: المقاس الحقّ يأتي من الملف المستورَد، وإن غاب سُئل المكتب
 * ولم يُخمَّن.
 */
export const SIZE_PRESETS: SizePreset[] = [
  { key: 'id-card', label: 'هوية CR80 (85.6 × 54)', size: { w: 85.6, h: 54 }, bleed: true },
  { key: 'a4-landscape', label: 'شهادة A4 أفقي', size: { w: 297, h: 210 }, bleed: false },
  { key: 'a4-portrait', label: 'ملصق A4 عمودي', size: { w: 210, h: 297 }, bleed: false },
  { key: 'a5-portrait', label: 'دعوة A5', size: { w: 148, h: 210 }, bleed: true },
  { key: 'a5-landscape', label: 'دعوة A5 أفقي', size: { w: 210, h: 148 }, bleed: true },
  { key: 'business-card', label: 'كرت عمل / شخصي (90 × 50)', size: { w: 90, h: 50 }, bleed: true },
  { key: 'a4-third', label: 'ثلث A4 (210 × 99)', size: { w: 210, h: 99 }, bleed: false },
  { key: 'badge-portrait', label: 'باج هوية عمودي (54 × 85.6)', size: { w: 54, h: 85.6 }, bleed: true },
  { key: 'a3-portrait', label: 'لوحة شرف A3', size: { w: 297, h: 420 }, bleed: false },
  // للشاشة (١٫٧): المنشور والستوري وحالة واتساب — بالبكسل.
  { key: 'post-square', label: 'منشور مربّع (1080 × 1080)', size: { w: 285.75, h: 285.75 }, bleed: false, px: { w: 1080, h: 1080 } },
  { key: 'post-portrait', label: 'منشور عمودي (1080 × 1350)', size: { w: 285.75, h: 357.19 }, bleed: false, px: { w: 1080, h: 1350 } },
  { key: 'story', label: 'ستوري وحالة واتساب (1080 × 1920)', size: { w: 285.75, h: 508 }, bleed: false, px: { w: 1080, h: 1920 } }
];

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
