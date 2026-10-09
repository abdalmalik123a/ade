/**
 * التحديد والتجميع والتدوير (DESIGNS.md ١٫٦): مستطيل التحديد، والمجموعة تُحدَّد كلّها وتُفكّ، واللصق بمعرّفاتٍ ومجموعاتٍ
 * جديدة فوق اللوحة، والزاوية من الفأرة حول المركز — والإخفاء لا يُرسم ولا يُحدَّد.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, normalizeCanvas, SCREEN_DPI, shapeElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { expandToGroups, groupElements, idsInRect, pasteElements, rectFrom, rotationFrom, ungroupElements } from '../src/shared/canvasEdit';

const el = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ ...shapeElement({ id, box: { x, y, w: 0.1, h: 0.1 }, fill: '#000' }), ...extra });

describe('التحديد والتجميع', () => {
  const els = [el('a', 0.1, 0.1), el('b', 0.5, 0.1, { group: 'g1' }), el('c', 0.7, 0.1, { group: 'g1' }), el('d', 0.1, 0.6, { hidden: true })];

  it('المستطيل من نقطتين أيًّا كان اتّجاه السحب، وما يمسّه يُحدَّد — إلا المخفيّ', () => {
    const r = rectFrom({ x: 0.6, y: 0.7 }, { x: 0.05, y: 0.05 });
    expect([r.x, r.y, r.w, r.h].map((v) => Math.round(v * 100) / 100)).toEqual([0.05, 0.05, 0.55, 0.65]);
    expect(idsInRect(els, { x: 0, y: 0, w: 0.55, h: 0.9 })).toEqual(['a', 'b']);
    expect(idsInRect(els, { x: 0.3, y: 0.3, w: 0.001, h: 0.001 })).toEqual([]);
  });

  it('وعضوٌ في مجموعةٍ يأتي بها كلّها', () => {
    expect(expandToGroups(els, ['b'])).toEqual(['b', 'c']);
    expect(expandToGroups(els, ['a'])).toEqual(['a']);
  });

  it('والتجميع لاثنين فأكثر، والفكّ يُخرج المجموعة كلّها', () => {
    const grouped = groupElements(els, ['a', 'b'], 'g2');
    expect(grouped.filter((e) => e.group === 'g2').map((e) => e.id)).toEqual(['a', 'b']);
    expect(groupElements(els, ['a'], 'g3')).toBe(els);
    const free = ungroupElements(els, ['c']);
    expect(free.every((e) => !('group' in e))).toBe(true);
  });

  it('واللصق: معرّفاتٌ جديدة فوق اللوحة، مزاحةٌ بعدد اللصقات، ومجموعةٌ جديدة لا مجموعة الأصل', () => {
    let n = 0;
    const id = () => `n${++n}`;
    const pasted = pasteElements([els[1]!, els[2]!], els, id, 2);
    expect(pasted.map((e) => e.id)).toEqual(['n2', 'n3']);
    expect(new Set(pasted.map((e) => e.group)).size).toBe(1);
    expect(pasted[0]!.group).not.toBe('g1');
    expect(pasted[0]!.z).toBeGreaterThan(Math.max(...els.map((e) => e.z)));
    expect(pasted[0]!.box.x).toBeCloseTo(0.54);
  });

  it('والمخفيّ لا يُرسم ولا يُطبع — ويبقى في التصميم', () => {
    const canvas = normalizeCanvas({ ...emptyCanvas({ w: 100, h: 50 }), elements: els });
    expect(canvas.elements.find((e) => e.id === 'd')?.hidden).toBe(true);
    const html = renderCanvasHtml(canvasDoc(canvas), {}, { dpi: SCREEN_DPI });
    expect((html.match(/background:#000/g) ?? []).length).toBe(3);
  });
});

describe('التدوير', () => {
  const c = { x: 100, y: 100 };
  it('ما يدور مع عقارب الساعة على الشاشة يُنقص الزاوية (الرسم rotate(-r))', () => {
    expect(rotationFrom(c, { x: 200, y: 100 }, { x: 100, y: 200 }, 0)).toBe(-90);
    expect(rotationFrom(c, { x: 200, y: 100 }, { x: 100, y: 0 }, 10)).toBe(100);
  });
  it('ومع Shift بخطوة ١٥°، وفي نطاق −١٨٠..١٨٠', () => {
    expect(rotationFrom(c, { x: 200, y: 100 }, { x: 200, y: 120 }, 0, true)).toBe(-15);
    // من ٠° إلى نحو ١٧٩٫٤° مع العقارب: ٩٠ − ١٧٩٫٤ = −٨٩٫٤
    expect(rotationFrom(c, { x: 200, y: 100 }, { x: 0, y: 101 }, 90)).toBe(-89.4);
    expect(rotationFrom(c, { x: 200, y: 100 }, { x: 200, y: 90 }, 175)).toBe(-179.3);
  });
});
