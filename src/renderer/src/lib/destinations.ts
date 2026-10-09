/**
 * الوجهات الخمس (قرار ٣ تشرين الأول، ن٤) وما يقع تحت كلٍّ منها من الشاشات القائمة.
 *
 * لا تُحذف شاشة: يتغيّر مكانها واسمها. «الطلبات» إلى قيد العمل، والأرشيف وسجلّ التدقيق إلى السجلّ،
 * والمواطنون والجهات إلى الزبائن، والنماذج والترويسات إلى المكتبة — والأدوات (الصور وPDF والأسئلة
 * والتصاميم والمحرّر) تُفتح من الشبّاك فتُحسب عليه.
 */
import type { RouteKey } from '@shared/routes';

export type DestKey = 'service' | 'work' | 'record' | 'customers' | 'library';

export type Destination = {
  key: DestKey;
  label: string;
  icon: string;
  /** الشاشة التي تُفتح بالوجهة. */
  entry: RouteKey;
  /** شاشاتها كلّها — وما تعدّد منها تبويبٌ في رأس الشاشة. */
  routes: RouteKey[];
  tabs?: { route: RouteKey; label: string }[];
};

export const DESTINATIONS: readonly Destination[] = [
  { key: 'service', label: 'الشبّاك', icon: 'storefront', entry: 'service', routes: ['service', 'photos', 'pdf', 'papers', 'designs', 'editor'] },
  { key: 'work', label: 'قيد العمل', icon: 'pending_actions', entry: 'orders', routes: ['orders'] },
  {
    key: 'record',
    label: 'السجلّ',
    icon: 'history',
    entry: 'archive',
    routes: ['archive', 'audit'],
    tabs: [
      { route: 'archive', label: 'ما خرج' },
      { route: 'audit', label: 'الأحداث' }
    ]
  },
  {
    key: 'customers',
    label: 'الزبائن',
    icon: 'group',
    entry: 'citizens',
    routes: ['citizens', 'clients'],
    tabs: [
      { route: 'citizens', label: 'أشخاص' },
      { route: 'clients', label: 'جهات' }
    ]
  },
  {
    key: 'library',
    label: 'المكتبة',
    icon: 'local_library',
    entry: 'templates',
    routes: ['templates', 'letterhead', 'fonts', 'elements'],
    tabs: [
      { route: 'templates', label: 'النماذج' },
      { route: 'letterhead', label: 'الترويسات' },
      { route: 'fonts', label: 'الخطوط' },
      { route: 'elements', label: 'العناصر' }
    ]
  }
];

/** الوجهة التي تقع تحتها الشاشة — والإعدادات خارجها. */
export function destinationOf(route: RouteKey): DestKey | null {
  return DESTINATIONS.find((d) => d.routes.includes(route))?.key ?? null;
}

/** تبويبات الوجهة إن كانت الشاشة في وجهةٍ متعدّدة الشاشات. */
export function tabsOf(route: RouteKey): Destination['tabs'] | null {
  return DESTINATIONS.find((d) => d.routes.includes(route))?.tabs ?? null;
}
