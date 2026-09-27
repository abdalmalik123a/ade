import { describe, expect, it } from 'vitest';
import {
  DOC_SCHEMA,
  docFromLegacy,
  docText,
  emptyDoc,
  fieldRef,
  makeField,
  normalizeDoc,
  pageMm,
  paginate,
  paragraph,
  reconcileFields,
  run,
  renameField,
  unfield,
  usedKeys,
  type Doc,
  type TableBlock
} from '../src/shared/doc';
import { missingRequired, renderDocHtml } from '../src/shared/docHtml';
import { legacyFieldMeta, renderBody } from '../src/shared/template';

/** الرسم القديم حرفيًّا — مرجعٌ يُقاس عليه أن الترحيل لم يغيّر ورقة المكتب. */
function legacyRender(
  body: string,
  values: Record<string, string>,
  opts: { markMissing?: boolean } = {}
): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escape(body)
    .replace(/\{([^{}\s][^{}]*)\}/g, (whole, rawName: string) => {
      const name = rawName.trim();
      const value = values[name];
      if (value)
        return `<span class="font-bold text-black underline underline-offset-4 decoration-1">${escape(value)}</span>`;
      if (opts.markMissing === false) return '';
      return `<span class="px-1 rounded bg-surface-container-high text-secondary font-mono">${whole}</span>`;
    })
    .replace(/\n/g, '<br/>');
}

const SAMPLE =
  'إلى / {الجهة_الموجه_إليها}\n\nنؤيد لكم أن السيد {الاسم} ورقمه {الرقم_الوطني}\n\nمع التقدير';

describe('ترحيل المتن القديم إلى وثيقة', () => {
  it('كل سطر فقرة، والوسم عقدةَ حقل لا نصًّا', () => {
    const doc = docFromLegacy('إلى / {الجهة}\nمع التقدير');

    expect(doc.blocks).toHaveLength(2);
    const first = doc.blocks[0]!;
    expect(first.kind).toBe('paragraph');
    if (first.kind !== 'paragraph') return;
    expect(first.inlines.map((i) => i.kind)).toEqual(['run', 'field']);
    expect(first.inlines[0]).toMatchObject({ text: 'إلى / ' });
    expect(first.inlines[1]).toMatchObject({ kind: 'field', ref: 'الجهة' });
  });

  it('الأسطر الفارغة تبقى — وخمسٌ منها هي فراغ التوقيع', () => {
    const doc = docFromLegacy('المتن\n\n\n\n\nمدير المدرسة');
    expect(doc.blocks).toHaveLength(6);
    expect(docText(doc)).toContain('مدير المدرسة');
  });

  it('يبني قائمة الحقول من المتن، ويعرف ما يأتي من ملف المواطن', () => {
    const doc = docFromLegacy(SAMPLE, legacyFieldMeta);

    expect(doc.fields.map((f) => f.key)).toEqual([
      'الجهة_الموجه_إليها',
      'الاسم',
      'الرقم_الوطني'
    ]);
    const name = doc.fields.find((f) => f.key === 'الاسم')!;
    expect(name.label).toBe('الاسم الرباعي واللقب');
    expect(name.source).toBe('full_name');
    expect(name.required).toBe(true);
  });

  it('لكل وثيقة وحقل معرّف ثابت — بغيره لا تصدير ولا دمج', () => {
    const doc = docFromLegacy('{أ} و{ب}');
    expect(doc.id).toMatch(/\S/);
    expect(doc.schemaVersion).toBe(DOC_SCHEMA);
    const ids = doc.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('الوسم المكرَّر حقلٌ واحد يُملأ مرّة ويظهر في موضعيه', () => {
    const doc = docFromLegacy('{الاسم} ... ويشهد {الاسم}');
    expect(doc.fields).toHaveLength(1);
    expect(usedKeys(doc)).toEqual(['الاسم']);
    expect(renderDocHtml(doc, { الاسم: 'أحمد' }).match(/أحمد/g)).toHaveLength(2);
  });
});

describe('الرسم لا يغيّر ورقة المكتب', () => {
  const values = { الاسم: 'أحمد عادل', الرقم_الوطني: '198421098312' };
  /**
   * صنف `fv` علامةٌ على القيمة المملوءة لا شكل لها — تُظهر القيم وحدها في
   * الطباعة على استمارةٍ مطبوعة. فتُنزع قبل المقارنة بما كان يخرج قبل النواة.
   */
  const render = (...args: Parameters<typeof renderBody>) => renderBody(...args).replace(/class="fv /g, 'class="');

  it('يطابق ما كان يخرج قبل النواة حرفًا بحرف', () => {
    expect(render(SAMPLE, values)).toBe(legacyRender(SAMPLE, values));
  });

  it('ويطابقه حين يُطلب إخفاء الفارغ', () => {
    expect(render(SAMPLE, values, { markMissing: false })).toBe(
      legacyRender(SAMPLE, values, { markMissing: false })
    );
  });

  it('ويطابقه في نصّ فيه محارف علامات', () => {
    const body = 'قيمة < & > في المتن {الاسم}';
    expect(render(body, { الاسم: '<b>خطر</b>' })).toBe(
      legacyRender(body, { الاسم: '<b>خطر</b>' })
    );
  });

  it('الحقل المملوء يُظلَّل، والفارغ يبقى وسمًا يُنبّه قبل الطباعة', () => {
    const html = renderBody(SAMPLE, values);
    expect(html).toContain('>أحمد عادل</span>');
    expect(html).toContain('{الجهة_الموجه_إليها}');
  });
});

describe('الحقل نوعٌ لا فراغ', () => {
  it('ما يُملأ باليد يُطبع فراغًا بطول ما كُتب — لا ينكمش فتتشوّه الورقة', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('التاريخ: '), fieldRef('تاريخ')])];
    doc.fields = [makeField({ key: 'تاريخ', fillMode: 'hand', width: 20 })];

    const html = renderDocHtml(doc);
    expect(html).toContain('min-width:20ch');
    expect(html).not.toContain('{تاريخ}');
  });

  it('لكنّ ما كتبه الموظف بيده لا يُحذف — القيمة تسبق الفراغ', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([fieldRef('تاريخ')])];
    doc.fields = [makeField({ key: 'تاريخ', fillMode: 'hand', width: 12 })];

    expect(renderDocHtml(doc)).toContain('min-width:12ch');
    expect(renderDocHtml(doc, { تاريخ: '2026' })).toContain('>2026</span>');
  });

  it('الحقل الإلزامي الفارغ يُكشف قبل الإصدار', () => {
    const doc = docFromLegacy('{الاسم} و{ملاحظة}', legacyFieldMeta);
    expect(missingRequired(doc, {}).map((f) => f.key)).toEqual(['الاسم']);
    expect(missingRequired(doc, { الاسم: 'أحمد' })).toEqual([]);
  });
});

describe('الكتل التي عجز عنها النصّ الواحد', () => {
  it('المجموعة الشرطية تُلغى كلّها — «المرفقات» لا تُترك سطرًا فارغًا', () => {
    const doc = emptyDoc();
    doc.blocks = [
      paragraph([run('المتن')]),
      {
        id: 'g1',
        kind: 'group',
        mode: 'conditional',
        on: 'المرفقات',
        blocks: [paragraph([run('المرفقات: '), fieldRef('المرفقات')])]
      },
      paragraph([run('مدير المدرسة')])
    ];
    doc.fields = [makeField({ key: 'المرفقات' })];

    expect(renderDocHtml(doc)).not.toContain('المرفقات:');
    expect(renderDocHtml(doc, { المرفقات: 'قائمة أسماء' })).toContain('قائمة أسماء');
  });

  it('الجدول يُرسم بصفوفه، وصفّ العناوين عناوينُ لا خلايا', () => {
    const table: TableBlock = {
      id: 't1',
      kind: 'table',
      columns: [2, 1],
      header: true,
      rows: [
        {
          id: 'r0',
          cells: [
            { id: 'c0', blocks: [paragraph([run('الدرس')])] },
            { id: 'c1', blocks: [paragraph([run('الدرجة')])] }
          ]
        },
        {
          id: 'r1',
          cells: [
            { id: 'c2', blocks: [paragraph([run('العربية')])] },
            { id: 'c3', blocks: [paragraph([fieldRef('درجة_العربية')])] }
          ]
        }
      ]
    };
    const doc = emptyDoc();
    doc.blocks = [table];
    doc.fields = [makeField({ key: 'درجة_العربية' })];

    const html = renderDocHtml(doc, { درجة_العربية: '٨٥' });
    expect(html).toContain('<th');
    expect(html).toContain('الدرجة');
    expect(html).toContain('٨٥');
    expect(html).toContain('page-break-inside:auto');
  });

  it('خليّة الجدول تحمل حقلًا — وهو ما عجز عنه الوسم النصّي', () => {
    const doc = emptyDoc();
    doc.blocks = [
      {
        id: 't',
        kind: 'table',
        columns: [1],
        header: false,
        rows: [{ id: 'r', cells: [{ id: 'c', blocks: [paragraph([fieldRef('س')])] }] }]
      }
    ];
    doc.fields = [makeField({ key: 'س' })];
    expect(usedKeys(doc)).toEqual(['س']);
  });

  it('فاصل الصفحة يُرسم فاصلًا للطباعة لا فراغًا', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 'pb', kind: 'pageBreak' }];
    expect(renderDocHtml(doc)).toContain('page-break-after:always');
  });

  it('كل كتلة باتجاهها — الإنجليزية LTR داخل ورقة عربية', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('Answer the following')], { dir: 'ltr', align: 'left' })];
    expect(renderDocHtml(doc, {}, { paragraphs: 'blocks' })).toContain('dir="ltr"');
  });
});

describe('توفيق الحقول مع المتن', () => {
  it('يضيف الجديد، ويحذف ما اختفى، ويحفظ ترتيب الباقي وما ضُبط فيه', () => {
    let doc = docFromLegacy('{أ} {ب}');
    doc.fields[0]!.label = 'الأول';
    doc.fields[0]!.width = 30;

    doc = { ...doc, blocks: docFromLegacy('{ب} {أ} {ج}').blocks };
    doc.fields = reconcileFields(doc);

    expect(doc.fields.map((f) => f.key)).toEqual(['أ', 'ب', 'ج']);
    expect(doc.fields[0]!.label).toBe('الأول');
    expect(doc.fields[0]!.width).toBe(30);
  });

  it('حقل المجموعة الشرطية محسوب وإن لم يظهر في نصّ', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 'g', kind: 'group', mode: 'conditional', on: 'المرفقات', blocks: [] }];
    expect(reconcileFields(doc).map((f) => f.key)).toEqual(['المرفقات']);
  });
});

describe('قراءة وثيقة محفوظة', () => {
  it('ما ليس وثيقة يعود وثيقةً فارغة بلا انهيار', () => {
    for (const bad of [null, 5, 'نصّ', [], undefined]) {
      expect(normalizeDoc(bad).blocks).toEqual([]);
    }
  });

  it('كتلة بصنف مجهول تُسقط، ولا تُسقط الورقة معها', () => {
    const doc = normalizeDoc({
      id: 'keep-me',
      blocks: [
        { id: 'p', kind: 'paragraph', align: 'right', inlines: [] },
        { id: 'x', kind: 'سؤال_من_المستقبل' },
        'ليس كتلة'
      ]
    });
    expect(doc.blocks).toHaveLength(1);
    expect(doc.id).toBe('keep-me');
    expect(doc.schemaVersion).toBe(DOC_SCHEMA);
  });

  it('قيم الحقل الغريبة تعود إلى الأصل الآمن', () => {
    const doc = normalizeDoc({
      blocks: [{ id: 'p', kind: 'paragraph', align: 'right', inlines: [{ kind: 'field', id: 'f', ref: 'س' }] }],
      fields: [{ key: 'س', width: -3, fillMode: 'غريب', required: 'نعم' }]
    });
    expect(doc.fields[0]).toMatchObject({ key: 'س', width: 14, fillMode: 'printed', required: false });
  });

  it('ضبط الورقة يُقرأ بما فيه من وضع الترويسة', () => {
    const doc = normalizeDoc({ pageSetup: { size: 'A5', letterheadMode: 'reserve', numerals: 'indic' } });
    expect(doc.pageSetup).toMatchObject({ size: 'A5', letterheadMode: 'reserve', numerals: 'indic' });
    // وما لم يُذكر يأخذ الأصل.
    expect(doc.pageSetup.orientation).toBe('portrait');
  });

  it('الورقة الأفقية تقلب مقاسها', () => {
    expect(pageMm({ ...emptyDoc().pageSetup, orientation: 'landscape' })).toEqual({ w: 297, h: 210 });
  });
});

describe('توزيع الصفحات بالقياس', () => {
  const item = (id: string, height: number, breakBefore = false) => ({ id, height, breakBefore });

  it('يملأ الصفحة ثم يبدأ غيرها', () => {
    const pages = paginate([item('a', 400), item('b', 400), item('c', 400)], 1000);
    expect(pages).toEqual([['a', 'b'], ['c']]);
  });

  it('الصفحة الأولى أقصر لأن الترويسة تأكل منها', () => {
    const pages = paginate([item('a', 400), item('b', 400)], 1000, 500);
    expect(pages).toEqual([['a'], ['b']]);
  });

  it('فاصل الصفحة الصريح يُطاع ولو بقي فراغ', () => {
    const pages = paginate([item('a', 100), item('b', 100, true), item('c', 100)], 1000);
    expect(pages).toEqual([['a'], ['b', 'c']]);
  });

  it('كتلة أطول من الصفحة تُفرد وحدها ولا تدور إلى الأبد', () => {
    const pages = paginate([item('a', 100), item('ضخمة', 5000), item('c', 100)], 1000);
    expect(pages).toEqual([['a'], ['ضخمة'], ['c']]);
  });

  it('بلا كتل لا صفحات', () => {
    expect(paginate([], 1000)).toEqual([]);
  });
});

describe('نصّ الوثيقة', () => {
  it('يجرّد العلامات ويضع القيم مكان الحقول — وعليه تُحسب البصمة', () => {
    const doc: Doc = docFromLegacy('نؤيد أن {الاسم} موظف\n\nمع التقدير');
    expect(docText(doc, { الاسم: 'أحمد' })).toBe('نؤيد أن أحمد موظف\n\nمع التقدير');
  });

  it('وما لم يُملأ يبقى وسمًا ظاهرًا — لا يُخترع له محتوى', () => {
    expect(docText(docFromLegacy('{الاسم}'))).toBe('{الاسم}');
  });
});

describe('تحرير الحقول في المراجعة', () => {
  it('إعادة التسمية لا تمسّ المفتاح — فهو مرجع المتن', () => {
    const doc = renameField(docFromLegacy('نؤيد أن {س} موظف'), 'س', 'اسم الموظف');
    expect(doc.fields[0]!.key).toBe('س');
    expect(doc.fields[0]!.label).toBe('اسم الموظف');
    expect(usedKeys(doc)).toEqual(['س']);
  });

  it('وردّ الحقل نصًّا يعيده فراغًا منقوطًا كما كان', () => {
    const before = docFromLegacy('مع التقدير {التقدير}');
    const after = unfield(before, 'التقدير');

    expect(after.fields).toEqual([]);
    expect(usedKeys(after)).toEqual([]);
    expect(docText(after)).toMatch(/مع التقدير .{3,}/);
  });

  it('وردُّه لا يمسّ غيره', () => {
    const doc = unfield(docFromLegacy('{أ} و{ب}'), 'أ');
    expect(doc.fields.map((f) => f.key)).toEqual(['ب']);
    expect(usedKeys(doc)).toEqual(['ب']);
  });
});
