/**
 * مظهر ديوان الواحد («ب٢»، ر175): كلّ نصٍّ بتباين ٤٫٥ فأكثر — في مساحة العمل وفي السكّة.
 * يُفحص كلّ لون نصٍّ على كلّ سطح، وكلّ «on-X» على «X».
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, PALETTE, RAIL, contrast, themeCss, type ColorRole, type Palette } from '../src/shared/theme';

const SURFACES: ColorRole[] = [
  'background',
  'surface',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest'
];
/** ألوانٌ تُكتب بها النصوص على السطوح مباشرة. */
const TEXTS: ColorRole[] = ['on-surface', 'on-surface-variant', 'secondary', 'error', 'tertiary'];

function lowContrast(p: Palette, texts: ColorRole[]): string[] {
  const low: string[] = [];
  for (const fg of texts) for (const bg of SURFACES) if (contrast(p[fg], p[bg]) < 4.5) low.push(`${fg} على ${bg}: ${contrast(p[fg], p[bg]).toFixed(2)}`);
  for (const role of COLOR_ROLES) {
    if (!role.startsWith('on-')) continue;
    const base = role.slice(3) as ColorRole;
    if (base in p && contrast(p[role], p[base]) < 4.5) low.push(`${role} على ${base}: ${contrast(p[role], p[base]).toFixed(2)}`);
  }
  for (const bg of ['secondary-fixed', 'primary-fixed'] as ColorRole[]) if (contrast(p.secondary, p[bg]) < 4.5) low.push(`secondary على ${bg}`);
  if (contrast(p['inverse-on-surface'], p['inverse-surface']) < 4.5) low.push('inverse');
  return low;
}

describe('تباين النصّ', () => {
  it('مساحة العمل: كلّ لون نصٍّ على كلّ سطح، وكلّ «on-X» على «X» — ٤٫٥ فأكثر', () => {
    expect(lowContrast(PALETTE, TEXTS)).toEqual([]);
  });
  it('والسكّة كذلك', () => {
    // في السكّة لا يُكتب بالذهبيّ (البنّيّ).
    expect(lowContrast(RAIL, ['on-surface', 'on-surface-variant', 'secondary', 'error'])).toEqual([]);
  });
});

describe('التوكنات متغيّرات', () => {
  it('كلّ دورٍ لونٌ، ومتغيّره في الصفحة وفي السكّة', () => {
    const css = themeCss();
    for (const role of COLOR_ROLES) {
      expect(PALETTE[role]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(RAIL[role]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(css).toContain(`--c-${role}:`);
    }
    expect(css).toContain('[data-sidebar="rail"]{');
  });

  it('وstyles.css يحملها كما هي — فالأنماط المحفوظة يوم الإصدار تحملها معها', () => {
    const styles = readFileSync('src/renderer/src/styles.css', 'utf8').replace(/\r\n/g, '\n');
    const block = styles.split('/* theme:start */\n')[1]?.split('\n/* theme:end */')[0];
    // إن اختلف: انسخ themeCss() إلى styles.css بين العلامتين.
    expect(block).toBe(themeCss());
  });

  it('وTailwind يأخذ الأدوار نفسها من المتغيّرات — لا ألوانًا ثابتة', () => {
    const config = createRequire(import.meta.url)('../tailwind.config.cjs') as { theme: { extend: { colors: Record<string, string> } } };
    const colors = config.theme.extend.colors;
    expect(Object.keys(colors).sort()).toEqual([...COLOR_ROLES].sort());
    for (const role of COLOR_ROLES) expect(colors[role]).toBe(`rgb(var(--c-${role}) / <alpha-value>)`);
  });
});
