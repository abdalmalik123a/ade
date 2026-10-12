/**
 * ما تشترك فيه مكتبة النماذج وأجزاؤها (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو.
 */

export const nf = new Intl.NumberFormat('en-US');

export const SORTS = [
  { value: 'used', label: 'الأكثر استخداماً' },
  { value: 'recent', label: 'المضافة حديثاً' },
  { value: 'title', label: 'أبجدياً حسب العنوان الإداري' }
] as const;
