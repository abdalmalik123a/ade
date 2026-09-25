import { describe, expect, it } from 'vitest';
import { measureFromOffset, offsetFromMeasure } from '../src/shared/calibration';

describe('معايرة الطابعة', () => {
  it('علامةٌ على ٢٢ من اليمين: الطباعة انزاحت يسارًا، فتُزاح يمينًا', () => {
    expect(offsetFromMeasure(22, 20)).toEqual({ x: 2, y: 0 });
  });
  it('وعلى ٢٢ من الأعلى: نزلت، فتُرفع', () => {
    expect(offsetFromMeasure(20, 22)).toEqual({ x: 0, y: -2 });
  });
  it('والقياس الصحيح لا إزاحة', () => {
    expect(offsetFromMeasure(20, 20)).toEqual({ x: 0, y: 0 });
  });
  it('وعكسُه يعيد ما قِيس', () => {
    expect(measureFromOffset(offsetFromMeasure(18.5, 21.5))).toEqual({ fromRight: 18.5, fromTop: 21.5 });
  });
});
