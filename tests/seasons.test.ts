/**
 * صفّ الموسم في الشبّاك (ن١) — ولا يُقترح نموذجٌ غير موجود (محادثة «الشبّاك واليوم الأوّل»، البند ٧).
 */
import { describe, expect, it } from 'vitest';
import { seasonItems, seasonOf } from '../src/shared/seasons';
import { normalizeCounterCards } from '../src/shared/counterCards';

const ALL = normalizeCounterCards(undefined);

describe('صفّ الموسم', () => {
  it('موسمٌ بالشهر الميلادي — وبداية العام الدراسي في أيلول وتشرين الأوّل', () => {
    expect(seasonOf(new Date(2026, 9, 11))?.title).toBe('موسم بداية العام الدراسي');
    expect(seasonOf(new Date(2026, 5, 1))?.title).toBe('موسم النتائج والتخرّج');
  });

  it('مكتبٌ بلا نماذج: البطاقات وحدها — لا «تأييد» يبحث فلا يجد', () => {
    const season = seasonOf(new Date(2026, 9, 11))!;
    expect(seasonItems(season, ALL, []).map((it) => it.label)).toEqual(['هويات الطلبة', 'الامتحانات الشهرية']);
  });

  it('وفي مكتبته نموذجٌ تجده الكلمة — متساهلةً مع الهمزة — فيُقترح', () => {
    const season = seasonOf(new Date(2026, 9, 11))!;
    expect(seasonItems(season, ALL, ['تاييد استمرار بالدوام — تربية']).map((it) => it.label)).toContain('تأييد استمرار بالدوام');
    expect(seasonItems(season, ALL, ['كتاب نقل']).map((it) => it.label)).not.toContain('تأييد استمرار بالدوام');
  });

  it('وبطاقةٌ أخفاها المكتب لا تُقترح', () => {
    const season = seasonOf(new Date(2026, 9, 11))!;
    expect(seasonItems(season, ALL.filter((c) => c !== 'papers'), []).map((it) => it.label)).toEqual(['هويات الطلبة']);
  });
});
