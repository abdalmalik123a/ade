/**
 * حساب الصناديق: أطرافها ومنتصفاتها وما يضمّها، وحدود المقابض والالتصاق.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import type { Box } from '../model/types';

/** أقلّ ما يُقبل من عرضٍ أو ارتفاع — فلا يختفي عنصرٌ بسحبة مقبض. */
export const MIN_SIDE = 0.01;

/** مدى الالتصاق نسبةً — نحو ٦ بكسلات على شاشةٍ عادية. */
export const SNAP = 0.012;

export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ── حسابُ الصناديق ───────────────────────────────────────────────────

export const right = (box: Box): number => box.x + box.w;
export const bottom = (box: Box): number => box.y + box.h;
export const centerX = (box: Box): number => box.x + box.w / 2;
export const centerY = (box: Box): number => box.y + box.h / 2;

/** أصغرُ صندوقٍ يضمّ ما أُعطي — وهو مرجع المحاذاة في التحديد المتعدد. */
export function hull(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map(right)) - x,
    h: Math.max(...boxes.map(bottom)) - y
  };
}
