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
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { docxToDoc } from '../src/main/services/docxDoc';
import { blocksToPm, cssSizeToPx, docSchema, firstFontFamily, pmBlocks } from '../src/shared/docPm';
import { cssColor } from '../src/shared/docPmMarks';
import { docToDocx } from '../src/main/services/docDocx';
import { renderDocHtml } from '../src/shared/docHtml';
import { emptyDoc, fieldRef, paragraph, run, walkBlocks, type Block, type Inline } from '../src/shared/doc';
import { EditorState } from 'prosemirror-state';
import { setParagraphAttr, setSpaceAfter, SPACE_AFTERS } from '../src/renderer/src/components/pageEditor/commands';

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
        run('مائلٌ بخطٍّ آخر', { italic: true, font: 'Simplified Arabic', size: 18 }),
        run('مشطوبٌ ملوّن', { strike: true, color: '#c00000' }),
        run('2', { script: 'sup' }),
        run('أسفل', { script: 'sub', bold: true })
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

  it('العلامات في المخطّط: الخمس الأولى، ثم الشطب وأعلى السطر وأسفله واللون (البند ٣)', () => {
    expect(Object.keys(docSchema.marks)).toEqual(['bold', 'italic', 'underline', 'size', 'font', 'strike', 'sup', 'sub', 'color']);
  });

  it('واللون من Word والمتصفّح بصيغةٍ واحدة — والأسود تلقائيّ، والفاتح الذي يختفي على الورقة البيضاء لا يُقرأ', () => {
    expect(cssColor('#C00000')).toBe('#c00000');
    expect(cssColor('#f00')).toBe('#ff0000');
    expect(cssColor('rgb(0, 112, 192)')).toBe('#0070c0');
    expect(cssColor('red')).toBe('#ff0000');
    expect(cssColor('navy')).toBe('#000080');
    for (const v of ['black', 'windowtext', '#000', 'rgb(51, 51, 51)', 'white', 'rgb(223, 227, 225)', 'rgba(255, 0, 0, 0)', 'inherit', 'currentcolor']) {
      expect(cssColor(v), v).toBeNull();
    }
  });

  it('وأعلى السطر وأسفله لا يجتمعان — كما في Word', () => {
    const { sup, sub } = docSchema.marks;
    expect(sup!.excludes(sub!)).toBe(true);
    expect(sub!.excludes(sup!)).toBe(true);
  });
});

describe('الشطب وأعلى السطر وأسفله واللون (محادثة «محرّر الكتاب»، البند ٣)', () => {
  const doc = () => {
    const d = emptyDoc();
    d.blocks = [paragraph([run('مشطوب', { strike: true }), run('م'), run('2', { script: 'sup' }), run('H'), run('2', { script: 'sub' }), run('O أحمر', { color: '#ff0000' })])];
    return d;
  };

  it('تُطبع كما تُرى', () => {
    const html = renderDocHtml(doc());
    expect(html).toContain('<s>مشطوب</s>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('<span style="color:#ff0000">O أحمر</span>');
  });

  it('ولونٌ بغير صيغته أو أعلى سطرٍ بغير اسمه لا يدخل الورقة ولا المحرّر', () => {
    const d = emptyDoc();
    d.blocks = [paragraph([run('نصّ', { color: 'red;background:url(x)', script: 'top' as never })])];
    expect(renderDocHtml(d)).not.toContain('background');
    expect(pmBlocks(blocksToPm(d.blocks))).toMatchObject([{ inlines: [{ kind: 'run', text: 'نصّ' }] }]);
    expect((pmBlocks(blocksToPm(d.blocks))[0] as { inlines: { marks?: unknown }[] }).inlines[0]!.marks).toBeUndefined();
  });

  it('وتخرج إلى Word بخصائصه', async () => {
    const x = strFromU8(unzipSync(new Uint8Array(await docToDocx(doc(), { title: 'تجربة', blanks: true })))['word/document.xml']!);
    expect(x).toContain('<w:strike/>');
    expect(x).toContain('<w:vertAlign w:val="superscript"/>');
    expect(x).toContain('<w:vertAlign w:val="subscript"/>');
    expect(x).toMatch(/<w:color w:val="ff0000"\/>/i);
  });
});

describe('تباعد ما بعد الفقرة (S11)', () => {
  it('يدعم تباعد ما بعد الفقرة في الكتل وتوليد ProseMirror وDOM', () => {
    const d = emptyDoc();
    d.blocks = [
      paragraph([run('فقرة متباعدة')], { spaceAfter: 12 }),
      paragraph([run('فقرة بلا تباعد')])
    ];
    const pm = blocksToPm(d.blocks);
    const round = pmBlocks(pm);
    expect(round[0]).toMatchObject({ spaceAfter: 12 });
    expect((round[1] as { spaceAfter?: number }).spaceAfter).toBeUndefined();

    const html = renderDocHtml(d, {}, { paragraphs: 'blocks' });
    expect(html).toContain('margin-bottom:12px');

    const pNode = pm.firstChild!;
    expect(pNode.attrs.spaceAfter).toBe(12);
    expect((pNode.type.spec.toDOM!(pNode) as [string, Record<string, string>, number])[1]).toMatchObject({
      style: 'text-align:right;margin-bottom:12px'
    });
  });

  it('أمر setParagraphAttr وsetSpaceAfter يضبطان spaceAfter على الفقرة المحددة في ProseMirror', () => {
    expect(SPACE_AFTERS).toEqual([0, 6, 12, 18]);
    const docNode = docSchema.node('doc', null, [
      docSchema.node('paragraph', { spaceAfter: null }, [docSchema.text('الفقرة الأولى')]),
      docSchema.node('paragraph', { spaceAfter: null }, [docSchema.text('الفقرة الثانية')])
    ]);
    let state = EditorState.create({ schema: docSchema, doc: docNode });

    // تطبيق تباعد 18 نقطة على الفقرة الأولى
    const cmd18 = setSpaceAfter(18);
    cmd18(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.firstChild!.attrs.spaceAfter).toBe(18);

    // أمر setParagraphAttr المباشر
    const cmd12 = setParagraphAttr('spaceAfter', 12);
    cmd12(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.firstChild!.attrs.spaceAfter).toBe(12);

    // إعادة التباعد إلى 0 (إلغاء التباعد)
    const cmd0 = setSpaceAfter(0);
    cmd0(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.firstChild!.attrs.spaceAfter).toBeNull();
  });

  it('يصدر إلى Word بخصيصة w:spacing w:after', async () => {
    const d = emptyDoc();
    d.blocks = [paragraph([run('فقرة متباعدة في وورد')], { spaceAfter: 12 })];
    const x = strFromU8(unzipSync(new Uint8Array(await docToDocx(d, { title: 'تباعد', blanks: true })))['word/document.xml']!);
    expect(x).toMatch(/<w:spacing[^>]*w:after="\d+"[^>]*\/>/);
  });
});
