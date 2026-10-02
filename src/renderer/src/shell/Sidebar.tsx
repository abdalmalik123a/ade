import { ROUTES, type RouteKey } from '@shared/routes';
import type { SidebarCounts } from '@shared/api';
import icon from '../assets/brand/diwan-icon.png';

/* أصناف الشريط من توكنات التصميم (stitch_). والعنصر النشط يختلف بـaria-current وأصنافه
   وحدها — فالتنقّل يُبنى من بيانات لا بتكرار العلامات. */

/** شاشةٌ قصيرة (١٣٦٦×٧٦٨ و١٢٨٠×٧٢٠): البنود أضيق فتسع كلّها بلا تمرير غالبًا (خطة Production، ٣٫١). */
const SHORT = '[@media(max-height:820px)]:py-1';
const NAV_BASE =
  `${SHORT} flex items-center justify-between px-space-md py-space-sm rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-150`;
const NAV_ACTIVE =
  `${SHORT} flex items-center justify-between px-space-md py-space-sm transition-all duration-150 bg-primary-container text-on-primary rounded-xl font-bold active-nav-glow shadow-md border border-secondary/20`;
const TOOL_BASE =
  `${SHORT} flex items-center gap-space-md px-space-md py-space-sm rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-150`;
const TOOL_ACTIVE =
  `${SHORT} flex items-center gap-space-md px-space-md py-space-sm transition-all duration-150 bg-primary-container text-on-primary rounded-xl font-bold active-nav-glow shadow-md border border-secondary/20`;
const BADGE = 'px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-medium';
/** شارةٌ تنبّه: طلبٌ متأخّر أو موعده اليوم — تُرى من أي شاشة. */
const BADGE_ALERT = 'px-2 py-0.5 rounded-full text-[10px] bg-error text-on-error font-bold';

type NavItem = {
  key: RouteKey;
  icon: string;
  label: string;
  badge?: { text: string; alert?: boolean };
};

export type SidebarProps = {
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  counts: SidebarCounts;
  printerName: string | null;
  printerReady: boolean;
  operatorName: string;
  officeName: string;
  /** رقم الإصدار من الحزمة — لا نصًّا مكتوبًا يتخلّف عنها. */
  version: string | null;
  /** أقسامٌ أخفاها المكتب (`shared/sections.ts`) — لا تُعرض. */
  hidden: readonly RouteKey[];
  /**
   * مثبّتٌ يأخذ مكانه؛ وغير المثبّت خارج النافذة، و`open` يُظهره فوق الشاشة حين تقترب الفأرة من
   * حافّتها (خطة Production، ٣٫٢).
   */
  pinned: boolean;
  open: boolean;
  onPin: (pinned: boolean) => void;
  /** «عن البرنامج»: من اسمه في رأس الشريط. */
  onAbout: () => void;
  /** الفأرة عادت إليه قبل أن يُخفى — يبقى. */
  onEnter: () => void;
  onLeave: () => void;
};

export default function Sidebar({
  active,
  onNavigate,
  counts,
  printerName,
  printerReady,
  operatorName,
  officeName,
  version,
  hidden,
  pinned,
  open,
  onPin,
  onAbout,
  onEnter,
  onLeave
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

  const shown = (items: NavItem[]) => items.filter((item) => !hidden.includes(item.key));
  const link = (item: NavItem, base: string, activeCls: string, row: boolean) => {
    const isActive = item.key === active;
    return (
      <a
        key={item.key}
        aria-current={isActive ? 'page' : undefined}
        className={isActive ? activeCls : base}
        data-path={ROUTES[item.key]}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(item.key);
        }}
      >
        {row ? (
          <>
            <div className="flex items-center gap-space-md min-w-0">
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="font-label-lg text-label-lg truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span className={item.badge.alert ? BADGE_ALERT : `${BADGE} font-semibold`}>{item.badge.text}</span>
            )}
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="font-label-lg text-label-lg truncate">{item.label}</span>
          </>
        )}
      </a>
    );
  };
  const group = (title: string, items: NavItem[], tool = false) =>
    items.length > 0 && (
      <div className="px-space-md pt-space-sm [@media(max-height:820px)]:pt-space-xs">
        <div className="font-label-sm text-label-sm text-on-surface-variant px-space-sm mb-space-xs font-semibold">
          {title}
        </div>
        <nav className="space-y-1 [@media(max-height:820px)]:space-y-0.5">
          {items.map((item) => (tool ? link(item, TOOL_BASE, TOOL_ACTIVE, false) : link(item, NAV_BASE, NAV_ACTIVE, true)))}
        </nav>
      </div>
    );

  return (
    <aside
      className={`fixed right-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col overflow-hidden transition-transform duration-200 ${
        pinned ? 'shadow-[0_1px_8px_rgba(0,0,0,0.04)]' : 'shadow-2xl'
      } ${pinned || open ? 'translate-x-0' : 'translate-x-full'}`}
      data-sidebar={pinned ? 'pinned' : open ? 'open' : 'hidden'}
      onMouseEnter={() => !pinned && open && onEnter()}
      onMouseLeave={() => !pinned && onLeave()}
    >
      <div className="h-16 shrink-0 px-space-md flex items-center justify-between gap-space-xs bg-surface-container-low">
        <button className="flex items-center gap-space-sm min-w-0 text-start" data-act="sidebar-about" title="عن البرنامج" type="button" onClick={onAbout}>
          <img alt="" className="w-9 h-9 shrink-0" src={icon} />
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate">
              {version ? `ديوان ${version}` : 'ديوان'}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">منظومة الكتب والتحارير</span>
          </div>
        </button>
        <button
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          data-act={pinned ? 'sidebar-hide' : 'sidebar-pin'}
          title={pinned ? 'أخفِ الشريط — يظهر حين تقترب الفأرة من حافّة النافذة' : 'ثبّت الشريط في مكانه'}
          type="button"
          onClick={() => onPin(!pinned)}
        >
          <span className="material-symbols-outlined text-[20px]">{pinned ? 'right_panel_close' : 'keep'}</span>
        </button>
      </div>

      {/* البنود تُمرَّر إن ضاقت النافذة — كانت تُقصّ فيختفي آخرها والطابعة والإعدادات. */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-space-sm">
        {group('العمل اليومي', shown(daily))}
        {group('الورشة — تُبنى مرّةً وتُستعمل كل يوم', shown(workshop))}
        {group('أدوات التوثيق', shown(tools), true)}
      </div>

      <div className="shrink-0 p-space-md [@media(max-height:820px)]:p-space-sm bg-surface-container-low space-y-space-sm [@media(max-height:820px)]:space-y-space-xs">
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
