/**
 * هوية «منتصف الليل» (المرحلة ٦): كلّ نصٍّ بتباين ٤٫٥ فأكثر في المظهرين — «متى تتمّ» في UPGRADE.md.
 * يُفحص كلّ لون نصٍّ على كلّ سطح، وكلّ «on-X» على «X»، والأبيض على طرفي تدرّج MADA.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, MADA, THEMES, contrast, themeCss, type ColorRole, type ThemeName } from '../src/shared/theme';

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

describe('تباين النصّ في المظهرين', () => {
  for (const name of ['dark', 'light'] as ThemeName[]) {
    const t = THEMES[name];
    it(`${name}: كلّ لون نصٍّ على كلّ سطح ٤٫٥ فأكثر`, () => {
      const low: string[] = [];
      for (const fg of TEXTS) for (const bg of SURFACES) if (contrast(t[fg], t[bg]) < 4.5) low.push(`${fg} على ${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`);
      expect(low).toEqual([]);
    });
    it(`${name}: كلّ «on-X» على «X»`, () => {
      const low: string[] = [];
      for (const role of COLOR_ROLES) {
        if (!role.startsWith('on-')) continue;
        const base = role.slice(3) as ColorRole;
        if (!(base in t)) continue;
        const c = contrast(t[role], t[base]);
        if (c < 4.5) low.push(`${role} على ${base}: ${c.toFixed(2)}`);
      }
      // والنصّ على الأسطح «الثابتة» (الشارات والمربّعات): الأزرق النصّيّ عليها.
      for (const bg of ['secondary-fixed', 'primary-fixed'] as ColorRole[]) {
        const c = contrast(t.secondary, t[bg]);
        if (c < 4.5) low.push(`secondary على ${bg}: ${c.toFixed(2)}`);
      }
      const inv = contrast(t['inverse-on-surface'], t['inverse-surface']);
      if (inv < 4.5) low.push(`inverse: ${inv.toFixed(2)}`);
      expect(low).toEqual([]);
    });
  }

  it('والأبيض على طرفي تدرّج MADA', () => {
    expect(contrast('#FFFFFF', MADA.from)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', MADA.to)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('التوكنات متغيّرات', () => {
  it('كلّ دورٍ في المظهرين، ومتغيّره في الصفحة', () => {
    const css = themeCss();
    for (const role of COLOR_ROLES) {
      expect(THEMES.dark[role]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(THEMES.light[role]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(css).toContain(`--c-${role}:`);
    }
    expect(css).toContain(':root[data-theme="dark"]');
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
