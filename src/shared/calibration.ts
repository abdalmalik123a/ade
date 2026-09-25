/**
 * معايرة الطابعة — من قياسٍ بالمسطرة إلى إزاحة.
 *
 * العلامة مطبوعةٌ على ٢٠ ملم من الحافّة اليمنى والعليا. فإن قِيست ٢٢ من اليمنى
 * فقد انزاحت الطباعة يسارًا ملّمين، فتُزاح يمينًا ملّمين (`x = +٢`). وإن قِيست ٢٢
 * من الأعلى فقد نزلت ملّمين، فتُرفع ملّمين (`y = −٢`). الإشارتان متعاكستان بين
 * المحورين — ولهذا يكتب الموظف ما قاسه لا الإزاحة.
 */
export const CALIBRATION_MARK_MM = 20;

export function offsetFromMeasure(fromRight: number, fromTop: number): { x: number; y: number } {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { x: r(fromRight - CALIBRATION_MARK_MM), y: r(CALIBRATION_MARK_MM - fromTop) };
}

/** عكسُه — ليُعرض ما قِيس سابقًا في الخانتين. */
export function measureFromOffset(o: { x: number; y: number }): { fromRight: number; fromTop: number } {
  return { fromRight: CALIBRATION_MARK_MM + o.x, fromTop: CALIBRATION_MARK_MM - o.y };
}
