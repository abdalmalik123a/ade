/**
 * رسم اللوحة علاماتٍ — محرّكٌ واحد للمعاينة والطباعة، كما في `docHtml.ts`.
 *
 * والدقّة وسيطٌ لا ثابت: الشاشة ٩٦ والطابعة ٣٠٠، والعلامات نفسها. فما يراه الموظف هو ما يخرج من الطابعة لأنه الكود
 * نفسه — ووجود نسختين من الرسم يعني شهادتين مختلفتين لتصميمٍ واحد.
 *
 * والمواضع نِسَبٌ من **مقاس التصميم** (بلا النزف)، والنزف إزاحةٌ حول ذلك. فتغيير المقاس لا يزيح حقلًا، وهو أكثر ما
 * يكسر التصاميم المستوردة. والرسّام يمرّ على سجلّ الأنواع ولا يعرفها بأسمائها (DESIGNS.md ٣٫٣).
 */
import type { Doc } from '../../doc';
import type { MissingMode } from '../../docHtml';
import { escapeHtml } from '../../html';
import { BLEED_MM, canvasPx, mmToPx } from '../model/units';
import { byLayer } from '../model/canvas';
import type { Canvas } from '../model/types';
import { kindSpec } from '../kinds/registry';
import type { RenderCtx } from '../kinds/types';

export type CanvasRenderOptions = {
  /** نقطة/إنش: ٩٦ للشاشة و٣٠٠ للطباعة. */
  dpi?: number;
  missing?: MissingMode;
  /** علامات القصّ تُرسم مع النزف — وتُخفى في المعاينة الصغيرة. */
  marks?: boolean;
  /** مسارٌ يحوّل مرجع الصورة إلى عنوانٍ يفتحه المتصفّح. */
  imageUrl?: (src: string) => string;
};

/**
 * مرجعُ الصورة إلى عنوان.
 *
 * وما بدأ بـ`data:` يمرّ كما هو: خلفياتُ المعرض مولَّدةٌ SVG في الوثيقة نفسها،
 * لا ملفاتٍ في المخزن — فلا مسارَ لها يُكسر ولا حجمَ يُنقل.
 */
const storeUrl = (src: string) => (src.startsWith('data:') ? src : `diwan://store/${src}`);

/**
 * يرسم اللوحة بقيمها.
 *
 * والخلفية تُرسم بدقّتها الأصلية تحت كل شيء، والعناصر فوقها بترتيب طبقاتها —
 * فلا يختفي حقلٌ خلف الخلفية كما يحدث في هذه البرامج.
 */
export function renderCanvasHtml(doc: Doc, values: Record<string, string> = {}, options: CanvasRenderOptions = {}): string {
  const canvas = doc.canvas;
  if (!canvas) return '';

  const opts = {
    dpi: options.dpi ?? 96,
    missing: options.missing ?? 'blank',
    marks: options.marks ?? canvas.cropMarks
  };
  const url = options.imageUrl ?? storeUrl;
  const fields = new Map(doc.fields.map((f) => [f.key, f]));
  const page = canvasPx(canvas, opts.dpi);

  const bg =
    canvas.background.kind === 'image'
      ? `<img alt="" src="${escapeHtml(url(canvas.background.src))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0"/>`
      : canvas.background.kind === 'color'
        ? `<div style="position:absolute;inset:0;background:${canvas.background.color};z-index:0"></div>`
        : canvas.background.kind === 'css'
          ? `<div style="position:absolute;inset:0;background:${canvas.background.style};z-index:0"></div>`
          : '';

  const ctx: RenderCtx = { canvas, values, fields, opts, url };
  // وعنصرٌ بنوعٍ لا يعرفه السجلّ (لم يمرّ بالتقويم) لا يُرسم ولا يُسقط الرسم — كما كان.
  const body = byLayer(canvas.elements)
    .filter((el) => !el.hidden)
    .map((el) => kindSpec(el)?.render(el, ctx) ?? '')
    .join('');

  const marks = opts.marks && canvas.bleed > 0 ? cropMarks(canvas, opts.dpi) : '';

  return `<div data-canvas style="position:relative;width:${page.w}px;height:${page.h}px;overflow:hidden;background:#fff">` + `${bg}${body}${marks}</div>`;
}

/**
 * علامات القصّ: أربع زوايا خارج حدّ التصميم.
 *
 * فالمطبعة تقصّ على الحدّ، والنزفُ ما يُؤكل — وبغير العلامات يُقصّ بالتخمين.
 */
function cropMarks(canvas: Canvas, dpi: number): string {
  const b = mmToPx(canvas.bleed, dpi);
  const len = mmToPx(Math.min(canvas.bleed, BLEED_MM), dpi);
  const thin = Math.max(1, Math.round(dpi / 300));
  const line = (style: string) => `<div style="position:absolute;background:#000;z-index:9999;${style}"></div>`;

  const w = mmToPx(canvas.size.w, dpi);
  const h = mmToPx(canvas.size.h, dpi);
  const out: string[] = [];
  for (const y of [b, b + h]) {
    out.push(line(`top:${y}px;right:0;width:${len}px;height:${thin}px`));
    out.push(line(`top:${y}px;left:0;width:${len}px;height:${thin}px`));
  }
  for (const x of [b, b + w]) {
    out.push(line(`right:${x}px;top:0;height:${len}px;width:${thin}px`));
    out.push(line(`right:${x}px;bottom:0;height:${len}px;width:${thin}px`));
  }
  return out.join('');
}
