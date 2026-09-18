import { ROUTES, type RouteKey } from '@shared/routes';

/* أصناف التصميم منقولة حرفيًا من ملفات code.html في stitch_.
   الفرق الوحيد بين الشاشات الأربع في التصميم هو انتقال aria-current وأصناف «النشط»،
   لذلك بُني التنقّل من بيانات بدل تكرار العلامات. */

const NAV_BASE =
  'flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all';
const NAV_ACTIVE =
  'flex items-center justify-between px-space-md py-space-sm transition-all bg-primary-container text-on-primary rounded-lg font-semibold';
const TOOL_BASE =
  'flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all';
const TOOL_ACTIVE =
  'flex items-center gap-space-md px-space-md py-space-sm transition-all bg-primary-container text-on-primary rounded-lg font-semibold';
const BADGE = 'px-1.5 py-0.5 rounded text-[10px] bg-surface-container-high text-on-surface-variant';

type NavItem = {
  key: RouteKey;
  icon: string;
  label: string;
  badge?: { text: string; bold?: boolean };
};

export type SidebarCounts = {
  templates: number;
  issuedToday: number;
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
  onSignOut: () => void;
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
  onSignOut
}: SidebarProps) {
  const main: NavItem[] = [
    {
      key: 'service',
      icon: 'point_of_sale',
      label: 'الشبّاك — اختر واملأ واطبع'
    },
    {
      key: 'editor',
      icon: 'edit_document',
      label: 'المحرر الذكي ومعاينة A4',
      badge: { text: 'نشط', bold: true }
    },
    {
      key: 'templates',
      icon: 'description',
      label: 'مكتبة النماذج والمسودات',
      badge: { text: String(counts.templates) }
    },
    {
      key: 'archive',
      icon: 'inventory_2',
      label: 'سجل المعاملات والأرشيف',
      badge: { text: `اليوم ${counts.issuedToday}` }
    },
    { key: 'citizens', icon: 'badge', label: 'سجل المواطنين والمستمسكات' }
  ];

  const tools: NavItem[] = [
    { key: 'letterhead', icon: 'verified', label: 'إعدادات الترويسة والأختام' },
    { key: 'search', icon: 'manage_search', label: 'البحث والتقارير الدورية' }
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
                ديوان 2.4
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
            الوحدات الإدارية الرئيسية
          </div>
          <nav className="space-y-1">
            {main.map((item) => {
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
                    <span className={`${BADGE} ${item.badge.bold ? 'font-bold' : 'font-semibold'}`}>
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
                  : 'اخترها من إعدادات الطباعة'}
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
            title="تبديل الحساب أو خروج"
            type="button"
            onClick={onSignOut}
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
