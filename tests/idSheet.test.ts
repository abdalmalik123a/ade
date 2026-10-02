import { describe, expect, it } from 'vitest';
import { A4, defaultSlots, fillFromAttachments, idSheetHtml, layoutIdSheet, slotSize } from '../src/shared/idSheet';

/** ورقة المستمسكات المجمّعة (خطة Production، المرحلة ٥): عدّة مستمسكاتٍ ١:١ على A4. */
describe('ورقة المستمسكات المجمّعة', () => {
  it('الافتراض — الوطنية والسكن وجهًا وظهرًا — ورقةٌ واحدة بمقاساتها الحقيقية', () => {
    const sizes = defaultSlots().map((s) => slotSize(s.sizeKey));
    const pl = layoutIdSheet(sizes);
    expect(pl.every((p) => p.page === 0)).toBe(true);
    expect(pl.map((p) => [p.w, p.h])).toEqual(sizes.map((s) => [s.w, s.h]));
    // داخل الهامش كلّها، ولا تتداخل.
    for (const p of pl) {
      expect(p.x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(p.x + p.w).toBeLessThanOrEqual(A4.w - 10 + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(A4.h - 10 + 1e-9);
    }
    for (const a of pl)
      for (const b of pl)
        if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
  });

  it('وجه الوطنية بجانب ظهرها، والوجه يمينًا كالقراءة — وبطاقة السكن لا يتّسع لها السطر فتنزل', () => {
    const [natF, natB, resF, resB] = layoutIdSheet(defaultSlots().map((s) => slotSize(s.sizeKey)));
    expect(natF!.y).toBe(natB!.y);
    expect(natF!.x).toBeGreaterThan(natB!.x);
    expect(resF!.y).toBeGreaterThan(natF!.y);
    expect(resB!.y).toBeGreaterThan(resF!.y);
    // كلّ سطرٍ في وسط الورقة.
    expect(Math.abs(resF!.x + resF!.w / 2 - A4.w / 2)).toBeLessThan(0.01);
  });

  it('وما لم تسعه الورقة يبدأ ورقةً ثانية', () => {
    // A7 (١٠٥ ملم) واحدةٌ في السطر، وثلاثة أسطرٍ في الورقة — فاثنتا عشرة أربع أوراق.
    const pl = layoutIdSheet(Array.from({ length: 12 }, () => slotSize('a7')));
    expect(Math.max(...pl.map((p) => p.page))).toBe(3);
    expect([0, 1, 2, 3].map((n) => pl.filter((p) => p.page === n).length)).toEqual([3, 3, 3, 3]);
    // والوطنية (ID-1) اثنتان في السطر، وأربعة أسطر: ثمانٍ في الورقة.
    const ids = layoutIdSheet(Array.from({ length: 9 }, () => slotSize('id1')));
    expect(ids.filter((p) => p.page === 0)).toHaveLength(8);
    expect(ids.at(-1)!.page).toBe(1);
  });

  it('أوراق الطباعة لما له صورة وحده، بالملّم', () => {
    const slots = defaultSlots().map((s, i) => ({ ...s, src: i === 0 || i === 2 ? `attachments/${i}.png` : null }));
    const pages = idSheetHtml(slots, { resolveUrl: (s) => `diwan://store/${s}` });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('width:85.6mm;height:54mm');
    expect(pages[0]).toContain('width:105mm;height:74mm');
    expect(pages[0]!.match(/data-sheet-card/g)).toHaveLength(2);
    expect(idSheetHtml(defaultSlots(), { resolveUrl: (s) => s })).toEqual([]);
  });

  it('مستمسكات المواطن تملأ خاناتها: الوطنية والسكن، والوجه والظهر — وما لم يُوجد يبقى فارغًا', () => {
    const filled = fillFromAttachments(defaultSlots(), [
      { docType: 'بطاقة السكن — الظهر', filePath: 'attachments/rb.png' },
      { docType: 'البطاقة الوطنية الموحدة — الوجه', filePath: 'attachments/nf.png' },
      { docType: 'البطاقة الوطنية الموحدة — الظهر', filePath: 'attachments/nb.png' },
      { docType: 'جواز السفر', filePath: 'attachments/p.png' }
    ]);
    expect(filled.map((s) => s.src)).toEqual(['attachments/nf.png', 'attachments/nb.png', null, 'attachments/rb.png']);
  });
});
