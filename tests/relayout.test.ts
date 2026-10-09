/**
 * «غيّر المقاس» (DESIGNS.md ١٫٧): العناصر تتوزّع ولا تتمطّط — كلٌّ يحفظ شكله بمعاملٍ واحد وموضعه نسبيًّا، وما لصق حافّةً
 * يبقى لاصقها، والممتدّ يبقى ممتدًّا، والخطّ والحدّ والإطار يتبعونه.
 */
import { describe, expect, it } from 'vitest';
import { emptyCanvas, imageElement, pathElement, SIZE_PRESETS, tableElement, textElement } from '../src/shared/canvas';
import { relayoutCanvas, relayoutScale } from '../src/shared/canvasEdit';
import { run } from '../src/shared/doc';

const A4L = { w: 297, h: 210 };
const POST = SIZE_PRESETS.find((p) => p.key === 'post-square')!.size;
const STORY = SIZE_PRESETS.find((p) => p.key === 'story')!.size;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function certificate() {
  const c = emptyCanvas(A4L);
  c.elements = [
    // صورةٌ مربّعة بالملّم في الوسط
    imageElement({ id: 'photo', box: { x: 0.4, y: 0.3, w: 60 / 297, h: 60 / 210 }, src: 'photos/a.png', frame: { color: '#000', width: 1, rings: 2, gap: 2 } }),
    // زاويةٌ في أعلى اليمين
    pathElement({ id: 'corner', box: { x: 0, y: 0, w: 0.2, h: 0.25 }, d: 'M100 0 V100 L0 0 Z', strokeWidth: 1, stroke: '#000' }),
    // موجةٌ سفلية بعرض الورقة
    pathElement({ id: 'wave', box: { x: 0, y: 0.82, w: 1, h: 0.18 }, d: 'M0 0 H100 V100 H0 Z' }),
    textElement({ id: 'title', box: { x: 0.15, y: 0.1, w: 0.7, h: 0.12 }, inlines: [run('شهادة تقدير')], size: 32 }),
    tableElement({ id: 'table', box: { x: 0.1, y: 0.55, w: 0.5, h: 0.2 }, fontSize: 10, headerFontSize: 12 })
  ];
  return c;
}

describe('«غيّر المقاس»', () => {
  it('المعامل الواحد أصغر النسبتين — فلا يخرج عنصرٌ عن الورقة', () => {
    expect(relayoutScale(A4L, POST)).toBeCloseTo(285.75 / 297);
    expect(relayoutScale(A4L, STORY)).toBeCloseTo(285.75 / 297);
    expect(relayoutScale(A4L, { w: 148.5, h: 105 })).toBe(0.5);
  });

  it('الصورة تحفظ شكلها (مربّعةً بالملّم) وموضعها من مركزها، وإطارها يتبعها', () => {
    const next = relayoutCanvas(certificate(), STORY);
    const photo = next.elements.find((e) => e.id === 'photo')!;
    const s = relayoutScale(A4L, STORY);
    expect(photo.box.w * STORY.w).toBeCloseTo(60 * s);
    expect(photo.box.h * STORY.h).toBeCloseTo(60 * s);
    expect(photo.box.x + photo.box.w / 2).toBeCloseTo(0.4 + 60 / 297 / 2);
    expect(photo.kind === 'image' && photo.frame?.width).toBeCloseTo(s);
  });

  it('وما لصق حافّةً يبقى لاصقها، والممتدّ يبقى ممتدًّا', () => {
    const next = relayoutCanvas(certificate(), STORY);
    const corner = next.elements.find((e) => e.id === 'corner')!;
    const wave = next.elements.find((e) => e.id === 'wave')!;
    expect([corner.box.x, corner.box.y]).toEqual([0, 0]);
    expect(wave.box.w).toBe(1);
    expect(near(wave.box.y + wave.box.h, 1)).toBe(true);
    expect(wave.box.h * STORY.h).toBeCloseTo(0.18 * 210 * relayoutScale(A4L, STORY));
  });

  it('والخطّ يتبع المعامل بأنصاف النقاط، والجدول كذلك', () => {
    const next = relayoutCanvas(certificate(), { w: 148.5, h: 105 });
    expect(next.elements.find((e) => e.id === 'title')).toMatchObject({ size: 16 });
    expect(next.elements.find((e) => e.id === 'table')).toMatchObject({ fontSize: 5, headerFontSize: 6 });
  });

  it('والمقاس نفسه لا يمسّ شيئًا، والعكس يعيد قريبًا من الأصل', () => {
    const c = certificate();
    expect(relayoutCanvas(c, A4L)).toBe(c);
    const back = relayoutCanvas(relayoutCanvas(c, POST), A4L);
    const title = back.elements.find((e) => e.id === 'title')!;
    // النصّ يجري في عرضه: حصّته كما هي ذهابًا وإيابًا.
    expect(title.box.w).toBe(0.7);
    expect(back.elements.find((e) => e.id === 'photo')!.box.w).toBeLessThan(60 / 297);
    expect(back.size).toEqual(A4L);
  });
});
