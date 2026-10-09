/**
 * المحاذاة والتوزيع.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import { clampBox } from '../model/box';
import type { Box } from '../model/types';
import { bottom, centerX, centerY, hull, right } from './boxes';

export type AlignMode = 'right' | 'hCenter' | 'left' | 'top' | 'vCenter' | 'bottom';

/**
 * يحاذي المحدَّد إلى صندوقٍ مرجع.
 *
 * والمرجع هو ما يضمّ المحدَّد إن كان أكثر من واحد، والورقةُ كلُّها إن كان واحدًا —
 * فمحاذاةُ عنصرٍ وحده تعني توسيطه في الورقة، وهو ما يتوقّعه المستعمل.
 */
export function alignBoxes(boxes: Box[], mode: AlignMode, page?: Box): Box[] {
  const ref = (boxes.length > 1 ? hull(boxes) : null) ?? page ?? { x: 0, y: 0, w: 1, h: 1 };
  return boxes.map((b) => {
    switch (mode) {
      case 'right':
        return clampBox({ ...b, x: ref.x });
      case 'left':
        return clampBox({ ...b, x: right(ref) - b.w });
      case 'hCenter':
        return clampBox({ ...b, x: centerX(ref) - b.w / 2 });
      case 'top':
        return clampBox({ ...b, y: ref.y });
      case 'bottom':
        return clampBox({ ...b, y: bottom(ref) - b.h });
      case 'vCenter':
        return clampBox({ ...b, y: centerY(ref) - b.h / 2 });
    }
  });
}

/**
 * يوزّع ثلاثةً فأكثر بفجواتٍ متساوية بين الأول والأخير.
 *
 * والطرفان لا يتحرّكان — فهما ما اختاره المستعمل، والتوزيع يمسّ ما بينهما.
 */
export function distribute(boxes: Box[], axis: 'x' | 'y'): Box[] {
  if (boxes.length < 3) return boxes;
  const key = axis;
  const side = axis === 'x' ? 'w' : 'h';
  const order = boxes.map((b, i) => ({ b, i })).sort((a, c) => a.b[key] - c.b[key]);

  const first = order[0]!.b;
  const last = order[order.length - 1]!.b;
  const span = last[key] + last[side] - first[key];
  const used = order.reduce((sum, o) => sum + o.b[side], 0);
  const gap = (span - used) / (order.length - 1);

  const out = [...boxes];
  let at = first[key];
  for (const o of order) {
    out[o.i] = clampBox({ ...o.b, [key]: at } as Box);
    at += o.b[side] + gap;
  }
  return out;
}
