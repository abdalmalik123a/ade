/**
 * «طقم الجهة» (DESIGNS.md ٣٫٣) على تصاميم المعرض الحقيقية: عائلتا اللون تُعرفان (الأزرق الملكيّ والذهبيّ)، ولون الجهة يحلّ في
 * العائلة الغالبة وتبقى إضاءة كلّ درجة، والرماديّ كما هو، وخلفية SVG تُدار معها؛ وخطّ الجهة على النصوص إلا الرقعة؛ والشعار
 * يحلّ محلّ شعار الجهة أو يُضاف — والأصل لا يُمسّ.
 */
import { describe, expect, it } from 'vitest';
import { applyBrand, canvasColours, colourFamilies, shiftColour } from '../src/shared/design/brand';
import { buildDesign, PALETTES } from '../src/shared/design/kit';
import { toHsl } from '../src/shared/design/kit/color';
import { familyOf } from '../src/shared/fonts';
import type { TextElement } from '../src/shared/canvas';

const royal = PALETTES[0]!;
const hue = (hex: string) => toHsl(hex).h;
const near = (a: number, b: number, tol = 25) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= tol;

describe('طقم الجهة', () => {
  it('عائلتا اللون في شهادةٍ ملكية: الأزرق غالبٌ والذهبيّ مرافق', () => {
    const fam = colourFamilies(canvasColours(buildDesign({ kind: 'thanks', style: 'official', palette: royal })));
    expect(near(fam.primary!, hue(royal.primary))).toBe(true);
    expect(near(fam.accent!, hue(royal.accent), 30)).toBe(true);
  });

  it('والإسلاميّ — ذهبه أكثر عددًا من أزرقه — الأزرق غالبه والذهبيّ مرافقه، فالأخضر يحلّ في الأزرق لا الذهب', () => {
    const islamic = buildDesign({ kind: 'thanks', style: 'islamic', palette: royal });
    const fam = colourFamilies(canvasColours(islamic));
    expect(near(fam.primary!, hue(royal.primary), 30)).toBe(true);
    expect(fam.accent! >= 30 && fam.accent! <= 60).toBe(true);
    const out = canvasColours(applyBrand(islamic, { color: '#0f6b50', font: null, logo: null }).canvas);
    // ما كان ذهبًا بقي ذهبًا (المرافق الذهبيّ في لوحة الجهة).
    expect([...out.keys()].some((c) => toHsl(c).h >= 30 && toHsl(c).h <= 60)).toBe(true);
  });

  it('الدرجة تُدار إلى تدرّج الجهة وتبقى إضاءتها — والرماديّ والأبيض لا', () => {
    const from = { primary: hue(royal.primary), accent: hue(royal.accent) };
    const green = { ...royal, primary: '#0f6b50', accent: '#b8923a' };
    const light = '#c7d2f0';
    const out = shiftColour(light, from, green);
    expect(near(hue(out), hue('#0f6b50'), 8)).toBe(true);
    expect(toHsl(out).l).toBeCloseTo(toHsl(light).l, 1);
    expect(shiftColour('#888888', from, green)).toBe('#888888');
    expect(shiftColour('#ffffff', from, green)).toBe('#ffffff');
  });

  it('الشهادة الملكية بلون الجهة الأخضر: عناوينها وخلفيّتها خضراء، ولا أزرق باقٍ، والأصل كما هو', () => {
    const before = buildDesign({ kind: 'thanks', style: 'official', palette: royal });
    const copy = JSON.stringify(before);
    const out = applyBrand(before, { color: '#0f6b50', font: null, logo: null });
    expect(out.colors).toBeGreaterThan(3);
    expect(JSON.stringify(before)).toBe(copy);
    const after = canvasColours(out.canvas);
    const blues = [...after.keys()].filter((c) => near(hue(c), hue(royal.primary), 15));
    expect(blues).toEqual([]);
    const fam = colourFamilies(after);
    expect(near(fam.primary!, hue('#0f6b50'))).toBe(true);
  });

  it('وخطّ الجهة على النصوص والجداول إلا الرقعة', () => {
    const cert = buildDesign({ kind: 'thanks', style: 'luxury', palette: royal });
    const out = applyBrand(cert, { color: null, font: 'Cairo', logo: null });
    const texts = out.canvas.elements.filter((e): e is TextElement => e.kind === 'text');
    expect(out.fonts).toBeGreaterThan(0);
    for (const t of texts) expect(['Cairo', 'Aref Ruqaa']).toContain(familyOf(t.font));
    expect(texts.some((t) => familyOf(t.font) === 'Aref Ruqaa')).toBe(true);
    expect(applyBrand(cert, { color: null, font: null, logo: null })).toMatchObject({ colors: 0, fonts: 0, logo: null });
  });

  it('والشعار يحلّ محلّ شعار الجهة، أو يُضاف في الركن الأعلى إن لم يكن', () => {
    const bare = buildDesign({ kind: 'thanks', style: 'official', palette: royal });
    const added = applyBrand(bare, { color: null, font: null, logo: 'letterheads/new.png' });
    expect(added.logo).toBe('added');
    const logo = added.canvas.elements.find((e) => e.kind === 'image' && e.name === 'شعار الجهة');
    expect(logo).toMatchObject({ src: 'letterheads/new.png', box: { x: 0.04, y: 0.04 } });
    const branded = buildDesign({ kind: 'thanks', style: 'official', palette: royal, brand: { name: 'مدرسة النور', logo: 'letterheads/old.png' } });
    const replaced = applyBrand(branded, { color: null, font: null, logo: 'letterheads/new.png' });
    expect(replaced.logo).toBe('replaced');
    expect(replaced.canvas.elements.filter((e) => e.kind === 'image' && e.name === 'شعار الجهة').map((e) => e.kind === 'image' && e.src)).toEqual(['letterheads/new.png']);
  });
});
