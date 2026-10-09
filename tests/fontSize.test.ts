/**
 * حجم الخطّ بالنقطة كما في Word (د٥): العرض بالنقطة والتخزين بالبكسل — والتحويل ذهابًا وإيابًا يعود بالحجم
 * نفسه لكلّ حجمٍ في القائمة، ويوافق ما يأتي من ملفّ Word، والكتب القديمة تُقرأ بأحجامها.
 */
import { describe, expect, it } from 'vitest';
import { PT_PER_PX, WORD_SIZES_PT, ptToPx, pxToPt } from '../src/shared/fontSize';

describe('حجم الخطّ بالنقطة', () => {
  it('كلّ حجمٍ في القائمة يعود كما هو بعد تخزينه بالبكسل', () => {
    for (const pt of WORD_SIZES_PT) expect(pxToPt(ptToPx(pt))).toBe(pt);
  });

  it('١٦ نقطةً تُختار تساوي ١٦ نقطةً من Word (نصف النقطة × ٩٦/٧٢ في docxDoc)', () => {
    const fromWord = (32 / 2) * (96 / 72);
    expect(ptToPx(16)).toBeCloseTo(fromWord, 2);
    expect(pxToPt(fromWord)).toBe(16);
  });

  it('أساس الورقة ١٤ بكسلًا = ١٠٫٥ نقطة، واختياره يعود إلى الأساس بلا علامة', () => {
    expect(pxToPt(14)).toBe(10.5);
    expect(ptToPx(10.5)).toBe(14);
  });

  it('أحجام الكتب القديمة (بكسل القائمة السابقة) تُعرض بأقرب نصف نقطة', () => {
    expect([11, 12, 16, 18, 20, 24, 28, 32].map(pxToPt)).toEqual([8.5, 9, 12, 13.5, 15, 18, 21, 24]);
  });

  it('النسبة كما في CSS: ٩٦ بكسلًا في البوصة و٧٢ نقطة', () => {
    expect(PT_PER_PX).toBe(72 / 96);
  });
});
