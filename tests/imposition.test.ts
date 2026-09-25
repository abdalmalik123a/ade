import { describe, expect, it } from 'vitest';
import { cellAt, impose, inlineBarcodes, sheetCount, sheetsHtml } from '../src/shared/imposition';
import { matchPhotos, parseRows } from '../src/shared/batch';

describe('الترتيب على الورق', () => {
  it('الهوية بنزفها تسعٌ في A4 أفقيّة (لا ثمانٍ عموديّة) — والخانات متلاصقة', () => {
    const imp = impose({ w: 85.6, h: 54 }, 3);
    expect(imp.per).toBe(9);
    expect(imp.sheet).toEqual({ w: 297, h: 210 });
    expect(imp.cell).toEqual({ w: 91.6, h: 60 });
    expect(imp.single).toBe(false);
  });

  it('والبطاقة الامتحانية بلا نزفٍ أربعٌ على A4 أفقيّة', () => {
    const flat = impose({ w: 148, h: 105 }, 0);
    expect(flat.per).toBe(2);
    expect(impose({ w: 140, h: 95 }, 0)).toMatchObject({ sheet: { w: 297, h: 210 }, per: 4 });
  });

  it('والشهادة A4 ورقةٌ بمقاسها لا شبكة', () => {
    const imp = impose({ w: 297, h: 210 }, 0);
    expect(imp.single).toBe(true);
    expect(imp.sheet).toEqual({ w: 297, h: 210 });
  });

  it('والخانات من اليمين كما يُقرأ العربي', () => {
    const imp = impose({ w: 85.6, h: 54 }, 3);
    expect(cellAt(imp, 0).x).toBeGreaterThan(cellAt(imp, 1).x);
    expect(cellAt(imp, imp.cols).y).toBeGreaterThan(cellAt(imp, 0).y);
  });

  it('أربعمئة هوية خمسٌ وأربعون ورقة، والأخيرة لا تُكرّر', () => {
    const imp = impose({ w: 85.6, h: 54 }, 3);
    expect(sheetCount(imp, 400)).toBe(45);
    const pages = sheetsHtml(imp, 11, (i) => `<b>${i}</b>`);
    expect(pages).toHaveLength(2);
    expect((pages[1]!.match(/<b>/g) ?? []).length).toBe(2);
    // علامات القصّ: حافّتا كل عمودٍ فوقًا وتحتًا، وحافّتا كل صفٍّ يمينًا ويسارًا.
    expect((pages[0]!.match(/background:#000/g) ?? []).length).toBe(3 * 2 * 2 + 3 * 2 * 2);
  });

  it('والباركود يُرسم قبل الإرسال', () => {
    expect(inlineBarcodes('<div data-barcode="code128" data-value="123" style="left:0"></div>')).toContain('<svg');
  });
});

describe('الدفعة', () => {
  const keys = ['الاسم', 'الصف', 'الرقم', 'الصورة'];

  it('يُلصق من Excel بعناوينه — والعمود المجهول يُقال عنه', () => {
    const text = 'الاسم\tالصف\tالهاتف\nزينب علي\tالخامس\t0770\nأحمد كريم\tالسادس\t0780\n';
    const p = parseRows(text, keys);
    expect(p.headed).toBe(true);
    expect(p.rows).toEqual([
      { الاسم: 'زينب علي', الصف: 'الخامس' },
      { الاسم: 'أحمد كريم', الصف: 'السادس' }
    ]);
    expect(p.ignored).toEqual(['الهاتف']);
  });

  it('وبلا عناوين فالأعمدة بترتيب الحقول', () => {
    const p = parseRows('زينب علي\tالخامس\t101', keys);
    expect(p.headed).toBe(false);
    expect(p.rows[0]).toEqual({ الاسم: 'زينب علي', الصف: 'الخامس', الرقم: '101' });
  });

  it('والعناوين تُطابَق بلا همزات ولا مسافات زائدة', () => {
    const p = parseRows('إسم \tالرقم\nزينب\t7', ['اسم', 'الرقم']);
    expect(p.rows[0]).toEqual({ اسم: 'زينب', الرقم: '7' });
  });

  it('والصور تُطابَق بالاسم أو بالرقم', () => {
    const rows = [
      { الاسم: 'زينب علي', الرقم: '101' },
      { الاسم: 'أحمد كريم', الرقم: '102' },
      { الاسم: 'مريم', الرقم: '103' }
    ];
    const out = matchPhotos(
      rows,
      [
        { name: 'زينب_علي', src: 'p/1.jpg' },
        { name: '102', src: 'p/2.jpg' }
      ],
      'الصورة',
      ['الاسم', 'الرقم']
    );
    expect(out.matched).toBe(2);
    expect(out.rows[0]!.الصورة).toBe('p/1.jpg');
    expect(out.rows[1]!.الصورة).toBe('p/2.jpg');
    expect(out.unmatched).toEqual(['مريم']);
  });
});
