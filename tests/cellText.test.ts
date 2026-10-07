import { describe, expect, it } from 'vitest';
import { cellText, dateText } from '../src/main/services/cellText';

const cell = (value: unknown) => ({ value });

describe('نصّ خليّة Excel كما يراه المكتب (مراجعة ٧ ت١)', () => {
  it('التاريخ يومًا لا «Thu Mar 09 2015 …»، بمكوّنات UTC كما يقرؤه exceljs', () => {
    expect(cellText(cell(new Date(Date.UTC(2015, 2, 9))))).toBe('2015/03/09');
    expect(dateText(new Date(Date.UTC(2026, 9, 7, 14, 30)))).toBe('2026/10/07 14:30');
    expect(dateText(new Date('غير صالح'))).toBe('');
  });

  it('المعادلة تُقرأ نتيجتها: الصفر صفرٌ، والتاريخ يومًا، والنصّ نصًّا', () => {
    expect(cellText(cell({ formula: 'A1-A1', result: 0 }))).toBe('0');
    expect(cellText(cell({ formula: 'A1', result: new Date(Date.UTC(2015, 2, 9)) }))).toBe('2015/03/09');
    expect(cellText(cell({ formula: 'B1', result: 'خامس' }))).toBe('خامس');
    expect(cellText(cell({ formula: 'A1>1', result: false }))).toBe('FALSE');
  });

  it('وخطأ الخليّة أو المعادلة فراغٌ لا «[object Object]» ولا «#N/A» على الورق', () => {
    expect(cellText(cell({ formula: 'A1/0', result: { error: '#DIV/0!' } }))).toBe('');
    expect(cellText(cell({ error: '#N/A' }))).toBe('');
    expect(cellText(cell({ formula: 'X', result: undefined }))).toBe('');
  });

  it('والرقم رقمًا لا «1.0» ولا ضجيج الفاصلة العائمة؛ وللقوائم تقريبٌ إلى ثلاث خانات', () => {
    expect(cellText(cell(2026001))).toBe('2026001');
    expect(cellText(cell(0.1 + 0.2))).toBe('0.3');
    expect(cellText(cell(76.66666666666667))).toBe('76.6666666667');
    expect(cellText(cell(76.66666666666667), { decimals: 3 })).toBe('76.667');
    expect(cellText(cell(85.755))).toBe('85.755');
  });

  it('والنصّ المنسَّق والرابط والفراغ', () => {
    expect(cellText(cell({ richText: [{ text: 'مديرية ' }, { text: 'التربية' }] }))).toBe('مديرية التربية');
    expect(cellText(cell({ text: 'اضغط هنا', hyperlink: 'https://x.test' }))).toBe('اضغط هنا');
    expect(cellText(cell(null))).toBe('');
    expect(cellText(cell(undefined))).toBe('');
    expect(cellText(cell('نصّ'))).toBe('نصّ');
  });
});
