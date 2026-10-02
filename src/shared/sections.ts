/**
 * الأقسام الظاهرة (خطة Production، ٣٫٣ — قرار المالك ٢٩ أيلول ٢٠٢٦): مكتبٌ لا يصمّم شهاداتٍ ولا
 * يطبع أسئلة لا يرى أقسامها في شريطه كلّ يوم. والإخفاء من الشريط ولوحة الأوامر وحدهما: لا يُمحى شيء،
 * وما أُخفي يعود من «الإعدادات».
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

/** الأقسام بترتيب الشريط، بأسمائها كما في «الإعدادات». */
export const SECTIONS: readonly { key: RouteKey; label: string }[] = [
  { key: 'service', label: 'الشبّاك' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'photos', label: 'الصور الشخصية' },
  { key: 'pdf', label: 'ملفات PDF' },
  { key: 'archive', label: 'الأرشيف والبحث' },
  { key: 'citizens', label: 'سجل المواطنين والمستمسكات' },
  { key: 'templates', label: 'مكتبة النماذج والمسودات' },
  { key: 'editor', label: 'المحرّر ومعاينة A4' },
  { key: 'clients', label: 'الجهات — مدارس ودوائر' },
  { key: 'letterhead', label: 'الترويسات والشعارات' },
  { key: 'papers', label: 'الأسئلة — أوراق الامتحانات' },
  { key: 'designs', label: 'التصاميم — شهادات وهويات' },
  { key: 'audit', label: 'سجلّ التدقيق وسلامة الأرشيف' },
  { key: 'settings', label: 'الإعدادات' }
];
