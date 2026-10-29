import { describe, expect, it } from 'vitest';
import { designPoint, placementBox } from '../src/shared/design/toolPlacement';
describe('مواضع الأدوات من اليمين وبلا النزف', () => {
  it.each([.5, 1, 2.5])('الموضع نفسه عند تكبير %s', (zoom) => {
    const rect = { right: 900, top: 80 }; const g = { pxW: 400, pxH: 200, offset: 12 };
    expect(designPoint({ clientX: 900 - (12 + 100) * zoom, clientY: 80 + (12 + 100) * zoom }, rect, g, zoom)).toEqual({ x: .25, y: .5 });
  });
  it('النقر قرب الحافة والنزف يبقى داخل التصميم', () => {
    expect(placementBox('text', { x: -.2, y: -.1 })).toEqual({ x: 0, y: 0, w: .4, h: .1 });
    expect(placementBox('text', { x: 1.2, y: 1.1 })).toEqual({ x: .6, y: .9, w: .4, h: .1 });
  });
  it('السحب بأي اتجاه يضع الصندوق بين النقطتين', () => {
    const box = placementBox('shape', { x: .6, y: .7 }, { x: .1, y: .2 });
    expect(box.x).toBe(.1); expect(box.y).toBe(.2); expect(box.w).toBeCloseTo(.5); expect(box.h).toBeCloseTo(.5);
  });
});
