/**
 * الالتصاق وخطوط الإرشاد.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import { clampBox } from '../model/box';
import type { Box } from '../model/types';
import { SNAP, bottom, centerX, centerY, right } from './boxes';

export type Guide = { axis: 'x' | 'y'; at: number };

/**
 * يُلصق صندوقًا بما حوله: حوافُّ الورقة ومنتصفاها، وحوافُّ الأشقّاء ومنتصفاتهم.
 *
 * ويُرجع الصندوق بعد الإزاحة **والخطوط التي التصق بها** — فالخطّ يُرى، وبغيره
 * يبدو الالتصاق سحرًا لا يفهمه المستعمل.
 */
export function snapBox(box: Box, siblings: Box[], range = SNAP): { box: Box; guides: Guide[] } {
  const xs = [0, 0.5, 1];
  const ys = [0, 0.5, 1];
  for (const s of siblings) {
    xs.push(s.x, centerX(s), right(s));
    ys.push(s.y, centerY(s), bottom(s));
  }

  const guides: Guide[] = [];
  let { x, y } = box;

  // ثلاثةُ مواضعَ لكل محور: الحافّة القريبة والمنتصف والحافّة البعيدة.
  const fit = (
    candidates: number[],
    points: { at: number; shift: number }[]
  ): { value: number; guide: number } | null => {
    let best: { value: number; guide: number; gap: number } | null = null;
    for (const point of points) {
      for (const c of candidates) {
        const gap = Math.abs(point.at - c);
        if (gap <= range && (!best || gap < best.gap)) {
          best = { value: c - point.shift, guide: c, gap };
        }
      }
    }
    return best ? { value: best.value, guide: best.guide } : null;
  };

  const hitX = fit(xs, [
    { at: box.x, shift: 0 },
    { at: centerX(box), shift: box.w / 2 },
    { at: right(box), shift: box.w }
  ]);
  if (hitX) {
    x = hitX.value;
    guides.push({ axis: 'x', at: hitX.guide });
  }

  const hitY = fit(ys, [
    { at: box.y, shift: 0 },
    { at: centerY(box), shift: box.h / 2 },
    { at: bottom(box), shift: box.h }
  ]);
  if (hitY) {
    y = hitY.value;
    guides.push({ axis: 'y', at: hitY.guide });
  }

  return { box: clampBox({ ...box, x, y }), guides };
}
