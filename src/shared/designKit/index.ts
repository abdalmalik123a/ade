/**
 * محرّك التصاميم — نوعٌ × نمطٌ × لوحةٌ × هويّةُ الجهة ⇒ لوحةٌ جاهزة للتحرير.
 *
 * يحلّ محلّ المعرض القديم (عشرُ دوالّ بلونٍ واحد وزخرفةٍ واحدة): اثنا عشر نوعًا
 * بخمسة أنماط وستّ لوحات، ولوحةٌ سابعة من شعار المدرسة نفسها. والناتج لوحةٌ
 * عادية (`Canvas`) — تُحرَّر وتُحفظ وتُدمج كأيّ تصميم، فلا مسار خاصّ لها بعد البناء.
 *
 * والخلفية SVG داخل الوثيقة (عنوان بيانات) بمقاس الورقة **مع النزف**: ما يلامس
 * الحافّة يمتدّ فيه، فلا يظهر خيطٌ أبيض بعد القصّ.
 */
import {
  barcodeElement,
  canvasDoc,
  emptyCanvas,
  imageElement,
  textElement,
  type Canvas,
  type CanvasElement,
  type CanvasSize
} from '../canvas';
import { reconcileFields, tokenInlines, type Doc } from '../doc';
import { PALETTES, paletteFrom, type Palette } from './color';
import { KINDS, SAMPLE, kindOf, type Decor, type KindSpec, type Rect } from './kinds';
import { U, ctxOf, n } from './ornaments';
import { STYLES, styleOf, type Style, type StyleCtx } from './styles';

export { KINDS, STYLES, PALETTES, SAMPLE, kindOf, styleOf, paletteFrom };
export { dominantColor } from './color';
export type { KindSpec, Style, Palette };

/** هويّة الجهة: اسمُها وشعارُها — وبهما تصير العيّنة تصميمَ هذه المدرسة. */
export type Brand = { name?: string; logo?: string | null };

const svgUrl = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** بذرةٌ من المفتاحين — فالقصاصات في «براعم» ثابتةٌ لكل نوع، لا تتبدّل بكل رسم. */
function seedOf(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** ما يلامس حافّة الورقة يمتدّ في النزف. */
function bleedOut(at: Rect, bx: number, by: number): Rect {
  let [x, y, w, h] = at;
  if (x <= 0) {
    w += bx - x;
    x = -bx;
  }
  if (x + w >= 1) w += bx;
  if (y <= 0) {
    h += by - y;
    y = -by;
  }
  if (y + h >= 1) h += by;
  return [x, y, w, h];
}

/** الخلفية: الورق، ثم إطار النمط، ثم قطع التخطيط — كلّها SVG واحد. */
export function backgroundSvg(kind: KindSpec, style: Style, p: Palette, logo = false): string {
  const base = ctxOf(kind.size.w, kind.size.h);
  const B = kind.bleed * U;
  const c: StyleCtx = { ...base, p, family: kind.family, seed: seedOf(kind.key + style.key), B, logo };
  const layout = kind.layout(style.variant);
  const defs = new Set<string>();
  const parts: string[] = [];

  const frame = style.frame(c, [layout.calm, ...layout.texts.map((t) => t.at), ...layout.images.map((i) => i.at)]);
  if (frame.defs) defs.add(frame.defs);

  const decor = (d: Decor) => {
    const drawn = style.decor(d.t === 'band' ? { ...d, at: bleedOut(d.at, B / c.W, B / c.H) } : d, c);
    if (drawn.defs) defs.add(drawn.defs);
    return drawn.body;
  };
  // الأشرطة أولًا فالإطار فوقها لا تحتها، ثم البقيّة.
  const bands = layout.decor.filter((d) => d.t === 'band').map(decor);
  const rest = layout.decor.filter((d) => d.t !== 'band').map(decor);
  parts.push(...bands, frame.body, ...rest);

  const W = c.W + 2 * B;
  const H = c.H + 2 * B;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-B)} ${n(-B)} ${n(W)} ${n(H)}" width="${n(W / U)}mm" height="${n(H / U)}mm">` +
    `<defs>${[...defs].join('')}</defs>` +
    `<rect x="${n(-B)}" y="${n(-B)}" width="${n(W)}" height="${n(H)}" fill="${style.paper(p)}"/>` +
    parts.join('') +
    `</svg>`
  );
}

/** التخطيط الأيسر ← صندوق اللوحة الأيمن: المحور الأفقي في اللوحة من اليمين. */
const toBox = (at: Rect) => ({ x: 1 - at[0] - at[2], y: at[1], w: at[2], h: at[3] });

export type DesignChoice = { kind: string; style: string; palette: Palette; brand?: Brand };

export function buildDesign({ kind: kindKey, style: styleKey, palette, brand }: DesignChoice): Canvas {
  const kind = kindOf(kindKey) ?? KINDS[0]!;
  const style = styleOf(styleKey);
  const layout = kind.layout(style.variant);
  const canvas = emptyCanvas(kind.size, kind.bleed);
  canvas.background = { kind: 'image', src: svgUrl(backgroundSvg(kind, style, palette, Boolean(brand?.logo))) };

  const elements: CanvasElement[] = [];
  let z = 1;
  for (const img of layout.images) {
    if (img.logo && !brand?.logo) continue; // بلا شعار: الختم الزخرفي يقوم مقامه.
    elements.push(
      imageElement({
        box: toBox(img.at),
        src: img.logo ? brand!.logo! : '',
        ref: img.ref,
        fit: img.fit,
        radius: img.radius,
        z: z++,
        name: img.logo ? 'شعار الجهة' : `صورة {${img.ref}}`,
        locked: img.logo ? false : undefined
      })
    );
  }
  // اسم الجهة إن عُرف يُكتب في التصميم نفسه لا حقلًا: فلا يُعاد كتابته لكل
  // بطاقة، ولا تحتاج قائمة الصفّ عمودًا له.
  const org = brand?.name?.trim();
  const bake = (text: string) => (org ? text.replace(/\{(الجهة|المدرسة|الدائرة)\}/g, org) : text);
  for (const slot of layout.texts) {
    const t = style.type(slot.role, palette, kind.family);
    elements.push(
      textElement({
        box: toBox(slot.at),
        inlines: tokenInlines(bake(slot.text)),
        size: n(slot.size * (t.scale ?? 1)),
        color: t.color,
        font: t.font,
        bold: t.bold,
        align: slot.align ?? 'center',
        vAlign: 'middle',
        dir: slot.dir ?? 'rtl',
        lineHeight: 1.35,
        fit: slot.fit ? 'shrink' : undefined,
        wordSpacing: t.wordSpacing,
        z: z++,
        name: bake(slot.text).length > 24 ? `${bake(slot.text).slice(0, 24)}…` : bake(slot.text)
      })
    );
  }
  for (const code of layout.codes ?? []) {
    elements.push(barcodeElement({ box: toBox(code.at), ref: code.ref, z: z++, name: `باركود {${code.ref}}` }));
  }
  canvas.elements = elements;
  return canvas;
}

/** الوثيقة المبنيّة بحقولها — ما يفتحه المحرّر ويحفظه. */
export function buildDoc(choice: DesignChoice, title?: string): Doc {
  const kind = kindOf(choice.kind) ?? KINDS[0]!;
  const doc = canvasDoc(buildDesign(choice), { title: title ?? kind.title, category: 'تصاميم' });
  doc.fields = reconcileFields(doc);
  return doc;
}

/** قيم العيّنة لنوع — واسم الجهة إن عُرف، فتبدو اللمحة تصميمَ هذه المدرسة. */
export function sampleValues(brand?: Brand): Record<string, string> {
  const name = brand?.name?.trim();
  return name ? { ...SAMPLE, الجهة: name, المدرسة: name } : { ...SAMPLE };
}

export const sizeLabel = (s: CanvasSize): string => `${s.w} × ${s.h} ملم`;
