/**
 * هوية «منتصف الليل» (خطّة الترقية، المرحلة ٦ — ن١٢): التوكنات بمظهرين، ليليٍّ افتراضيّ ونهاريّ،
 * متغيّراتٍ تُكتب في الصفحة فيأخذها Tailwind (`rgb(var(--c-…) / <alpha-value>)` في
 * `tailwind.config.cjs`) — فيبدّل المظهر بلا إعادة بناء. وتُكتب هنا يدويًّا: توليدها من `stitch_` توقّف.
 *
 * والورقة والصورة بيضاوان في المظهرين (styles.css): ما يُطبع لا يتبع المظهر.
 */

export type ThemeName = 'dark' | 'light';

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

/** تدرّج MADA — للزرّ الأساسي والمحدَّد في السكّة ومربّعات الأيقونات والشعار وحدها. */
export const MADA = { from: '#1570DA', to: '#1446D8', glow: '#22D3EE' } as const;

export const THEMES: Record<ThemeName, Record<ColorRole, string>> = {
  // ليلي: خلفيةٌ بوهجين، وسطحٌ كحليّ، ونصٌّ فاتح، وأزرق النصّ على الداكن.
  dark: {
    background: '#060B1A',
    'on-background': '#EEF3FF',
    surface: '#060B1A',
    'surface-bright': '#18244A',
    'surface-dim': '#050915',
    'surface-container-lowest': '#0D1630',
    'surface-container-low': '#0A1226',
    'surface-container': '#0F1A38',
    'surface-container-high': '#16224A',
    'surface-container-highest': '#1C2954',
    'surface-variant': '#1C2954',
    'on-surface': '#EEF3FF',
    'on-surface-variant': '#9AA8CC',
    outline: '#6E7DA6',
    'outline-variant': '#1F2C54',
    'surface-tint': '#1570DA',
    'inverse-surface': '#EEF3FF',
    'inverse-on-surface': '#0B1633',
    'inverse-primary': '#1446D8',
    primary: '#1468CC',
    'on-primary': '#FFFFFF',
    'primary-container': '#1446D8',
    'on-primary-container': '#FFFFFF',
    'primary-fixed': '#14295C',
    'primary-fixed-dim': '#1B3878',
    'on-primary-fixed': '#EEF3FF',
    'on-primary-fixed-variant': '#8DB8FF',
    secondary: '#8DB8FF',
    'on-secondary': '#06122E',
    'secondary-container': '#1446D8',
    'on-secondary-container': '#FFFFFF',
    'secondary-fixed': '#14295C',
    'secondary-fixed-dim': '#1B3878',
    'on-secondary-fixed': '#EEF3FF',
    'on-secondary-fixed-variant': '#8DB8FF',
    tertiary: '#E2C78F',
    'on-tertiary': '#2A1F08',
    'tertiary-container': '#3A2C10',
    'on-tertiary-container': '#F3E9D6',
    'tertiary-fixed': '#3A2C10',
    'tertiary-fixed-dim': '#6E5320',
    'on-tertiary-fixed': '#F3E9D6',
    'on-tertiary-fixed-variant': '#E2C78F',
    error: '#FFB4AB',
    'on-error': '#690005',
    'error-container': '#93000A',
    'on-error-container': '#FFDAD6',
    scrim: '#000000'
  },
  // نهاري: خلفيةٌ زرقاء فاتحة جدًّا، وسطحٌ أبيض، ونصٌّ كحليّ.
  light: {
    background: '#EEF3FC',
    'on-background': '#0B1633',
    surface: '#EEF3FC',
    'surface-bright': '#F7F9FE',
    'surface-dim': '#E2E9F6',
    'surface-container-lowest': '#FFFFFF',
    'surface-container-low': '#F6F8FD',
    'surface-container': '#EEF3FC',
    'surface-container-high': '#E4EBF8',
    'surface-container-highest': '#D9E2F3',
    'surface-variant': '#D9E2F3',
    'on-surface': '#0B1633',
    'on-surface-variant': '#46536F',
    outline: '#6B7899',
    'outline-variant': '#D3DCEE',
    'surface-tint': '#1570DA',
    'inverse-surface': '#1B2647',
    'inverse-on-surface': '#EEF3FF',
    'inverse-primary': '#8DB8FF',
    primary: '#1468CC',
    'on-primary': '#FFFFFF',
    'primary-container': '#1446D8',
    'on-primary-container': '#FFFFFF',
    'primary-fixed': '#DCE7FD',
    'primary-fixed-dim': '#B9CEF8',
    'on-primary-fixed': '#061A45',
    'on-primary-fixed-variant': '#1446D8',
    secondary: '#1446D8',
    'on-secondary': '#FFFFFF',
    'secondary-container': '#1446D8',
    'on-secondary-container': '#FFFFFF',
    'secondary-fixed': '#DCE7FD',
    'secondary-fixed-dim': '#B9CEF8',
    'on-secondary-fixed': '#061A45',
    'on-secondary-fixed-variant': '#1446D8',
    tertiary: '#7D5F22',
    'on-tertiary': '#FFFFFF',
    'tertiary-container': '#F3E9D6',
    'on-tertiary-container': '#5C4419',
    'tertiary-fixed': '#F3E9D6',
    'tertiary-fixed-dim': '#E2C78F',
    'on-tertiary-fixed': '#3A2C10',
    'on-tertiary-fixed-variant': '#5C4419',
    error: '#BA1A1A',
    'on-error': '#FFFFFF',
    'error-container': '#FFDAD6',
    'on-error-container': '#93000A',
    scrim: '#000000'
  }
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** ما هو ورقٌ أو صورة: يبقى بألوان النهار في المظهرين — فالورقة بيضاء وما عليها كما يُطبع. */
export const PAPER_SELECTOR = '.paper,.a4-sheet,[data-letter-sheet],[data-design],[data-pdf-view],[data-photo-frame]';

/**
 * متغيّرات المظهرين كما تُكتب في `styles.css` (بين `theme:start` و`theme:end` — يطابقها الاختبار):
 * النهاريّ أصلٌ للجذر — فنافذة الطباعة وأنماط يوم الإصدار المحفوظة بلا مظهر — والليليّ بـ`data-theme`،
 * والورق نهاريٌّ دائمًا.
 */
export function themeCss(): string {
  const block = (name: ThemeName) => COLOR_ROLES.map((r) => `--c-${r}:${rgb(THEMES[name][r]).join(' ')};`).join('');
  return `:root{color-scheme:light;${block('light')}}
:root[data-theme="dark"]{color-scheme:dark;${block('dark')}}
${PAPER_SELECTOR}{color-scheme:light;${block('light')}}`;
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

export function normalizeTheme(raw: unknown): ThemeName {
  return raw === 'light' ? 'light' : 'dark';
}
