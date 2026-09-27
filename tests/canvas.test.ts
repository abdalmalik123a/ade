import { describe, expect, it } from 'vitest';
import {
  BLEED_MM,
  SIZE_PRESETS,
  barcodeElement,
  byLayer,
  canvasDoc,
  canvasKeys,
  canvasPx,
  canvasText,
  clampBox,
  emptyCanvas,
  imageElement,
  mmToPx,
  normalizeCanvas,
  ptToPx,
  textElement,
  topZ
} from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { fieldRef, normalizeDoc, reconcileFields, run, usedKeys, docText } from '../src/shared/doc';

const ID_CARD = SIZE_PRESETS.find((p) => p.key === 'id-card')!.size;

function card() {
  const canvas = emptyCanvas(ID_CARD, BLEED_MM);
  canvas.background = { kind: 'image', src: 'designs/id.png', dpi: 300 };
  canvas.elements = [
    textElement({
      box: { x: 0.35, y: 0.2, w: 0.6, h: 0.15 },
      inlines: [run('الاسم: '), fieldRef('اسم الطالب')],
      size: 10,
      z: 2
    }),
    imageElement({ box: { x: 0.04, y: 0.2, w: 0.25, h: 0.6 }, ref: 'صورة الطالب', z: 1 }),
    barcodeElement({ box: { x: 0.35, y: 0.75, w: 0.6, h: 0.15 }, ref: 'الرقم', z: 3 })
  ];
  return canvas;
}

describe('اللوحة: المقاس بالملّم والمواضع نِسَب', () => {
  it('ملّمٌ يصير بكسلًا بالدقّة المطلوبة — والملّم هو الحقيقة', () => {
    // هوية CR80 عند ٣٠٠ نقطة/إنش: ١٠١١ × ٦٣٨ كما في المعيار.
    expect(Math.round(mmToPx(85.6, 300))).toBe(1011);
    expect(Math.round(mmToPx(54, 300))).toBe(638);
    // وعند ٩٦ للشاشة، وهي الورقة نفسها لا ورقةٌ ثانية.
    expect(Math.round(mmToPx(85.6, 96))).toBe(324);
  });

  it('والنزف يزيد ثلاثة ملّمات من كل جهة', () => {
    const px = canvasPx(emptyCanvas(ID_CARD, BLEED_MM), 300);
    expect(Math.round(px.w)).toBe(Math.round(mmToPx(85.6 + 6, 300)));
    expect(Math.round(px.h)).toBe(Math.round(mmToPx(54 + 6, 300)));
  });

  it('والنقطة الطباعية تتبع الدقّة فلا يتصاغر الخط في الطباعة', () => {
    expect(ptToPx(12, 96)).toBe(16);
    expect(ptToPx(12, 300)).toBe(50);
  });

  it('وتغييرُ المقاس لا يزيح حقلًا — فالموضع نسبةٌ لا بكسل', () => {
    const doc = canvasDoc(card());
    const small = renderCanvasHtml(doc, {}, { dpi: 96 });
    const big = renderCanvasHtml(doc, {}, { dpi: 300 });

    const rightOf = (html: string) => Number(/right:([\d.]+)px/.exec(html)?.[1]);
    // الموضع بالبكسل يكبر بنسبة الدقّة تمامًا — أي أن النسبة لم تتغيّر.
    expect(rightOf(big) / rightOf(small)).toBeCloseTo(300 / 96, 3);
  });

  it('والصندوق لا يهرب خارج الورقة', () => {
    expect(clampBox({ x: 1.4, y: -0.3, w: 0.5, h: 0.2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.2 });
    expect(clampBox({ x: 0.1, y: 0.1, w: 9, h: 9 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('الطبقات ترتيبٌ صريح — فلا يختفي حقل خلف الخلفية', () => {
  it('العناصر تُرسم بترتيب `z`', () => {
    const canvas = emptyCanvas(ID_CARD);
    canvas.elements = [
      textElement({ box: { x: 0, y: 0, w: 0.2, h: 0.1 }, inlines: [run('ثالث')], z: 9 }),
      textElement({ box: { x: 0, y: 0.2, w: 0.2, h: 0.1 }, inlines: [run('أول')], z: 1 }),
      textElement({ box: { x: 0, y: 0.4, w: 0.2, h: 0.1 }, inlines: [run('ثانٍ')], z: 5 })
    ];
    expect(canvasText(canvas)).toBe('أول\nثانٍ\nثالث');
    expect(topZ(canvas.elements)).toBe(9);
  });

  it('والمتساوي يبقى بترتيب إضافته', () => {
    const a = textElement({ box: { x: 0, y: 0, w: 0.2, h: 0.1 }, inlines: [run('أ')], z: 1 });
    const b = textElement({ box: { x: 0, y: 0.2, w: 0.2, h: 0.1 }, inlines: [run('ب')], z: 1 });
    expect(byLayer([a, b]).map((el) => el.id)).toEqual([a.id, b.id]);
  });

  it('والخلفية تحت كل شيء', () => {
    const html = renderCanvasHtml(canvasDoc(card()), {}, { missing: 'token' });
    expect(html.indexOf('designs/id.png')).toBeLessThan(html.indexOf('اسم الطالب'));
    expect(html).toContain('z-index:0');
  });
});

describe('الحقل هو هو — فالدمج يعمل بلا تغيير', () => {
  it('حقول اللوحة تدخل `usedKeys` كما تدخل حقول المتن', () => {
    const doc = canvasDoc(card());
    expect(usedKeys(doc).sort()).toEqual(['اسم الطالب', 'الرقم', 'صورة الطالب']);
    expect(canvasKeys(doc.canvas!).sort()).toEqual(['اسم الطالب', 'الرقم', 'صورة الطالب']);
  });

  it('و`reconcileFields` تبني لها شاشة إدخال', () => {
    const doc = canvasDoc(card());
    doc.fields = reconcileFields(doc);
    expect(doc.fields.map((f) => f.key).sort()).toEqual(['اسم الطالب', 'الرقم', 'صورة الطالب']);
  });

  it('والقيم تُرسم مكانها — نصًّا وصورةً وباركودًا', () => {
    const doc = canvasDoc(card());
    doc.fields = reconcileFields(doc);
    const html = renderCanvasHtml(doc, {
      'اسم الطالب': 'مريم عادل',
      'صورة الطالب': 'citizens/7.jpg',
      الرقم: '2026-0031'
    });
    expect(html).toContain('مريم عادل');
    expect(html).toContain('citizens/7.jpg');
    expect(html).toContain('data-value="2026-0031"');
  });

  it('وما لم يُملأ يُطبع فراغًا بطوله لا وسمًا', () => {
    const doc = canvasDoc(card());
    doc.fields = reconcileFields(doc);
    const html = renderCanvasHtml(doc, {}, { missing: 'blank' });
    expect(html).not.toContain('{اسم الطالب}');
    expect(html).toContain('border-bottom:1px dotted');
  });

  it('ونصّ اللوحة يدخل نصّ الوثيقة — فتُبحث الشهادة باسم صاحبها', () => {
    const doc = canvasDoc(card());
    expect(docText(doc, { 'اسم الطالب': 'مريم عادل' })).toContain('مريم عادل');
  });
});

describe('النزف وعلامات القصّ', () => {
  it('العلامات تُرسم مع النزف', () => {
    const doc = canvasDoc(card());
    expect(renderCanvasHtml(doc, {}, { marks: true })).toContain('z-index:9999');
  });

  it('ولا تُرسم بلا نزف — فلا شيء يُقصّ', () => {
    const doc = canvasDoc(emptyCanvas(ID_CARD, 0));
    expect(renderCanvasHtml(doc, {}, { marks: true })).not.toContain('z-index:9999');
  });
});

describe('ما حُفظ يُقرأ، وما فسد يُردّ إلى حدّه', () => {
  it('اللوحة تُقوَّم مع الوثيقة', () => {
    const before = canvasDoc(card(), { title: 'هوية طالب' });
    const after = normalizeDoc(JSON.parse(JSON.stringify(before)));

    expect(after.kind).toBe('canvas');
    expect(after.issuing).toBe('print-only');
    expect(after.canvas?.elements).toHaveLength(3);
    expect(after.canvas?.background).toEqual({ kind: 'image', src: 'designs/id.png', dpi: 300 });
    expect(after.canvas?.bleed).toBe(BLEED_MM);
  });

  it('وعنصرٌ بصندوقٍ فاسد يُردّ ولا يُسقط الورقة', () => {
    const canvas = normalizeCanvas({
      size: { w: 85.6, h: 54 },
      elements: [
        { kind: 'text', box: { x: 5, y: 5, w: 5, h: 5 }, inlines: [] },
        { kind: 'مجهول', box: { x: 0, y: 0, w: 1, h: 1 } },
        'ليس عنصرًا'
      ]
    });
    expect(canvas.elements).toHaveLength(1);
    expect(canvas.elements[0]!.box).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(canvas.elements[0]!.id).toBeTruthy();
  });

  it('وتصميمٌ حُفظ أيام الذكاء الاصطناعي: رسمته تصير صورةً بشكلها، وعنصر الويب يسقط', () => {
    const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#1b3a5c"/></svg>';
    const canvas = normalizeCanvas({
      size: { w: 85.6, h: 54 },
      elements: [
        { kind: 'svg', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, svg, name: 'زخرفة' },
        { kind: 'html', box: { x: 0, y: 0, w: 1, h: 1 }, html: '<div>{الاسم}</div>' },
        { kind: 'svg', box: { x: 0, y: 0, w: 1, h: 1 }, svg: '  ' }
      ]
    });
    expect(canvas.elements).toHaveLength(1);
    const el = canvas.elements[0]!;
    expect(el.kind).toBe('image');
    expect(el.name).toBe('زخرفة');
    expect(el.kind === 'image' && decodeURIComponent(el.src)).toContain('<circle');
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: 96 });
    expect(html).toContain('<img');
    expect(html).not.toContain('{الاسم}');
  });

  it('ولوحةٌ بلا مقاسٍ تأخذ مقاسًا معياريًّا لا صفرًا', () => {
    const canvas = normalizeCanvas({});
    expect(canvas.size.w).toBeGreaterThan(0);
    expect(canvas.size.h).toBeGreaterThan(0);
  });

  it('ووثيقةٌ متدفّقة لا تحمل لوحة', () => {
    const doc = normalizeDoc({ kind: 'flow', blocks: [], fields: [] });
    expect(doc.canvas).toBeUndefined();
  });
});
