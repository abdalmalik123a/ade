import { ROUTES, type RouteKey } from '@shared/routes';

/* أصناف التصميم منقولة حرفيًا من ملفات code.html في stitch_.
   الفرق الوحيد بين الشاشات الأربع في التصميم هو انتقال aria-current وأصناف «النشط»،
   لذلك بُني التنقّل من بيانات بدل تكرار العلامات. */

const NAV_BASE =
  'flex items-center justify-between px-space-md py-space-sm rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-150';
const NAV_ACTIVE =
  'flex items-center justify-between px-space-md py-space-sm transition-all duration-150 bg-primary-container text-on-primary rounded-xl font-bold active-nav-glow shadow-md border border-secondary/20';
const TOOL_BASE =
  'flex items-center gap-space-md px-space-md py-space-sm rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-150';
const TOOL_ACTIVE =
  'flex items-center gap-space-md px-space-md py-space-sm transition-all duration-150 bg-primary-container text-on-primary rounded-xl font-bold active-nav-glow shadow-md border border-secondary/20';
const BADGE = 'px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-medium';
/** شارةٌ تنبّه: طلبٌ متأخّر أو موعده اليوم — تُرى من أي شاشة. */
const BADGE_ALERT = 'px-2 py-0.5 rounded-full text-[10px] bg-error text-on-error font-bold';

type NavItem = {
  key: RouteKey;
  icon: string;
  label: string;
  badge?: { text: string; bold?: boolean; alert?: boolean };
};

export type SidebarCounts = {
  templates: number;
  issuedToday: number;
  orders: { open: number; dueToday: number; overdue: number };
};

export type SidebarProps = {
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  counts: SidebarCounts;
  printerName: string | null;
  printerReady: boolean;
  supplyPercent: number | null;
  operatorName: string;
  officeName: string;
  /** رقم الإصدار من الحزمة — لا نصًّا مكتوبًا يتخلّف عنها. */
  version: string | null;
};

export default function Sidebar({
  active,
  onNavigate,
  counts,
  printerName,
  printerReady,
  supplyPercent,
  operatorName,
  officeName,
  version
}: SidebarProps) {
  /**
   * الشاشة اليومية وحدها في الأعلى.
   *
   * فالمكتب يقضي نهاره في الشبّاك: يختار ويملأ ويطبع والزبون واقف. وما عداه
   * يُفتح مرّةً في الأسبوع — والمحرّر **أداةُ مصمّمٍ في مكان أداة كاشير**،
   * فنُقل إلى الورشة ولم يُرمَ (§الإخلاء).
   */
  const daily: NavItem[] = [
    {
      key: 'service',
      icon: 'point_of_sale',
      label: 'الشبّاك — اختر واملأ واطبع'
    },
    {
      key: 'orders',
      icon: 'assignment',
      label: 'الطلبات',
      badge: counts.orders.overdue
        ? { text: `متأخّر ${counts.orders.overdue}`, alert: true }
        : counts.orders.dueToday
          ? { text: `اليوم ${counts.orders.dueToday}`, alert: true }
          : counts.orders.open
            ? { text: String(counts.orders.open) }
            : undefined
    },
    { key: 'photos', icon: 'portrait', label: 'الصور الشخصية' },
    { key: 'pdf', icon: 'picture_as_pdf', label: 'ملفات PDF' },
    {
      key: 'archive',
      icon: 'inventory_2',
      label: 'الأرشيف والبحث',
      badge: { text: `اليوم ${counts.issuedToday}` }
    },
    { key: 'citizens', icon: 'badge', label: 'سجل المواطنين والمستمسكات' }
  ];

  /** ما يُبنى مرّةً ويُستعمل كل يوم — وهذه هي الورشة. */
  const workshop: NavItem[] = [
    {
      key: 'templates',
      icon: 'description',
      label: 'مكتبة النماذج والمسودات',
      badge: { text: String(counts.templates) }
    },
    { key: 'editor', icon: 'edit_document', label: 'المحرّر ومعاينة A4' },
    { key: 'clients', icon: 'domain', label: 'الجهات — مدارس ودوائر' },
    { key: 'letterhead', icon: 'verified', label: 'الترويسات والشعارات' },
    // ورقة الامتحان لا تُقيَّد ولا تُصدَّر، فلا تجاور الكتب في المكتبة ولا في الشبّاك.
    { key: 'papers', icon: 'quiz', label: 'الأسئلة — أوراق الامتحانات' },
    // اللوحة لا تتدفّق: مقاسٌ ثابت وخلفيةٌ وعناصرُ بمواضعها — فشاشةٌ ثالثة.
    { key: 'designs', icon: 'badge', label: 'التصاميم — شهادات وهويات' }
  ];

  const tools: NavItem[] = [
    { key: 'audit', icon: 'verified_user', label: 'سجلّ التدقيق وسلامة الأرشيف' },
    { key: 'settings', icon: 'settings', label: 'الإعدادات' }
  ];

  return (
    <aside className="fixed right-0 top-0 h-full w-72 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between overflow-hidden">
      <div className="flex flex-col flex-1">
        <div className="h-16 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                {version ? `ديوان ${version}` : 'ديوان'}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                منظومة الكتب والتحارير
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded-full bg-surface-container-highest text-secondary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="font-label-sm text-label-sm font-semibold">محلي</span>
          </div>
        </div>

        <div className="px-space-md py-space-sm">
          <div className="font-label-sm text-label-sm text-on-surface-variant px-space-sm mb-space-xs font-semibold">
            العمل اليومي
          </div>
          <nav className="space-y-1">
            {daily.map((item) => {
              const isActive = item.key === active;
              return (
                <a
                  key={item.key}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? NAV_ACTIVE : NAV_BASE}
                  data-path={ROUTES[item.key]}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.key);
                  }}
                >
                  <div className="flex items-center gap-space-md">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="font-label-lg text-label-lg">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={item.badge.alert ? BADGE_ALERT : `${BADGE} ${item.badge.bold ? 'font-bold' : 'font-semibold'}`}>
                      {item.badge.text}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="px-space-md pt-space-xs">
          <div className="font-label-sm text-label-sm text-on-surface-variant px-space-sm mb-space-xs font-semibold">
            الورشة — تُبنى مرّةً وتُستعمل كل يوم
          </div>
          <nav className="space-y-1">
            {workshop.map((item) => {
              const isActive = item.key === active;
              return (
                <a
                  key={item.key}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? NAV_ACTIVE : NAV_BASE}
                  data-path={ROUTES[item.key]}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.key);
                  }}
                >
                  <div className="flex items-center gap-space-md">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="font-label-lg text-label-lg">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={item.badge.alert ? BADGE_ALERT : `${BADGE} ${item.badge.bold ? 'font-bold' : 'font-semibold'}`}>
                      {item.badge.text}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="px-space-md pt-space-xs">
          <div className="font-label-sm text-label-sm text-on-surface-variant px-space-sm mb-space-xs font-semibold">
            أدوات التوثيق
          </div>
          <div className="space-y-1">
            {tools.map((item) => {
              const isActive = item.key === active;
              return (
                <a
                  key={item.key}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? TOOL_ACTIVE : TOOL_BASE}
                  data-path={ROUTES[item.key]}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.key);
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-label-lg text-label-lg">{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-space-md bg-surface-container-low space-y-space-sm">
        <div className="p-space-sm rounded-lg bg-surface-container-lowest flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[22px]">print</span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {printerName ?? 'لم تُحدَّد طابعة'}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {printerName
                  ? printerReady
                    ? 'جاهزة للطباعة الإدارية'
                    : 'غير متاحة الآن'
                  : 'اخترها من «الإعدادات»'}
              </span>
            </div>
          </div>
          {supplyPercent !== null && (
            <div className="flex flex-col items-end">
              <span className="font-label-sm text-label-sm text-secondary font-bold">
                {supplyPercent}%
              </span>
              <div className="w-10 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-secondary" style={{ width: `${supplyPercent}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-space-xs">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-bold">
                {operatorName}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {officeName}
              </span>
            </div>
          </div>
          <button
            className="p-space-xs rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            data-act="open-settings"
            title="الإعدادات"
            type="button"
            onClick={() => onNavigate('settings')}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
