/**
 * الطلاء المشترك (DESIGNS.md ١٫٣): التدرّج — خطّيٌّ بزاويته أو دائريّ — والخطّ المنقّط والمتقطّع. خاصّيّاتٌ لا نوع: يأخذها
 * الشكل والشكل الحرّ والنصّ وإطار الصورة من هنا بقاعدةٍ واحدة، والشفافية في صندوق العنصر نفسه (`render/box.ts`).
 *
 * والتدرّج يبقى متّجهًا في PDF (تجربة ٠٫١٠: `/ShadingType` لا صورة).
 */
import { cssColor } from './shapes';

export type GradientStop = { offset: number; color: string };
export type Gradient = { type: 'linear' | 'radial'; /** بالدرجات، للخطّي: ٠ من اليسار إلى اليمين، و٩٠ من الأعلى إلى الأسفل. */ angle: number; stops: GradientStop[] };
/** لونٌ واحد، أو تدرّج. */
export type Paint = string | Gradient;
export type Dash = 'dashed' | 'dotted';

export const isGradient = (p: Paint | undefined): p is Gradient => typeof p === 'object' && p !== null;

/** التدرّج المحفوظ مقوَّمًا: نقطتان إلى ثمانٍ بألوانٍ آمنة ومواضع بين ٠ و١ مرتّبة — والتالف عدم. */
export function normalizeGradient(raw: unknown): Gradient | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as Record<string, unknown>;
  if (!Array.isArray(g.stops)) return undefined;
  const stops = (g.stops as unknown[])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .slice(0, 8)
    .map((s) => ({ offset: Math.min(1, Math.max(0, typeof s.offset === 'number' && Number.isFinite(s.offset) ? s.offset : 0)), color: cssColor(s.color, '#000000') }))
    .sort((a, b) => a.offset - b.offset);
  if (stops.length < 2) return undefined;
  const angle = typeof g.angle === 'number' && Number.isFinite(g.angle) ? ((Math.round(g.angle) % 360) + 360) % 360 : 0;
  return { type: g.type === 'radial' ? 'radial' : 'linear', angle, stops };
}

/** لونٌ أو تدرّجٌ محفوظ — أو عدم. */
export function normalizePaint(raw: unknown, fallback: string): Paint | undefined {
  if (raw === undefined || raw === null || raw === 'none') return undefined;
  return typeof raw === 'object' ? normalizeGradient(raw) : cssColor(raw, fallback);
}

export const normalizeDash = (raw: unknown): Dash | undefined => (raw === 'dashed' || raw === 'dotted' ? raw : undefined);

const pct = (o: number) => `${Math.round(o * 1000) / 10}%`;

/** تدرّج CSS — لخلفية الشكل ولملء النصّ. وزاوية CSS من الأعلى مع عقارب الساعة، فتُحوَّل. */
export function cssGradient(g: Gradient): string {
  const stops = g.stops.map((s) => `${s.color} ${pct(s.offset)}`).join(', ');
  return g.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${(g.angle + 90) % 360}deg, ${stops})`;
}

/** لونٌ أو تدرّجٌ خلفيةً في CSS. */
export const cssPaint = (p: Paint | undefined, none = 'transparent'): string => (p === undefined ? none : isGradient(p) ? cssGradient(p) : p);

/** تعريف التدرّج في SVG بمعرّفه — يُملأ به الشكل الحرّ وإطار الصورة (`fill="url(#…)"`). */
export function svgGradient(id: string, g: Gradient): string {
  const stops = g.stops.map((s) => `<stop offset="${pct(s.offset)}" stop-color="${s.color}"/>`).join('');
  return g.type === 'radial'
    ? `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`
    : `<linearGradient id="${id}" gradientTransform="rotate(${g.angle} 0.5 0.5)">${stops}</linearGradient>`;
}

/** نقشُ الحدّ في SVG بسُمكه — والمنقّط نقاطٌ مدوّرة. */
export function svgDash(dash: Dash | undefined, width: number): string {
  if (!dash) return '';
  return dash === 'dotted' ? ` stroke-dasharray="0 ${(width * 2).toFixed(2)}" stroke-linecap="round"` : ` stroke-dasharray="${(width * 3).toFixed(2)} ${(width * 2).toFixed(2)}"`;
}

/** معرّفٌ صالحٌ في SVG من معرّف العنصر. */
export const paintId = (elementId: string, part: string) => `${part}-${elementId.replace(/[^\w-]/g, '')}`;
