/**
 * تقاسمُ مساحةٍ بين جارين — عمودان في جدول، أو صفّان: ما يكسبه أحدهما يخسره جاره، فلا يتغيّر المجموع ولا الباقي. وبه
 * يُسحب الحدّ بينهما بالفأرة كما في Word: في جدول محرّر الكتاب (`docPmTable.ts`، البند ١) وفي جدول التصاميم
 * (`design/tableSizes.ts`، البند ٢).
 */

/**
 * `border` الحدّ بين الجزء `border - 1` والجزء `border`، و`gain` ما يكسبه الأوّل من المجموع كلّه (٠٫١ = عُشره). ولا يضيق
 * أحدهما عن `minShare` من المجموع — وما كان أضيق منه لا يضيق أكثر. والحدّان الخارجيّان لا يُسحبان.
 */
export function dragShare(weights: number[], border: number, gain: number, minShare: number): number[] {
  if (border <= 0 || border >= weights.length) return weights;
  const total = weights.reduce((a, b) => a + b, 0);
  const a = weights[border - 1]!;
  const b = weights[border]!;
  const min = total * minShare;
  const lo = Math.min(0, min - a);
  const hi = Math.max(0, b - min);
  const delta = Math.min(hi, Math.max(lo, gain * total));
  const out = [...weights];
  out[border - 1] = Math.round((a + delta) * 100) / 100;
  out[border] = Math.round((a + b - out[border - 1]!) * 100) / 100;
  return out;
}
