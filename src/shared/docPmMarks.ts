/**
 * علامات النصّ في المحرّر: مخطّطها، وقراءتها من HTML ملصوق (Word والمتصفّح)، وتحويلها إلى `Marks` الوثيقة والعكس.
 *
 * كانت في `docPm.ts` حتى بلغ سقفه، فنُقلت (محادثة «محرّر الكتاب»، البند ٣) ومعها ما نقص المحرّرَ عن Word: **الشطب،
 * وأعلى السطر وأسفله، ولون النصّ**. وكلٌّ منها يُطبع كما يُرى (`docHtml`) ويخرج إلى Word (`docDocx`)، ويُقرأ من لصق Word.
 */
import type { Mark, MarkSpec, Schema } from 'prosemirror-model';
import type { Marks } from './doc';
import { cleanFamily } from './fonts';

/** حجمٌ مكتوبٌ في CSS إلى بكسل: Word يكتب `14.0pt`، والمتصفّح `18.6667px`. */
export function cssSizeToPx(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(px|pt)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const px = (m[2] ?? 'px').toLowerCase() === 'pt' ? (n * 4) / 3 : n;
  return Math.round(px * 10) / 10;
}

/** أوّل خطٍّ في القائمة بلا علامات اقتباس — `"Simplified Arabic",serif` ← Simplified Arabic. */
export function firstFontFamily(value: string): string | null {
  const first = value.split(',')[0]?.trim().replace(/^["']|["']$/g, '').trim();
  if (!first || /^(serif|sans-serif|monospace|inherit|initial)$/i.test(first)) return null;
  return first;
}

/** ما يكتبه Word باسمه من الألوان القياسية — وغيرها يكتبه رقمًا. */
const NAMED: Record<string, number[]> = {
  red: [255, 0, 0],
  darkred: [139, 0, 0],
  maroon: [128, 0, 0],
  green: [0, 128, 0],
  darkgreen: [0, 100, 0],
  blue: [0, 0, 255],
  darkblue: [0, 0, 139],
  navy: [0, 0, 128],
  purple: [128, 0, 128],
  orange: [255, 165, 0],
  olive: [128, 128, 0],
  teal: [0, 128, 128],
  brown: [165, 42, 42],
  gray: [128, 128, 128],
  grey: [128, 128, 128]
};

/** اللون المحفوظ: `#rrggbb` وحده — فلا يدخل نمطَ الورقة غيرُه. */
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** قنوات اللون من CSS (`#rgb` و`#rrggbb` و`rgb()` واسم Word) — أو لا شيء. والشفّاف لا لون. */
function rgbOf(value: string): number[] | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  const fn = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(v);
  let rgb: number[] | null = null;
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!;
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (fn) {
    if (fn[4] !== undefined && Number(fn[4]) === 0) return null;
    rgb = [fn[1], fn[2], fn[3]].map(Number);
  } else {
    rgb = NAMED[v] ?? null;
  }
  return rgb && rgb.every((c) => c >= 0 && c <= 255) ? rgb : null;
}

const nearBlack = (rgb: number[]) => Math.max(...rgb) < 64;
const nearWhite = (rgb: number[]) => Math.min(...rgb) > 200;

/**
 * لون النصّ من CSS إلى `#rrggbb` — أو لا لون. **الأسود ومقاربُه «تلقائي»** (لون الورقة، فلا يُحفظ)، **والأبيض ومقاربُه لا
 * يُقرأ**: الورقة بيضاء أبدًا، ونصٌّ نُسخ من شاشةٍ داكنة يحمل لونًا فاتحًا فيختفي عليها.
 */
export function cssColor(value: string): string | null {
  const rgb = rgbOf(value);
  if (!rgb || nearBlack(rgb) || nearWhite(rgb)) return null;
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** لونٌ فاتحٌ لا يُقرأ (`cssColor`) — يُكتب أسود، فيُقال في «ما جرى في الاستيراد». */
export function lightColor(value: string): boolean {
  const rgb = rgbOf(value);
  return Boolean(rgb && nearWhite(rgb));
}

/** لون Word (`<w:color w:val="C00000"/>`) بالقاعدة نفسها — و«auto» وما ليس رقمًا لا لون. */
export const wordColor = (val: string | undefined): string | null => (val && /^[0-9a-f]{6}$/i.test(val) ? cssColor(`#${val}`) : null);

const lineThrough = (v: unknown) => (/line-through/.test(v as string) ? null : false);

/** عناصر HTML تُقرأ بلا نمط — والمخطّط لا يحتاج DOM (يُبنى مع العملية الرئيسة أيضًا). */
type DomEl = { style: { fontWeight: string } };

/**
 * العلامات بترتيبها: الخمس الأولى من المرحلة ١ (العريض والمائل والتسطير والحجم والخطّ)، ثم ما زاد في البند ٣.
 * وأعلى السطر وأسفله لا يجتمعان (`excludes`) — كما في Word: اختيار أحدهما يرفع الآخر.
 */
export const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (el) => ((el as unknown as DomEl).style.fontWeight !== 'normal' ? null : false) },
      { style: 'font-weight', getAttrs: (v) => (/^(bold(er)?|[6-9]\d\d)$/.test(v as string) ? null : false) }
    ],
    toDOM: () => ['strong', 0]
  },
  italic: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0]
  },
  underline: {
    parseDOM: [
      { tag: 'u' },
      { style: 'text-decoration', getAttrs: (v) => (/underline/.test(v as string) ? null : false) },
      { style: 'text-decoration-line', getAttrs: (v) => (/underline/.test(v as string) ? null : false) }
    ],
    toDOM: () => ['u', 0]
  },
  size: {
    attrs: { px: {} },
    parseDOM: [
      {
        style: 'font-size',
        getAttrs: (v) => {
          const px = cssSizeToPx(v as string);
          return px ? { px } : false;
        }
      }
    ],
    toDOM: (mark) => ['span', { style: `font-size:${mark.attrs.px}px`, 'data-size': String(mark.attrs.px) }, 0]
  },
  font: {
    attrs: { family: {} },
    parseDOM: [
      {
        style: 'font-family',
        getAttrs: (v) => {
          const family = firstFontFamily(v as string);
          return family ? { family } : false;
        }
      }
    ],
    toDOM: (mark) => ['span', { style: `font-family:'${mark.attrs.family}'`, 'data-font': mark.attrs.family }, 0]
  },
  strike: {
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { tag: 'del' },
      { style: 'text-decoration', getAttrs: lineThrough },
      { style: 'text-decoration-line', getAttrs: lineThrough }
    ],
    toDOM: () => ['s', 0]
  },
  sup: {
    excludes: 'sup sub',
    parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
    toDOM: () => ['sup', 0]
  },
  sub: {
    excludes: 'sup sub',
    parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
    toDOM: () => ['sub', 0]
  },
  color: {
    attrs: { hex: {} },
    parseDOM: [
      {
        style: 'color',
        getAttrs: (v) => {
          const hex = cssColor(v as string);
          return hex ? { hex } : false;
        }
      }
    ],
    toDOM: (mark) => ['span', { style: `color:${mark.attrs.hex}`, 'data-color': mark.attrs.hex }, 0]
  }
};

/** تنسيق المقطع في الوثيقة ← علامات المحرّر. وما لا يُعرف (أعلى سطرٍ بغير اسمه، لونٌ بغير صيغته) يُترك. */
export function marksOf(m: Marks | undefined, schema: Schema): Mark[] {
  if (!m) return [];
  const M = schema.marks;
  const out: Mark[] = [];
  if (m.bold) out.push(M.bold!.create());
  if (m.italic) out.push(M.italic!.create());
  if (m.underline) out.push(M.underline!.create());
  if (m.size) out.push(M.size!.create({ px: m.size }));
  if (m.font) out.push(M.font!.create({ family: m.font }));
  if (m.strike) out.push(M.strike!.create());
  if (m.script === 'sup' || m.script === 'sub') out.push(M[m.script]!.create());
  if (isHexColor(m.color)) out.push(M.color!.create({ hex: m.color.toLowerCase() }));
  return out;
}

/** علامات المحرّر ← تنسيق المقطع في الوثيقة. */
export function marksFrom(list: readonly Mark[]): Marks | undefined {
  const out: Marks = {};
  for (const mk of list) {
    const name = mk.type.name;
    if (name === 'bold') out.bold = true;
    else if (name === 'italic') out.italic = true;
    else if (name === 'underline') out.underline = true;
    else if (name === 'size') out.size = mk.attrs.px as number;
    else if (name === 'font') out.font = mk.attrs.family as string;
    else if (name === 'strike') out.strike = true;
    else if (name === 'sup' || name === 'sub') out.script = name;
    else if (name === 'color') out.color = mk.attrs.hex as string;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * المقطع بتنسيقه في الورقة التي تُطبع (`docHtml`) — `html` نصّه وقد هُرِّب. واسم الخطّ نظيفًا (`cleanFamily`) واللون بصيغته
 * وحدها (`isHexColor`): كلاهما يُكتب في نمطٍ مضمَّن، وما جاء من Word أو من ملفٍّ مستورد لا يُوثق به.
 */
export function marksHtml(m: Marks | undefined, html: string): string {
  if (!m) return html;
  let out = html;
  if (m.font && cleanFamily(m.font)) out = `<span style="font-family:'${cleanFamily(m.font)}'">${out}</span>`;
  if (m.size) out = `<span style="font-size:${m.size}px">${out}</span>`;
  if (isHexColor(m.color)) out = `<span style="color:${m.color}">${out}</span>`;
  if (m.script === 'sup' || m.script === 'sub') out = `<${m.script}>${out}</${m.script}>`;
  if (m.strike) out = `<s>${out}</s>`;
  if (m.underline) out = `<u>${out}</u>`;
  if (m.italic) out = `<em>${out}</em>`;
  if (m.bold) out = `<strong>${out}</strong>`;
  return out;
}
