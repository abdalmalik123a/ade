import { describe, expect, it } from 'vitest';
import { lacksSigner, letterChecks, letterValues, nameFieldOf, readSavedLetter, sampleValues, NO_REGISTRY } from '../src/shared/letterDraft';
import { docText, emptyDoc, fieldRef, makeField, paragraph, run, type Doc } from '../src/shared/doc';
import { emptyLayout } from '../src/shared/letterhead';

function letter(): Doc {
  const doc = emptyDoc();
  doc.fields = [
    makeField({ key: 'الاسم', label: 'الاسم', role: 'name', required: true }),
    makeField({ key: 'تاريخ التعيين', label: 'تاريخ التعيين' })
  ];
  doc.blocks = [paragraph([run('م / تأييد')]), paragraph([run('نؤيد أن '), fieldRef('الاسم'), run(' تعيّن في '), fieldRef('تاريخ التعيين')])];
  return doc;
}

describe('الكتاب في المحرّر: ما يُحفظ', () => {
  it('يُحفظ ويُقرأ كما هو: الورقة وقيمها وعددها وترويستها', () => {
    const saved = { doc: letter(), values: { الاسم: 'زينب علي' }, registry: { number: '٤٥١٢', dateGreg: '1 أيلول 2026', dateHijri: '' }, layout: emptyLayout(), docType: 'تأييد', owner: '' };
    const back = readSavedLetter(JSON.stringify(letterValues(saved)))!;
    expect(back.values).toEqual({ الاسم: 'زينب علي' });
    expect(back.registry.number).toBe('٤٥١٢');
    expect(back.docType).toBe('تأييد');
    expect(docText(back.doc, back.values)).toContain('نؤيد أن زينب علي');
    expect(back.layout).not.toBeNull();
  });

  it('والمسودة القديمة (متنٌ بوسوم وحقولٌ جانبية) تُرحَّل كتلًا ولا يضيع منها سطر', () => {
    const old = {
      serial: '١٢',
      dateGreg: '3 آب 2026',
      subject: 'تأييد استمرار بالخدمة',
      body: 'نؤيد أن السيد {الاسم} مستمر بالخدمة.',
      signerName: 'علي حسن',
      signerRole: 'مدير المدرسة',
      copiesTo: 'الإضبارة\nالصادرة',
      __fields: JSON.stringify([{ token: 'الاسم', label: 'الاسم الرباعي', value: 'أحمد عادل', role: 'name', source: 'fullName' }])
    };
    const back = readSavedLetter(JSON.stringify(old))!;
    const text = docText(back.doc, back.values);
    expect(text).toContain('م / تأييد استمرار بالخدمة');
    expect(text).toContain('نؤيد أن السيد أحمد عادل مستمر بالخدمة.');
    expect(text).toContain('علي حسن');
    expect(text).toContain('نسخة منه إلى :-');
    expect(text).toContain('- الإضبارة');
    expect(back.registry).toEqual({ number: '١٢', dateGreg: '3 آب 2026', dateHijri: '' });
    expect(nameFieldOf(back.doc)?.label).toBe('الاسم الرباعي');
    expect(back.owner).toBe('أحمد عادل');
  });

  it('وما لا يُقرأ يُردّ لا يُسقط الشاشة', () => {
    expect(readSavedLetter('{ليس json')).toBeNull();
  });
});

describe('«جرّبها» بقيمٍ وهمية', () => {
  it('يملأ الفارغ وحده بقيمٍ طويلة، والمكتوب لا يُمسّ', () => {
    const doc = letter();
    const s = sampleValues(doc.fields, { الاسم: 'زينب' }, new Date(2026, 8, 1));
    expect(s['الاسم']).toBe('زينب');
    expect(s['تاريخ التعيين']).toBe('1 أيلول 2026');
    expect(sampleValues(doc.fields, {})['الاسم']!.length).toBeGreaterThan(25);
  });
});

describe('قائمة التحقّق قبل الإصدار', () => {
  const base = { spelling: 0, registryPrinted: false, number: '', headRatio: null, pages: null };

  it('يمنع: بلا اسم صاحب العلاقة، وبلا متن، وحقلٌ إلزاميٌّ فارغ', () => {
    const empty = emptyDoc();
    const blocks = letterChecks({ ...base, doc: empty, values: {}, owner: '' }).filter((c) => c.level === 'block');
    expect(blocks.map((c) => c.text).join(' ')).toContain('اسم صاحب العلاقة');
    expect(blocks.map((c) => c.text).join(' ')).toContain('الورقة فارغة');
    const req = letterChecks({ ...base, doc: letter(), values: {}, owner: 'زينب' });
    expect(req.some((c) => c.level === 'block' && c.text.includes('«الاسم» إلزاميٌّ'))).toBe(true);
  });

  it('وينبّه ولا يمنع: «م /» غائب، والإملاء، والترويسة العالية، والفارغ يُطبع فراغًا', () => {
    const doc = letter();
    doc.blocks = doc.blocks.slice(1);
    const checks = letterChecks({ ...base, doc, values: { الاسم: 'زينب' }, owner: 'زينب', spelling: 2, headRatio: 0.4, pages: 2, registryPrinted: true });
    expect(checks.some((c) => c.level === 'block')).toBe(false);
    const warn = checks.filter((c) => c.level === 'warn').map((c) => c.text).join(' | ');
    expect(warn).toContain('م /');
    expect(warn).toContain('إملائيًّا');
    expect(warn).toContain('40٪');
    const info = checks.filter((c) => c.level === 'info').map((c) => c.text).join(' | ');
    expect(info).toContain('فراغًا منقوطًا');
    expect(info).toContain('العدد فارغ');
    expect(info).toContain('2 صفحات');
  });

  it('ينبّه إلى كتابٍ ختم بخاتمته بلا اسم موقّع — ولا يحكم على ما لا خاتمة له', () => {
    const lines = (...xs: string[]) => xs.join('\n');
    expect(lacksSigner(lines('م / تأييد', 'نؤيد لكم ...', 'مع التقدير'))).toBe(true);
    expect(lacksSigner(lines('م / تأييد', 'نؤيد لكم ...', 'مع التقدير', '', 'نسخة منه إلى :-', '- الإضبارة'))).toBe(true);
    expect(lacksSigner(lines('نؤيد لكم ...', 'مع التقدير', '', 'أحمد علي', 'مدير المدرسة'))).toBe(false);
    expect(lacksSigner(lines('نؤيد لكم ...', 'هذا ولكم التقدير والاحترام.', 'المدير العام', 'نسخة منه إلى :-'))).toBe(false);
    // عريضةٌ يوقّعها صاحبها: لا خاتمة، فلا حكم
    expect(lacksSigner(lines('إلى / محكمة البداءة', 'أطلب ...'))).toBe(false);
    const doc = { ...emptyDoc(), blocks: [paragraph([run('م / طلب')]), paragraph([run('يرجى الموافقة')]), paragraph([run('مع التقدير')])] };
    const checks = letterChecks({ ...base, doc, values: {}, owner: 'زينب' });
    expect(checks.some((c) => c.level === 'warn' && c.text.includes('اسم موقّع'))).toBe(true);
    expect(checks.some((c) => c.level === 'block')).toBe(false);
  });

  it('وكتابٌ سليم لا يُقال فيه إلا ما هو معلومة', () => {
    const checks = letterChecks({ ...base, doc: letter(), values: { الاسم: 'زينب', 'تاريخ التعيين': 'أمس' }, owner: 'زينب', headRatio: 0.2 });
    expect(checks.every((c) => c.level === 'info')).toBe(true);
    expect(NO_REGISTRY.number).toBe('');
  });
});
