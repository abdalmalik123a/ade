/**
 * مظهر ديوان — واحدٌ لا يُبدَّل (ر067)، وهو «ب٢» منذ ر175 (٢٤ تشرين الأول ٢٠٢٦، اعتمده المالك من لوحة «الشبّاك — الوجبة الثانية»):
 * أسطحٌ بيضاء على أرضيةٍ بيضاء مائلة للرمادي، ونصٌّ بلون الحبر، ولونُ فعلٍ أزرق، والسكّة والرأس لوحان أبيضان عائمان.
 * وتدرّج السماويّ إلى الأزرق (`bg-grad-act` في `tailwind.config.cjs`) لأفعال الإخراج والوجهة المحدّدة — يقع النصّ الأبيض على أزرقه.
 * والبرتقاليّ (#F89800، وتدرّجه `bg-grad-orange`) **صبغةٌ لا دور**: للشارة والعدد بنصٍّ بلون الحبر، ولا يُكتب به نصٌّ على الأبيض.
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

/**
 * مساحة العمل: كلّ ما سوى السكّة. وعن «ب٢» فرقان مقصودان: `on-surface-variant` و`secondary` أغمق قليلًا،
 * لأنّهما يُكتبان على أغمق الأسطح (`-highest`) أيضًا فيبقيان فوق ٤٫٥.
 */
export const PALETTE: Palette = {
  background: '#F3F5F7',
  'on-background': '#24343D',
  surface: '#F3F5F7',
  'surface-bright': '#FAFBFC',
  'surface-dim': '#E8ECEF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-low': '#F7F9FA',
  'surface-container': '#EFF2F4',
  'surface-container-high': '#E9EDF0',
  'surface-container-highest': '#E2E7EA',
  'surface-variant': '#E2E7EA',
  'on-surface': '#24343D',
  'on-surface-variant': '#56646E',
  outline: '#7A8892',
  'outline-variant': '#E2E7EA',
  'surface-tint': '#0872A3',
  'inverse-surface': '#24343D',
  'inverse-on-surface': '#EFF2F4',
  'inverse-primary': '#8CDCEB',
  primary: '#0872A3',
  'on-primary': '#FFFFFF',
  'primary-container': '#06608B',
  'on-primary-container': '#FFFFFF',
  'primary-fixed': '#E6F3F9',
  'primary-fixed-dim': '#C6E3F0',
  'on-primary-fixed': '#04425F',
  'on-primary-fixed-variant': '#06608B',
  secondary: '#066A98',
  'on-secondary': '#FFFFFF',
  'secondary-container': '#0872A3',
  'on-secondary-container': '#FFFFFF',
  'secondary-fixed': '#E7F9FC',
  'secondary-fixed-dim': '#BDEAF4',
  'on-secondary-fixed': '#04425F',
  'on-secondary-fixed-variant': '#06608B',
  tertiary: '#8A4B00',
  'on-tertiary': '#FFFFFF',
  'tertiary-container': '#FFF3DF',
  'on-tertiary-container': '#6B3A00',
  'tertiary-fixed': '#FFF3DF',
  'tertiary-fixed-dim': '#FFD79A',
  'on-tertiary-fixed': '#3D2200',
  'on-tertiary-fixed-variant': '#6B3A00',
  error: '#B8262C',
  'on-error': '#FFFFFF',
  'error-container': '#FCE4E3',
  'on-error-container': '#8A1519',
  scrim: '#14202A'
};

/** السكّة: لوحٌ أبيض، والمرور فيها سماويٌّ باهت، والمحدَّد بالتدرّج (`Sidebar.tsx`). وما سوى ذلك كمساحة العمل. */
export const RAIL: Palette = {
  ...PALETTE,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-high': '#E7F9FC'
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
