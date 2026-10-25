/**
 * حقل الصورة في الكتاب (S38، DC-2): كتلة صورةٍ مربوطةٌ بحقلٍ نوعه `image` تُملأ عند كلّ ورقة — من صورة الزبون في ملفّه أو من الجهاز.
 *
 * يُحفظ ويُفتح بحقله (المحرّر ذهابًا وإيابًا، وقراءة المحفوظ)، ويُرسم بقيمته صورةً وبلا قيمةٍ إطارًا بمقاسه، ويملؤه `fillDoc`
 * فيأخذه Word كأيّ صورة — ولا تُحذف الصورة من المخزن وهي في مسودّة.
 */
import { describe, expect, it } from 'vitest';
import { blocksToPm, pmBlocks } from '../src/shared/docPm';
import { renderDocHtml } from '../src/shared/docHtml';
import { fillDoc } from '../src/shared/docFill';
import { normalizeDoc } from '../src/shared/docNormalize';
import { emptyDoc, makeField, paragraph, run, usedKeys, type Doc, type ImageBlock } from '../src/shared/doc';
import { saveDraft } from '../src/main/services/templates';
import { unreferenced } from '../src/main/services/storeRefs';
import { freshDb } from './helpers';

const PHOTO = 'photos/9f2c1d0e8b7a6f5e4d3c2b1a09f8e7d6.jpg';

function letter(): Doc {
  const image: ImageBlock = { id: 'img-1', kind: 'image', src: '', field: 'الصورة', width: 132, height: 170, align: 'center' };
  return {
    ...emptyDoc(),
    blocks: [paragraph([run('بطاقة تعريف')]), image],
    fields: [makeField({ key: 'الصورة', label: 'الصورة', type: 'image', source: 'photoPath' })]
  };
}

describe('حقل الصورة', () => {
  it('يُحفظ ويُفتح بحقله ومقاسه: المحرّر ذهابًا وإيابًا، وقراءة المحفوظ', () => {
    const doc = letter();
    const back = pmBlocks(blocksToPm(doc.blocks));
    expect(back[1]).toEqual(doc.blocks[1]);
    const read = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(read.blocks[1]).toEqual(doc.blocks[1]);
    // والحقل باقٍ في القائمة لأنّ الكتلة تستعمله — وإلا أسقطه التوفيق فلا تُعرض خانته في الشبّاك.
    expect(usedKeys(read)).toContain('الصورة');
    expect(read.fields.map((f) => [f.key, f.type, f.source])).toEqual([['الصورة', 'image', 'photoPath']]);
  });

  it('بقيمةٍ يُرسم صورةً بمسارها، وبلا قيمةٍ إطارًا رفيعًا بمقاسه يُطبع', () => {
    const doc = letter();
    const filled = renderDocHtml(doc, { الصورة: PHOTO }, { missing: 'blank' });
    expect(filled).toContain(`<img alt="" src="diwan://store/${PHOTO}"`);
    expect(filled).toContain('width:132px;height:170px;');
    // والمملوء قيمةٌ تظهر في «القيم وحدها» على الاستمارة المطبوعة مسبقًا.
    expect(filled).toMatch(/<div class="fv"[^>]*><img/);

    const empty = renderDocHtml(doc, {}, { missing: 'blank' });
    expect(empty).not.toContain('<img');
    expect(empty).toContain('data-image-field="الصورة"');
    expect(empty).toMatch(/width:132px;height:170px;[^"]*border:1px solid currentColor/);
  });

  it('والصورة الثابتة بلا حقلٍ تُرسم كما كانت حرفًا بحرف', () => {
    const doc: Doc = { ...emptyDoc(), blocks: [{ id: 'logo', kind: 'image', src: 'images/logo.png', width: 140, align: 'right' }] };
    expect(renderDocHtml(doc)).toContain(
      '<div style="text-align:right;break-inside:avoid"><img alt="" src="diwan://store/images/logo.png" style="display:inline-block;width:140px;max-width:100%"/></div>'
    );
  });

  it('`fillDoc` يضع مسار القيمة في الكتلة فيأخذه Word، والفارغ يبقى بلا مسار', () => {
    const doc = letter();
    expect((fillDoc(doc, { الصورة: PHOTO }).blocks[1] as ImageBlock).src).toBe(PHOTO);
    expect((fillDoc(doc, {}).blocks[1] as ImageBlock).src).toBe('');
  });

  it('صورة الزبون في مسودّةٍ فيها الحقل لا تُحذف من المخزن', () => {
    const d = freshDb();
    const doc = letter();
    saveDraft(d, { id: null, templateId: null, citizenId: null, title: 'بطاقة', values: { الصورة: PHOTO }, bodyHtml: renderDocHtml(doc, { الصورة: PHOTO }) });
    expect(unreferenced(d, [PHOTO])).toEqual([]);
    expect(unreferenced(d, ['photos/other.jpg'])).toEqual(['photos/other.jpg']);
  });
});
