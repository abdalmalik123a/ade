import { describe, expect, it } from 'vitest';
import {
  addColumn,
  addRow,
  commit,
  fieldify,
  FIELD_CHAR,
  insertBlock,
  insertField,
  makeTable,
  moveBlock,
  paragraphText,
  patchField,
  removeBlock,
  removeColumn,
  removeRow,
  reorderFields,
  setCell,
  setInlines,
  startHistory,
  redo,
  undo
} from '../src/shared/docEdit';
import {
  docFromLegacy,
  docText,
  emptyDoc,
  fieldRef,
  paragraph,
  run,
  usedKeys,
  type ParagraphBlock,
  type TableBlock
} from '../src/shared/doc';

const para = (doc: ReturnType<typeof emptyDoc>, i = 0) => doc.blocks[i] as ParagraphBlock;

describe('مواضع الفقرة', () => {
  it('الحقل محرفٌ واحد — فهو وحدةٌ لا تُقسم', () => {
    const doc = docFromLegacy('نؤيد أن {الاسم} موظف');
    expect(paragraphText(para(doc).inlines)).toBe(`نؤيد أن ${FIELD_CHAR} موظف`);
  });
});

describe('النصّ ← حقل (F4)', () => {
  it('يظلّل كلمة فتصير حقلًا باسمها', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('نؤيد أن أحمد عادل موظف لدينا')])];

    const next = fieldify(doc, doc.blocks[0]!.id, 8, 17);
    expect(next.fields).toHaveLength(1);
    expect(next.fields[0]!.label).toBe('أحمد عادل');
    expect(usedKeys(next)).toEqual([next.fields[0]!.key]);
    expect(docText(next, { [next.fields[0]!.key]: 'سالم' })).toBe('نؤيد أن سالم موظف لدينا');
  });

  it('وعرضه من طول ما كان مكتوبًا — فلا تنكمش الورقة عن شكلها', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('الجهة: مديرية تربية الأنبار العامة')])];
    const next = fieldify(doc, doc.blocks[0]!.id, 7, 34);
    expect(next.fields[0]!.width).toBeGreaterThan(20);
  });

  it('والمكرَّر يأخذ مفتاحًا مستقلًّا فلا يملأ أحدهما مكان الآخر', () => {
    let doc = emptyDoc();
    doc.blocks = [paragraph([run('أحمد ثم أحمد')])];
    doc = fieldify(doc, doc.blocks[0]!.id, 0, 4);
    // المواضع تُحسب على النصّ بعد التحويل: الحقل صار محرفًا واحدًا.
    const text = paragraphText(para(doc).inlines);
    const at = text.lastIndexOf('أحمد');
    doc = fieldify(doc, doc.blocks[0]!.id, at, at + 4);

    expect(doc.fields.map((f) => f.key)).toEqual(['أحمد', 'أحمد_2']);
  });

  it('ولا يُشقّ حقلٌ قائم — الحقل وحدة', () => {
    const doc = docFromLegacy('نؤيد {الاسم} موظف');
    const before = doc.fields.length;
    // مدًى يبتلع الحقل ونصف ما حوله.
    const next = fieldify(doc, doc.blocks[0]!.id, 4, 9);
    expect(next.fields).toHaveLength(before);
    expect(next).toBe(doc);
  });

  it('ومدًى فارغ أو بلا نصّ لا يصنع حقلًا', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('   نصّ   ')])];
    expect(fieldify(doc, doc.blocks[0]!.id, 2, 2)).toBe(doc);
    expect(fieldify(doc, doc.blocks[0]!.id, 0, 3)).toBe(doc);
  });

  it('وإدراج حقلٍ قائم يظهره في موضعٍ ثانٍ ويُملأ مرّة', () => {
    const doc = docFromLegacy('{الاسم} يشهد بأن');
    const next = insertField(doc, doc.blocks[0]!.id, 16, 'الاسم');

    expect(next.fields).toHaveLength(1);
    expect(docText(next, { الاسم: 'أحمد' })).toBe('أحمد يشهد بأنأحمد');
  });

  it('ولا يُدرج حقلٌ لا وجود له', () => {
    const doc = docFromLegacy('متن');
    expect(insertField(doc, doc.blocks[0]!.id, 1, 'وهم')).toBe(doc);
  });
});

describe('الكتل', () => {
  it('تُدرج بعد كتلة، وتُحذف، وتُحرَّك', () => {
    let doc = emptyDoc();
    doc.blocks = [paragraph([run('أ')]), paragraph([run('ب')])];

    doc = insertBlock(doc, paragraph([run('ج')]), doc.blocks[0]!.id);
    expect(docText(doc).split('\n')).toEqual(['أ', 'ج', 'ب']);

    doc = moveBlock(doc, doc.blocks[2]!.id, -1);
    expect(docText(doc).split('\n')).toEqual(['أ', 'ب', 'ج']);

    doc = removeBlock(doc, doc.blocks[1]!.id);
    expect(docText(doc).split('\n')).toEqual(['أ', 'ج']);
  });

  it('والحدود لا تُسقط شيئًا', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('أ')])];
    expect(moveBlock(doc, doc.blocks[0]!.id, -1)).toBe(doc);
    expect(moveBlock(doc, doc.blocks[0]!.id, 1)).toBe(doc);
  });

  it('وحذف كتلةٍ فيها حقل يُسقط الحقل من شاشة الإدخال', () => {
    const doc = docFromLegacy('{أ}\n{ب}');
    const next = removeBlock(doc, doc.blocks[0]!.id);
    expect(next.fields.map((f) => f.key)).toEqual(['ب']);
  });

  it('وتحرير الفقرة يتبعه توفيق الحقول', () => {
    const doc = docFromLegacy('{أ} و{ب}');
    const next = setInlines(doc, doc.blocks[0]!.id, [run('لا حقول')]);
    expect(next.fields).toEqual([]);
  });
});

describe('لوحة الحقول — وهي ترتيب شاشة الإدخال', () => {
  it('تُعاد ترتيبًا، وما لم يُذكر يلحق بآخرها', () => {
    const doc = docFromLegacy('{أ} {ب} {ج}');
    expect(reorderFields(doc, ['ج', 'أ']).fields.map((f) => f.key)).toEqual(['ج', 'أ', 'ب']);
  });

  it('والوصف يُعدَّل، والمفتاح لا يُمسّ — فهو مرجع المتن', () => {
    const doc = docFromLegacy('{س}');
    const next = patchField(doc, 'س', { label: 'اسم الطالب', required: true, key: 'مختلف' });

    expect(next.fields[0]).toMatchObject({ key: 'س', label: 'اسم الطالب', required: true });
    expect(usedKeys(next)).toEqual(['س']);
  });
});

describe('الجداول', () => {
  it('تُبنى بصفوفها وأعمدتها وصفّ عناوينها', () => {
    const t = makeTable(3, 2);
    expect(t.rows).toHaveLength(3);
    expect(t.columns).toHaveLength(2);
    expect(t.header).toBe(true);
    expect(t.rows.every((r) => r.cells.length === 2)).toBe(true);
  });

  it('وتُضاف الصفوف والأعمدة وتُحذف', () => {
    let doc = emptyDoc();
    const t = makeTable(2, 2);
    doc = insertBlock(doc, t);

    doc = addRow(doc, t.id);
    expect((doc.blocks[0] as TableBlock).rows).toHaveLength(3);

    doc = addColumn(doc, t.id, 1);
    const table = doc.blocks[0] as TableBlock;
    expect(table.columns).toHaveLength(3);
    expect(table.rows.every((r) => r.cells.length === 3)).toBe(true);

    doc = removeRow(doc, t.id, 0);
    doc = removeColumn(doc, t.id, 0);
    expect((doc.blocks[0] as TableBlock).rows).toHaveLength(2);
    expect((doc.blocks[0] as TableBlock).columns).toHaveLength(2);
  });

  it('ولا يبقى جدولٌ بلا صفّ ولا بلا عمود', () => {
    let doc = insertBlock(emptyDoc(), makeTable(1, 1));
    const id = doc.blocks[0]!.id;
    doc = removeRow(doc, id, 0);
    doc = removeColumn(doc, id, 0);

    expect((doc.blocks[0] as TableBlock).rows).toHaveLength(1);
    expect((doc.blocks[0] as TableBlock).columns).toHaveLength(1);
  });

  it('والخليّة تحمل حقلًا يُحسب في شاشة الإدخال', () => {
    let doc = emptyDoc();
    doc.fields = [];
    const t = makeTable(2, 2);
    doc = insertBlock(doc, t);
    doc = setCell(doc, t.id, 1, 1, [fieldRef('درجة_العربية')]);

    expect(usedKeys(doc)).toEqual(['درجة_العربية']);
    expect(doc.fields.map((f) => f.key)).toEqual(['درجة_العربية']);
  });
});

describe('التراجع بلقطات', () => {
  it('يرجع خطوةً ويعيدها', () => {
    const first = docFromLegacy('أ');
    let h = startHistory(first);
    const second = docFromLegacy('ب');
    const third = docFromLegacy('ج');

    h = commit(h, second);
    h = commit(h, third);
    expect(docText(h.present)).toBe('ج');

    h = undo(h);
    expect(docText(h.present)).toBe('ب');
    h = undo(h);
    expect(docText(h.present)).toBe('أ');

    h = redo(h);
    expect(docText(h.present)).toBe('ب');
  });

  it('وتحريرٌ جديد يمحو ما بعده — فلا يعود ما تُخُلّي عنه', () => {
    let h = startHistory(docFromLegacy('أ'));
    h = commit(h, docFromLegacy('ب'));
    h = undo(h);
    h = commit(h, docFromLegacy('ج'));

    expect(h.future).toEqual([]);
    expect(docText(undo(h).present)).toBe('أ');
  });

  it('والحدود لا تُسقط شيئًا، والوثيقة نفسها لا تُقيَّد لقطةً', () => {
    const doc = docFromLegacy('أ');
    const h = startHistory(doc);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(commit(h, doc)).toBe(h);
  });
});
