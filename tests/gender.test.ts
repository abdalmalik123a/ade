import { describe, expect, it } from 'vitest';
import { guessGender, hasChoiceText, pickChoice, resolveChoices } from '../src/shared/gender';

describe('التذكير والتأنيث', () => {
  it('الوسم بخيارين: الأوّل للمذكّر والثاني للمؤنّث، واللاحقة تلتصق بكلمتها', () => {
    const text = 'تؤيد المدرسة أن {الطالب|الطالبة} مستمرّ{|ة} بالدوام، ونتمنى ل{ـه|ـها} التوفيق';
    expect(resolveChoices(text, 'أنثى')).toBe('تؤيد المدرسة أن الطالبة مستمرّة بالدوام، ونتمنى لها التوفيق');
    expect(resolveChoices(text, 'ذكر')).toBe('تؤيد المدرسة أن الطالب مستمرّ بالدوام، ونتمنى له التوفيق');
  });

  it('ومن لم يُحدَّد جنسه يُرسم له الخياران ظاهرين — لا تخمين', () => {
    expect(pickChoice('المحترم|المحترمة', undefined)).toBe('المحترم/المحترمة');
  });

  it('يُعرف النصّ الذي فيه خيارٌ — والأقواس العادية ليست خيارًا', () => {
    expect(hasChoiceText('نشكر {الطالب|الطالبة}')).toBe(true);
    expect(hasChoiceText('نشكر {اسم الطالب}')).toBe(false);
  });

  it('يقترح الجنس من الاسم الأول: القائمة ثم اللاحقة، ورجالٌ على هيئة المؤنّث', () => {
    expect(guessGender('زينب علي حسن')).toEqual({ gender: 'أنثى', sure: true });
    expect(guessGender('مريم عادل')).toEqual({ gender: 'أنثى', sure: true });
    expect(guessGender('حمزة كريم')).toEqual({ gender: 'ذكر', sure: true });
    expect(guessGender('مصطفى جاسم')).toEqual({ gender: 'ذكر', sure: true });
    expect(guessGender('الطالبة رفيدة سالم')).toEqual({ gender: 'أنثى', sure: false });
    expect(guessGender('أحمد عادل')).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('')).toBeNull();
  });
});
