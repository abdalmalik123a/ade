import { describe, expect, it } from 'vitest';
import { emptyCanvas, imageElement, textElement, type Canvas } from '../src/shared/canvas';
import { tokenInlines } from '../src/shared/doc';
import { designPreflight, lowResIssues, placedDpi } from '../src/shared/preflight';

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
    expect(issues.map((i) => i.text)).toEqual(['١ من ٢ بطاقات بلا «اسم الطالب»', '١ بطاقة بلا صورة في «صورة الطالب»']);
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
