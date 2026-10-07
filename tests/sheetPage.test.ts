import { describe, expect, it } from 'vitest';
import { pageOfSheetHtml, sheetPageAttr } from '../src/shared/sheetPage';
import { PAGE_MM, pageMm, emptyDoc } from '../src/shared/doc';
import { valuesOnlySheet } from '../src/shared/docHtml';

describe('مقاس الورقة يرافق علاماتها (مراجعة ٧ ت١)', () => {
  it('يُكتب بلا كسورٍ زائدة ويُقرأ كما كُتب', () => {
    expect(sheetPageAttr({ w: 210, h: 330 })).toBe('210x330');
    expect(sheetPageAttr({ w: 148.5, h: 210 })).toBe('148.5x210');
    expect(sheetPageAttr({ w: 210.004, h: 296.999 })).toBe('210x297');
    expect(pageOfSheetHtml('<div data-letter-sheet="" data-page="210x330" class="a4-sheet">…</div>')).toEqual({ w: 210, h: 330 });
    expect(pageOfSheetHtml(`<div data-page="${sheetPageAttr({ w: 148.5, h: 210 })}"></div>`)).toEqual({ w: 148.5, h: 210 });
  });

  it('وأوّل ورقةٍ هي الحكم، ولو غُلّفت بغلاف «القيم وحدها»', () => {
    const two = '<div data-page="210x330"></div><div data-page="148x210"></div>';
    expect(pageOfSheetHtml(two)).toEqual({ w: 210, h: 330 });
    expect(pageOfSheetHtml(valuesOnlySheet('<div data-letter-sheet="" data-page="297x210"></div>'))).toEqual({ w: 297, h: 210 });
  });

  it('وما لا سمة له أو سمتُه غير معقولة لا مقاس له — فيبقى A4 كما طُبع قبلُ', () => {
    expect(pageOfSheetHtml('<div class="a4-sheet">كتاب قديم</div>')).toBeNull();
    expect(pageOfSheetHtml('<div data-page="5x5"></div>')).toBeNull();
    expect(pageOfSheetHtml('<div data-page="99999x2"></div>')).toBeNull();
    expect(pageOfSheetHtml('<div data-page="abc"></div>')).toBeNull();
    expect(pageOfSheetHtml('')).toBeNull();
  });

  it('ومقاسات الوثيقة كلّها تصلح سمةً: فولسكاب وأفقي وA5', () => {
    for (const size of Object.keys(PAGE_MM) as (keyof typeof PAGE_MM)[]) {
      for (const orientation of ['portrait', 'landscape'] as const) {
        const doc = emptyDoc();
        doc.pageSetup = { ...doc.pageSetup, size, orientation };
        const want = pageMm(doc.pageSetup);
        expect(pageOfSheetHtml(`<div data-page="${sheetPageAttr(want)}"></div>`)).toEqual(want);
      }
    }
  });
});
