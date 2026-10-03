import { describe, expect, it } from 'vitest';
import { LOCKED_SECTIONS, normalizeHidden } from '../src/shared/sections';
import { COUNTER_CARDS, normalizeCounterCards } from '../src/shared/counterCards';

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

});

/** بطاقات الشبّاك (المرحلة ٢): ما أخفاه المكتب قسمًا يبقى مخفيًّا بطاقة، والمحفوظ بترتيبه. */
describe('بطاقات الشبّاك', () => {
  it('الافتراض البطاقات كلّها بترتيبها، بلا مكرّر', () => {
    const ids = normalizeCounterCards(undefined);
    expect(ids).toEqual(COUNTER_CARDS.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('وما أُخفي قسمًا في الإصدار السابق تُخفى بطاقته أوّل مرّة', () => {
    const ids = normalizeCounterCards(undefined, ['designs', 'papers', 'archive']);
    expect(ids).not.toContain('designs');
    expect(ids).not.toContain('papers');
    expect(ids).toContain('photos');
  });

  it('والمحفوظ بترتيبه — والمجهول والمكرّر يُتركان، والقديم لا يغلبه', () => {
    expect(normalizeCounterCards(['pdf', 'photos', 'pdf', 'nope', 7], ['photos'])).toEqual(['pdf', 'photos']);
    expect(normalizeCounterCards([])).toEqual([]);
  });
});
