/**
 * الجسر بين الوثيقة والمحرّر (المرحلة ١ من خطّة الترقية): ما يدخل المحرّر يخرج كما هو.
 *
 * المعيار مطلق لأنّ المحرّر يحفظ ما يخرج منه فوق ما دخل: كتلةٌ تسقط أو معرّفٌ يتبدّل
 * أو تنسيقٌ يضيع في الذهاب والإياب يضيع من نموذج المكتب نفسه. والفرق الوحيد المقبول أنّ
 * مقطعين متجاورين بالتنسيق نفسه يصيران مقطعًا واحدًا — وهو النصّ نفسه.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { docxToDoc } from '../src/main/services/docxDoc';
import { blocksToPm, cssSizeToPx, docSchema, firstFontFamily, pmBlocks } from '../src/shared/docPm';
import { renderDocHtml } from '../src/shared/docHtml';
import { emptyDoc, fieldRef, paragraph, run, walkBlocks, type Block, type Inline } from '../src/shared/doc';

/** المقاطع المتجاورة بالتنسيق نفسه مقطعٌ واحد، والمقطع الفارغ لا شيء. */
function canonInlines(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const i of inlines) {
    if (i.kind === 'run') {
      if (!i.text) continue;
      const last = out[out.length - 1];
      if (last?.kind === 'run' && JSON.stringify(last.marks ?? {}) === JSON.stringify(i.marks ?? {})) {
        out[out.length - 1] = { ...last, text: last.text + i.text };
        continue;
      }
    }
    out.push(i);
  }
  return out;
}

function canon(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.kind === 'paragraph') return { ...b, inlines: canonInlines(b.inlines) };
    if (b.kind === 'table')
      return {
        ...b,
        rows: b.rows.map((r) => ({
          ...r,
          cells: r.cells.map((c) => ({ ...c, blocks: canon(c.blocks) as typeof c.blocks }))
        }))
      };
    if (b.kind === 'columns') return { ...b, columns: b.columns.map(canon) };
    if (b.kind === 'group') return { ...b, blocks: canon(b.blocks) };
    if (b.kind === 'list') {
      const items = (list: typeof b.items): typeof b.items =>
        list.map((it) => ({ ...it, inlines: canonInlines(it.inlines), ...(it.items ? { items: items(it.items) } : {}) }));
      return { ...b, items: items(b.items) };
    }
    return b;
  });
}

const roundTrip = (blocks: Block[]) => pmBlocks(blocksToPm(blocks));

/** كلّ نوعٍ من الكتل، بكلّ صفةٍ اختيارية فيه. */
function everything(): Block[] {
  return [
    paragraph(
      [
        run('السيد '),
        fieldRef('الاسم'),
        run(' المحترم', { bold: true, underline: true }),
        { kind: 'break' },
        run('مائلٌ بخطٍّ آخر', { italic: true, font: 'Simplified Arabic', size: 18 })
      ],
      { align: 'justify', indent: 20, spaceAfter: 6, size: 16, lineHeight: 1.5 }
    ),
    paragraph([], { align: 'center', dir: 'ltr' }),
    {
      id: 'list-1',
      kind: 'list',
      styles: ['question', 'arabicLetter'],
      pick: 4,
      items: [
        {
          id: 'q1',
          inlines: [run('أكمل الفراغات')],
          score: 20,
          pick: 2,
          items: [
            { id: 'q1a', inlines: [run('ناتج 3 × 4')], answer: [run('12')] },
            { id: 'q1b', inlines: [fieldRef('سؤال')] }
          ]
        },
        { id: 'q2', inlines: [run('حلّ المعادلة')], score: 30 }
      ]
    },
    {
      id: 'tbl',
      kind: 'table',
      columns: [2, 1, 1],
      header: true,
      borders: false,
      rows: [
        { id: 'r1', cells: [{ id: 'c1', blocks: [paragraph([run('المادة', { bold: true })])] }, { id: 'c2', colSpan: 2, blocks: [paragraph([run('الدرجة')])] }] },
        {
          id: 'r2',
          cells: [
            { id: 'c3', blocks: [paragraph([fieldRef('المادة')]), paragraph([run('سطر ثانٍ')])] },
            { id: 'c4', blocks: [paragraph([run('90')], { align: 'center' })] },
            { id: 'c5', blocks: [paragraph([run('تسعون')])] }
          ]
        }
      ]
    },
    { id: 'img', kind: 'image', src: 'letterheads/logo.png', width: 120, height: 3, align: 'left' },
    { id: 'sp', kind: 'spacer', height: 112, lines: true },
    { id: 'sp2', kind: 'spacer', height: 24 },
    { id: 'pb', kind: 'pageBreak' },
    { id: 'hr', kind: 'rule' },
    {
      id: 'cols',
      kind: 'columns',
      gap: 24,
      widths: [3, 1],
      columns: [[paragraph([run('إدارة المدرسة')])], [paragraph([run('العدد:')]), paragraph([run('التاريخ:')])]]
    },
    { id: 'grp', kind: 'group', mode: 'repeat', on: 'الجهات', blocks: [paragraph([run('- '), fieldRef('الجهات')])], dir: 'rtl' }
  ];
}

describe('الجسر بين الوثيقة والمحرّر', () => {
  it('كلّ نوعٍ من الكتل يعود كما دخل — بمعرّفاته وصفاته', () => {
    const blocks = everything();
    expect(roundTrip(blocks)).toEqual(canon(blocks));
  });

  it('المخطّط يقبل الوثيقة كلّها بلا تصحيح', () => {
    expect(() => blocksToPm(everything()).check()).not.toThrow();
  });

  it('الذهاب والإياب مرّتين كمرّة — لا شيء يتراكم', () => {
    const once = roundTrip(everything());
    expect(roundTrip(once)).toEqual(once);
  });

  it('الحقل عقدةٌ ذرّية بمفتاحه ومعرّفه', () => {
    const p = paragraph([run('إلى '), fieldRef('الجهة')]);
    const field = p.inlines[1]!;
    const node = blocksToPm([p]).firstChild!;
    expect(node.childCount).toBe(2);
    const pm = node.child(1);
    expect(pm.type.name).toBe('field');
    expect(pm.isAtom).toBe(true);
    expect(pm.attrs).toMatchObject({ ref: 'الجهة', id: (field as { id: string }).id });
  });

  it('ورقةٌ بلا كتل تبدأ بسطرٍ فارغ يُكتب فيه', () => {
    const doc = blocksToPm([]);
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild!.type.name).toBe('paragraph');
  });

  it('المقاطع المتجاورة بالتنسيق نفسه تصير مقطعًا واحدًا — والنصّ نفسه', () => {
    const blocks = [paragraph([run('تؤيّد '), run('إدارة '), run('المدرسة', { bold: true }), run(' أنّ', { bold: true })])];
    const back = roundTrip(blocks)[0] as Extract<Block, { kind: 'paragraph' }>;
    expect(back.inlines).toEqual([run('تؤيّد إدارة '), run('المدرسة أنّ', { bold: true })]);
  });

  for (const file of ['warning-letter.docx', 'school-warning.docx']) {
    it(`ملف Word حقيقيّ (${file}) يعبر المحرّر بلا فقد`, () => {
      const files = unzipSync(new Uint8Array(readFileSync(join(__dirname, 'fixtures', file))));
      const { doc } = docxToDoc(files, (_b, ext) => `letterheads/x${ext}`);
      expect(doc.blocks.length).toBeGreaterThan(3);
      expect(() => blocksToPm(doc.blocks).check()).not.toThrow();
      expect(roundTrip(doc.blocks)).toEqual(canon(doc.blocks));
    });
  }
});

describe('المائل والخطّ: يُطبعان كما في المحرّر، ويُقرآن من Word', () => {
  it('الطباعة ترسم المائل والخطّ', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('نصٌّ مائل', { italic: true, font: 'Simplified Arabic' }), run(' وعادي')])];
    const html = renderDocHtml(doc);
    expect(html).toContain('<em>');
    expect(html).toContain("font-family:'Simplified Arabic'");
  });

  it('المائل في ملف Word يصل إلى الوثيقة — والعربيّ بخاصّية النصوص المعقّدة', () => {
    const body =
      '<w:p><w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t>نصٌّ مائل</w:t></w:r><w:r><w:t> وعادي</w:t></w:r></w:p>' +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>';
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`;
    const { doc } = docxToDoc(unzipSync(zipSync({ 'word/document.xml': strToU8(xml) })));
    const runs = walkBlocks(doc.blocks).flatMap((b) => (b.kind === 'paragraph' ? b.inlines : []));
    expect(runs.find((i) => i.kind === 'run' && i.text.includes('نصٌّ مائل'))).toMatchObject({ marks: { italic: true } });
    expect(runs.find((i) => i.kind === 'run' && i.text.includes('وعادي'))).not.toMatchObject({ marks: { italic: true } });
  });
});

describe('قراءة أنماط اللصق', () => {
  it('الحجم من Word بالنقطة يصير بكسلًا، ومن المتصفّح كما هو', () => {
    expect(cssSizeToPx('14.0pt')).toBeCloseTo(18.7, 1);
    expect(cssSizeToPx('16px')).toBe(16);
    expect(cssSizeToPx('larger')).toBeNull();
  });

  it('الخطّ أوّل عائلةٍ بلا اقتباس، والعامّ لا يُعدّ خطًّا', () => {
    expect(firstFontFamily('"Simplified Arabic",serif')).toBe('Simplified Arabic');
    expect(firstFontFamily("'Traditional Arabic', 'Times New Roman'")).toBe('Traditional Arabic');
    expect(firstFontFamily('serif')).toBeNull();
  });

  it('العلامات الخمس في المخطّط', () => {
    expect(Object.keys(docSchema.marks)).toEqual(['bold', 'italic', 'underline', 'size', 'font']);
  });
});
