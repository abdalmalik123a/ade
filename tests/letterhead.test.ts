import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  emptyLayout,
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
