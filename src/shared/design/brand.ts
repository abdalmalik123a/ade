/**
 * «طقم الجهة» (DESIGNS.md ٣٫٣): شعار الجهة ولونها وخطّها على **أيّ** تصميمٍ بضغطة — من المعرض، أو محفوظٍ قبل سنة، أو مستوردٍ
 * من Photoshop. حسابٌ خالص على اللوحة:
 *
 * - **اللون**: لا يُستبدل لونٌ بلون (فالدرجات المشتقّة — الأفتح للخلفيات والأعمق للأشرطة — لا تطابق)، بل تُعرف **عائلتا اللون**
 *   في التصميم: الغالبة (`primary`) والمرافقة البعيدة عنها (`accent`، الذهبيّ غالبًا)، ثمّ **يُدار تدرّج كلّ لونٍ** في العائلة إلى
 *   تدرّج لون الجهة وتبقى إضاءته — فالفاتح فاتحٌ والعميق عميق بلون الجهة. والرماديّ والأبيض والأسود كما هي. وخلفيات المعرض
 *   SVG فألوانها تُدار بالقاعدة نفسها.
 * - **الخطّ**: خطّ الجهة لكلّ نصٍّ وجدول — إلا الخطّ المكتوب (الرقعة) الذي تُكتب به الأسماء في الشهادات.
 * - **الشعار**: يحلّ محلّ «شعار الجهة» في التصميم، أو يُضاف في ركنه الأعلى إن لم يكن.
 */
import { newUuid } from '../doc';
import { familyOf, sameFamily, stackOf } from '../fonts';
import { fromHsl, paletteFrom, toHsl, type Palette } from './kit/color';
import type { Canvas, CanvasElement } from './model/types';
import type { Gradient, Paint } from './paint';

export type BrandKit = { color: string | null; font: string | null; logo: string | null };
export type BrandResult = { canvas: Canvas; colors: number; fonts: number; logo: 'replaced' | 'added' | null };

/** لونٌ في صفةٍ من صفات اللون في SVG — لا مرجعٌ (`url(#au)`) يشبه اللون. */
const SVG_COLOUR = /((?:fill|stroke|stop-color|flood-color|color)=")(#[0-9a-f]{6}|#[0-9a-f]{3})(")/gi;
/** خطوطٌ مكتوبةٌ للأسماء — لا يمسّها خطّ الجهة. */
const CALLIGRAPHIC = ['Aref Ruqaa'];

const full = (hex: string) => (hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex).toLowerCase();
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** لونٌ له لون: لا رماديّ ولا أبيض ولا أسود. */
const colourful = (hex: string) => {
  const h = toHsl(full(hex));
  return h.s >= 0.22 && h.l > 0.08 && h.l < 0.94;
};

/** ألوان العنصر النصّية — ما يُقرأ وما يُكتب بالقاعدة نفسها. */
function eachColour(el: CanvasElement, f: (c: string) => string): CanvasElement {
  const paint = (p: Paint | undefined): Paint | undefined => (typeof p === 'string' ? (p.startsWith('#') ? f(p) : p) : p ? grad(p) : p);
  const grad = (g: Gradient): Gradient => ({ ...g, stops: g.stops.map((s) => ({ ...s, color: s.color.startsWith('#') ? f(s.color) : s.color })) });
  switch (el.kind) {
    case 'text':
      return { ...el, color: el.color.startsWith('#') ? f(el.color) : el.color, ...(el.gradient && { gradient: grad(el.gradient) }) };
    case 'shape':
      return { ...el, ...(el.fill !== undefined && { fill: paint(el.fill) }), ...(el.stroke?.startsWith('#') && { stroke: f(el.stroke) }) };
    case 'path':
      return { ...el, ...(el.fill !== undefined && { fill: paint(el.fill) }), ...(el.stroke?.startsWith('#') && { stroke: f(el.stroke) }) };
    case 'table':
      return {
        ...el,
        ...(el.headerBg?.startsWith('#') && { headerBg: f(el.headerBg) }),
        ...(el.rowStyles && { rowStyles: el.rowStyles.map((r) => (r ? { ...r, ...(r.bg?.startsWith('#') && { bg: f(r.bg) }), ...(r.color?.startsWith('#') && { color: f(r.color) }) } : r)) })
      };
    case 'image':
      return el.frame?.color.startsWith('#') ? { ...el, frame: { ...el.frame, color: f(el.frame.color) } } : el;
    default:
      return el;
  }
}

/** خلفيةٌ SVG مضمَّنة (المعرض): نصّها وطريقة ترميزه — فتُعاد بعد تدوير ألوانها كما كانت. */
function svgOf(canvas: Canvas): { svg: string; wrap: (s: string) => string } | null {
  const bg = canvas.background;
  if (bg.kind !== 'image' || !bg.src.startsWith('data:image/svg+xml')) return null;
  const comma = bg.src.indexOf(',');
  const head = bg.src.slice(0, comma + 1);
  const body = bg.src.slice(comma + 1);
  if (head.includes(';base64')) return null;
  return { svg: decodeURIComponent(body), wrap: (s) => head + encodeURIComponent(s) };
}

/** وزن كلّ لونٍ ملوّن في التصميم: عناصره وخلفيّته. */
export function canvasColours(canvas: Canvas): Map<string, number> {
  const out = new Map<string, number>();
  const add = (c: string) => colourful(c) && out.set(full(c), (out.get(full(c)) ?? 0) + 1);
  for (const el of canvas.elements) eachColour(el, (c) => (add(c), c));
  if (canvas.background.kind === 'color' && canvas.background.color.startsWith('#')) add(canvas.background.color);
  for (const m of svgOf(canvas)?.svg.matchAll(SVG_COLOUR) ?? []) add(m[2]!);
  return out;
}

/** عائلتا اللون: تدرّج الغالبة، وتدرّج أثقل ما يبعد عنها ٤٠° فأكثر — و`null` لما ليس فيه. */
export function colourFamilies(colours: Map<string, number>): { primary: number | null; accent: number | null } {
  // مدرّجٌ بعشر درجات مرجَّحٌ بالتكرار.
  const bins = new Array<number>(36).fill(0);
  for (const [c, n] of colours) bins[Math.floor(toHsl(c).h / 10) % 36]! += n;
  const best = (skip: number | null) => {
    let at = -1;
    for (let i = 0; i < 36; i++) if (bins[i]! > 0 && (skip === null || hueDist(i * 10 + 5, skip) >= 40) && (at < 0 || bins[i]! > bins[at]!)) at = i;
    return at < 0 ? null : at * 10 + 5;
  };
  const first = best(null);
  const second = first === null ? null : best(first);
  // الذهبيّ مرافقٌ أبدًا (لغة المعرض): في الإسلاميّ يكثر خطّه حتى يغلب الأزرق عددًا، وهو ليس لون الجهة.
  const gold = (h: number | null) => h !== null && h >= 30 && h <= 60;
  if (gold(first) && second !== null && !gold(second)) return { primary: second, accent: first };
  return { primary: first, accent: second };
}

/** يدير تدرّج اللون إلى عائلة الجهة إن كان من إحدى العائلتين — وإضاءته كما هي. */
export function shiftColour(hex: string, from: { primary: number | null; accent: number | null }, to: Palette): string {
  if (!colourful(hex)) return hex;
  const c = toHsl(full(hex));
  const target = from.primary !== null && hueDist(c.h, from.primary) <= 30 ? to.primary : from.accent !== null && hueDist(c.h, from.accent) <= 30 ? to.accent : null;
  if (!target) return hex;
  const t = toHsl(target);
  return fromHsl({ h: t.h, s: (c.s + t.s) / 2, l: c.l });
}

/** الطقم على اللوحة — ونسخةٌ جديدة لا تُمسّ بها الأولى (فالتراجع يعيدها). */
export function applyBrand(canvas: Canvas, kit: BrandKit): BrandResult {
  let colours = 0;
  let fonts = 0;
  let next: Canvas = { ...canvas, elements: canvas.elements.map((el) => ({ ...el })) as CanvasElement[] };

  if (kit.color) {
    const palette = paletteFrom(kit.color, 'الجهة');
    const families = colourFamilies(canvasColours(canvas));
    const f = (c: string) => {
      const out = shiftColour(c, families, palette);
      if (out !== c) colours++;
      return out;
    };
    next.elements = next.elements.map((el) => eachColour(el, f));
    const svg = svgOf(next);
    if (svg) next.background = { ...(next.background as Extract<Canvas['background'], { kind: 'image' }>), src: svg.wrap(svg.svg.replace(SVG_COLOUR, (_m, a: string, c: string, b: string) => a + f(c) + b)) };
    else if (next.background.kind === 'color' && next.background.color.startsWith('#')) next.background = { kind: 'color', color: f(next.background.color) };
  }

  if (kit.font) {
    const stack = stackOf(kit.font);
    next.elements = next.elements.map((el) => {
      if ((el.kind !== 'text' && el.kind !== 'table') || sameFamily(familyOf(el.font), kit.font!)) return el;
      if (CALLIGRAPHIC.some((c) => sameFamily(familyOf(el.font), c))) return el;
      fonts++;
      return { ...el, font: stack };
    });
  }

  let logo: BrandResult['logo'] = null;
  if (kit.logo) {
    const isLogo = (el: CanvasElement) => el.kind === 'image' && !el.ref && /شعار/.test(el.name ?? '');
    if (next.elements.some(isLogo)) {
      next.elements = next.elements.map((el) => (isLogo(el) && el.kind === 'image' ? { ...el, src: kit.logo! } : el));
      logo = 'replaced';
    } else {
      // في الركن الأعلى الأيمن (اللوحة عربية: x من اليمين)، مربّعًا بخُمس الضلع الأقصر.
      const side = Math.min(next.size.w, next.size.h) * 0.2;
      const z = next.elements.reduce((m, el) => Math.max(m, el.z), 0) + 1;
      next.elements = [
        ...next.elements,
        { id: newUuid(), kind: 'image', name: 'شعار الجهة', src: kit.logo, fit: 'contain', z, box: { x: 0.04, y: 0.04, w: side / next.size.w, h: side / next.size.h } }
      ];
      logo = 'added';
    }
  }
  return { canvas: next, colors: colours, fonts, logo };
}
