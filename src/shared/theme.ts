/**
 * مظهر ديوان — واحدٌ لا يُبدَّل (قرار المالك، ٤ تشرين الأول ٢٠٢٦، بعد تجربة الليليّ والنهاريّ):
 * مساحة عملٍ فاتحةٌ هادئة بأزرق-رماديّ خفيف، وبطاقاتٌ بيضاء، ونصٌّ بلون الحبر، ولونُ فعلٍ واحد
 * (أزرقُ نيليّ)، وذهبيٌّ خافتٌ للتمييز — وسكّةٌ كحليّة تحمل الشعار. الموظف ينظر طوال يومه إلى ورقٍ
 * أبيض، فالخلفية الفاتحة لا تُبهره بالفرق، والسكّة الداكنة تعطي الواجهة طابعها بلا وهجٍ ولا تدرّج.
 *
 * التوكنات متغيّراتٌ في `styles.css` (يطابقها `tests/theme.test.ts`)، وTailwind يأخذها
 * `rgb(var(--c-…) / <alpha-value>)` في `tailwind.config.cjs`. وتُكتب هنا يدويًّا.
 */

/** أسماء الأدوار كما يستعملها الكود (`bg-surface-container-low`، `text-on-surface-variant`…). */
export const COLOR_ROLES = [
  'background',
  'on-background',
  'surface',
  'surface-bright',
  'surface-dim',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'surface-variant',
  'on-surface',
  'on-surface-variant',
  'outline',
  'outline-variant',
  'surface-tint',
  'inverse-surface',
  'inverse-on-surface',
  'inverse-primary',
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'on-primary-fixed',
  'on-primary-fixed-variant',
  'secondary',
  'on-secondary',
  'secondary-container',
  'on-secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'on-secondary-fixed',
  'on-secondary-fixed-variant',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'tertiary-fixed',
  'tertiary-fixed-dim',
  'on-tertiary-fixed',
  'on-tertiary-fixed-variant',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'scrim'
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];
export type Palette = Record<ColorRole, string>;

/** مساحة العمل: كلّ ما سوى السكّة. */
export const PALETTE: Palette = {
  background: '#F1F3F7',
  'on-background': '#18202F',
  surface: '#F1F3F7',
  'surface-bright': '#F8F9FB',
  'surface-dim': '#E6E9EF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-low': '#F7F8FB',
  'surface-container': '#EEF1F6',
  'surface-container-high': '#E6EAF1',
  'surface-container-highest': '#DCE1EA',
  'surface-variant': '#DCE1EA',
  'on-surface': '#18202F',
  'on-surface-variant': '#535D70',
  outline: '#7D879A',
  'outline-variant': '#DDE2EA',
  'surface-tint': '#2A55CF',
  'inverse-surface': '#1E2638',
  'inverse-on-surface': '#EEF1F6',
  'inverse-primary': '#A9C1FF',
  primary: '#2A55CF',
  'on-primary': '#FFFFFF',
  'primary-container': '#2349B8',
  'on-primary-container': '#FFFFFF',
  'primary-fixed': '#E5ECFC',
  'primary-fixed-dim': '#C6D5F8',
  'on-primary-fixed': '#0E2366',
  'on-primary-fixed-variant': '#2349B8',
  secondary: '#2A55CF',
  'on-secondary': '#FFFFFF',
  'secondary-container': '#2349B8',
  'on-secondary-container': '#FFFFFF',
  'secondary-fixed': '#E5ECFC',
  'secondary-fixed-dim': '#C6D5F8',
  'on-secondary-fixed': '#0E2366',
  'on-secondary-fixed-variant': '#2349B8',
  tertiary: '#80570D',
  'on-tertiary': '#FFFFFF',
  'tertiary-container': '#F6EAD2',
  'on-tertiary-container': '#5E400B',
  'tertiary-fixed': '#F6EAD2',
  'tertiary-fixed-dim': '#E6CB91',
  'on-tertiary-fixed': '#3D2A06',
  'on-tertiary-fixed-variant': '#5E400B',
  error: '#B8262C',
  'on-error': '#FFFFFF',
  'error-container': '#FCE4E3',
  'on-error-container': '#8A1519',
  scrim: '#0B1220'
};

/** السكّة الكحليّة: أسطحها ونصّها، والمحدَّد فيها بلون الفعل. وما سوى ذلك كمساحة العمل. */
export const RAIL: Palette = {
  ...PALETTE,
  background: '#16223F',
  'on-background': '#F1F4FA',
  surface: '#16223F',
  'surface-bright': '#25355C',
  'surface-dim': '#121C35',
  'surface-container-lowest': '#16223F',
  'surface-container-low': '#1A2747',
  'surface-container': '#1E2C4F',
  'surface-container-high': '#25355C',
  'surface-container-highest': '#2D3E68',
  'surface-variant': '#2D3E68',
  'on-surface': '#F1F4FA',
  'on-surface-variant': '#B3BED6',
  outline: '#7F8DAD',
  'outline-variant': '#2D3E68',
  primary: '#3E66DB',
  'primary-container': '#3E66DB',
  secondary: '#A9C1FF',
  'on-secondary': '#0E2366',
  'primary-fixed': '#25355C',
  'primary-fixed-dim': '#2D3E68',
  'on-primary-fixed': '#F1F4FA',
  'on-primary-fixed-variant': '#A9C1FF',
  'secondary-fixed': '#25355C',
  'secondary-fixed-dim': '#2D3E68',
  'on-secondary-fixed': '#F1F4FA',
  'on-secondary-fixed-variant': '#A9C1FF',
  error: '#FF8A8E',
  'on-error': '#4A0508',
  'error-container': '#C9353B',
  'on-error-container': '#FFFFFF'
};

/** السكّة في الصفحة. */
export const RAIL_SELECTOR = '[data-sidebar="rail"]';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** المتغيّرات كما تُكتب في `styles.css` (بين `theme:start` و`theme:end` — يطابقها الاختبار). */
export function themeCss(): string {
  const block = (p: Palette) => COLOR_ROLES.map((r) => `--c-${r}:${rgb(p[r]).join(' ')};`).join('');
  return `:root{color-scheme:light;${block(PALETTE)}}\n${RAIL_SELECTOR}{${block(RAIL)}}`;
}

/** نسبة التباين بين لونين (WCAG 2) — والمعيار ٤٫٥ للنصّ. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = rgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
