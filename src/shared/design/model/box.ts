/**
 * تقويم القيم: الصندوق يبقى داخل الورقة، والرقم الفاسد يُردّ إلى افتراضه — بلا شيءٍ آخر، فتستعمله الأنواع كلّها.
 */
import type { Box } from './types';

export const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** الصندوق يبقى داخل الورقة نِسَبًا — فلا عنصر يهرب خارج ما يُطبع. */
export function clampBox(box: Box): Box {
  const w = Math.min(1, Math.max(0.005, num(box.w, 0.2)));
  const h = Math.min(1, Math.max(0.005, num(box.h, 0.1)));
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, num(box.x, 0))),
    y: Math.min(1 - h, Math.max(0, num(box.y, 0)))
  };
}
