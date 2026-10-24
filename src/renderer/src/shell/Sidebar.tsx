import { ROUTES, type RouteKey } from '@shared/routes';
import type { SidebarCounts } from '@shared/api';
import logo from '../assets/brand/diwan-icon.png';
import { useEffect, useRef, useState } from 'react';
import { channels } from '@shared/brand';
import { toIndic } from '@shared/arabic';
import { destinationOf, DESTINATIONS, type Destination } from '../lib/destinations';

/**
 * السكّة (خطّة الترقية، المرحلة ٢ — قرار ٣ تشرين الأول، ن٤): خمس وجهاتٍ ظاهرة دائمًا، أيقونةٌ
 * واسم، والإعدادات زرٌّ صغير أسفلها لأنها قليلة الاستعمال.
 *
 * وكان شريطًا بأربعة عشر قسمًا يُخفى ويظهر بتقريب الفأرة ويُثبَّت بزرّ: التنقّل المخفيّ يُكتشف ولا
 * يُرى، والاسم مع الأيقونة أسرع من الأيقونة وحدها. والأدوات (الصور وPDF والأسئلة والتصاميم)
 * تُفتح من بطاقات الشبّاك، و«عدّل» في المكتبة يفتح المحرّر — فلا يضيع قسم، يتغيّر مكانه.
 */
// «ب٢» (ر175): السكّة لوحٌ أبيض عائم، والمرور فيها سماويٌّ باهت، والمحدَّد بتدرّج الفعل ونصٍّ أبيض.
const ITEM =
  'relative w-[62px] flex flex-col items-center gap-1 pt-2.5 pb-2 rounded-card text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors';
const ITEM_ON =
  'relative w-[62px] flex flex-col items-center gap-1 pt-2.5 pb-2 rounded-card bg-grad-act text-on-primary font-bold shadow-act';
const SMALL =
  'relative w-[62px] flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 rounded-card text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors';

export type SidebarProps = {
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  counts: SidebarCounts;
  /** رقم الإصدار من الحزمة — في تلميح الشعار. */
  version: string | null;
  /** «عن البرنامج»: من الشعار في رأس السكّة. */
  onAbout: () => void;
  /** اسم المكتب — في تلميح الشعار، فالسكّة لا تتّسع له. */
  officeName?: string;
};

export default function Sidebar({ active, onNavigate, counts, version, onAbout, officeName }: SidebarProps) {
  const here = destinationOf(active);
  /**
   * العدّاد على «قيد العمل»: الطلبات المفتوحة والمعاملات المعلّقة — لا المسودّات (د٢) — والمتأخّر وما موعده اليوم بلون التنبيه.
   * وهو «مفتوح» في صفحتها نفسه، بالرقم الهندي، وتلميحه يقول ما يعدّ (البند ١٩).
   */
  const badge = (d: Destination) => {
    if (d.key !== 'work') return null;
    const { dueToday, overdue } = counts.orders;
    const open = counts.orders.open + (counts.pending ?? 0);
    if (!open) return null;
    const alert = overdue > 0 || dueToday > 0;
    return (
      <span
        className={`absolute top-1 left-2 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center ${
          alert ? 'bg-error text-on-error' : 'bg-grad-orange text-on-surface shadow-[0_3px_8px_-2px_rgba(248,152,0,0.5)]'
        }`}
        data-badge={alert ? 'alert' : 'count'}
        title={`${overdue ? `متأخّر ${toIndic(overdue)} — ` : dueToday ? `موعده اليوم ${toIndic(dueToday)} — ` : ''}مفتوح ${toIndic(open)}: الطلبات والمعاملات المعلّقة، والمسودّات لا تُعدّ`}
      >
        {toIndic(open)}
      </span>
    );
  };

  return (
    <aside className="fixed right-0 top-0 h-full w-20 z-50 p-1.5" data-sidebar="rail">
      {/* اللوح الأبيض داخل الصندوق بهامش ٦ نقاط — فالسكّة بعرضها والشاشات بجانبها كما كانت. */}
      <div
        className="h-full flex flex-col items-center py-space-sm gap-1 bg-grad-surface rounded-frame shadow-card border border-white/90"
        data-rail-panel=""
      >
        {/* رأس السكّة: رمز «ديوان» (ر175، شفّاف بلا إطار) واسمه، و«MADA TECH» تحته. */}
        <button
          className="mb-space-xs w-[62px] pt-1 pb-1.5 rounded-card flex flex-col items-center gap-0.5 hover:bg-surface-container-high"
          data-act="sidebar-about"
          title={`${officeName ? `${officeName} — ` : ''}${version ? `ديوان ${version}` : 'ديوان'} — عن البرنامج`}
          type="button"
          onClick={onAbout}
        >
          <span className="w-11 h-11" data-brand-mark="">
            <img alt="ديوان" className="w-full h-full" src={logo} />
          </span>
          <span className="font-headline-sm text-[15px] leading-5 font-bold text-on-surface">ديوان</span>
          <span className="text-[8px] leading-3 tracking-[0.12em] text-on-surface-variant" dir="ltr">
            MADA TECH
          </span>
        </button>

        <nav aria-label="أقسام ديوان" className="flex flex-col items-center gap-1">
          {DESTINATIONS.map((d) => {
            const on = here === d.key;
            return (
              <a
                key={d.key}
                aria-current={on ? 'page' : undefined}
                className={on ? ITEM_ON : ITEM}
                data-dest={d.key}
                data-path={ROUTES[d.entry]}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(d.entry);
                }}
              >
                {badge(d)}
                <span className="material-symbols-outlined text-[24px]">{d.icon}</span>
                <span className="text-[12px] leading-4 text-center">{d.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1">
          <ChannelsButton />
          <a
            aria-current={active === 'settings' ? 'page' : undefined}
            className={active === 'settings' ? `${SMALL} bg-surface-container-high text-on-surface font-bold` : SMALL}
            data-act="open-settings"
            data-path={ROUTES.settings}
            href="#"
            title="الإعدادات — الطابعات والخدمات والبيانات والتفعيل"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('settings');
            }}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="text-[11px] leading-4">الإعدادات</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

/**
 * «قنواتنا» (قرار المالك ٢ تشرين الأول ٢٠٢٦): قنوات المطوّر الرسمية — تُفتح في متصفّح الجهاز، والبرنامج نفسه
 * لا يتّصل. قائمةٌ صغيرة بجانب الزرّ، وتُغلق بالنقر خارجها.
 */
function ChannelsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = channels();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  if (!list.length) return null;
  return (
    <div ref={ref} className="relative">
      <button
        className={SMALL}
        data-act="open-channels"
        title="قنواتنا — تيليجرام ويوتيوب وواتساب وفيسبوك"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined text-[20px]">campaign</span>
        <span className="text-[11px] leading-4">قنواتنا</span>
      </button>
      {open && (
        <div className="absolute bottom-0 right-[76px] z-50 w-52 surface-panel p-space-xs flex flex-col gap-0.5" data-channels-menu="">
          <span className="px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">قنواتنا</span>
          {list.map((c) => (
            <a
              key={c.key}
              className="flex items-center gap-space-sm px-space-sm h-9 rounded-btn hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              data-channel={c.key}
              href={c.url}
              rel="noreferrer"
              target="_blank"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">{c.icon}</span>
              {c.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
