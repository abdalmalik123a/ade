/**
 * الطلب وملفّ الجهة يملآن التصاميم (DESIGNS.md ٣٫٥): كلّ حقلٍ يُعرف معناه يأخذ ما في ملفّ الجهة، والمدرسة مديريتها
 * ومديرها وصفته، والعام الدراسي من التاريخ — وما لا يُعرف لا يُكتب، وما كتبه الموظّف بيده لا يُطمس.
 * (الجهات والأسماء مختلَقة.)
 */
import { describe, expect, it } from 'vitest';
import { clientValues, designAcademicYear, filledWords } from '../src/shared/design/fillFrom';
import { applySchool } from '../src/shared/schoolFile';
import { buildDoc, PALETTES } from '../src/shared/design/kit';
import type { Client } from '../src/shared/orders';

const client = (patch: Partial<Client>): Client => ({
  id: 1,
  name: 'مدرسة النور الابتدائية',
  kind: 'مدرسة',
  phone: '0770 000 0000',
  address: 'بغداد — الكرخ',
  color: null,
  notes: null,
  logo: null,
  letterheads: 0,
  openOrders: 0,
  schoolGender: 'المختلطة',
  governorate: 'مديرية تربية بغداد الكرخ الأولى',
  principal: 'سعاد كاظم جواد',
  font: null,
  ...patch
});
const today = new Date(2026, 9, 11);
const KEYS = ['الجهة', 'المدرسة', 'الدائرة', 'المديرية', 'العنوان', 'الهاتف', 'الموقّع', 'صفة الموقّع', 'العام الدراسي', 'الاسم', 'العنوان الوظيفي', 'السبب'];

describe('ملفّ الجهة يملأ التصميم', () => {
  it('مدرسةٌ بملفّها: اسمها ومديريتها وعنوانها وهاتفها ومديرتها وصفتها والعام — ولا يمسّ الاسم ولا «العنوان الوظيفي»', () => {
    expect(clientValues(KEYS, client({}), today)).toEqual({
      الجهة: 'مدرسة النور الابتدائية',
      المدرسة: 'مدرسة النور الابتدائية',
      الدائرة: 'مدرسة النور الابتدائية',
      المديرية: 'مديرية تربية بغداد الكرخ الأولى',
      العنوان: 'بغداد — الكرخ',
      الهاتف: '0770 000 0000',
      الموقّع: 'سعاد كاظم جواد',
      'صفة الموقّع': 'مديرة المدرسة',
      'العام الدراسي': '٢٠٢٦ – ٢٠٢٧'
    });
  });

  it('صفة الموقّع من جنس المدير يقينًا ونوع الجهة — واللقب المختصر يُترك، والملتبس لا يُكتب', () => {
    const title = (p: Partial<Client>) => clientValues(['صفة الموقّع'], client(p), today)['صفة الموقّع'];
    expect(title({ principal: 'حسين علي عبد الأمير' })).toBe('مدير المدرسة');
    expect(title({ principal: 'أ. سعاد كاظم' })).toBe('مديرة المدرسة');
    expect(title({ principal: 'رسل حسن', kind: 'روضة' })).toBe('مديرة الروضة');
    expect(title({ principal: 'نور كاظم جواد' })).toBeUndefined();
    expect(title({ principal: null })).toBeUndefined();
  });

  it('جهةٌ ليست مدرسة: اسمها وعنوانها وهاتفها، ولا مديرية ولا موقّع من ملفٍّ ليس لها', () => {
    const company = client({ name: 'شركة الرافدين للطباعة', kind: 'شركة' });
    expect(clientValues(KEYS, company, today)).toEqual({
      الجهة: 'شركة الرافدين للطباعة',
      المدرسة: 'شركة الرافدين للطباعة',
      الدائرة: 'شركة الرافدين للطباعة',
      العنوان: 'بغداد — الكرخ',
      الهاتف: '0770 000 0000',
      'العام الدراسي': '٢٠٢٦ – ٢٠٢٧'
    });
  });

  it('بلا جهة: العام الدراسي وحده — وهو يبدأ في أيلول', () => {
    expect(clientValues(KEYS, null, today)).toEqual({ 'العام الدراسي': '٢٠٢٦ – ٢٠٢٧' });
    expect(designAcademicYear(new Date(2027, 2, 1))).toBe('٢٠٢٦ – ٢٠٢٧');
    expect(designAcademicYear(new Date(2027, 8, 1))).toBe('٢٠٢٧ – ٢٠٢٨');
  });

  it('على حقول المعرض الحقيقية: البطاقة الامتحانية تأخذ المديرية والجهة والعام', () => {
    const keys = buildDoc({ kind: 'exam-card', style: 'official', palette: PALETTES[0]! }).fields.map((f) => f.key);
    const out = clientValues(keys, client({}), today);
    expect(Object.keys(out).sort()).toEqual(['الجهة', 'العام الدراسي', 'المديرية'].sort());
  });

  it('وما كتبه الموظّف لا يُطمس، وجهةٌ ثانية تبدّل ما ملأته الأولى', () => {
    const first = applySchool({ الهاتف: '07801112222' }, clientValues(KEYS, client({}), today), {});
    expect(first.values['الهاتف']).toBe('07801112222');
    expect(first.values['الجهة']).toBe('مدرسة النور الابتدائية');
    const second = applySchool(first.values, clientValues(KEYS, client({ name: 'روضة الأمل', kind: 'روضة', principal: null, governorate: null }), today), first.filled);
    expect(second.values['الجهة']).toBe('روضة الأمل');
    expect(second.values['الموقّع']).toBe('');
    expect(second.values['الهاتف']).toBe('07801112222');
    expect(filledWords({ العنوان: 'x', الهاتف: 'y', الموقّع: 'z' })).toBe('العنوان، الهاتف والموقّع');
  });
});
