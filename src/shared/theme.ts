/**
 * مظهر ديوان الواحد: العسلي والسيان (ر192، D241) بعد اعتماد النموذج المستقل.
 * الفعل عسلي بنص كحلي؛ primary نص سيان داكن للروابط والأيقونات، فلا يصير النص عسليًا على الأبيض.
 * التوكنات مشتركة مع styles.css وTailwind؛ الورقة والطباعة ومقاساتهما كما هي.
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

/** مساحة العمل: النصوص الداكنة واضحة حتى على أغمق سطح، والعسلي في INTERACTION لا في النصوص. */
export const PALETTE: Palette = {
  background: '#F3F5F7',
  'on-background': '#12324D',
  surface: '#F3F5F7',
  'surface-bright': '#FAFBFC',
  'surface-dim': '#E8ECEF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-low': '#F7F9FA',
  'surface-container': '#EFF2F4',
  'surface-container-high': '#E9EDF0',
  'surface-container-highest': '#E2E7EA',
  'surface-variant': '#E2E7EA',
  'on-surface': '#12324D',
  'on-surface-variant': '#586775',
  outline: '#7A8892',
  'outline-variant': '#E2E7EA',
  'surface-tint': '#245E69',
  'inverse-surface': '#12324D',
  'inverse-on-surface': '#EFF2F4',
  'inverse-primary': '#63BFCB',
  primary: '#245E69',
  'on-primary': '#FFFFFF',
  'primary-container': '#245E69',
  'on-primary-container': '#FFFFFF',
  'primary-fixed': '#EDF8FA',
  'primary-fixed-dim': '#DFF2F5',
  'on-primary-fixed': '#12324D',
  'on-primary-fixed-variant': '#245E69',
  secondary: '#245E69',
  'on-secondary': '#FFFFFF',
  'secondary-container': '#245E69',
  'on-secondary-container': '#FFFFFF',
  'secondary-fixed': '#EDF8FA',
  'secondary-fixed-dim': '#DFF2F5',
  'on-secondary-fixed': '#12324D',
  'on-secondary-fixed-variant': '#245E69',
  tertiary: '#704A1C',
  'on-tertiary': '#FFFFFF',
  'tertiary-container': '#FFF0DA',
  'on-tertiary-container': '#6B3A00',
  'tertiary-fixed': '#FFF0DA',
  'tertiary-fixed-dim': '#F5B866',
  'on-tertiary-fixed': '#3D2200',
  'on-tertiary-fixed-variant': '#6B3A00',
  error: '#B8262C',
  'on-error': '#FFFFFF',
  'error-container': '#FCE4E3',
  'on-error-container': '#8A1519',
  scrim: '#14202A'
};

/** ألوان اللمس: لا تُستعمل درجات العسلي أو السيان الفاتحة لنص صغير على الأبيض. */
export const INTERACTION = {
  honey: '#EFA04A',
  'honey-light': '#F5B866',
  'honey-hover': '#E39339',
  'honey-hover-light': '#F1AD56',
  'honey-pressed': '#F6B76A',
  cyan: '#63BFCB',
  disabled: '#E6E8E6',
  'on-disabled': '#60676E'
} as const;

/** السكّة: لوحٌ أبيض، والمرور فيها سماويٌّ باهت، والمحدَّد بالتدرّج (`Sidebar.tsx`). وما سوى ذلك كمساحة العمل. */
export const RAIL: Palette = {
  ...PALETTE,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-high': '#EDF8FA'
};

/** السكّة في الصفحة. */
export const RAIL_SELECTOR = '[data-sidebar="rail"]';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** المتغيّرات كما تُكتب في `styles.css` (بين `theme:start` و`theme:end` — يطابقها الاختبار). */
export function themeCss(): string {
  const block = (p: Palette) => COLOR_ROLES.map((r) => `--c-${r}:${rgb(p[r]).join(' ')};`).join('');
  const accents = Object.entries(INTERACTION).map(([name, hex]) => `--i-${name}:${rgb(hex).join(' ')};`).join('');
  return `:root{color-scheme:light;${block(PALETTE)}${accents}}\n${RAIL_SELECTOR}{${block(RAIL)}}`;
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
