/**
 * ما لا يُنقل من ملف Word (الموجة ٢): يُعدّ ما يتركه القارئ (`docxDoc.ts`) وحده — ولا يُتّهم ما ينقله: الأسود
 * ليس لونًا (والأحمر والشطب وأعلى السطر تُنقل منذ «محرّر الكتاب»)، والحدّ السفلي خطٌّ فاصل يُنقل، والقسمان المتطابقان لا يُفقد بينهما شيء، ومربّع النصّ يُعدّ مرّةً
 * ولو حفظه Word مرّتين. والإحصاء أعدادٌ بلا أسماء ملفّات.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync } from 'fflate';
import { scanWord } from '../src/main/services/wordScan';
import { censusOf, censusText, lossesOf, type WordScan } from '../src/shared/wordLosses';

const r = (text: string, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t>${text}</w:t></w:r>`;
const p = (inner: string, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
const docx = (body: string, parts: Record<string, string> = {}, before = '') => ({
  'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document>${before}<w:body>${body}</w:body></w:document>`),
  ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)]))
});

const IMAGE = '<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
// مربّع النصّ في Word الحديث: رسمٌ ونسخةٌ قديمة منه للبرامج الأقدم — شكلٌ واحد.
const TEXTBOX =
  '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>' +
  p(r('نصّ المربّع', '<w:color w:val="FF0000"/>')) +
  '</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>' +
  p(r('نصّ المربّع')) +
  '</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>';
const SHAPE = '<w:r><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:spPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';

describe('ما لا يُنقل من ملف Word', () => {
  it('يُعدّ كلّ ما يتركه القارئ في المتن والجداول والأقسام ورأس الصفحة وتذييلها', () => {
    const body = [
      p(r('أحمر', '<w:color w:val="FF0000"/>')),
      p(r('فاتح', '<w:color w:val="E7E6E6"/>')),
      p(r('أسود', '<w:color w:val="000000"/>')),
      p(r('مظلّل', '<w:highlight w:val="yellow"/>')),
      p(r('بلا تظليل', '<w:highlight w:val="none"/>')),
      p(r('مشطوب', '<w:strike/>')),
      p(r('غير مشطوب', '<w:strike w:val="0"/>')),
      p(r('2', '<w:vertAlign w:val="superscript"/>')),
      p(r('بخطّه', '<w:rFonts w:cs="Simplified Arabic" w:ascii="Arial"/>')),
      `<w:tbl><w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="D9D9D9"/></w:tcPr>${p(IMAGE)}<w:tbl><w:tr><w:tc>${p(r('داخلي'))}</w:tc></w:tr></w:tbl></w:tc></w:tr></w:tbl>`,
      p(TEXTBOX),
      p(SHAPE),
      p('<w:r><w:pict><v:shape><v:imagedata r:id="rId6"/></v:shape></w:pict></w:r>'),
      p(`${r('نصّ')}<w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>`),
      p('<m:oMathPara><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></m:oMathPara>'),
      p(r('الاسم\t'), '<w:tabs><w:tab w:val="left" w:leader="dot" w:pos="8000"/></w:tabs>'),
      p(r('مظلّلة'), '<w:shd w:val="clear" w:fill="FFFF00"/>'),
      p(r('بخطٍّ تحتها'), '<w:pBdr><w:bottom w:val="single"/></w:pBdr>'),
      p(r('مرقّم'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>'),
      p('', '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:cols w:num="2"/><w:pgBorders><w:top w:val="single"/></w:pgBorders></w:sectPr>'),
      p('<w:ins><w:r><w:t>مضاف</w:t></w:r></w:ins>'),
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>'
    ].join('');
    const scan = scanWord(
      docx(
        body,
        {
          'word/header1.xml': `<w:hdr>${p(r('رأس الصفحة'))}</w:hdr>`,
          'word/header2.xml': '<w:hdr><w:p><w:r><w:pict><v:shape id="PowerPlusWaterMarkObject"><v:textpath string="سري"/></v:shape></w:pict></w:r></w:p></w:hdr>',
          'word/footer1.xml': `<w:ftr>${p(r('العنوان: بغداد'))}</w:ftr>`,
          'word/styles.xml': '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:cs="Times New Roman"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>'
        },
        '<w:background w:color="FFFF00"/>'
      )
    );
    expect(scan.losses).toEqual({
      color: 1,
      highlight: 1,
      cellShading: 1,
      cellImage: 1,
      nestedTable: 1,
      textbox: 1,
      shape: 1,
      footnote: 1,
      symbol: 1,
      equation: 1,
      tabLeader: 1,
      paraShading: 1,
      sections: 1,
      columns: 1,
      pageBorder: 2,
      trackChanges: 1,
      pageSize: 1,
      header: 1,
      watermark: 1,
      footer: 1,
      font: 3
    });
    expect(scan).toMatchObject({ tables: 2, images: 2, lists: 1, page: 'Letter', landscape: false });
    expect(scan.fonts).toEqual(['Arial', 'Simplified Arabic', 'Times New Roman']);
    // وما يُعرض بجانب الورقة: ما يختفي نصُّه أوّلًا.
    expect(lossesOf(scan)[0]).toMatchObject({ key: 'textbox', label: 'مربّعات نصّ', count: 1 });
  });

  it('وملفٌّ بما تنقله الورقة وحده لا يُقال فيه شيء — والأسود ليس لونًا، والأحمر والشطب وأعلى السطر تُنقل، والحدّ السفلي خطٌّ فاصل', () => {
    const scan = scanWord(
      docx(
        [
          p(r('عريض', '<w:b/><w:color w:val="auto"/>')),
          p(r('أحمر مشطوب', '<w:strike/><w:color w:val="C00000"/>') + r('2', '<w:vertAlign w:val="superscript"/>')),
          p(r('تحته خطّ'), '<w:pBdr><w:bottom w:val="single"/></w:pBdr>'),
          `<w:tbl><w:tr><w:tc>${p(r('خليّة'))}</w:tc></w:tr></w:tbl>`,
          p(IMAGE),
          // قسمان بالإعداد نفسه: فاصل قسمٍ لا يُفقد به شيء.
          p('', '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'),
          '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'
        ].join('')
      )
    );
    expect(scan.losses).toEqual({});
    expect(lossesOf(scan)).toEqual([]);
    expect(scan).toMatchObject({ tables: 1, images: 1, page: 'A4', fonts: [] });
  });

  it('والفولسكاب وA5 يُنقلان بمقاسهما، والأفقي يُعرف', () => {
    const page = (w: number, h: number, orient = '') =>
      scanWord(docx(`<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"${orient ? ` w:orient="${orient}"` : ''}/></w:sectPr>`));
    expect(page(11906, 18709)).toMatchObject({ page: 'F4 (فولسكاب)', losses: {} });
    expect(page(8391, 11906)).toMatchObject({ page: 'A5', losses: {} });
    expect(page(16838, 11906, 'landscape')).toMatchObject({ page: 'A4', landscape: true });
    expect(page(16838, 23811).losses).toEqual({ pageSize: 1 });
  });

  it('وعلى ملفّي Word حقيقيّين: الخطوط وحدها — لا مربّع نصٍّ ولا لونٌ مُتوهَّم', () => {
    for (const f of ['warning-letter.docx', 'school-warning.docx']) {
      const scan = scanWord(unzipSync(new Uint8Array(readFileSync(`tests/fixtures/${f}`))));
      expect(scan.losses).toEqual({ font: 2 });
      expect(scan).toMatchObject({ page: 'A4', images: 1, fonts: ['Arial', 'Calibri'] });
    }
  });
});

describe('إحصاء المجلّد', () => {
  const scan = (losses: WordScan['losses'], extra: Partial<WordScan> = {}): WordScan => ({
    losses,
    fonts: [],
    tables: 0,
    images: 0,
    lists: 0,
    page: 'A4',
    landscape: false,
    ...extra
  });

  it('لكلّ ما لا يُنقل كم ملفًّا فيه وكم مرّة — الأكثر ملفّاتٍ أوّلًا', () => {
    const c = censusOf(
      [
        scan({ textbox: 2, color: 5 }, { fonts: ['Arial', 'Simplified Arabic'], tables: 1 }),
        scan({ color: 1 }, { fonts: ['Arial'], images: 2, page: 'F4 (فولسكاب)' }),
        scan({}, { lists: 3, landscape: true })
      ],
      1
    );
    expect(c).toMatchObject({ files: 3, failed: 1, withTables: 1, withImages: 1, withLists: 1, landscape: 1 });
    expect(c.losses).toEqual([
      { key: 'color', files: 2, count: 6 },
      { key: 'textbox', files: 1, count: 2 }
    ]);
    expect(c.fonts).toEqual([
      { name: 'Arial', files: 2 },
      { name: 'Simplified Arabic', files: 1 }
    ]);
    expect(c.pages).toEqual([
      { name: 'A4', files: 2 },
      { name: 'F4 (فولسكاب)', files: 1 }
    ]);
  });

  it('ونصّه يُقرأ ويُرسل: أعدادٌ وأسماء خطوطٍ وحدها', () => {
    const text = censusText(censusOf([scan({ textbox: 1 }, { fonts: ['Arial'] })]), new Date('2026-10-06T10:00:00Z'));
    expect(text).toContain('الملفات: ١');
    expect(text).toContain('مربّعات نصّ: ١ ملفّ (١٠٠٪) — ١ مرّة');
    expect(text).toContain('Arial: ١');
    expect(text).toContain('لا أسماء ملفاتٍ في هذا الإحصاء');
  });
});
