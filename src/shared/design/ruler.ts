/** مسطرة الشاشة بالملم: الصفر عند حافة القص، والنزف يحمل قياسات سالبة. */
import { SCREEN_DPI, mmToPx } from './model/units';
export type RulerTick = { mm: number; px: number; major: boolean };
export function rulerTicks(size: number, bleed: number, zoom: number): RulerTick[] {
  if (![size, bleed, zoom].every(Number.isFinite) || size <= 0 || bleed < 0 || zoom <= 0) return [];
  const scale = mmToPx(1, SCREEN_DPI) * zoom;
  const step = [1, 2, 5, 10, 20, 50, 100].find((n) => n * scale >= 8) ?? 100;
  const out: RulerTick[] = [];
  for (let mm = Math.ceil(-bleed / step) * step; mm <= size + bleed + 1e-9; mm += step) {
    out.push({ mm: mm || 0, px: (bleed + mm) * scale, major: mm % 10 === 0 || step >= 10 });
  }
  return out;
}
