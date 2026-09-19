import { describe, expect, it } from 'vitest';
import { emptyCanvas, textElement, type Box, type CanvasElement } from '../src/shared/canvas';
import {
  CLONE_OFFSET,
  MIN_SIDE,
  SNAP,
  alignBoxes,
  bottom,
  cloneElements,
  commitCanvas,
  distribute,
  hull,
  moveLayer,
  nudge,
  redoCanvas,
  resizeBox,
  right,
  snapBox,
  startCanvasHistory,
  undoCanvas,
  withBoxes
} from '../src/shared/canvasEdit';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

const el = (id: string, b: Box, z: number, locked = false): CanvasElement => ({
  ...textElement({ box: b, z }),
  id,
  locked
});

describe('الالتصاق يُرى — فالخطّ يُعلن سببه', () => {
  it('يلتصق بحافّة الورقة', () => {
    const { box: out, guides } = snapBox(box(0.004, 0.3, 0.2, 0.1), []);
    expect(out.x).toBe(0);
    expect(guides).toContainEqual({ axis: 'x', at: 0 });
  });

  it('ويلتصق بمنتصفها — وهو أكثر ما يُطلب في الشهادات', () => {
    const { box: out } = snapBox(box(0.396, 0.3, 0.2, 0.1), []);
    // منتصفُ الصندوق صار منتصف الورقة.
    expect(out.x + out.w / 2).toBeCloseTo(0.5, 5);
  });

  it('ويلتصق بحافّة شقيقه فتستقيم الحواف', () => {
    const sibling = box(0.2, 0.1, 0.3, 0.1);
    const { box: out, guides } = snapBox(box(0.205, 0.5, 0.2, 0.1), [sibling]);
    expect(out.x).toBeCloseTo(0.2, 5);
    expect(guides).toContainEqual({ axis: 'x', at: 0.2 });
  });

  it('ولا يلتصق بما هو أبعد من مداه', () => {
    const far = box(0.2, 0.1, 0.3, 0.1);
    const start = box(0.2 + SNAP * 3, 0.5, 0.2, 0.1);
    const { box: out, guides } = snapBox(start, [far]);
    expect(out.x).toBeCloseTo(start.x, 5);
    expect(guides.some((g) => g.axis === 'x')).toBe(false);
  });

  it('ويختار الأقرب حين يزدحم المرشّحون', () => {
    // حافّةُ الشقيق على بُعد ٠٫٠٠٢، ومنتصفُ الورقة على ٠٫٠١٨ — خارج المدى.
    const { box: out } = snapBox(box(0.482, 0.3, 0.2, 0.1), [box(0.48, 0, 0.1, 0.1)]);
    expect(out.x).toBeCloseTo(0.48, 5);
  });
});

describe('المقابض: الحافّة المقابلة ثابتة', () => {
  it('سحبُ المقبض الغربي يمدّ العرض ولا يحرّك مبدأه', () => {
    const out = resizeBox(box(0.2, 0.2, 0.3, 0.2), 'w', { dx: 0.1, dy: 0 });
    expect(out.x).toBeCloseTo(0.2, 5);
    expect(out.w).toBeCloseTo(0.4, 5);
  });

  it('وسحبُ الشرقي يحرّك المبدأ ويُبقي الحافّة المقابلة', () => {
    const start = box(0.2, 0.2, 0.3, 0.2);
    const out = resizeBox(start, 'e', { dx: 0.1, dy: 0 });
    expect(right(out)).toBeCloseTo(right(start), 5);
    expect(out.w).toBeCloseTo(0.2, 5);
  });

  it('والشمالي يُبقي الحافّة السفلى', () => {
    const start = box(0.2, 0.3, 0.2, 0.3);
    const out = resizeBox(start, 'n', { dx: 0, dy: 0.1 });
    expect(bottom(out)).toBeCloseTo(bottom(start), 5);
  });

  it('ولا يتلاشى عنصرٌ بسحبةٍ مفرطة', () => {
    const out = resizeBox(box(0.2, 0.2, 0.3, 0.2), 'w', { dx: -9, dy: -9 });
    expect(out.w).toBeGreaterThanOrEqual(MIN_SIDE);
    expect(out.h).toBeGreaterThanOrEqual(MIN_SIDE);
  });

  it('وحفظُ النسبة يمنع تشوّه الصورة', () => {
    const start = box(0.1, 0.1, 0.4, 0.2);
    const out = resizeBox(start, 'se', { dx: 0.2, dy: 0.01 }, true);
    expect(out.w / out.h).toBeCloseTo(start.w / start.h, 5);
  });

  it('والأسهم تحرّك بمقدار الخطوة', () => {
    expect(nudge(box(0.2, 0.2, 0.1, 0.1), -1, 0, 0.01).x).toBeCloseTo(0.19, 5);
    expect(nudge(box(0.2, 0.2, 0.1, 0.1), 0, 1, 0.1).y).toBeCloseTo(0.3, 5);
  });
});

describe('المحاذاة والتوزيع', () => {
  const boxes = [box(0.1, 0.1, 0.2, 0.1), box(0.4, 0.3, 0.1, 0.1), box(0.6, 0.5, 0.3, 0.1)];

  it('تحاذي إلى ما يضمّ المحدَّد', () => {
    const box = hull(boxes)!;
    expect(box.x).toBeCloseTo(0.1, 5);
    expect(box.y).toBeCloseTo(0.1, 5);
    expect(box.w).toBeCloseTo(0.8, 5);
    expect(box.h).toBeCloseTo(0.5, 5);
    const out = alignBoxes(boxes, 'right');
    for (const b of out) expect(b.x).toBeCloseTo(0.1, 5);
  });

  it('وتوسّط أفقيًّا', () => {
    const out = alignBoxes(boxes, 'hCenter');
    for (const b of out) expect(b.x + b.w / 2).toBeCloseTo(0.5, 5);
  });

  it('وعنصرٌ وحده يُوسَّط في الورقة لا في نفسه', () => {
    const [out] = alignBoxes([box(0.1, 0.1, 0.2, 0.1)], 'hCenter');
    expect(out!.x).toBeCloseTo(0.4, 5);
  });

  it('والتوزيع يساوي الفجوات ولا يحرّك الطرفين', () => {
    const wide = [box(0, 0, 0.1, 0.1), box(0.3, 0, 0.1, 0.1), box(0.9, 0, 0.1, 0.1)];
    const out = distribute(wide, 'x');
    expect(out[0]!.x).toBeCloseTo(0, 5);
    expect(out[2]!.x).toBeCloseTo(0.9, 5);
    const gap1 = out[1]!.x - right(out[0]!);
    const gap2 = out[2]!.x - right(out[1]!);
    expect(gap1).toBeCloseTo(gap2, 5);
  });

  it('ولا يُوزَّع اثنان — فلا فجوةَ بينهما تُقسم', () => {
    const two = [box(0, 0, 0.1, 0.1), box(0.5, 0, 0.1, 0.1)];
    expect(distribute(two, 'x')).toEqual(two);
  });
});

describe('الطبقات: ترقيمٌ يُعاد فلا تتباعد الأرقام', () => {
  const elements = [el('a', box(0, 0, 0.1, 0.1), 1), el('b', box(0, 0, 0.1, 0.1), 2), el('c', box(0, 0, 0.1, 0.1), 3)];
  const zOf = (list: CanvasElement[]) =>
    Object.fromEntries(list.map((e) => [e.id, e.z]));

  it('«إلى الأمام» يجعله أعلى الكل', () => {
    expect(zOf(moveLayer(elements, ['a'], 'front'))).toEqual({ a: 3, b: 1, c: 2 });
  });

  it('و«إلى الخلف» أسفله', () => {
    expect(zOf(moveLayer(elements, ['c'], 'back'))).toEqual({ a: 2, b: 3, c: 1 });
  });

  it('و«خطوةً أمام» يتخطّى واحدًا', () => {
    expect(zOf(moveLayer(elements, ['a'], 'forward'))).toEqual({ a: 2, b: 1, c: 3 });
  });

  it('والأرقام تبقى متّصلة ١..ن مهما تكرّرت الحركة', () => {
    let out = elements;
    for (let i = 0; i < 6; i++) out = moveLayer(out, ['a'], 'forward');
    expect([...out.map((e) => e.z)].sort()).toEqual([1, 2, 3]);
  });
});

describe('التكرار والقفل', () => {
  it('النسخة تُزاح عن أصلها فتُرى', () => {
    let n = 0;
    const [copy] = cloneElements([el('a', box(0.2, 0.2, 0.1, 0.1), 1)], ['a'], () => `n${++n}`);
    expect(copy!.id).toBe('n1');
    expect(copy!.box.x).toBeCloseTo(0.2 + CLONE_OFFSET, 5);
    expect(copy!.z).toBe(2);
  });

  it('والمقفل لا يُمسّ', () => {
    const canvas = { ...emptyCanvas({ w: 100, h: 100 }), elements: [el('a', box(0.2, 0.2, 0.1, 0.1), 1, true)] };
    const out = withBoxes(canvas, ['a'], (boxes) => boxes.map((b) => ({ ...b, x: 0.9 })));
    expect(out.elements[0]!.box.x).toBeCloseTo(0.2, 5);
  });

  it('وغيرُ المقفل يُمسّ', () => {
    const canvas = { ...emptyCanvas({ w: 100, h: 100 }), elements: [el('a', box(0.2, 0.2, 0.1, 0.1), 1)] };
    const out = withBoxes(canvas, ['a'], (boxes) => boxes.map((b) => ({ ...b, x: 0.5 })));
    expect(out.elements[0]!.box.x).toBeCloseTo(0.5, 5);
  });
});

describe('التراجع في اللوحة', () => {
  it('يرجع ويعيد', () => {
    const one = emptyCanvas({ w: 100, h: 100 });
    const two = { ...one, bleed: 3 };
    const three = { ...two, cropMarks: true };

    let h = startCanvasHistory(one);
    h = commitCanvas(h, two);
    h = commitCanvas(h, three);

    h = undoCanvas(h);
    expect(h.present).toBe(two);
    h = undoCanvas(h);
    expect(h.present).toBe(one);
    h = redoCanvas(h);
    expect(h.present).toBe(two);
  });

  it('ولا يرجع أبعد من أوّله', () => {
    const one = emptyCanvas({ w: 100, h: 100 });
    const h = undoCanvas(startCanvasHistory(one));
    expect(h.present).toBe(one);
  });

  it('وعملٌ جديد يمحو ما أُعيد', () => {
    const one = emptyCanvas({ w: 100, h: 100 });
    let h = commitCanvas(startCanvasHistory(one), { ...one, bleed: 3 });
    h = undoCanvas(h);
    h = commitCanvas(h, { ...one, bleed: 5 });
    expect(h.future).toHaveLength(0);
  });
});
