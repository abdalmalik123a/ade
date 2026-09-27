import { describe, expect, it } from 'vitest';
import { countInDoc, findPattern, replaceInDoc } from '../src/shared/findReplace';
import { docSpelling } from '../src/shared/spelling';
import { emptyDoc, fieldRef, makeField, paragraph, run, type Doc } from '../src/shared/doc';

function letter(): Doc {
  const doc = emptyDoc();
  doc.fields = [makeField({ key: 'الاسم', label: 'الاسم' })];
  doc.blocks = [
    paragraph([run('نؤيد أن السيد '), fieldRef('الاسم'), run(' منتسب إلى مدرسة الرشيد.')]),
    { id: 'c', kind: 'columns', columns: [[paragraph([run('ادارة مدرسه الرشيد')])], [paragraph([run('العدد:')])]] }
  ];
  return doc;
}

describe('البحث والاستبدال في الوثيقة', () => {
  it('متساهلٌ مع الهمزة والتاء المربوطة: «مدرسه» تجد «مدرسة»، وفي الأعمدة أيضًا', () => {
    expect(countInDoc(letter(), 'مدرسه')).toBe(2);
    expect(countInDoc(letter(), 'مدرسه', false)).toBe(1);
    expect(countInDoc(letter(), 'اداره')).toBe(1);
  });

  it('يستبدل النصّ ويعدّه — والحقل لا يُمسّ', () => {
    const { doc, count } = replaceInDoc(letter(), 'الرشيد', 'المأمون');
    expect(count).toBe(2);
    const first = doc.blocks[0]!;
    expect(first.kind === 'paragraph' && first.inlines.some((i) => i.kind === 'field' && i.ref === 'الاسم')).toBe(true);
    expect(countInDoc(doc, 'المأمون')).toBe(2);
    expect(countInDoc(doc, 'الرشيد')).toBe(0);
  });

  it('وما لا يوجد لا يغيّر الوثيقة، والرموز في البحث حرفية', () => {
    const doc = letter();
    expect(replaceInDoc(doc, 'غير موجود', 'x').doc).toBe(doc);
    expect(findPattern('(م/)', false)!.test('(م/)')).toBe(true);
    expect(findPattern('   ', true)).toBeNull();
  });

  it('والتدقيق الإملائي يرى الأعمدة الآن — «مدرسه» في رأسٍ بعمودين', () => {
    expect(docSpelling(letter()).some((i) => i.word === 'مدرسه')).toBe(true);
  });
});
