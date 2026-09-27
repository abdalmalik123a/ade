/**
 * هويّات الموظفين من السجل (د١٥): قيمة الحقل من ملف صاحبه بمعناه.
 */
import { describe, expect, it } from 'vitest';
import { citizenSourceOf, rowFromCitizen, rowsToTsv } from '../src/shared/citizenFields';
import { parseRows } from '../src/shared/batch';

const citizen = {
  fullName: 'سجاد كاظم محمد',
  nationalId: '199912345678',
  jobTitle: 'مهندس',
  workplace: 'مديرية الماء',
  employeeCode: 'E-104',
  phone: '07701234567',
  birthDate: '1990-03-05'
};

describe('الحقل بمعناه', () => {
  it('أسماء المكتب المختلفة لخانةٍ واحدة', () => {
    expect(citizenSourceOf('اسم الموظف')).toBe('fullName');
    expect(citizenSourceOf('المنصب')).toBe('jobTitle');
    expect(citizenSourceOf('الرقم الوطني')).toBe('nationalId');
    expect(citizenSourceOf('رقم الموظف')).toBe('employeeCode');
    expect(citizenSourceOf('القسم')).toBe('workplace');
    expect(citizenSourceOf('تاريخ الولادة')).toBe('birthDate');
    expect(citizenSourceOf('فصيلة الدم')).toBeNull();
    expect(citizenSourceOf('أيّ شيء', 'phone')).toBe('phone');
  });

  it('صفّ الدفعة من الملف — وما لم يُعرف معناه يُترك يُملأ باليد', () => {
    const row = rowFromCitizen(citizen, [{ key: 'الاسم' }, { key: 'المنصب' }, { key: 'الرقم' }, { key: 'فصيلة الدم' }]);
    expect(row).toEqual({ الاسم: 'سجاد كاظم محمد', المنصب: 'مهندس', الرقم: 'E-104' });
  });

  it('و«الرقم» بلا رمز موظفٍ هو الرقم الوطني', () => {
    expect(rowFromCitizen({ ...citizen, employeeCode: null }, [{ key: 'الرقم' }])).toEqual({ الرقم: '199912345678' });
  });

  it('وتمرّ بقراءة الدفعة نفسها — كأنها لُصقت من Excel', () => {
    const keys = ['الاسم', 'المنصب'];
    const tsv = rowsToTsv(keys, [rowFromCitizen(citizen, keys.map((key) => ({ key }))), { الاسم: 'زينب\tعلي' }]);
    expect(parseRows(tsv, keys).rows).toEqual([{ الاسم: 'سجاد كاظم محمد', المنصب: 'مهندس' }, { الاسم: 'زينب علي' }]);
  });
});
