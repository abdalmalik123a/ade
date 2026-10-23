import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PAGE_NAMES, emptyDoc, isPageSize, pageMm, type Doc } from '../src/shared/doc';
import { normalizeDoc } from '../src/shared/docNormalize';
import { pageOfSheetHtml, sheetPageAttr } from '../src/shared/sheetPage';
import { docToDocx } from '../src/main/services/docDocx';

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

/** وثيقةٌ بمقاسٍ مخصّص كما تُحفظ وتُقرأ (JSON في القاعدة). */
const custom = (customSize: unknown, size = 'custom'): Doc => {
  const doc = emptyDoc();
  return normalizeDoc(JSON.parse(JSON.stringify({ ...doc, pageSetup: { ...doc.pageSetup, size, customSize } })));
};

describe('المقاس المخصّص يبقى بعد الحفظ، وWord بمقاسه (D135)', () => {
  it('normalizeDoc يحفظ ١٠٠×١٥٠، ويحصر ٥٠٠٠ إلى ١٠٠٠، ويُسقط النصّ وما ليس «مخصّصًا»', () => {
    // كان يسقط هنا فيُرسم ما حُفظ A4.
    expect(custom({ w: 100, h: 150 }).pageSetup.customSize).toEqual({ w: 100, h: 150 });
    expect(pageMm(custom({ w: 100, h: 150 }).pageSetup)).toEqual({ w: 100, h: 150 });

    // ٥٠٠٠ لا تُحفظ ٥٠٠٠: تُحصر بحدّ `pageMm`.
    expect(custom({ w: 5000, h: 150 }).pageSetup.customSize).toEqual({ w: 1000, h: 150 });
    expect(custom({ w: 20.04, h: 150.26 }).pageSetup.customSize).toEqual({ w: 50, h: 150.3 });

    // والنصّ وما نقص منه بُعدٌ يسقطان، فتُرسم A4.
    for (const bad of [{ w: '100', h: 150 }, { w: 100 }, 'مئة', null, [100, 150]]) {
      const page = custom(bad).pageSetup;
      expect(page.size).toBe('custom');
      expect(page.customSize).toBeUndefined();
      expect(pageMm(page)).toEqual({ w: 210, h: 297 });
    }

    // ومقاسٌ قياسيّ لا يحمل بُعدًا مخصّصًا بقي من قبل.
    expect(custom({ w: 100, h: 150 }, 'A5').pageSetup.customSize).toBeUndefined();
    expect(pageMm(custom({ w: 100, h: 150 }, 'A5').pageSetup)).toEqual({ w: 148, h: 210 });
  });

  it('docToDocx لمخصّص ١٠٠×١٥٠ ← w:pgSz بعرضه وارتفاعه بالـtwips، والأفقيّة مقلوبة كما كانت', async () => {
    const pgSz = async (doc: Doc) => {
      const xml = strFromU8(unzipSync(new Uint8Array(await docToDocx(doc, { title: 'مقاس' })))['word/document.xml']!);
      const tag = xml.match(/<w:pgSz\b[^>]*>/)?.[0] ?? '';
      const attr = (name: string) => tag.match(new RegExp(`w:${name}="([^"]+)"`))?.[1] ?? null;
      return { w: attr('w'), h: attr('h'), orient: attr('orient') };
    };
    const doc = custom({ w: 100, h: 150 });
    // ١٠٠ ملم × ٥٦٫٧ = ٥٦٧٠ twips، و١٥٠ ← ٨٥٠٥ (وكان A4: ١١٩٠٧ × ١٦٨٤٠).
    expect(await pgSz(doc)).toMatchObject({ w: '5670', h: '8505' });

    doc.pageSetup.orientation = 'landscape';
    expect(await pgSz(doc)).toEqual({ w: '8505', h: '5670', orient: 'landscape' });

    // والقياسيّ كما كان.
    const a5 = emptyDoc();
    a5.pageSetup.size = 'A5';
    expect(await pgSz(a5)).toMatchObject({ w: String(Math.round(148 * 56.7)), h: String(Math.round(210 * 56.7)) });
  });
});
