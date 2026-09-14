import { describe, expect, it } from 'vitest';
import { normalizeFold, normalizeStrict, toFtsQuery } from '../src/shared/arabic';

describe('التطبيع المتساهل — للبحث', () => {
  it('يوحّد صور الهمزة فيجد الموظفُ الاسمَ كما يكتبه', () => {
    const target = normalizeFold('أحمد');
    expect(normalizeFold('احمد')).toBe(target);
    expect(normalizeFold('إحمد')).toBe(target);
    expect(normalizeFold('آحمد')).toBe(target);
  });

  it('يردّ التاء المربوطة هاءً والألف المقصورة ياءً', () => {
    expect(normalizeFold('حمزة')).toBe(normalizeFold('حمزه'));
    expect(normalizeFold('مصطفى')).toBe(normalizeFold('مصطفي'));
  });

  it('يحذف التشكيل والتطويل', () => {
    expect(normalizeFold('مُحَمَّد')).toBe(normalizeFold('محمد'));
    expect(normalizeFold('محـــمد')).toBe(normalizeFold('محمد'));
  });

  it('يحوّل الأرقام العربية-الهندية إلى لاتينية', () => {
    expect(normalizeFold('١٩٨٤٢١٠٩٨٣١٢')).toBe('198421098312');
    expect(normalizeFold('۱۹۸۴')).toBe('1984');
  });

  it('يوحّد المسافات المكرّرة ويقلّم الأطراف', () => {
    expect(normalizeFold('  أحمد   عادل  ')).toBe(normalizeFold('احمد عادل'));
  });
});

describe('التطبيع الدقيق — لنصّ الكتاب الرسمي', () => {
  it('يحفظ الهمزات لأن الكتاب الرسمي لا يحتمل تحريف اسم', () => {
    expect(normalizeStrict('أحمد')).not.toBe(normalizeStrict('احمد'));
    expect(normalizeStrict('مصطفى')).not.toBe(normalizeStrict('مصطفي'));
  });

  it('يحذف التشكيل والتطويل مع ذلك', () => {
    expect(normalizeStrict('مُحَمَّد')).toBe('محمد');
    expect(normalizeStrict('محـــمد')).toBe('محمد');
  });
});

describe('بناء استعلام FTS5', () => {
  it('يجعل كل كلمة بادئة ويربطها بـ AND', () => {
    expect(toFtsQuery('احمد عادل')).toBe('"احمد"* AND "عادل"*');
  });

  it('يطبّع قبل البناء فيجد «أحمد» بكتابة «احمد»', () => {
    expect(toFtsQuery('أحمد')).toBe('"احمد"*');
  });

  it('يقتبس علامة الاقتباس فلا تكسر الصيغة', () => {
    expect(toFtsQuery('ا"ب')).toBe('"ا""ب"*');
  });

  it('يتجاهل المسافات الزائدة ولا ينتج حدودًا فارغة', () => {
    expect(toFtsQuery('   ')).toBe('');
    expect(toFtsQuery(' احمد  ')).toBe('"احمد"*');
  });
});
