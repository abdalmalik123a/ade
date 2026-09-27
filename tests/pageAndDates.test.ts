/**
 * الصفحات (ترقيمها وهوامشها في الطباعة) وحقل التاريخ بتقويمه.
 */
import { describe, expect, it } from 'vitest';
import { formatDateIn, formatGregorian, formatHijri, fromIsoDate } from '../src/shared/dates';
import { emptyDoc, fieldRef, isDateField, makeField, normalizeDoc, paragraph, type Doc } from '../src/shared/doc';
import { pageCss, renderDocHtml } from '../src/shared/docHtml';
import { makeTable } from '../src/shared/docEdit';

const withPage = (patch: Partial<Doc['pageSetup']>): Doc => {
  const d = emptyDoc();
  return { ...d, pageSetup: { ...d.pageSetup, ...patch } };
};

describe('قواعد الصفحة في الطباعة', () => {
  it('هوامش كل صفحة من الورقة، والحشو يُنزع في الطباعة وحدها', () => {
    const css = pageCss(withPage({ margins: { top: 25, right: 20, bottom: 18, left: 20 } }));
    expect(css).toContain('@page{margin:25mm 0 18mm 0;');
    expect(css).toMatch(/@media print\{[^]*padding-top:0!important/);
    expect(css).not.toContain('@bottom-center');
  });

  it('الترقيم «صفحة س من ص» في الهامش السفلي — ويتّسع له الهامش', () => {
    const css = pageCss(withPage({ pageNumbers: true, margins: { top: 20, right: 20, bottom: 8, left: 20 } }));
    expect(css).toContain('@bottom-center');
    expect(css).toContain('counter(page)');
    expect(css).toContain('counter(pages)');
    expect(css).toContain('0 14mm 0;'); // لا يقلّ عن ١٤ ملم فلا يلتصق الرقم بالحافّة
  });

  it('وبالأرقام الهندية إن اختارتها الورقة', () => {
    const css = pageCss(withPage({ pageNumbers: true, numerals: 'indic' }));
    expect(css).toContain('counter(page, arabic-indic)');
  });
});

describe('الجدول الطويل بين الصفحات', () => {
  const withTable = (header: boolean): Doc => ({ ...emptyDoc(), blocks: [makeTable(4, 2, header)] });

  it('صفّ العناوين رأسُ جدولٍ تعيده الطابعة في كل صفحة', () => {
    const html = renderDocHtml(withTable(true), {});
    expect(html).toMatch(/<thead><tr[^>]*><th/);
    expect(html.match(/<th[ >]/g)).toHaveLength(2); // صفّه وحده، لا كل الصفوف
    expect(html).toMatch(/<\/thead><tbody>(<tr[^>]*>(<td[^]*?<\/td>)+<\/tr>){3}<\/tbody>/);
  });

  it('وبلا عناوين فلا رأس — الصفوف كلّها متن', () => {
    const html = renderDocHtml(withTable(false), {});
    expect(html).not.toContain('<thead>');
    expect(html.match(/<tr[ >]/g)).toHaveLength(4);
  });

  it('والصفّ لا يُشطر بين صفحتين', () => {
    expect(renderDocHtml(withTable(true), {})).toContain('<tr style="break-inside:avoid">');
  });
});

describe('حقل التاريخ بتقويمه', () => {
  const day = new Date(2024, 10, 14); // ١٤ تشرين الثاني ٢٠٢٤

  it('الميلادي بلا علامة، كما يُكتب في الكتب الرسمية', () => {
    expect(formatDateIn(day)).toBe('14 تشرين الثاني 2024');
    expect(formatDateIn(day, 'gregorian')).toBe(formatGregorian(day));
  });

  it('الهجري معلَّمٌ «هـ» فلا يُقرأ ميلاديًّا', () => {
    expect(formatDateIn(day, 'hijri')).toBe(`${formatHijri(day)} هـ`);
    expect(formatDateIn(day, 'hijri')).toMatch(/1446 هـ$/);
  });

  it('وكلاهما: «… م الموافق … هـ»', () => {
    expect(formatDateIn(day, 'both')).toBe(`14 تشرين الثاني 2024 م الموافق ${formatHijri(day)} هـ`);
  });

  it('قيمة منتقي التاريخ تُقرأ محلّيًّا فلا ينزاح اليوم', () => {
    const d = fromIsoDate('2024-11-14');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 10, 14]);
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('14/11/2024')).toBeNull();
  });

  it('التقويم يبقى مع الحقل بعد الحفظ والقراءة — والمجهول يسقط', () => {
    const d = emptyDoc();
    const saved = JSON.parse(
      JSON.stringify({
        ...d,
        blocks: [paragraph([fieldRef('تاريخ_العقد'), fieldRef('تاريخ_آخر')])],
        fields: [
          makeField({ key: 'تاريخ_العقد', type: 'date', calendar: 'hijri' }),
          { ...makeField({ key: 'تاريخ_آخر', type: 'date' }), calendar: 'julian' }
        ]
      })
    );
    const back = normalizeDoc(saved);
    expect(back.fields[0]!.calendar).toBe('hijri');
    expect(back.fields[1]!.calendar).toBeUndefined();
  });

  it('حقل التاريخ بنوعه، أو باسمه في النماذج السابقة', () => {
    expect(isDateField(makeField({ key: 'أ', type: 'date' }))).toBe(true);
    expect(isDateField(makeField({ key: 'تاريخ_الولادة' }))).toBe(true);
    expect(isDateField(makeField({ key: 'الاسم' }))).toBe(false);
  });
});
