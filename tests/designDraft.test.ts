/**
 * مسودّة التصميم (DESIGNS.md ٠٫٦): في جدول المسودّات نفسه، بمفتاح `__design` — تُقرأ كما تُقرأ التصاميم المحفوظة،
 * ولا تختلط بمسودّات الكتب.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, shapeElement, textElement, CANVAS_VERSION } from '../src/shared/canvas';
import { fieldRef, run } from '../src/shared/doc';
import { normalizeDoc } from '../src/shared/docNormalize';
import { DESIGN_DRAFT_KEY, designDraftValues, designKey, isDesignDraft, readDesignDraft } from '../src/shared/design/draft';
import { letterValues, readSavedLetter, NO_REGISTRY } from '../src/shared/letterDraft';

function design() {
  const front = emptyCanvas({ w: 85.6, h: 54 }, 3);
  front.elements = [
    textElement({ box: { x: 0.1, y: 0.1, w: 0.8, h: 0.2 }, inlines: [run('هوية '), fieldRef('الاسم')], z: 1 }),
    shapeElement({ box: { x: 0, y: 0.9, w: 1, h: 0.1 }, shape: 'rect', fill: '#123456', z: 2 })
  ];
  const doc = canvasDoc(front, { title: 'هوية طالب', category: 'تصاميم', batchMap: { الاسم: 'العمود ١' } });
  doc.backCanvas = { ...emptyCanvas({ w: 85.6, h: 54 }, 3), background: { kind: 'color', color: '#eeeeee' } };
  return doc;
}

describe('مسودّة التصميم', () => {
  it('تُكتب وتُقرأ: الوجه والظهر والعنوان وربط الدفعة والقيم', () => {
    // كما في المحرّر: ما في اللوحة مقوَّمٌ أصلًا (المفتوح والمستأنف يُقوَّمان قبل أن يُرسما).
    const doc = normalizeDoc(design());
    const json = JSON.stringify(designDraftValues({ doc, values: { الاسم: 'سالم حسن' } }));
    expect(isDesignDraft(json)).toBe(true);
    const back = readDesignDraft(json)!;
    expect(back.values).toEqual({ الاسم: 'سالم حسن' });
    expect(back.doc.kind).toBe('canvas');
    expect(back.doc.canvas?.v).toBe(CANVAS_VERSION);
    expect(designKey(back.doc)).toBe(designKey(doc));
  });

  it('مسودّة الكتاب ليست مسودّة تصميم — ولا العكس', () => {
    const letter = JSON.stringify(letterValues({ doc: design(), values: {}, registry: NO_REGISTRY, layout: null, docType: '', owner: '' }));
    expect(isDesignDraft(letter)).toBe(false);
    expect(readDesignDraft(letter)).toBeNull();
    // ومحرّر الكتب لا يجد في مسودّة التصميم ورقة (`__doc`).
    const designJson = JSON.stringify(designDraftValues({ doc: design(), values: {} }));
    expect(readSavedLetter(designJson)?.doc.kind).toBe('flow');
  });

  it('التالف لا يُسقط: نصٌّ فاسد، ووثيقةٌ ليست لوحة، وقيمٌ ليست نصوصًا', () => {
    for (const bad of ['', '{', 'null', '[]', '{"__design":5}', `{"${DESIGN_DRAFT_KEY}":"{"}`]) expect(readDesignDraft(bad)).toBeNull();
    const flow = JSON.stringify({ [DESIGN_DRAFT_KEY]: JSON.stringify({ doc: { kind: 'flow', blocks: [] } }) });
    expect(readDesignDraft(flow)).toBeNull();
    const odd = JSON.stringify({ [DESIGN_DRAFT_KEY]: JSON.stringify({ doc: design(), values: { أ: 'نص', ب: 3, ج: null } }) });
    expect(readDesignDraft(odd)?.values).toEqual({ أ: 'نص' });
  });

  it('البصمة: التصميم يغيّرها، ومعرّف الوثيقة وربط الدفعة (يُحفظ وحده) لا', () => {
    const a = design();
    const b = { ...a, id: 'آخر' };
    expect(designKey(b)).toBe(designKey(a));
    const moved = { ...a, canvas: { ...a.canvas!, elements: a.canvas!.elements.map((el, i) => (i ? { ...el, box: { ...el.box, y: 0.8 } } : el)) } };
    expect(designKey(moved)).not.toBe(designKey(a));
    expect(designKey({ ...a, meta: { ...a.meta, title: 'غيره' } })).not.toBe(designKey(a));
    expect(designKey({ ...a, backCanvas: undefined })).not.toBe(designKey(a));
    expect(designKey({ ...a, meta: { ...a.meta, batchMap: {} } })).toBe(designKey(a));
  });
});
