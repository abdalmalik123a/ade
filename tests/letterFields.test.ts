import { describe, expect, it } from 'vitest';
import {
  defaultFields,
  fieldByRole,
  toField,
  tokenFromLabel,
  uniqueToken,
  CORE_FIELDS,
  FIELD_GROUPS,
  type LetterField
} from '../src/shared/letterFields';
import { CITIZEN_FIELDS } from '../src/shared/citizenSchema';

/**
 * حقول صاحب العلاقة كتالوجٌ يُختار منه، لا قائمة مفروضة. وما يهمّ في اختباره:
 * أن الأدوار تصل إلى السجل، وأن الوسوم لا تتصادم، وأن ما يسمّيه المكتب بيده
 * يصير وسمًا صالحًا في المتن.
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

describe('حقول الكتاب', () => {
  it('الكتاب يبدأ بالحقول التي لا يخلو منها كتاب', () => {
    const fields = defaultFields();
    expect(fields.map((f) => f.role)).toEqual(['name', 'nationalId', 'destination', 'purpose']);
    expect(fields.every((f) => f.value === '')).toBe(true);
    // لكل حقل معرّف مستقلّ، وإلا تعارضت البطاقات في الواجهة.
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
  });

  it('الأدوار تصل إلى السجل بقيمها مشذّبة', () => {
    const fields = defaultFields();
    fields[0]!.value = '  أحمد عبد الله  ';
    fields[2]!.value = 'مصرف الرشيد';
    expect(fieldByRole(fields, 'name')).toBe('أحمد عبد الله');
    expect(fieldByRole(fields, 'destination')).toBe('مصرف الرشيد');
    expect(fieldByRole(fields, 'purpose')).toBe('');
  });

  it('حذف حقل لا يمسّ غيره', () => {
    const fields = defaultFields();
    const rest = fields.filter((f) => f.role !== 'purpose');
    expect(rest).toHaveLength(3);
    expect(fieldByRole(rest, 'name')).toBe('');
  });
});

describe('الحقل الذي يسمّيه المكتب', () => {
  it('الاسم يصير وسمًا صالحًا في المتن', () => {
    expect(tokenFromLabel('رقم الإضبارة')).toBe('رقم_الإضبارة');
    expect(tokenFromLabel('  تاريخ   المباشرة ')).toBe('تاريخ_المباشرة');
    expect(tokenFromLabel('{اسم}')).toBe('اسم');
    expect(tokenFromLabel('   ')).toBe('حقل');
  });

  it('الوسم المكرّر يُميَّز فلا يفسد الحقن', () => {
    const fields: LetterField[] = [toField({ label: 'الاسم', token: 'الاسم' })];
    expect(uniqueToken('الاسم', fields)).toBe('الاسم_2');

    const more = [...fields, toField({ label: 'الاسم', token: 'الاسم_2' })];
    expect(uniqueToken('الاسم', more)).toBe('الاسم_3');
    expect(uniqueToken('اللقب', more)).toBe('اللقب');
  });
});
