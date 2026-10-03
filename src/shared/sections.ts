/**
 * الأقسام الظاهرة (خطة Production، ٣٫٣ — قرار المالك ٢٩ أيلول ٢٠٢٦) — صارت قديمة: السكّة خمس وجهاتٍ
 * ظاهرة، والأدوات بطاقاتٌ في الشبّاك (المرحلة ٢ من UPGRADE.md). ويُقرأ المحفوظ منها وحده، فمكتبٌ أخفى
 * قسمًا تُخفى بطاقته أوّل مرّة (`counterCards.ts`).
 */
import { ROUTES, type RouteKey } from './routes';

/** لا تُخفى: الشبّاك عمل اليوم، والأرشيف حافظ ما صدر، والإعدادات طريق إعادة ما أُخفي. */
export const LOCKED_SECTIONS: readonly RouteKey[] = ['service', 'archive', 'settings'];

/** المحفوظ كما هو مقروءًا: أسماء أقسامٍ معروفة غير مقفلة، بلا تكرار — وما فسد يُترك. */
export function normalizeHidden(raw: unknown): RouteKey[] {
  if (!Array.isArray(raw)) return [];
  const out: RouteKey[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !(v in ROUTES)) continue;
    const key = v as RouteKey;
    if (LOCKED_SECTIONS.includes(key) || out.includes(key)) continue;
    out.push(key);
  }
  return out;
}
