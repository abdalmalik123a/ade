/**
 * ما تشترك فيه شاشة الترويسة وأجزاؤها (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو.
 */

export const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : null);

export const settingInput =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';
