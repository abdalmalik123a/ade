/**
 * رسم اللوحة علاماتٍ — محرّكٌ واحد للمعاينة والطباعة، كما في `docHtml.ts`.
 *
 * والدقّة وسيطٌ لا ثابت: الشاشة ٩٦ والطابعة ٣٠٠، والعلامات نفسها. فما يراه
 * الموظف هو ما يخرج من الطابعة لأنه الكود نفسه — ووجود نسختين من الرسم يعني
 * شهادتين مختلفتين لتصميمٍ واحد.
 *
 * والمواضع نِسَبٌ من **مقاس التصميم** (بلا النزف)، والنزف إزاحةٌ حول ذلك.
 * فتغيير المقاس لا يزيح حقلًا، وهو أكثر ما يكسر التصاميم المستوردة.
 */
import {
  BLEED_MM,
  byLayer,
  canvasPx,
  mmToPx,
  ptToPx,
  type Canvas,
  type CanvasElement,
  type TextElement
} from './canvas';
import type { Doc, DocField, Inline } from './doc';
import { escapeHtml, type MissingMode } from './docHtml';

export type CanvasRenderOptions = {
  /** نقطة/إنش: ٩٦ للشاشة و٣٠٠ للطباعة. */
  dpi?: number;
  missing?: MissingMode;
  /** علامات القصّ تُرسم مع النزف — وتُخفى في المعاينة الصغيرة. */
  marks?: boolean;
  /** مسارٌ يحوّل مرجع الصورة إلى عنوانٍ يفتحه المتصفّح. */
  imageUrl?: (src: string) => string;
};

const storeUrl = (src: string) => `diwan://store/${src}`;

/** فراغٌ بطول ما كُتب — لا ينكمش فتتشوّه اللوحة. */
function blank(field: DocField | undefined): string {
  return `<span style="display:inline-block;min-width:${field?.width ?? 10}ch;border-bottom:1px dotted currentColor">&nbsp;</span>`;
}

function inlinesHtml(
  inlines: Inline[],
  values: Record<string, string>,
  fields: Map<string, DocField>,
  missing: MissingMode
): string {
  return inlines
    .map((node) => {
      if (node.kind === 'break') return '<br/>';
      if (node.kind === 'run') {
        let out = escapeHtml(node.text);
        const m = node.marks;
        if (m?.underline) out = `<u>${out}</u>`;
        if (m?.bold) out = `<strong>${out}</strong>`;
        return out;
      }
      const value = values[node.ref];
      if (value) return escapeHtml(value);
      if (missing === 'hide') return '';
      if (missing === 'blank') return blank(fields.get(node.ref));
      return `{${escapeHtml(node.ref)}}`;
    })
    .join('');
}

/** الصندوق موضعًا مطلقًا بالبكسل — النِّسَب من التصميم، والنزف إزاحة. */
function boxStyle(el: CanvasElement, canvas: Canvas, dpi: number): string {
  const offset = mmToPx(canvas.bleed, dpi);
  const w = mmToPx(canvas.size.w, dpi);
  const h = mmToPx(canvas.size.h, dpi);
  const parts = [
    'position:absolute',
    `right:${offset + el.box.x * w}px`,
    `top:${offset + el.box.y * h}px`,
    `width:${el.box.w * w}px`,
    `height:${el.box.h * h}px`,
    `z-index:${el.z}`
  ];
  if (el.rotate) parts.push(`transform:rotate(${-el.rotate}deg)`);
  return parts.join(';');
}

const V_ALIGN: Record<TextElement['vAlign'], string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const H_ALIGN: Record<string, string> = {
  right: 'flex-end',
  left: 'flex-start',
  center: 'center',
  justify: 'stretch'
};

function textHtml(
  el: TextElement,
  canvas: Canvas,
  values: Record<string, string>,
  fields: Map<string, DocField>,
  opts: Required<Omit<CanvasRenderOptions, 'imageUrl'>>
): string {
  const inner = inlinesHtml(el.inlines, values, fields, opts.missing);
  const style = [
    boxStyle(el, canvas, opts.dpi),
    'display:flex',
    `align-items:${V_ALIGN[el.vAlign]}`,
    `justify-content:${H_ALIGN[el.align] ?? 'center'}`,
    `text-align:${el.align}`,
    // الحجم بالنقاط يصير بكسلات عند الدقّة المطلوبة — فالطباعة لا تتصاغر.
    `font-size:${ptToPx(el.size, opts.dpi)}px`,
    `line-height:${el.lineHeight ?? 1.4}`,
    `color:${el.color}`,
    el.font ? `font-family:${el.font}` : '',
    el.bold ? 'font-weight:700' : '',
    el.italic ? 'font-style:italic' : '',
    'overflow:hidden'
  ]
    .filter(Boolean)
    .join(';');
  return `<div dir="${el.dir ?? 'rtl'}" style="${style}"><span style="width:100%">${inner}</span></div>`;
}

/**
 * يرسم اللوحة بقيمها.
 *
 * والخلفية تُرسم بدقّتها الأصلية تحت كل شيء، والعناصر فوقها بترتيب طبقاتها —
 * فلا يختفي حقلٌ خلف الخلفية كما يحدث في هذه البرامج.
 */
export function renderCanvasHtml(
  doc: Doc,
  values: Record<string, string> = {},
  options: CanvasRenderOptions = {}
): string {
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
        : '';

  const body = byLayer(canvas.elements)
    .map((el) => {
      switch (el.kind) {
        case 'text':
          return textHtml(el, canvas, values, fields, opts);
        case 'image': {
          const src = (el.ref && values[el.ref]) || el.src;
          if (!src) return '';
          const radius = el.radius ? `;border-radius:${el.radius}%` : '';
          return `<img alt="" src="${escapeHtml(url(src))}" style="${boxStyle(el, canvas, opts.dpi)};object-fit:${el.fit}${radius}"/>`;
        }
        case 'barcode': {
          const value = (el.ref && values[el.ref]) || el.value;
          // الرسم الفعلي يُحقن عند العرض؛ وهنا موضعه وقيمته فلا يُنسى مكانه.
          return `<div data-barcode="${escapeHtml(el.symbology)}" data-value="${escapeHtml(value)}" style="${boxStyle(el, canvas, opts.dpi)}"></div>`;
        }
        case 'shape': {
          const radius =
            el.shape === 'ellipse'
              ? ';border-radius:50%'
              : el.radius
                ? `;border-radius:${el.radius}px`
                : '';
          const border = el.stroke
            ? `;border:${(el.strokeWidth ?? 1) * (opts.dpi / 96)}px solid ${el.stroke}`
            : '';
          return `<div style="${boxStyle(el, canvas, opts.dpi)};background:${el.fill ?? 'transparent'}${border}${radius}"></div>`;
        }
      }
    })
    .join('');

  const marks = opts.marks && canvas.bleed > 0 ? cropMarks(canvas, opts.dpi) : '';

  return (
    `<div data-canvas style="position:relative;width:${page.w}px;height:${page.h}px;overflow:hidden;background:#fff">` +
    `${bg}${body}${marks}</div>`
  );
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
  const line = (style: string) =>
    `<div style="position:absolute;background:#000;z-index:9999;${style}"></div>`;

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
