/**
 * Word ← ورقة: الملف قطعةٌ واحدة بتنسيقه.
 *
 * المقياس ما رسمه Word نفسه: صُدِّر `warning-letter.docx` بـWord إلى PDF وقيست
 * المواضع على صفحته — فالأرقام هنا ليست ما نظنّه صحيحًا بل ما رآه صاحب الملف.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strToU8, zipSync } from 'fflate';
import { docxToDoc, parseXml } from '../src/main/services/docxDoc';
import type { Block, ColumnsBlock, ImageBlock, Inline, ParagraphBlock, TableBlock } from '../src/shared/doc';

const FIXTURE = join(__dirname, 'fixtures', 'warning-letter.docx');

function load() {
  const saved: { ext: string; size: number }[] = [];
  const files = unzipSync(new Uint8Array(readFileSync(FIXTURE)));
  const res = docxToDoc(files, (bytes, ext) => {
    saved.push({ ext, size: bytes.length });
    return `letterheads/hr${ext}`;
  });
  return { ...res, saved };
}

const text = (inlines: Inline[]) => inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');
const paras = (blocks: Block[]) => blocks.filter((b): b is ParagraphBlock => b.kind === 'paragraph');
const findPara = (blocks: Block[], needle: string) => paras(blocks).find((b) => text(b.inlines).includes(needle));

/** يُبنى مستند Word صغير من فقرات XML — لحالاتٍ لا يحملها الملف المرجعي. */
function docx(bodyXml: string, extra: Record<string, string> = {}): Record<string, Uint8Array> {
  const document =
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="w"><w:body>' +
    bodyXml +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    '</w:body></w:document>';
  const files: Record<string, Uint8Array> = { 'word/document.xml': strToU8(document) };
  for (const [k, v] of Object.entries(extra)) files[k] = strToU8(v);
  return unzipSync(zipSync(files));
}

const p = (runs: string, ppr = '<w:bidi/>') => `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
const r = (t: string, rpr = '<w:rtl/>') => `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;

describe('warning-letter.docx — ورقةٌ واحدة كما رسمها Word', () => {
  it('الصفحة بمقاسها وهوامشها من الملف: A4 وهوامش ١٢٫٧ ملم', () => {
    const { doc } = load();
    expect(doc.pageSetup.size).toBe('A4');
    expect(doc.pageSetup.orientation).toBe('portrait');
    expect(doc.pageSetup.margins).toEqual({ top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 });
  });

  it('الرأس لا يُفصل ترويسةً: هو أسطرُ أعلى الورقة', () => {
    const { doc } = load();
    expect(doc.pageSetup.letterheadMode).toBe('none');
    const first = doc.blocks.find((b) => b.kind === 'columns') as ColumnsBlock;
    expect(doc.blocks.indexOf(first)).toBeLessThan(3);
  });

  it('«ادارة ……… العدد:» عمودان، والعدد حيث أوصلته المسافات في Word', () => {
    const { doc } = load();
    const row = doc.blocks.find(
      (b) => b.kind === 'columns' && text((b.columns[0]![0] as ParagraphBlock).inlines) === 'ادارة'
    ) as ColumnsBlock;
    expect(row).toBeTruthy();
    const [right, left] = row.columns.map((c) => c[0] as ParagraphBlock);
    expect(text(left!.inlines)).toBe('العدد:');
    // Word: «ادارة» على ٢٥٫١ ملم من الهامش الأيمن، و«العدد:» على ١٤١٫٧ ملم.
    expect(right!.indent).toBeCloseTo(25.1, 0);
    const contentMm = 210 - 12.7 * 2;
    expect(row.widths![0]! * contentMm).toBeGreaterThan(139);
    expect(row.widths![0]! * contentMm).toBeLessThan(145);
    expect(row.gap).toBe(0);
  });

  it('«مدرسة الصحوة ……… التاريخ: / / 20» — والتاريخ على ١٣٢ ملم كما في Word', () => {
    const { doc } = load();
    const row = doc.blocks.find(
      (b) => b.kind === 'columns' && text((b.columns[1]![0] as ParagraphBlock).inlines).startsWith('التاريخ:')
    ) as ColumnsBlock;
    const contentMm = 210 - 12.7 * 2;
    expect(row.widths![0]! * contentMm).toBeGreaterThan(129);
    expect(row.widths![0]! * contentMm).toBeLessThan(135);
    // المسافات داخل «/    /     20» فراغُ كتابةٍ باليد — تبقى.
    expect(text((row.columns[1]![0] as ParagraphBlock).inlines)).toContain('/    /');
  });

  it('الرأس عريضٌ بحجم ١٨ نقطة (٢٤ بكسل)، والمتن ٢٠ نقطة غير عريض', () => {
    const { doc } = load();
    const head = findPara(doc.blocks, 'للبني')!;
    expect(head.size).toBe(24);
    expect(head.inlines[0]).toMatchObject({ kind: 'run', marks: { bold: true } });
    const body = findPara(doc.blocks, 'بالنظر لوصول')!;
    expect(body.size).toBe(26.7);
    expect(body.inlines.some((i) => i.kind === 'run' && i.marks?.bold)).toBe(false);
  });

  it('التمديد يبقى كما كتبه صاحب الملف — Word يرسمه', () => {
    const { doc } = load();
    expect(findPara(doc.blocks, 'م/ ان')!.inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('')).toContain(
      'انـــ'
    );
  });

  it('المحاذاة: الموضوع و«مع التقدير» موسَّطان، والمتن يمين', () => {
    const { doc } = load();
    expect(findPara(doc.blocks, 'م/ ان')!.align).toBe('center');
    expect(findPara(doc.blocks, 'مع التقدير')!.align).toBe('center');
    expect(findPara(doc.blocks, 'بالنظر لوصول')!.align).toBe('right');
  });

  it('الجدولة في أوّل السطر موضعُ بدايته: «الى /» على ٢٣٫٤ ملم و«مدير المدرسة» على ١٢٨ ملم', () => {
    const { doc } = load();
    expect(findPara(doc.blocks, 'الى / ولي امر')!.indent).toBeCloseTo(23.4, 0);
    expect(findPara(doc.blocks, 'مدير المدرسة')!.indent).toBeCloseTo(128.4, 0);
  });

  it('فراغ الكتابة باليد «(                 )» لا يُضغط ولا يُقسم عمودين', () => {
    const { doc } = load();
    const line = findPara(doc.blocks, 'ووصول عدد')!;
    expect(text(line.inlines)).toMatch(/\( {10,}\)/);
  });

  it('الخطّ الفاصل صورةٌ بمقاسها في Word: ٤٥٠×٧٫٥ نقطة، موسّطة', () => {
    const { doc, saved } = load();
    const hr = doc.blocks.find((b) => b.kind === 'image') as ImageBlock;
    expect(hr).toMatchObject({ width: 600, height: 10, align: 'center', src: 'letterheads/hr.gif' });
    expect(saved).toEqual([{ ext: '.gif', size: 279 }]);
  });

  it('«0» بدل النقطة يُصحّح ويُقال — وفي حدود المقاطع', () => {
    const { doc, notes } = load();
    const line = text(findPara(doc.blocks, 'المواظبة')!.inlines);
    expect(line).toContain('وانذاره.');
    expect(line).not.toMatch(/[ء-ي]0/);
    expect(notes.join(' ')).toContain('«0»');
  });

  it('فراغ التوقيع خمسةُ أسطرٍ بحجم ٢٠ — فلا يرتفع التوقيع عن موضعه', () => {
    const { doc } = load();
    const at = doc.blocks.indexOf(findPara(doc.blocks, 'مدير المدرسة')!);
    const before = doc.blocks.slice(at - 5, at) as ParagraphBlock[];
    expect(before.every((b) => b.kind === 'paragraph' && b.inlines.length === 0 && b.size === 26.7)).toBe(true);
  });

  it('سطرٌ مسافاته وحدها ارتفاعُه من علامة فقرته لا من مسافاته — كما يرسمه Word', () => {
    const { doc } = load();
    // بعد «ووصول عدد…» سطرٌ فيه مسافةٌ بحجم ٢٠ وعلامته ٥ نقاط: خرج في Word
    // بارتفاع السطر الفارغ الصغير، لا بارتفاع سطرٍ من المتن.
    const at = doc.blocks.indexOf(findPara(doc.blocks, 'ووصول عدد')!);
    const spaceLine = doc.blocks[at + 1] as ParagraphBlock;
    expect(spaceLine.kind).toBe('paragraph');
    expect(text(spaceLine.inlines).trim()).toBe('');
    expect(spaceLine.size).toBe(6.7);
  });

  it('تباعد الأسطر والمسافة بعد الفقرة من الملف', () => {
    const { doc } = load();
    const body = findPara(doc.blocks, 'بالنظر لوصول')!;
    expect(body.lineHeight).toBeCloseTo(1.32, 2);
    expect(body.spaceAfter).toBeCloseTo(13.3, 1);
  });

  it('ولا متغيّرات تُصنع خفيةً: الفراغات تبقى نقاطًا حتى يضغط المكتب F4', () => {
    const { doc } = load();
    expect(doc.fields).toEqual([]);
  });
});

describe('Word ← ورقة: حالات لا يحملها الملف المرجعي', () => {
  it('في الفقرة العربية `jc="right"` يسارٌ و`left` يمين — ثابتٌ بسؤال Word نفسه', () => {
    const files = docx(
      p(r('يسار'), '<w:bidi/><w:jc w:val="right"/>') + p(r('يمين'), '<w:bidi/><w:jc w:val="left"/>') + p(r('ضبط'), '<w:bidi/><w:jc w:val="both"/>')
    );
    const blocks = paras(docxToDoc(files).doc.blocks);
    expect(blocks.map((b) => b.align)).toEqual(['left', 'right', 'justify']);
  });

  it('وفي الفقرة الإنجليزية تُقرأ حرفيًّا، واتجاهها يُحفظ', () => {
    const files = docx(p(r('left', ''), '<w:jc w:val="left"/>'));
    const [b] = paras(docxToDoc(files).doc.blocks);
    expect(b).toMatchObject({ align: 'left', dir: 'ltr' });
  });

  it('العريض العربي من `bCs` لا `b` — كما يرسمه Word', () => {
    const files = docx(p(r('عريض', '<w:rtl/><w:bCs/>') + r('ليس عريضًا', '<w:rtl/><w:b/>')));
    const [b] = paras(docxToDoc(files).doc.blocks);
    expect(b!.inlines[0]).toMatchObject({ text: 'عريض', marks: { bold: true } });
    expect(b!.inlines[1]).toMatchObject({ text: 'ليس عريضًا' });
    expect((b!.inlines[1] as { marks?: unknown }).marks).toBeUndefined();
  });

  it('ما لم يُكتب على المقطع يُرث من نمطه ثم من افتراض المستند', () => {
    const styles =
      '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="28"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:styleId="Big"><w:rPr><w:szCs w:val="40"/></w:rPr></w:style></w:styles>';
    const files = docx(
      p(r('افتراض')) + p(r('بنمطه'), '<w:bidi/><w:pStyle w:val="Big"/>'),
      { 'word/styles.xml': styles }
    );
    const [a, b] = paras(docxToDoc(files).doc.blocks);
    expect(a!.size).toBe(18.7); // ١٤ نقطة
    expect(b!.size).toBe(26.7); // ٢٠ نقطة
  });

  it('الجدول بأعمدته وخليّته المدموجة، وحدوده مخفيّة إن أُخفيت', () => {
    const cell = (t: string, pr = '') => `<w:tc><w:tcPr>${pr}</w:tcPr>${p(r(t))}</w:tc>`;
    const table =
      '<w:tbl><w:tblPr><w:tblBorders><w:top w:val="nil"/><w:bottom w:val="none"/></w:tblBorders></w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid>' +
      `<w:tr>${cell('الجهة', '<w:gridSpan w:val="2"/>')}${cell('العدد')}</w:tr>` +
      `<w:tr>${cell('أ')}${cell('ب')}${cell('ج')}</w:tr></w:tbl>`;
    const t = docxToDoc(docx(table)).doc.blocks.find((b) => b.kind === 'table') as TableBlock;
    expect(t.borders).toBe(false);
    expect(t.columns).toEqual([1.8, 0.6, 0.6]);
    expect(t.rows[0]!.cells[0]).toMatchObject({ colSpan: 2 });
    expect(text(t.rows[0]!.cells[0]!.blocks[0]!.inlines)).toBe('الجهة');
    expect(t.rows[1]!.cells).toHaveLength(3);
  });

  it('فاصل الصفحة يشطر الفقرة', () => {
    const files = docx(p(r('قبل') + '<w:r><w:br w:type="page"/></w:r>' + r('بعد')));
    const kinds = docxToDoc(files).doc.blocks.map((b) => b.kind);
    expect(kinds).toEqual(['paragraph', 'pageBreak', 'paragraph']);
  });

  it('سطرٌ طويلٌ من المتن فيه فراغ لا يُقسم عمودين', () => {
    const long = 'بالنظر لوصول غيابات التلميذ المذكور أعلاه إلى الحدّ المقرّر      في الصف الخامس';
    const blocks = docxToDoc(docx(p(r(long)))).doc.blocks;
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph']);
  });
});

describe('قارئ XML', () => {
  it('يقرأ الشجرة بسماتها ونصوصها وكياناتها', () => {
    const root = parseXml('<?xml version="1.0"?><a x="1"><b y=\'2\'>ن &amp; ص</b><c/></a>');
    const a = root.kids[0]!;
    expect(a).toMatchObject({ name: 'a', attrs: { x: '1' } });
    expect(a.kids.map((k) => k.name)).toEqual(['b', 'c']);
    expect(a.kids[0]!.text).toBe('ن & ص');
  });
});
