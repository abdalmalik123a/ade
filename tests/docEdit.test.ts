/**
 * ما بقي في `docEdit.ts` بعد حذف المحرّر الأوّل (الموجة ١، المجموعة ج): صنع الحقل من نصٍّ (F4)،
 * ولوحة الحقول، وصنع الجدول. وتحرير المتن نفسه صار لأوامر ProseMirror (`docPmTable.test.ts`
 * وسيناريوهات المحرّر).
 */
import { describe, expect, it } from 'vitest';
import { fieldFromText, makeTable, patchField, reorderFields } from '../src/shared/docEdit';
import { docFromLegacy, emptyDoc, makeField, usedKeys } from '../src/shared/doc';

describe('النصّ ← حقل (F4)', () => {
  it('اسمه النصّ نفسه، ومفتاحه منه بلا فراغات', () => {
    const field = fieldFromText(emptyDoc(), ' أحمد عادل ')!;
    expect(field.label).toBe('أحمد عادل');
    expect(field.key).toBe('أحمد_عادل');
  });

  it('وعرضه من طول ما كان مكتوبًا — فلا تنكمش الورقة عن شكلها', () => {
    expect(fieldFromText(emptyDoc(), 'مديرية تربية الأنبار العامة')!.width).toBeGreaterThan(20);
    expect(fieldFromText(emptyDoc(), 'أ')!.width).toBe(6);
  });

  it('والمكرَّر يأخذ مفتاحًا مستقلًّا فلا يملأ أحدهما مكان الآخر', () => {
    const doc = emptyDoc();
    doc.fields = [makeField({ key: 'أحمد', label: 'أحمد' })];
    expect(fieldFromText(doc, 'أحمد')!.key).toBe('أحمد_2');
    doc.fields.push(makeField({ key: 'أحمد_2', label: 'أحمد' }));
    expect(fieldFromText(doc, 'أحمد')!.key).toBe('أحمد_3');
  });

  it('والأقواس لا تدخل المفتاح — فهي علامة الحقل في الصيغة القديمة', () => {
    expect(fieldFromText(emptyDoc(), '{الاسم}')!.key).toBe('الاسم');
  });

  it('ووصفٌ يُعطى يغلب النصّ في الاسم والمفتاح، والعرض من النصّ', () => {
    const field = fieldFromText(emptyDoc(), 'سالم محمود علي', { label: 'اسم الطالب' })!;
    expect(field).toMatchObject({ key: 'اسم_الطالب', label: 'اسم الطالب', width: 14 });
  });

  it('ونصٌّ فارغ لا يصنع حقلًا', () => {
    expect(fieldFromText(emptyDoc(), '   ')).toBeNull();
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
    expect(t.columns).toEqual([1, 1]);
    expect(t.header).toBe(true);
    expect(t.rows.every((r) => r.cells.length === 2)).toBe(true);
  });

  it('وبلا صفّ عناوين إن طُلب، وكلّ خليّةٍ بمعرّفها وفقرةٍ فارغة', () => {
    const t = makeTable(2, 2, false);
    expect(t.header).toBe(false);
    const ids = t.rows.flatMap((r) => r.cells.map((c) => c.id));
    expect(new Set(ids).size).toBe(4);
    expect(t.rows[0]!.cells[0]!.blocks).toMatchObject([{ kind: 'paragraph', inlines: [] }]);
  });
});
