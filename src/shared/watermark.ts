/**
 * العلامة المائية المكرَّرة (هـ٣) — نصٌّ مائلٌ يتكرّر فوق الصورة كلّها.
 *
 * على **نسخة المستمسك**: «نسخة لغرض معاملة مصرف الرشيد فقط» فوق الهوية — فالنسخة
 * التي تُعطى لجهةٍ لا تصلح لغيرها لو تسرّبت. و**فوق** الصورة لا خلفها: خلف الصورة
 * لا تُرى، وفي زاويةٍ تُقصّ. وعلى **معاينة التصميم** التي تُرسل للزبون ليوافق:
 * «معاينة — ليست للطباعة»، فلا يطبعها في غير المكتب.
 *
 * SVG مضمَّن بنمطٍ (`pattern`) لا صورةٌ في الخلفية: يأخذ خطوط الصفحة العربية ويُطبع
 * متّجهًا حادًّا بأيّ مقاس.
 */
let seq = 0;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type WatermarkOptions = {
  text: string;
  /** شفافية النصّ (٠..١) — ٠٫٢٢ يُقرأ ولا يحجب ما تحته. */
  opacity?: number;
  /** حجم الحرف بالملّم. */
  sizeMm?: number;
  /** زاوية الميل بالدرجات. */
  angle?: number;
  color?: string;
};

/**
 * طبقةٌ تغطّي عنصرها الأب (`position:relative`) بالنصّ مكرَّرًا — أو لا شيء إن كان
 * النصّ فارغًا. والمعرّف فريدٌ لكلّ طبقة: عشر بطاقاتٍ في ورقةٍ لا تتنازع نمطًا واحدًا.
 */
export function tiledWatermark(opts: WatermarkOptions): string {
  const text = opts.text.trim();
  if (!text) return '';
  const id = `wm-${++seq}-${Math.random().toString(36).slice(2, 7)}`;
  const size = opts.sizeMm ?? 3.2;
  const opacity = Math.max(0.05, Math.min(0.8, opts.opacity ?? 0.22));
  const angle = opts.angle ?? -28;
  // خانة النمط: عرض النصّ تقديرًا (نصف مقاس الحرف لكل حرف) وفراغٌ بين الأسطر.
  const w = Math.max(20, text.length * size * 0.55 + size * 4);
  const h = size * 3.2;
  return (
    `<svg data-watermark-tiled="" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2" aria-hidden="true">` +
    `<defs><pattern id="${id}" width="${w}mm" height="${h}mm" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">` +
    `<text x="0" y="${size * 1.2}mm" font-size="${size}mm" font-family="'Noto Naskh Arabic','Amiri',Tahoma,sans-serif" font-weight="700" ` +
    `fill="${escape(opts.color ?? '#b00020')}" fill-opacity="${opacity}" direction="rtl" text-anchor="start">${escape(text)}</text>` +
    `<text x="${w / 2}mm" y="${size * 2.8}mm" font-size="${size}mm" font-family="'Noto Naskh Arabic','Amiri',Tahoma,sans-serif" font-weight="700" ` +
    `fill="${escape(opts.color ?? '#b00020')}" fill-opacity="${opacity}" direction="rtl" text-anchor="start">${escape(text)}</text>` +
    `</pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`
  );
}

/** نصوصٌ جاهزة تُختار بضغطة — وتُعدَّل. */
export const WATERMARK_PRESETS = {
  copy: 'نسخة — لا تُستعمل إلا للغرض الذي أُعطيت له',
  preview: 'معاينة — ليست للطباعة'
} as const;

/** «نسخة لغرض …» من الجهة التي تُقدَّم إليها. */
export function purposeWatermark(destination: string): string {
  const to = destination.trim();
  return to ? `نسخة لغرض تقديمها إلى ${to} فقط` : WATERMARK_PRESETS.copy;
}
