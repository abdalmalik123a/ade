import { describe, expect, it } from 'vitest';
import { A4, docSheetHtml, docTypes, fillDocs, layoutDocs, newDoc, pageCount, startDocs, type DocPlacement, type SheetDoc } from '../src/shared/idDocSheet';

/** ورقة المستمسكات كما يعمل المكتب (S47، D197): الأنواع بمقاساتها، والرصف بوحداتٍ بوجهيها، والأوراق. */
const filled = (typeKey: string, patch: Partial<SheetDoc> = {}) => newDoc(typeKey, { front: 'f.png', back: 'b.png', ...patch });
const inside = (p: DocPlacement) => p.x >= 10 - 1e-9 && p.y >= 10 - 1e-9 && p.x + p.w <= A4.w - 10 + 1e-9 && p.y + p.h <= A4.h - 10 + 1e-9;
const apart = (a: DocPlacement, b: DocPlacement) => a.page !== b.page || a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9;

describe('ورقة المستمسكات (S47)', () => {
  it('الأنواع بجدول المالك: الوطنية ٨٥٫٦×٥٣٫٩٨ والجواز ١٢٥×٨٨ والسكن ١٤٨×٢١٠ — ولا نوعٌ بلا مقاس', () => {
    const t = Object.fromEntries(docTypes().map((x) => [x.key, x]));
    expect([t.national!.w, t.national!.h, t.national!.faces]).toEqual([85.6, 53.98, 2]);
    expect([t.passport!.w, t.passport!.h, t.passport!.faces]).toEqual([125, 88, 1]);
    expect([t.residence!.w, t.residence!.h]).toEqual([148, 210]);
    expect([t.nationality!.w, t.nationality!.h]).toEqual([210, 148]);
    expect([t.vital!.w, t.vital!.h]).toEqual([297, 210]);
    expect(docTypes().every((x) => x.w > 0 && x.h > 0 && (x.faces === 1 || x.faces === 2) && x.label)).toBe(true);
    expect(new Set(docTypes().map((x) => x.key)).size).toBe(docTypes().length);
  });

  it('الوطنية بوجهيها جنبًا في سطرٍ واحد والوجه يمينًا — وفوق في عمودٍ واحد', () => {
    const [f, b] = layoutDocs([filled('national')]);
    expect([f!.face, b!.face]).toEqual(['front', 'back']);
    expect(f!.y).toBe(b!.y);
    expect(f!.x).toBeGreaterThan(b!.x);
    expect([f!.w, f!.h]).toEqual([85.6, 53.98]);
    const [of, ob] = layoutDocs([filled('national', { arrange: 'over' })]);
    expect(of!.x).toBe(ob!.x);
    expect(ob!.y).toBeCloseTo(of!.y + 53.98 + 6, 6);
  });

  it('مستمسكان بنوعين على ورقةٍ واحدة بمقاسيهما، داخل الهامش ولا يتداخلان', () => {
    const pl = layoutDocs([filled('passport'), filled('national')]);
    expect(pl.every((p) => p.page === 0 && p.scale === 1 && inside(p))).toBe(true);
    expect(pl.map((p) => [p.w, p.h])).toEqual([[125, 88], [85.6, 53.98], [85.6, 53.98]]);
    for (const a of pl) for (const b of pl) if (a !== b) expect(apart(a, b)).toBe(true);
  });

  it('السكن ١٤٨×٢١٠ لا يسعه جنبًا ولا فوق: يُفصل وجهاه ولا يُصغَّران — وما جاوز الورقة وحده يُصغَّر', () => {
    const res = layoutDocs([filled('residence')]);
    expect(res.map((p) => [p.page, p.w, p.h, p.scale])).toEqual([[0, 148, 210, 1], [1, 148, 210, 1]]);
    // الولادة ٢٩٧×٢١٠ والتموينية ٢١٠×٢٩٧ أكبر من A4 بهوامشها: تُصغَّر بنسبتها ولا تُقصّ.
    const [vital] = layoutDocs([filled('vital')]);
    expect(vital!.scale).toBeLessThan(1);
    expect(vital!.w / vital!.h).toBeCloseTo(297 / 210, 6);
    expect(inside(vital!)).toBe(true);
    expect(layoutDocs([filled('ration')])[0]!.scale).toBeLessThan(1);
    // والجنسية ٢١٠×١٤٨ بوجهيها: لا جنبًا ولا فوق (٢١٠ > ١٩٠)، فيُفصلان ويُصغَّر كلٌّ.
    const nat = layoutDocs([filled('nationality')]);
    expect(nat).toHaveLength(2);
    expect(nat.every((p) => p.scale < 1 && inside(p))).toBe(true);
  });

  it('وحدةٌ لا يسعها ترتيبها تُجرَّب بالآخر: الأحوال ١٠٥×٧٥ جنبًا (٢١٦) لا تسع، ففوق', () => {
    const [f, b] = layoutDocs([filled('civil')]);
    expect(f!.x).toBe(b!.x);
    expect(b!.y).toBeGreaterThan(f!.y);
    expect([f!.scale, b!.scale]).toEqual([1, 1]);
  });

  it('ما لم تسعه الورقة يبدأ ورقةً تالية، وعدد النسخ يكرّر الوحدة', () => {
    // الوطنية بوجهيها ١٧٧٫٢ عرضًا فوحدةٌ في السطر، وأربعة أسطرٍ في الورقة (٤×٥٣٫٩٨ + ٣×٦ ≤ ٢٧٧).
    const pl = layoutDocs([filled('national', { copies: 5 })]);
    expect(pl).toHaveLength(10);
    expect(pl.filter((p) => p.page === 0)).toHaveLength(8);
    expect(pl.filter((p) => p.page === 1)).toHaveLength(2);
    expect(new Set(pl.map((p) => p.copy))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(layoutDocs([filled('passport', { copies: 3 })])).toHaveLength(3);
  });

  it('الخانة الفارغة لها موضعها — وأوراق الطباعة ترسم ما له صورة وحده', () => {
    const d = newDoc('national', { front: 'f.png' });
    expect(layoutDocs([d])).toHaveLength(2);
    const pages = docSheetHtml([d], { resolveUrl: (s) => s });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.match(/data-sheet-card/g)).toHaveLength(1);
    expect(docSheetHtml([newDoc('national')], { resolveUrl: (s) => s })).toEqual([]);
  });

  it('الصورة تُحتوى في خانتها ولا يُقصّ طرفها، بالملّم — والظلّ والحوافّ المدوّرة مطفآن ما لم يُطلبا', () => {
    const [html] = docSheetHtml([filled('national')], { resolveUrl: (s) => `diwan://store/${s}` });
    expect(html).toContain('object-fit:contain');
    expect(html).not.toContain('cover');
    expect(html).toContain('width:85.6mm;height:53.98mm');
    expect(html).not.toMatch(/border-radius|box-shadow/);
    const [round] = docSheetHtml([filled('national')], { resolveUrl: (s) => s, rounded: true, shadow: true, labels: true });
    expect(round).toContain('border-radius:3mm');
    expect(round).toContain('box-shadow');
    expect(round).toContain('البطاقة الوطنية الموحّدة — الظهر');
  });

  it('«على وجهي الورقة»: الوجوه في ورقة، وكلّ ظهرٍ في التالية في موضعه معكوسًا أفقيًّا', () => {
    // نسختان من الوطنية في سطرٍ واحد (لا في وسط الورقة، فالعكس يُرى) والجواز تحتهما.
    const docs = [filled('national', { copies: 2 }), filled('passport')];
    const pl = layoutDocs(docs, { duplex: true });
    const fronts = pl.filter((p) => p.face === 'front');
    const backs = pl.filter((p) => p.face === 'back');
    expect(fronts.every((p) => p.page === 0)).toBe(true);
    expect(backs).toHaveLength(2);
    for (const back of backs) {
      const front = fronts.find((p) => p.doc === 0 && p.copy === back.copy)!;
      expect(back.page).toBe(1);
      expect(Math.abs(front.x + front.w / 2 - A4.w / 2)).toBeGreaterThan(10);
      expect(back.x).toBeCloseTo(A4.w - front.x - front.w, 6);
      expect(back.y).toBe(front.y);
    }
    expect(pageCount(docs, pl, true)).toBe(2);
    expect(docSheetHtml(docs, { resolveUrl: (s) => s, duplex: true })).toHaveLength(2);
    // ولا ورقة ظهورٍ لما لا ظهر له.
    expect(docSheetHtml([filled('passport')], { resolveUrl: (s) => s, duplex: true })).toHaveLength(1);
  });

  it('البداية: «استنساخ هوية» بالوطنية، و«المستمسكات على ورقة» بالوطنية والسكن — ومستمسكات الشخص تملؤها', () => {
    expect(startDocs('id-copy').map((d) => d.typeKey)).toEqual(['national']);
    const docs = [...startDocs('id-sheet'), newDoc('passport')];
    expect(docs.map((d) => d.typeKey)).toEqual(['national', 'residence', 'passport']);
    const out = fillDocs(docs, [
      { docType: 'بطاقة السكن — الظهر', filePath: 'rb.png' },
      { docType: 'البطاقة الوطنية الموحدة — الوجه', filePath: 'nf.png' },
      { docType: 'البطاقة الوطنية الموحدة — الظهر', filePath: 'nb.png' },
      { docType: 'جواز السفر', filePath: 'p.png' },
      { docType: 'شهادة الجنسية', filePath: 'n.png' }
    ]);
    expect(out.map((d) => [d.front, d.back])).toEqual([['nf.png', 'nb.png'], [null, 'rb.png'], ['p.png', null]]);
  });
});
