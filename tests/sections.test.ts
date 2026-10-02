import { describe, expect, it } from 'vitest';
import { LOCKED_SECTIONS, SECTIONS, normalizeHidden } from '../src/shared/sections';
import { ROUTES } from '../src/shared/routes';

/** الأقسام الظاهرة (خطة Production، ٣٫٣): ما يُخفى من الشريط، وما لا يُخفى أبدًا. */
describe('الأقسام الظاهرة', () => {
  it('الشبّاك والأرشيف والإعدادات لا تُخفى ولو حُفظت مخفيّة', () => {
    expect(normalizeHidden(['service', 'archive', 'settings', 'designs'])).toEqual(['designs']);
    expect(LOCKED_SECTIONS).toEqual(['service', 'archive', 'settings']);
  });

  it('ما فسد من المحفوظ يُترك: غير القائمة، والأسماء المجهولة، والمكرَّر', () => {
    expect(normalizeHidden(undefined)).toEqual([]);
    expect(normalizeHidden('designs')).toEqual([]);
    expect(normalizeHidden(['papers', 'papers', 'nope', 5, null, 'orders'])).toEqual(['papers', 'orders']);
  });

  it('قائمة الإعدادات فيها الأقسام كلّها مرّةً واحدة', () => {
    const keys = SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(ROUTES).sort());
  });
});
