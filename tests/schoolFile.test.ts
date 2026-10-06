/**
 * «ملفّ المدارس» (الموجة ٢): خانات المدرسة تُعرف بأسمائها، والعام الدراسي من التاريخ، والاختيار لا يطمس ما كُتب باليد.
 */
import { describe, expect, it } from 'vitest';
import { academicYear, applySchool, hasSchoolFields, schoolSlotOf, schoolValues } from '../src/shared/schoolFile';

const SCHOOL = { name: 'مدرسة النور الابتدائية', schoolGender: 'المختلطة', governorate: 'بغداد الكرخ الأولى', principal: 'سالم حسن' };
const f = (key: string, source: string | null = null) => ({ key, source });

describe('خانات المدرسة بأسمائها', () => {
  it('كما يكتبها برنامج المخاطبات وورقة بياناته', () => {
    expect(schoolSlotOf('اسم_المدرسة')).toBe('name');
    expect(schoolSlotOf('جنس_المدرسة')).toBe('gender');
    expect(schoolSlotOf('المحافظة')).toBe('governorate');
    expect(schoolSlotOf('اسم_مدير_المدرسة')).toBe('principal');
    expect(schoolSlotOf('العام_الدراسي')).toBe('year');
    expect(schoolSlotOf('العام_الدراسي_2')).toBe('year2');
    expect(schoolSlotOf('السنة الدراسية')).toBe('year');
    expect(schoolSlotOf('اسم_التلميذ')).toBeNull();
  });

  it('والخانة المربوطة بملفّ الزبون لصاحبها — «المحافظة» من سكنه لا من المدرسة', () => {
    expect(schoolSlotOf('المحافظة', 'governorate')).toBeNull();
    expect(hasSchoolFields([f('المحافظة', 'governorate'), f('العام_الدراسي')])).toBe(false);
    expect(hasSchoolFields([f('اسم_المدرسة')])).toBe(true);
  });
});

describe('العام الدراسي من التاريخ', () => {
  it('يبدأ في أيلول', () => {
    expect(academicYear(new Date(2026, 7, 31))).toEqual({ from: 2025, to: 2026 });
    expect(academicYear(new Date(2026, 8, 1))).toEqual({ from: 2026, to: 2027 });
    expect(academicYear(new Date(2026, 0, 15))).toEqual({ from: 2025, to: 2026 });
  });
});

describe('قيم خانات المدرسة', () => {
  const day = new Date(2026, 9, 6);

  it('من ملفّها، والعام بخانتين كما تكتبه ورقة البيانات وبخانةٍ «2026/2027»', () => {
    const fields = [f('اسم_المدرسة'), f('جنس_المدرسة'), f('المحافظة'), f('اسم_مدير_المدرسة'), f('العام_الدراسي'), f('العام_الدراسي_2'), f('اسم_التلميذ')];
    expect(schoolValues(fields, SCHOOL, day)).toEqual({
      اسم_المدرسة: 'مدرسة النور الابتدائية',
      جنس_المدرسة: 'المختلطة',
      المحافظة: 'بغداد الكرخ الأولى',
      اسم_مدير_المدرسة: 'سالم حسن',
      العام_الدراسي: '2026 /',
      العام_الدراسي_2: '2027'
    });
    expect(schoolValues([f('العام_الدراسي')], null, day)).toEqual({ العام_الدراسي: '2026/2027' });
  });

  it('وما لا يُعرف لا يُكتب', () => {
    expect(schoolValues([f('اسم_المدرسة'), f('اسم_مدير_المدرسة')], { name: 'مدرسة الأمل' }, day)).toEqual({ اسم_المدرسة: 'مدرسة الأمل' });
  });

  it('والاختيار لا يطمس ما كُتب باليد، وتبديل المدرسة يبدّل قيمها ويمحو ما لا تعرفه', () => {
    const first = applySchool({ اسم_المدرسة: '', الصف: 'الرابع' }, { اسم_المدرسة: 'مدرسة النور', اسم_مدير_المدرسة: 'سالم حسن' }, {});
    expect(first.values).toEqual({ اسم_المدرسة: 'مدرسة النور', الصف: 'الرابع', اسم_مدير_المدرسة: 'سالم حسن' });
    // كتب الموظف المحافظة بيده، ثم اختار مدرسةً أخرى بلا مدير في ملفّها.
    const typed = { ...first.values, المحافظة: 'البصرة' };
    const second = applySchool(typed, { اسم_المدرسة: 'مدرسة الأمل', المحافظة: 'بابل' }, first.filled);
    expect(second.values).toEqual({ اسم_المدرسة: 'مدرسة الأمل', الصف: 'الرابع', اسم_مدير_المدرسة: '', المحافظة: 'البصرة' });
  });
});
