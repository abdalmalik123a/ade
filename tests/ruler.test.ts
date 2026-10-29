import { describe, expect, it } from 'vitest';
import { rulerTicks } from '../src/shared/design/ruler';
import { SCREEN_DPI, mmToPx } from '../src/shared/canvas';
describe('المسطرة بالملم', () => {
  it.each([.15, .5, 1, 2.25, 3])('الصفر والنزف والمسافة يتبعان التكبير %s', (zoom) => {
    const ticks=rulerTicks(85.6,3,zoom),zero=ticks.find(t=>t.mm===0)!,ten=ticks.find(t=>t.mm===10);
    expect(zero.px).toBeCloseTo(mmToPx(3,SCREEN_DPI)*zoom);
    if(ten) expect(ten.px-zero.px).toBeCloseTo(mmToPx(10,SCREEN_DPI)*zoom);
    expect(ticks.every(t=>t.mm>=-3&&t.mm<=88.6)).toBe(true);
  });
  it('الكسور والنزف السالب يبقيان أصل القص كما هو', () => {
    const ticks=rulerTicks(90.5,2.5,3);expect(ticks.find(t=>t.mm===-2)!.px).toBeCloseTo(mmToPx(.5,SCREEN_DPI)*3);
    expect(ticks.find(t=>t.mm===0)!.px).toBeCloseTo(mmToPx(2.5,SCREEN_DPI)*3);
  });
  it('المدخل الفاسد لا يولد حلقة بلا نهاية', () => { expect(rulerTicks(Infinity,3,1)).toEqual([]);expect(rulerTicks(85,3,0)).toEqual([]); });
});
