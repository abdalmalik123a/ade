/**
 * التنسيق على الورقة: Enter وBackspace، والحجم والمحاذاة، والجدول، والعلامة
 * المائية — وكلّها يجب أن تخرج في الطباعة كما رُئيت، لأن محرّك الرسم واحد.
 */
import { describe, expect, it } from 'vitest';
import {
  FIELD_CHAR,
  makeTable,
  mergeWithPrevious,
  paragraphText,
  resizeColumn,
  splitParagraph
} from '../src/shared/docEdit';
import {
  docFromLegacy,
  emptyDoc,
  normalizeDoc,
  paragraph,
  run,
  type ImageBlock,
  type ParagraphBlock,
  type TableBlock
} from '../src/shared/doc';
import { renderDocHtml, watermarkHtml } from '../src/shared/docHtml';

const para = (doc: ReturnType<typeof emptyDoc>, i = 0) => doc.blocks[i] as ParagraphBlock;

describe('Enter: الفقرة تنشطر عند المؤشّر', () => {
  it('ما بعد المؤشّر سطرٌ جديد، والحقل ينتقل معه ولا يضيع', () => {
    const doc = docFromLegacy('نؤيد أن {الاسم} موظف');
    const res = splitParagraph(doc, para(doc).id, 8, 8)!;

    expect(res.doc.blocks).toHaveLength(2);
    expect(paragraphText(para(res.doc, 0).inlines)).toBe('نؤيد أن ');
    expect(paragraphText(para(res.doc, 1).inlines)).toBe(`${FIELD_CHAR} موظف`);
    expect(res.doc.blocks[1]!.id).toBe(res.id);
    // الحقل ما زال مستعملًا في المتن، فلا يسقط من شاشة الإدخال.
    expect(res.doc.fields.map((f) => f.key)).toEqual(['الاسم']);
  });

  it('السطر الجديد يرث محاذاة سابقه ومسافته البادئة', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('العنوان')], { align: 'center', indent: 20 })];
    const res = splitParagraph(doc, doc.blocks[0]!.id, 7, 7)!;
    const next = para(res.doc, 1);
    expect(next.align).toBe('center');
    expect(next.indent).toBe(20);
  });

  it('ما ظُلِّل يُحذف كما في Word', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('أبجدهوز')])];
    const res = splitParagraph(doc, doc.blocks[0]!.id, 2, 5)!;
    expect(paragraphText(para(res.doc, 0).inlines)).toBe('أب');
    expect(paragraphText(para(res.doc, 1).inlines)).toBe('وز');
  });

  it('التنسيق يبقى على شطري النصّ', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('كبيرٌ عريض', { bold: true, size: 20 })])];
    const res = splitParagraph(doc, doc.blocks[0]!.id, 5, 5)!;
    const tail = para(res.doc, 1).inlines[0];
    expect(tail).toMatchObject({ kind: 'run', marks: { bold: true, size: 20 } });
  });

  it('لا يُشطر ما ليس فقرة', () => {
    const doc = emptyDoc();
    doc.blocks = [makeTable(2, 2)];
    expect(splitParagraph(doc, doc.blocks[0]!.id, 0, 0)).toBeNull();
  });
});

describe('Backspace في أوّل السطر: يلتحق بما قبله', () => {
  it('يدمج السطرين، ويعيد موضع الالتحام ليقف المؤشّر فيه', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('نؤيد ')]), paragraph([run('بأنّ')])];
    const res = mergeWithPrevious(doc, doc.blocks[1]!.id)!;
    expect(res.doc.blocks).toHaveLength(1);
    expect(paragraphText(para(res.doc).inlines)).toBe('نؤيد بأنّ');
    expect(res.id).toBe(doc.blocks[0]!.id);
    expect(res.at).toBe(5);
  });

  it('السطر الأوّل لا يلتحق بشيء', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('أ')])];
    expect(mergeWithPrevious(doc, doc.blocks[0]!.id)).toBeNull();
  });

  it('ولا يُسكب نصٌّ في جدول', () => {
    const doc = emptyDoc();
    doc.blocks = [makeTable(2, 2), paragraph([run('بعد الجدول')])];
    expect(mergeWithPrevious(doc, doc.blocks[1]!.id)).toBeNull();
  });
});

describe('الجدول: أعمدةٌ بأوزانٍ نسبية', () => {
  it('يتّسع العمود ويضيق، ولا ينكمش حتى يختفي', () => {
    const doc = emptyDoc();
    doc.blocks = [makeTable(2, 3)];
    const id = doc.blocks[0]!.id;

    const wider = resizeColumn(doc, id, 1, 0.5);
    expect((wider.blocks[0] as TableBlock).columns).toEqual([1, 1.5, 1]);

    let narrow = doc;
    for (let i = 0; i < 10; i++) narrow = resizeColumn(narrow, id, 0, -0.5);
    expect((narrow.blocks[0] as TableBlock).columns[0]).toBe(0.4);
  });

  it('وأوزانه تخرج في الطباعة عرضًا نسبيًّا', () => {
    const doc = emptyDoc();
    doc.blocks = [makeTable(1, 2)];
    const id = doc.blocks[0]!.id;
    const html = renderDocHtml(resizeColumn(doc, id, 0, 2), {}, { paragraphs: 'blocks' });
    expect(html).toContain('width:75%');
    expect(html).toContain('width:25%');
  });
});

describe('التنسيق يُطبع كما رُئي', () => {
  it('الحجم والمحاذاة والمسافة البادئة في علامات الطباعة', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('عنوانٌ كبير', { size: 20, bold: true })], { align: 'center', indent: 20 })];
    const html = renderDocHtml(doc, {}, { paragraphs: 'blocks' });
    expect(html).toContain('text-align:center');
    expect(html).toContain('text-indent:20mm');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('<strong>');
  });

  it('الفقرة الفارغة سطرٌ بارتفاعه لا صفر — فلا ينهار فراغ التوقيع', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('أ')]), paragraph([]), paragraph([run('ب')])];
    expect(renderDocHtml(doc, {}, { paragraphs: 'blocks' })).toContain('&nbsp;</p>');
  });

  it('الصورة محاذاةٌ فيزيائية: يسارٌ في الورقة العربية يسار', () => {
    const doc = emptyDoc();
    const stamp: ImageBlock = { id: 'img', kind: 'image', src: 'seals/abc.png', width: 140, align: 'left' };
    doc.blocks = [stamp];
    const html = renderDocHtml(doc, {}, { paragraphs: 'blocks' });
    expect(html).toContain('text-align:left');
    expect(html).not.toContain('flex-start');
    expect(html).toContain('diwan://store/seals/abc.png');
  });
});

describe('العلامة المائية', () => {
  it('بلا علامة لا يُرسم شيء', () => {
    expect(watermarkHtml(emptyDoc())).toBe('');
  });

  it('النصّ خلف المتن ومهرَّبٌ فلا يُحقن', () => {
    const doc = emptyDoc();
    doc.pageSetup.watermark = { kind: 'text', text: '<b>مسودة</b>' };
    const html = watermarkHtml(doc);
    expect(html).toContain('data-watermark');
    expect(html).toContain('z-index:-1');
    expect(html).toContain('&lt;b&gt;مسودة');
    expect(html).not.toContain('<b>');
  });

  it('الشعار من المخزن', () => {
    const doc = emptyDoc();
    doc.pageSetup.watermark = { kind: 'image', src: 'seals/crest.png' };
    expect(watermarkHtml(doc)).toContain('diwan://store/seals/crest.png');
  });

  it('تُحفظ وتُقرأ مع الوثيقة', () => {
    const doc = emptyDoc();
    doc.pageSetup.watermark = { kind: 'text', text: 'نسخة' };
    const back = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(back.pageSetup.watermark).toEqual({ kind: 'text', text: 'نسخة' });
  });

  it('الوثيقة القديمة بلا علامة تُقرأ بلا علامة', () => {
    const raw = JSON.parse(JSON.stringify(emptyDoc()));
    delete raw.pageSetup.watermark;
    expect(normalizeDoc(raw).pageSetup.watermark).toBeNull();
  });

  it('ما لا يُفهم يسقط، والشفافية تُحصر فلا تحجب المتن', () => {
    const base = JSON.parse(JSON.stringify(emptyDoc()));
    base.pageSetup.watermark = { kind: 'video', src: 'x' };
    expect(normalizeDoc(base).pageSetup.watermark).toBeNull();

    base.pageSetup.watermark = { kind: 'text', text: '   ' };
    expect(normalizeDoc(base).pageSetup.watermark).toBeNull();

    base.pageSetup.watermark = { kind: 'text', text: 'سري', opacity: 0.9 };
    expect(normalizeDoc(base).pageSetup.watermark).toEqual({ kind: 'text', text: 'سري', opacity: 0.3 });
  });
});
