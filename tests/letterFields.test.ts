import { describe, expect, it } from 'vitest';
import { CORE_FIELDS, FIELD_GROUPS } from '../src/shared/letterFields';
import { CITIZEN_FIELDS } from '../src/shared/citizenSchema';

/**
 * حقول صاحب العلاقة كتالوجٌ يُختار منه، لا قائمة مفروضة. وما يهمّ في اختباره: أن الوسوم
 * لا تتصادم، وأنه يغطّي المعاملات، وأن مصادر ملئه أعمدةٌ في ملف المواطن.
 * (والحقل في الكتاب نفسه `DocField` في الوثيقة — تختبره `doc` و`docEdit`.)
 */

describe('كتالوج حقول المعاملات', () => {
  it('كل حقل يحمل عنوانًا ووسمًا، والوسوم لا تتكرّر', () => {
    const all = [...CORE_FIELDS, ...FIELD_GROUPS.flatMap((g) => g.fields)];
    for (const field of all) {
      expect(field.label.trim().length).toBeGreaterThan(1);
      expect(field.token).toMatch(/^[^\s{}]+$/);
    }
    const tokens = all.map((f) => f.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('يغطّي المعاملات التي يقصدها المكتب', () => {
    const names = FIELD_GROUPS.map((g) => g.name);
    expect(names).toContain('الأحوال المدنية والجنسية');
    expect(names).toContain('الجوازات والسفر');
    expect(names).toContain('التربية والتعليم');
    expect(names).toContain('السكن والعنوان');

    const tokens = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.token));
    // حقول تسألها الاستمارات الرسمية المنشورة
    expect(tokens).toContain('اسم_الأم');
    expect(tokens).toContain('رقم_السجل');
    expect(tokens).toContain('رقم_الصحيفة');
    expect(tokens).toContain('رقم_الجواز');
    expect(tokens).toContain('الرقم_الامتحاني');
    expect(tokens).toContain('رقم_بطاقة_السكن');
  });

  it('مصادر الملء التلقائي تطابق أعمدة ملف المواطن', () => {
    // الخانات من تعريفها الواحد — فمصدرٌ لا خانة له في الملف يُكشف هنا.
    const citizenColumns = CITIZEN_FIELDS.map((f) => f.key as string);
    const sources = [...CORE_FIELDS, ...FIELD_GROUPS.flatMap((g) => g.fields)]
      .map((f) => f.source)
      .filter(Boolean) as string[];
    for (const source of sources) expect(citizenColumns).toContain(source);
  });
});
