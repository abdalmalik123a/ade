import { describe, expect, it } from 'vitest';
import { PAGE_NAMES, emptyDoc, isPageSize, pageMm } from '../src/shared/doc';
import { pageOfSheetHtml, sheetPageAttr } from '../src/shared/sheetPage';

describe('المقاس المخصّص والمقاسات القياسية للورقة (S09 · ر102)', () => {
  it('المقاسات السبعة المعتمدة تعمل في الاتجاهين الرأسي والأفقي', () => {
    const doc = emptyDoc();
    doc.pageSetup.size = 'A4';
    doc.pageSetup.orientation = 'portrait';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 210, h: 297 });

    doc.pageSetup.orientation = 'landscape';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 297, h: 210 });

    doc.pageSetup.size = 'FS';
    doc.pageSetup.orientation = 'portrait';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 210, h: 330 });

    doc.pageSetup.size = 'A5';
    doc.pageSetup.orientation = 'portrait';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 148, h: 210 });
  });

  it('المقاس المخصّص يحسب الأبعاد بدقّة مع مراعاة الاتجاه', () => {
    const doc = emptyDoc();
    doc.pageSetup.size = 'custom';
    doc.pageSetup.customSize = { w: 160, h: 240 };
    doc.pageSetup.orientation = 'portrait';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 160, h: 240 });

    doc.pageSetup.orientation = 'landscape';
    expect(pageMm(doc.pageSetup)).toEqual({ w: 240, h: 160 });
  });

  it('المقاس المخصّص يحرس الحدود المنطقية (٥٠–١٠٠٠ ملم)', () => {
    const doc = emptyDoc();
    doc.pageSetup.size = 'custom';

    // أبعاد أصغر من الحدّ الأدنى
    doc.pageSetup.customSize = { w: 20, h: 30 };
    expect(pageMm(doc.pageSetup)).toEqual({ w: 50, h: 50 });

    // أبعاد أكبر من الحدّ الأقصى
    doc.pageSetup.customSize = { w: 1500, h: 2000 };
    expect(pageMm(doc.pageSetup)).toEqual({ w: 1000, h: 1000 });

    // قيم غير منتهية
    doc.pageSetup.customSize = { w: Number.NaN, h: Number.POSITIVE_INFINITY };
    expect(pageMm(doc.pageSetup)).toEqual({ w: 210, h: 297 });
  });

  it('المقاس المخصّص بلا أبعاد يعود تلقائيًّا إلى المقاس الافتراضي A4', () => {
    const doc = emptyDoc();
    doc.pageSetup.size = 'custom';
    doc.pageSetup.customSize = undefined;
    expect(pageMm(doc.pageSetup)).toEqual({ w: 210, h: 297 });
  });

  it('isPageSize وPAGE_NAMES يدعمان custom والمقاسات القياسية', () => {
    expect(isPageSize('custom')).toBe(true);
    expect(isPageSize('A4')).toBe(true);
    expect(isPageSize('FS')).toBe(true);
    expect(isPageSize('unknown')).toBe(false);

    expect(PAGE_NAMES.custom).toBe('مخصّص');
    expect(PAGE_NAMES.A4).toBe('A4');
    expect(PAGE_NAMES.FS).toBe('فولسكاب');
  });

  it('المقاس المخصّص يرافق سمة الورقة data-page ويُستخرج منها سليمًا للطباعة وPDF', () => {
    const doc = emptyDoc();
    doc.pageSetup.size = 'custom';
    doc.pageSetup.customSize = { w: 175, h: 250 };
    const mm = pageMm(doc.pageSetup);
    const attr = sheetPageAttr(mm);
    expect(attr).toBe('175x250');

    const html = `<div data-letter-sheet="" data-page="${attr}" class="a4-sheet">متن</div>`;
    expect(pageOfSheetHtml(html)).toEqual({ w: 175, h: 250 });
  });
});
