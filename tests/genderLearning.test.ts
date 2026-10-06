/**
 * التذكير والتأنيث (ج٤): ما لم يُعرف يقينًا يُسأل قبل الطباعة، وجوابُ المكتب يُحفظ
 * فلا يُسأل عنه ثانيةً.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { firstNameKey, guessGender, isUnisexName, unsureNames } from '../src/shared/gender';
import { learnGenders, learnedGenders } from '../src/main/services/genderMemory';
import { letterChecks } from '../src/shared/letterDraft';
import { emptyDoc, paragraph, run } from '../src/shared/doc';

describe('مفتاح الاسم فيما يتعلّمه المكتب', () => {
  it('الاسم الأوّل بعد اللقب، مطويًّا', () => {
    expect(firstNameKey('الطالبة رُسُل حسن علي')).toBe('رسل');
    expect(firstNameKey('رسل حسن')).toBe('رسل');
    expect(firstNameKey('أمل')).toBe('امل');
  });

  it('و«عبد» و«أم» كلمتان معًا', () => {
    expect(firstNameKey('عبد الله كريم')).toBe('عبد الله');
    expect(firstNameKey('أم البنين جاسم')).toBe('ام البنين');
  });
});

describe('ما لم يُعرف يُسأل — وما أجاب عنه المكتب يُعرف', () => {
  it('«غسق» بلا يقين حتى يُجاب عنه، ثم يقينٌ من المكتب', () => {
    expect(guessGender('غسق حسن')).toEqual({ gender: 'ذكر', sure: false });
    const learned = { غسق: 'أنثى' as const };
    expect(guessGender('غسق حسن', learned)).toEqual({ gender: 'أنثى', sure: true, learned: true });
  });

  it('وما يعرفه المكتب يغلب القائمة المبنيّة — فهو أعلم ببيته', () => {
    expect(guessGender('رسل علي')?.gender).toBe('أنثى');
    expect(guessGender('رسل علي', { رسل: 'ذكر' })).toMatchObject({ gender: 'ذكر', sure: true });
  });

  it('الأسماء التي تُسأل: بلا يقين، بلا تكرار، وما حُسم لا يُسأل', () => {
    const names = ['زينب علي', 'غسق حسن', 'أحمد كريم', 'غسق حسن', 'تبارك جاسم', 'نمير علي', 'رفيدة سالم'];
    // الشائع يقين (زينب، أحمد، تبارك) — والنادر يُسأل مرّةً
    expect(unsureNames(names)).toEqual(['غسق حسن', 'نمير علي', 'رفيدة سالم']);
    expect(unsureNames(names, { غسق: 'أنثى', نمير: 'ذكر' })).toEqual(['رفيدة سالم']);
    expect(unsureNames(names, {}, { 'غسق حسن': 'أنثى', 'نمير علي': 'ذكر', 'رفيدة سالم': 'أنثى' })).toEqual([]);
  });
});

describe('الاسم الملتبس يُسأل في كلّ مرّة (قرار المالك، ٦ تشرين الأول ٢٠٢٦)', () => {
  const UNISEX = ['نور', 'ضياء', 'علاء', 'بهاء', 'صفاء', 'رضا', 'تقى', 'أنوار', 'ملاك', 'ولاء', 'غفران', 'نبأ', 'يقين', 'رند'];

  it('الأربعة عشر بلا يقين — وإن كانت في القائمة المبنيّة', () => {
    for (const n of UNISEX) expect([n, guessGender(`${n} علي حسين`)?.sure]).toEqual([n, false]);
    // ويبقى الاقتراح كما كان: نور أنثى، وضياء ذكر — يُقلب بضغطة.
    expect(guessGender('نور علي')?.gender).toBe('أنثى');
    expect(guessGender('ضياء كاظم')?.gender).toBe('ذكر');
    expect(unsureNames(['نور علي', 'زينب علي', 'علاء حسين'])).toEqual(['نور علي', 'علاء حسين']);
  });

  it('وما أجاب عنه المكتب لنورٍ لا يحسم نورًا غيرها', () => {
    expect(guessGender('نور علي', { نور: 'أنثى' })).toEqual({ gender: 'أنثى', sure: false });
    expect(unsureNames(['نور علي'], { نور: 'أنثى' })).toEqual(['نور علي']);
  });

  it('واللقب يحسم، و«… الدين» اسمُ رجل', () => {
    expect(guessGender('الطالبة نور علي')).toEqual({ gender: 'أنثى', sure: true });
    expect(guessGender('السيد ضياء كاظم')).toEqual({ gender: 'ذكر', sure: true });
    expect(guessGender('نور الدين كاظم')).toEqual({ gender: 'ذكر', sure: true });
    expect(guessGender('علاء الدين حسن', { علاء: 'أنثى' })).toEqual({ gender: 'ذكر', sure: true });
    expect(isUnisexName('نور الدين كاظم')).toBe(false);
    expect(isUnisexName('الطالبة نُور')).toBe(true);
  });

  it('ولا يُحفظ جوابه في ذاكرة المكتب', () => {
    const db = freshDb();
    expect(learnGenders(db, [{ name: 'نور علي', gender: 'أنثى' }, { name: 'غسق حسن', gender: 'أنثى' }])).toBe(1);
    expect(learnedGenders(db)).toEqual({ غسق: 'أنثى' });
  });
});

describe('ذاكرة المكتب', () => {
  it('تحفظ الجواب باسم صاحبه الأوّل، والأحدث يغلب', () => {
    const db = freshDb();
    expect(learnedGenders(db)).toEqual({});
    expect(learnGenders(db, [{ name: 'غسق حسن علي', gender: 'أنثى' }, { name: 'نمير علي', gender: 'ذكر' }])).toBe(2);
    expect(learnedGenders(db)).toEqual({ غسق: 'أنثى', نمير: 'ذكر' });
    learnGenders(db, [{ name: 'غسق كاظم', gender: 'ذكر' }]);
    expect(learnedGenders(db).غسق).toBe('ذكر');
  });

  it('ولا تحفظ ما ليس جنسًا ولا اسمًا', () => {
    const db = freshDb();
    expect(learnGenders(db, [{ name: '   ', gender: 'أنثى' }, { name: 'رسل', gender: 'x' as never }])).toBe(0);
    expect(learnedGenders(db)).toEqual({});
  });
});

describe('في المحرّر: يمنع الإصدار حتى يُحسم', () => {
  it('اسمٌ بلا يقين والورقة تُذكّر وتؤنّث', () => {
    const doc = { ...emptyDoc(), blocks: [paragraph([run('م / تأييد')]), paragraph([run('نؤيد أن الطالب مستمر')])] };
    const base = { doc, values: {}, owner: 'رسل حسن', spelling: 0, registryPrinted: false, number: '', headRatio: null, pages: null };
    const blocked = letterChecks({ ...base, genderUnsure: 'رسل' }).find((c) => c.act === 'gender');
    expect(blocked).toMatchObject({ level: 'block' });
    expect(blocked!.text).toContain('«رسل»: ذكرٌ أم أنثى؟');
    expect(letterChecks({ ...base, genderUnsure: null }).some((c) => c.act === 'gender')).toBe(false);
  });
});
