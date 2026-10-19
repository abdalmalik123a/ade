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
    // اللقب يحسم: كتبه الموظف بنفسه
    expect(guessGender('الطالبة رفيدة سالم')).toEqual({ gender: 'أنثى', sure: true });
    expect(guessGender('رفيدة سالم')).toEqual({ gender: 'أنثى', sure: false });
    // والشائع يقين — وإلا سُئل عن كل ولدٍ في الصف (ج٤)
    expect(guessGender('أحمد عادل')).toEqual({ gender: 'ذكر', sure: true });
    expect(guessGender('احمد عادل')).toEqual({ gender: 'ذكر', sure: true });
    // والنادر بلا يقين: يُسأل مرّةً ويُحفظ
    expect(guessGender('غسق عادل')).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('')).toBeNull();
  });

  it('الأسماء المشتركة مثل «نعمة» و«رحمة» لا تُحسم تلقائيًّا ويُسأل عنها دائمًا (S03)', () => {
    // تصنيف نعمة ورحمة كأسماء غير مؤكدة (sure: false)
    expect(guessGender('نعمة كريم')).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('رحمة علي')).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('نعمة')).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('رحمة')).toEqual({ gender: 'ذكر', sure: false });
    // وحتى لو تعلّمها المكتب لا تُحسم يقينًا
    expect(guessGender('نعمة كريم', { نعمة: 'ذكر' })).toEqual({ gender: 'ذكر', sure: false });
    expect(guessGender('رحمة علي', { رحمة: 'أنثى' })).toEqual({ gender: 'ذكر', sure: false });
  });

  it('ملء الجنس المحفوظ مسبقًا في ملف الزبون مع إبقاء السؤال (ر150)', () => {
    // زبون مسجل بجنس مؤنث يُملأ جنسه مسبقًا مع بقاء sure: false ليسأل عنه
    expect(guessGender('علاء حسن', {}, 'أنثى')).toEqual({ gender: 'أنثى', sure: false, registered: true });
    // زبون مسجل بجنس مذكر
    expect(guessGender('نور الهدى', {}, 'ذكر')).toEqual({ gender: 'ذكر', sure: false, registered: true });
  });
});
