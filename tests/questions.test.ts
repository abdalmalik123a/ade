import { describe, expect, it } from 'vitest';
import {
  emptyDoc,
  itemScore,
  listScore,
  newUuid,
  normalizeDoc,
  paragraph,
  run,
  tallyScores,
  walkItems,
  type ListBlock,
  type ListItem
} from '../src/shared/doc';
import { marker, renderDocHtml } from '../src/shared/docHtml';

const item = (text: string, patch: Partial<ListItem> = {}): ListItem => ({
  id: newUuid(),
  inlines: [run(text)],
  ...patch
});

/** ورقة أسئلة كما تُكتب فعلًا: ثلاثة مستويات، ودرجات، واختياريّ. */
function paper(): ListBlock {
  return {
    id: 'q',
    kind: 'list',
    styles: ['question', 'arabicLetter', 'number'],
    pick: 2,
    items: [
      item('أجب عمّا يأتي:', {
        score: 20,
        pick: 2,
        items: [
          item('عرّف ما يأتي:', {
            items: [item('الضغط الجوي'), item('الكثافة')]
          }),
          item('علّل ما يأتي:', { items: [item('يطفو الخشب على الماء')] }),
          item('اكتب المصطلح العلمي:')
        ]
      }),
      item('حلّ ما يأتي:', { score: 30 }),
      item('سؤالٌ ثالث:', { score: 25 })
    ]
  };
}

const withPaper = () => {
  const doc = emptyDoc();
  doc.blocks = [paper()];
  return doc;
};

describe('الترقيم يُحسب عند الرسم', () => {
  it('لكل مستوى نمطه: س١ ثم أ ثم ١', () => {
    expect(marker('question', 0, 'arabic')).toBe('س1:');
    expect(marker('arabicLetter', 0, 'arabic')).toBe('أ)');
    expect(marker('arabicLetter', 2, 'arabic')).toBe('ج)');
    expect(marker('number', 1, 'arabic')).toBe('2-');
    expect(marker('ordinal', 0, 'arabic')).toBe('أولًا:');
    expect(marker('latinLetter', 1, 'arabic')).toBe('b)');
    expect(marker('bullet', 5, 'arabic')).toBe('•');
  });

  it('والأرقام هندية إن اختارها المكتب', () => {
    expect(marker('question', 0, 'indic')).toBe('س١:');
    expect(marker('number', 11, 'indic')).toBe('١٢-');
  });

  it('وما جاوز حروف الأبجدية يعود رقمًا بلا انهيار', () => {
    expect(marker('arabicLetter', 99, 'arabic')).toBe('100)');
    expect(marker('ordinal', 50, 'arabic')).toBe('51:');
  });

  it('فحذف سؤال يعيد ترقيم ما بعده وحده — لا يُكتب الرقم في المتن', () => {
    const doc = withPaper();
    const html = renderDocHtml(doc, {}, { paragraphs: 'blocks' });
    expect(html).toContain('س1:');
    expect(html).toContain('س2:');

    // يُحذف الأول، فيصير الثاني أولًا بلا أن يُمسّ نصّه.
    const block = doc.blocks[0] as ListBlock;
    doc.blocks = [{ ...block, items: block.items.slice(1) }];
    const after = renderDocHtml(doc, {}, { paragraphs: 'blocks' });
    expect(after).toContain('س1:');
    expect(after).toContain('حلّ ما يأتي');
    expect(after).not.toContain('أجب عمّا يأتي');
  });
});

describe('العمق هو «الفروع»', () => {
  it('ثلاثة مستويات تُرسم متداخلة', () => {
    const html = renderDocHtml(withPaper(), {}, { paragraphs: 'blocks' });
    expect(html).toContain('الضغط الجوي');
    expect(html).toContain('أ)');
    expect(html).toContain('1-');
  });

  it('والمشي يبلغ أعمقها', () => {
    const all = walkItems(paper().items).map((i) =>
      i.inlines.map((n) => (n.kind === 'run' ? n.text : '')).join('')
    );
    expect(all).toContain('الكثافة');
    expect(all).toHaveLength(9);
  });
});

describe('الدرجات', () => {
  it('درجة العنصر ما كُتب له', () => {
    expect(itemScore(item('س', { score: 15 }))).toBe(15);
  });

  it('وإلا فمجموع فروعه', () => {
    const q = item('س', { items: [item('أ', { score: 5 }), item('ب', { score: 7 })] });
    expect(itemScore(q)).toBe(12);
  });

  it('وبلا درجة ولا فروع فصفر', () => {
    expect(itemScore(item('س'))).toBe(0);
  });

  it('«أجب عن ن» يحسب أكبر ن درجةً — وهو أقصى ما يناله الطالب', () => {
    const q = item('س', {
      pick: 2,
      items: [item('أ', { score: 10 }), item('ب', { score: 6 }), item('ج', { score: 8 })]
    });
    expect(itemScore(q)).toBe(18);
  });

  it('ومجموع الورقة يحترم الاختياريّ على المستوى الأول', () => {
    // ثلاثة أسئلة (٢٠ و٣٠ و٢٥) و«أجب عن اثنين» ← ٥٥ لا ٧٥.
    expect(listScore(paper())).toBe(55);
    expect(tallyScores(withPaper())).toEqual({ total: 55, questions: 3 });
  });

  it('وبلا اختياريّ يُجمع الكلّ', () => {
    const block = { ...paper(), pick: undefined };
    expect(listScore(block)).toBe(75);
  });

  it('والدرجة تُرسم على الورقة كما تُكتب في ورقة المدرسة', () => {
    const html = renderDocHtml(withPaper(), {}, { paragraphs: 'blocks' });
    expect(html).toContain('20 درجة');
    expect(html).toContain('أجب عن 2 فقط');
  });
});

describe('نموذج الإجابة', () => {
  const doc = () => {
    const d = emptyDoc();
    d.blocks = [
      {
        id: 'l',
        kind: 'list',
        styles: ['number'],
        items: [item('ما عاصمة العراق؟', { answer: [run('بغداد')] })]
      }
    ];
    return d;
  };

  it('تُخفى في ورقة الطالب', () => {
    expect(renderDocHtml(doc(), {}, { paragraphs: 'blocks' })).not.toContain('بغداد');
  });

  it('وتظهر في ورقة المصحّح', () => {
    const html = renderDocHtml(doc(), {}, { paragraphs: 'blocks', answers: 'show' });
    expect(html).toContain('بغداد');
    expect(html).toContain('الإجابة:');
  });
});

describe('التخطيط', () => {
  it('العمودان لا يتدفّقان عبر الصفحات', () => {
    const doc = emptyDoc();
    doc.blocks = [
      {
        id: 'c',
        kind: 'columns',
        columns: [[paragraph([run('يمين')])], [paragraph([run('يسار')])]]
      }
    ];
    const html = renderDocHtml(doc, {}, { paragraphs: 'blocks' });

    expect(html).toContain('display:flex');
    expect(html).toContain('page-break-inside:avoid');
    expect(html).toContain('يمين');
    expect(html).toContain('يسار');
  });

  it('ومساحة الإجابة سطورٌ منقّطة بارتفاع يُضبط', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 's', kind: 'spacer', height: 120, lines: true }];
    const html = renderDocHtml(doc);

    expect(html).toContain('height:120px');
    expect(html).toContain('repeating-linear-gradient');
  });

  it('والمسافة بلا سطور تبقى فراغًا', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 's', kind: 'spacer', height: 90 }];
    expect(renderDocHtml(doc)).not.toContain('repeating-linear-gradient');
  });

  it('وكتلة الإنجليزية LTR داخل ورقة عربية', () => {
    const doc = emptyDoc();
    doc.blocks = [
      {
        id: 'l',
        kind: 'list',
        dir: 'ltr',
        styles: ['latinNumber'],
        items: [item('Choose the correct answer')]
      }
    ];
    expect(renderDocHtml(doc, {}, { paragraphs: 'blocks' })).toContain('dir="ltr"');
  });
});

describe('صنف الوثيقة وتقييدها', () => {
  it('الأصل: متدفّقة تُقيَّد في الصادر', () => {
    expect(emptyDoc()).toMatchObject({ kind: 'flow', issuing: 'registered' });
  });

  it('وورقة الأسئلة تُطبع ولا تُقيَّد', () => {
    const doc = normalizeDoc({ kind: 'flow', issuing: 'print-only', blocks: [] });
    expect(doc.issuing).toBe('print-only');
  });

  it('وما حُفظ قبل هذا يُقرأ متدفّقًا مُقيَّدًا — فلا يتبدّل حكم كتابٍ قديم', () => {
    const doc = normalizeDoc({ blocks: [] });
    expect(doc).toMatchObject({ kind: 'flow', issuing: 'registered' });
  });

  it('وقيمة غريبة تعود إلى الأصل الآمن', () => {
    expect(normalizeDoc({ kind: 'شيء', issuing: 'آخر' })).toMatchObject({
      kind: 'flow',
      issuing: 'registered'
    });
  });
});

describe('ترحيل القوائم القديمة', () => {
  it('قائمةٌ حُفظت بنمطٍ واحد تُقرأ بمستوًى واحد', () => {
    const doc = normalizeDoc({
      blocks: [{ id: 'l', kind: 'list', style: 'ordinal', items: [{ id: 'a', inlines: [] }] }]
    });
    expect((doc.blocks[0] as ListBlock).styles).toEqual(['ordinal']);
  });

  it('وبلا نمطٍ أصلًا تعود إلى النقطة', () => {
    const doc = normalizeDoc({ blocks: [{ id: 'l', kind: 'list', items: [] }] });
    expect((doc.blocks[0] as ListBlock).styles).toEqual(['bullet']);
  });
});
