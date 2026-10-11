import { describe, expect, it } from 'vitest';
import { barcodeElement, emptyCanvas, imageElement, textElement, type Canvas } from '../src/shared/canvas';
import { tokenInlines } from '../src/shared/doc';
import { designPreflight, lowResIssues, missingPhotoIssues, placedDpi, qrModuleMm, shrinkRatio } from '../src/shared/preflight';

/** هويةٌ CR80 بنزفها: اسمٌ في الوسط، وصورةُ طالب. */
function card(): Canvas {
  const c = emptyCanvas({ w: 85.6, h: 54 }, 3);
  c.elements = [
    textElement({ box: { x: 0.3, y: 0.4, w: 0.6, h: 0.15 }, inlines: tokenInlines('{اسم الطالب}') }),
    imageElement({ box: { x: 0.05, y: 0.2, w: 0.2, h: 0.5 }, ref: 'صورة الطالب' })
  ];
  return c;
}

describe('فاحص ما قبل الطباعة', () => {
  it('تصميمٌ سليم وقيمٌ كاملة: لا ملاحظة', () => {
    expect(designPreflight(card(), [{ 'اسم الطالب': 'زينب', 'صورة الطالب': 'photos/a.png' }])).toEqual([]);
  });

  it('خلفيةٌ دون ١٥٠ نقطة/إنش', () => {
    const c = card();
    c.background = { kind: 'image', src: 'designs/x.png', dpi: 96 };
    expect(designPreflight(c, [])[0]?.text).toContain('٩٦');
  });

  it('عنصرٌ على بعد ملّمٍ من خطّ القصّ — والشهادة التي لا تُقصّ لا تُنبَّه', () => {
    const c = card();
    c.elements.push(textElement({ box: { x: 0.01, y: 0.9, w: 0.3, h: 0.08 }, inlines: tokenInlines('الرقم') }));
    expect(designPreflight(c, []).some((i) => i.text.includes('«الرقم»') && i.text.includes('خطّ القصّ'))).toBe(true);
    c.bleed = 0;
    expect(designPreflight(c, []).some((i) => i.text.includes('خطّ القصّ'))).toBe(false);
  });

  it('بطاقاتٌ بلا اسم، وأخرى بلا صورة', () => {
    const issues = designPreflight(card(), [
      { 'اسم الطالب': 'زينب', 'صورة الطالب': 'photos/a.png' },
      { 'اسم الطالب': '', 'صورة الطالب': '' }
    ]);
    expect(issues.map((i) => i.text)).toEqual(['بطاقة واحدة بلا «اسم الطالب» (من ٢)', 'بطاقة واحدة بلا صورة في «صورة الطالب»']);
  });

  it('دقّة الصورة في موضعها، وتُجمع الضبابية بعنصرها', () => {
    expect(Math.round(placedDpi(240, 25))).toBe(244);
    const issues = lowResIssues([
      { label: 'صورة الطالب', dpi: 90 },
      { label: 'صورة الطالب', dpi: 300 },
      { label: 'صورة الطالب', dpi: 120 }
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.text).toContain('٢ صور');
  });
});

describe('فحص الدفعة كلّها (DESIGNS.md ٣٫٢)', () => {
  it('الاسم الذي يصغر دون ٦٠٪ ليسع يُقال بأصحابه — والقصير لا', () => {
    const c = card();
    const name = c.elements[0]!;
    if (name.kind === 'text') name.fit = 'shrink';
    const long = 'عبد الرحمن محمد عبد الكريم عبد الأمير الموسوي';
    expect(shrinkRatio(name as Extract<typeof name, { kind: 'text' }>, 85.6, { 'اسم الطالب': 'زينب' })).toBe(1);
    expect(shrinkRatio(name as Extract<typeof name, { kind: 'text' }>, 85.6, { 'اسم الطالب': long })).toBeLessThan(0.6);
    const issues = designPreflight(c, [{ 'اسم الطالب': 'زينب', 'صورة الطالب': 'a' }, { 'اسم الطالب': long, 'صورة الطالب': 'b' }]);
    const shrunk = issues.find((i) => i.text.includes('يصغر دون'));
    expect(shrunk?.text).toContain('بطاقة');
    expect(shrunk?.text).toContain(long);
    expect(shrunk?.text).not.toContain('«زينب»');
  });

  it('رمز QR: الخليّة بالملّم من طول ما فيه ومقاسه، والكثيف على مقاسه يُقال، والقصير في صندوقٍ كافٍ لا', () => {
    // ٣٠ بايتًا لا يسعها الإصدار ٢ (٢٨ كلمة بيانات) فالإصدار ٣: ٢٩ خليّة + ٨ هامش = ٣٧ — فصندوقٌ ١٥ ملم خليّته ٠٫٤١.
    expect(qrModuleMm('x'.repeat(30), 15)).toBeCloseTo(15 / 37, 5);
    expect(qrModuleMm('x'.repeat(5000), 15)).toBeNull();
    const c = card();
    c.elements.push(barcodeElement({ box: { x: 0.7, y: 0.6, w: 0.1, h: 0.16 }, symbology: 'qr', ref: 'الرابط' }));
    const short = { 'اسم الطالب': 'زينب', 'صورة الطالب': 'a', الرابط: 'https://x.iq/1' };
    const dense = { ...short, الرابط: `https://example.iq/students/verify?id=${'7'.repeat(120)}` };
    expect(designPreflight(c, [short]).some((i) => i.text.includes('كثيفٌ'))).toBe(false);
    const issue = designPreflight(c, [short, dense]).find((i) => i.text.includes('كثيفٌ'));
    expect(issue?.level).toBe('warn');
    expect(issue?.text).toContain('في بطاقة واحدة');
    expect(designPreflight(c, [{ ...short, الرابط: 'z'.repeat(5000) }]).some((i) => i.text.includes('أطول من أن يحمله'))).toBe(true);
  });

  it('والصور التي لم تُفتح تُجمع بعنصرها', () => {
    expect(missingPhotoIssues(['صورة الطالب', 'صورة الطالب', 'الشعار'])).toEqual([
      { level: 'warn', text: 'صورتان في «صورة الطالب» لم تُفتح — الملف غير موجود أو تالف، فتخرج البطاقة بلا صورة' },
      { level: 'warn', text: 'صورة واحدة في «الشعار» لم تُفتح — الملف غير موجود أو تالف، فتخرج البطاقة بلا صورة' }
    ]);
  });
});
