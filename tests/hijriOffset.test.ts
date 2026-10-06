/**
 * الميلادي هو الأصل، والهجري يُزاح يدويًّا ليطابق ما يُعلن في العراق (قرار المالك، ٦ تشرين الأول ٢٠٢٦).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { clampHijriOffset, formatDateIn, formatGregorian, formatHijri, setHijriOffset } from '../src/shared/dates';
import { emptyLayout, printsHijri } from '../src/shared/letterhead';

/** اليوم من التاريخ الهجري المكتوب: «12 جمادى الأولى 1446» ← 12. */
const dayOf = (text: string) => Number(text.split(' ')[0]);

afterEach(() => setHijriOffset(0));

describe('إزاحة الهجري', () => {
  // ١٤ تشرين الثاني ٢٠٢٤ منتصف شهرٍ هجريّ — فالإزاحة لا تعبر بداية شهر.
  const day = new Date(2024, 10, 14, 9, 30);

  it('بلا إزاحة كما يحسبه أمّ القرى، وبالإزاحة يومٌ قبل أو بعد', () => {
    const base = dayOf(formatHijri(day, 0));
    expect(dayOf(formatHijri(day, 1))).toBe(base + 1);
    expect(dayOf(formatHijri(day, -1))).toBe(base - 1);
    expect(dayOf(formatHijri(day, 2))).toBe(base + 2);
  });

  it('إزاحة المكتب تأخذها كلّ كتابةٍ هجرية — والميلادي لا يُزاح', () => {
    const base = formatHijri(day);
    setHijriOffset(1);
    expect(dayOf(formatHijri(day))).toBe(dayOf(base) + 1);
    expect(formatDateIn(day, 'hijri')).toBe(`${formatHijri(day)} هـ`);
    expect(formatDateIn(day, 'gregorian')).toBe('14 تشرين الثاني 2024');
    expect(formatGregorian(day)).toBe('14 تشرين الثاني 2024');
  });

  it('ولا تتجاوز يومين، وما فسد صفر', () => {
    expect(clampHijriOffset(5)).toBe(2);
    expect(clampHijriOffset(-9)).toBe(-2);
    expect(clampHijriOffset('1')).toBe(1);
    expect(clampHijriOffset('x')).toBe(0);
    expect(clampHijriOffset(undefined)).toBe(0);
    setHijriOffset(7);
    expect(dayOf(formatHijri(day))).toBe(dayOf(formatHijri(day, 0)) + 2);
  });
});

describe('الترويسة التي تطبع الهجري', () => {
  it('يُعرف وسمها أينما وُضع — فيُقيَّد الهجري في السجلّ معها', () => {
    const layout = emptyLayout();
    expect(printsHijri(layout)).toBe(false);
    expect(printsHijri(null)).toBe(false);
    const withHijri = { ...layout, sections: [{ ...layout.sections[0]!, blocks: [{ kind: 'field', value: 'التاريخ: {التاريخ_الهجري}' }] }] };
    expect(printsHijri(withHijri as typeof layout)).toBe(true);
  });
});
