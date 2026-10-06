/**
 * التنسيق على الورقة: الحجم والمحاذاة، وأوزان أعمدة الجدول، والعلامة المائية — وكلّها يجب أن تخرج
 * في الطباعة كما رُئيت، لأن محرّك الرسم واحد. (وEnter وBackspace وأوامر الجدول صارت لـProseMirror
 * بعد حذف المحرّر الأوّل: `docPmTable.test.ts` وسيناريوهات المحرّر.)
 */
import { describe, expect, it } from 'vitest';
import { makeTable } from '../src/shared/docEdit';
import { emptyDoc, normalizeDoc, paragraph, run, type ImageBlock } from '../src/shared/doc';
import { renderDocHtml, watermarkHtml } from '../src/shared/docHtml';

describe('الجدول: أعمدةٌ بأوزانٍ نسبية', () => {
  it('أوزانه تخرج في الطباعة عرضًا نسبيًّا', () => {
    const doc = emptyDoc();
    const table = makeTable(1, 2);
    table.columns = [3, 1];
    doc.blocks = [table];
    const html = renderDocHtml(doc, {}, { paragraphs: 'blocks' });
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
