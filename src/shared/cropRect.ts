/**
 * القصّ المستطيل في «ورقة المستمسكات» (S47، ر182: التحديد بالخيارين — الأركان الأربعة والقصّ المستطيل).
 *
 * مستطيلٌ بإحداثيّات الصورة (بكسل) يُسحب بثمانية مقابض ومن وسطه، ويبقى داخل الصورة وفوق أصغر مقاس، وإن قُفلت نسبة المستمسك
 * بقي عليها من أيّ مقبض: الركن يرسو على الركن المقابل، والحافّة على الحافّة المقابلة ووسطها. وبلا DOM فيُختبر وحده.
 */
import { padRect, type Rect } from './multiCard';

export type { Rect };
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';
export type Bounds = { w: number; h: number };

/** يضيّق المستطيل إلى النسبة (عرضٌ ÷ طول) حول وسطه — ولا يوسّعه أبدًا. */
export function fitAspect(r: Rect, aspect: number): Rect {
  if (r.w / r.h > aspect) {
    const w = r.h * aspect;
    return { x: r.x + (r.w - w) / 2, y: r.y, w, h: r.h };
  }
  const h = r.w / aspect;
  return { x: r.x, y: r.y + (r.h - h) / 2, w: r.w, h };
}

/** «الحوافّ آليًّا»: أكبر بطاقةٍ كشفها `detectCards` بهامشها — وإلا إطارٌ بداخل ٤٪ من كلّ حافّة. */
export function autoRect(cards: Rect[], bounds: Bounds): Rect {
  const big = [...cards].sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (big) return padRect(big, bounds);
  return { x: bounds.w * 0.04, y: bounds.h * 0.04, w: bounds.w * 0.92, h: bounds.h * 0.92 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * المستطيل بعد سحب مقبضه بـ(`dx`، `dy`) من موضعه حين بدأ السحب — يُحسب من البداية لا تراكمًا، فلا ينجرف.
 * `aspect` (عرضٌ ÷ طول) يقفل النسبة، و`min` أصغر ضلعٍ بالبكسل.
 */
export function dragHandle(r: Rect, handle: Handle, dx: number, dy: number, opts: { bounds: Bounds; aspect?: number; min?: number }): Rect {
  const { bounds } = opts;
  const min = opts.min ?? 16;
  if (handle === 'move') return { x: clamp(r.x + dx, 0, bounds.w - r.w), y: clamp(r.y + dy, 0, bounds.h - r.h), w: r.w, h: r.h };

  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');
  let left = r.x;
  let right = r.x + r.w;
  let top = r.y;
  let bottom = r.y + r.h;
  if (west) left = clamp(left + dx, 0, right - min);
  if (east) right = clamp(right + dx, left + min, bounds.w);
  if (north) top = clamp(top + dy, 0, bottom - min);
  if (south) bottom = clamp(bottom + dy, top + min, bounds.h);
  if (!opts.aspect) return { x: left, y: top, w: right - left, h: bottom - top };

  const a = opts.aspect;
  // الركن: يرسو على المقابل، ويتبع الضلع الذي سُحب أكثر بنسبته.
  if ((west || east) && (north || south)) {
    const ax = west ? right : left;
    const ay = north ? bottom : top;
    let w = right - left;
    let h = bottom - top;
    if (Math.abs(dy) * a > Math.abs(dx)) w = h * a;
    else h = w / a;
    const s = Math.min(1, (west ? ax : bounds.w - ax) / w, (north ? ay : bounds.h - ay) / h);
    w *= s;
    h *= s;
    return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
  }
  // الحافّة: الضلع الآخر بالنسبة حول الوسط، والمقابلة ثابتة.
  if (north || south) {
    let h = bottom - top;
    let w = h * a;
    const cx = r.x + r.w / 2;
    const ay = north ? bottom : top;
    const s = Math.min(1, (2 * Math.min(cx, bounds.w - cx)) / w, (north ? ay : bounds.h - ay) / h);
    w *= s;
    h *= s;
    return { x: cx - w / 2, y: north ? ay - h : ay, w, h };
  }
  let w = right - left;
  let h = w / a;
  const cy = r.y + r.h / 2;
  const ax = west ? right : left;
  const s = Math.min(1, (2 * Math.min(cy, bounds.h - cy)) / h, (west ? ax : bounds.w - ax) / w);
  w *= s;
  h *= s;
  return { x: west ? ax - w : ax, y: cy - h / 2, w, h };
}
