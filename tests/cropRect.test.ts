import { describe, expect, it } from 'vitest';
import { autoRect, dragHandle, fitAspect, type Handle, type Rect } from '../src/shared/cropRect';
import { detectCards } from '../src/shared/multiCard';

/** القصّ المستطيل (S47، D199): المقابض داخل الصورة، والنسبة مقفولةً من أيّ مقبض، و«الحوافّ آليًّا». */
const B = { w: 1000, h: 700 };
const R: Rect = { x: 200, y: 150, w: 400, h: 300 };
const inside = (r: Rect) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= B.w + 1e-9 && r.y + r.h <= B.h + 1e-9;
const HANDLES: Handle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** زجاج ماسحٍ أبيض عليه بطاقةٌ بإطارٍ وكتابةٍ وصورة (كـ`idTools`) — بكسلات RGBA. */
function glass(card: Rect | null) {
  const W = 850;
  const H = 1100;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let px = [250, 250, 248];
      if (card && x >= card.x && y >= card.y && x < card.x + card.w && y < card.y + card.h) {
        const edge = x - card.x < 4 || card.x + card.w - x <= 4 || y - card.y < 4 || card.y + card.h - y <= 4;
        const ly = y - card.y - 30;
        if (edge) px = [120, 120, 125];
        else if (x - card.x > 20 && x - card.x < card.w * 0.55 && ly >= 0 && ly < 120 && ly % 30 < 4) px = [40, 40, 50];
        else if (x > card.x + card.w - 90 && x < card.x + card.w - 25 && y > card.y + 25 && y < card.y + card.h - 25) px = [150, 110, 90];
        else px = [236, 240, 250];
      }
      data.set([px[0]!, px[1]!, px[2]!, 255], (y * W + x) * 4);
    }
  return { width: W, height: H, data };
}

describe('القصّ المستطيل (S47)', () => {
  it('المقبض يبقى داخل الصورة وفوق أصغر ضلع، والنقل لا يخرجها', () => {
    for (const h of HANDLES) {
      const far = dragHandle(R, h, 5000, 5000, { bounds: B });
      const back = dragHandle(R, h, -5000, -5000, { bounds: B });
      expect(inside(far) && inside(back)).toBe(true);
      expect(Math.min(far.w, far.h, back.w, back.h)).toBeGreaterThanOrEqual(16 - 1e-9);
    }
    expect(dragHandle(R, 'move', 9000, -9000, { bounds: B })).toEqual({ x: 600, y: 0, w: 400, h: 300 });
    // والمقابل ثابت: سحب الركن الأيسر الأعلى لا يحرّك الأيمن الأسفل.
    const nw = dragHandle(R, 'nw', -50, -30, { bounds: B });
    expect([nw.x + nw.w, nw.y + nw.h]).toEqual([600, 450]);
  });

  it('النسبة مقفولةً من أيّ مقبضٍ وأيّ سحب — والمقابل راسٍ، ولا خروج من الصورة', () => {
    const a = 125 / 88;
    for (const h of HANDLES)
      for (const [dx, dy] of [
        [40, 10],
        [-30, 70],
        [900, 900],
        [-900, -900],
        [5, -400]
      ] as const) {
        const r = dragHandle(fitAspect(R, a), h, dx, dy, { bounds: B, aspect: a });
        expect(r.w / r.h).toBeCloseTo(a, 6);
        expect(inside(r)).toBe(true);
      }
    const start = fitAspect(R, a);
    const se = dragHandle(start, 'se', 60, 0, { bounds: B, aspect: a });
    expect([se.x, se.y]).toEqual([start.x, start.y]);
  });

  it('`fitAspect` يضيّق حول الوسط ولا يوسّع', () => {
    for (const a of [85.6 / 53.98, 148 / 210, 4]) {
      const r = fitAspect(R, a);
      expect(r.w <= R.w + 1e-9 && r.h <= R.h + 1e-9).toBe(true);
      expect(r.w / r.h).toBeCloseTo(a, 6);
      expect(r.x + r.w / 2).toBeCloseTo(R.x + R.w / 2, 6);
      expect(r.y + r.h / 2).toBeCloseTo(R.y + R.h / 2, 6);
    }
  });

  it('«الحوافّ آليًّا»: البطاقة في ركن الزجاج يحيط بها المستطيل — وبلا بطاقة إطارٌ بداخل ٤٪', () => {
    const card = { x: 60, y: 80, w: 340, h: 214 };
    const px = glass(card);
    const r = autoRect(detectCards(px), { w: px.width, h: px.height });
    expect(r.x <= card.x && r.y <= card.y && r.x + r.w >= card.x + card.w && r.y + r.h >= card.y + card.h).toBe(true);
    expect(r.w * r.h).toBeLessThan(card.w * card.h * 1.3);
    const empty = glass(null);
    expect(autoRect(detectCards(empty), { w: empty.width, h: empty.height })).toEqual({ x: 34, y: 44, w: 782, h: 1012 });
  });
});
