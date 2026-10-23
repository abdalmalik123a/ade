import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { pageCss } from '../src/shared/docHtml';
import {
  emptyLayout,
  footerBandMm,
  isLayoutEmpty,
  layoutText,
  normalizeLayout,
  resolveLayout,
  type LetterheadLayout
} from '../src/shared/letterhead';
import { emptyDoc, paragraph, run } from '../src/shared/doc';
import { docToDocx } from '../src/main/services/docDocx';

describe('تذييل الورقة (القدم) في الترويسة', () => {
  it('يبدأ مطفأً فارغًا في الترويسة الافتراضية', () => {
    const layout = emptyLayout();
    expect(layout.footer).toEqual({
      show: false,
      text: '',
      align: 'center',
      size: 10
    });
  });

  it('تطبيع الترويسة يملأ حقول التذييل الناقصة بقيم منطقية', () => {
    const raw: Partial<LetterheadLayout> = {
      footer: { show: true, text: 'بغداد — شارع الرشيد' } as any
    };
    const normalized = normalizeLayout(raw);
    expect(normalized.footer).toEqual({
      show: true,
      text: 'بغداد — شارع الرشيد',
      align: 'center',
      size: 10
    });

    const withCustom = normalizeLayout({
      footer: { show: true, text: 'هاتف: 0770000000', align: 'right', size: 12 }
    });
    expect(withCustom.footer).toEqual({
      show: true,
      text: 'هاتف: 0770000000',
      align: 'right',
      size: 12
    });
  });

  it('isLayoutEmpty يرى التذييل المفعّل ولا يعتبر الترويسة فارغة', () => {
    const layout = emptyLayout();
    expect(isLayoutEmpty(layout)).toBe(true);

    layout.footer = { show: true, text: 'هاتف المكتب', align: 'center', size: 10 };
    expect(isLayoutEmpty(layout)).toBe(false);

    layout.footer = { show: false, text: 'هاتف المكتب', align: 'center', size: 10 };
    expect(isLayoutEmpty(layout)).toBe(true);

    layout.footer = { show: true, text: '   ', align: 'center', size: 10 };
    expect(isLayoutEmpty(layout)).toBe(true);
  });

  it('layoutText يضمّن نص التذييل للبحث عنه في المكتبة', () => {
    const layout = emptyLayout();
    layout.footer = { show: true, text: 'بغداد — ساحة الفردوس', align: 'center', size: 10 };
    expect(layoutText(layout)).toContain('بغداد — ساحة الفردوس');
  });

  it('resolveLayout يحلّ الحقول التلقائية في نص التذييل إن وُجدت', () => {
    const layout = emptyLayout();
    layout.footer = { show: true, text: 'الفرع: {القسم}', align: 'center', size: 10 };
    const resolved = resolveLayout(layout, (t) => t.replace('{القسم}', 'شعبة الاستنساخ'));
    expect(resolved.footer?.text).toBe('الفرع: شعبة الاستنساخ');
  });

  it('تصدير Word (docToDocx) يُنشئ عنصر w:ftr متضمنًا نص التذييل', async () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('كتاب رسمي')])];

    const layout = emptyLayout();
    layout.footer = {
      show: true,
      text: 'مكتب ديوان للطباعة — هاتف 07701234567',
      align: 'center',
      size: 10
    };

    const buf = await docToDocx(doc, {
      title: 'كتاب بتذييل',
      head: { layout }
    });

    expect(buf.length).toBeGreaterThan(0);
    const files = unzipSync(new Uint8Array(buf));
    const footerXmlKey = Object.keys(files).find((k) => k.startsWith('word/footer') && k.endsWith('.xml'));
    expect(footerXmlKey, 'ملف التذييل في حزمة docx').toBeDefined();

    const footerXml = strFromU8(files[footerXmlKey!]!);
    expect(footerXml).toContain('w:ftr');
    expect(footerXml).toContain('مكتب ديوان للطباعة — هاتف 07701234567');
  });
});

describe('شريط التذييل محجوزٌ أسفل كلّ صفحة فلا يُطبع فوق المتن (D136)', () => {
  const foot = (text: string, size = 10, show = true) => ({ show, text, align: 'center' as const, size });

  it('footerBandMm: لا شيء للمطفأ والفارغ، وسطرٌ بخطّه وحشوه وخطّه العلوي وفسحته، ويكبر بالخطّ وبالنصّ الطويل', () => {
    expect(footerBandMm(null, 170)).toBe(0);
    expect(footerBandMm(foot('بغداد', 10, false), 170)).toBe(0);
    expect(footerBandMm(foot('   '), 170)).toBe(0);
    // سطرٌ واحد بخطّ ١٠: (١٥ + ٤ + ١) بكسل ≈ ٥٫٢٩ ملم، وفسحة ٢ ← ٧٫٣.
    const one = footerBandMm(foot('بغداد — شارع الرشيد | هاتف 07700000000'), 170);
    expect(one).toBe(7.3);
    expect(footerBandMm(foot('بغداد — شارع الرشيد | هاتف 07700000000', 14), 170)).toBeGreaterThan(one);
    // نصٌّ لا يسعه سطرٌ على عرض المتن يحجز سطرين.
    expect(footerBandMm(foot('بغداد — شارع الرشيد | '.repeat(12)), 170)).toBeGreaterThan(one + 3.9);
  });

  it('pageCss: الحشو السفلي بالشريط في كلّ صفحة والتذييل فيه — والهامش كما هو، والورقة بلا تذييل كما كانت', () => {
    const doc = emptyDoc();
    doc.pageSetup.margins = { top: 20, right: 20, bottom: 20, left: 20 };
    const css = pageCss(doc, { footer: foot('بغداد — شارع الرشيد') });
    expect(css).toContain('@page{margin:20mm 0 20mm 0;}');
    expect(css).toContain('[data-letter-sheet]{padding-bottom:7.3mm!important;-webkit-box-decoration-break:clone;box-decoration-break:clone}');
    expect(css).toContain('[data-letterhead-footer]{position:fixed;bottom:0;left:20mm;right:20mm}');
    // الحشو بعد قاعدة نزعه فيغلبها، وكلاهما في الطباعة وحدها.
    expect(css.indexOf('padding-bottom:7.3mm')).toBeGreaterThan(css.indexOf('padding-bottom:0!important'));
    expect(css.lastIndexOf('}}')).toBe(css.length - 2);

    // وكان التذييل `bottom:<الهامش>` داخل المتن بلا حجز — فوق آخر سطرين.
    expect(css).not.toContain('bottom:20mm;left');
    const plain = '@page{margin:20mm 0 20mm 0;}@media print{.print-root{min-height:0!important}' +
      '[data-letter-sheet]{padding-top:0!important;padding-bottom:0!important;min-height:0!important}}';
    expect(pageCss(doc)).toBe(plain);
    expect(pageCss(doc, { footer: foot('بغداد', 10, false) })).toBe(plain);
  });
});
