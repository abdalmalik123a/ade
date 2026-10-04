import { ROUTES, type RouteKey } from '@shared/routes';
import type { SidebarCounts } from '@shared/api';
import mark from '../assets/brand/mt-mark.png';
import { useEffect, useRef, useState } from 'react';
import { channels } from '@shared/brand';
import { destinationOf, DESTINATIONS, type Destination } from '../lib/destinations';

/**
 * السكّة (خطّة الترقية، المرحلة ٢ — قرار ٣ تشرين الأول، ن٤): خمس وجهاتٍ ظاهرة دائمًا، أيقونةٌ
 * واسم، والإعدادات زرٌّ صغير أسفلها لأنها قليلة الاستعمال.
 *
 * وكان شريطًا بأربعة عشر قسمًا يُخفى ويظهر بتقريب الفأرة ويُثبَّت بزرّ: التنقّل المخفيّ يُكتشف ولا
 * يُرى، والاسم مع الأيقونة أسرع من الأيقونة وحدها. والأدوات (الصور وPDF والأسئلة والتصاميم)
 * تُفتح من بطاقات الشبّاك، و«عدّل» في المكتبة يفتح المحرّر — فلا يضيع قسم، يتغيّر مكانه.
 */
const ITEM =
  'relative w-[68px] flex flex-col items-center gap-1 pt-2.5 pb-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors';
const ITEM_ON =
  'relative w-[68px] flex flex-col items-center gap-1 pt-2.5 pb-2 rounded-xl bg-primary-container text-on-primary font-bold shadow-md active-nav-glow';
const SMALL =
  'relative w-[68px] flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors';

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
  /** العدّاد على «قيد العمل»: ما ينتظر كلّه (طلباتٌ ومسوداتٌ ومعلّقات) — والمتأخّر وما موعده اليوم بلون التنبيه. */
  const badge = (d: Destination) => {
    if (d.key !== 'work') return null;
    const { dueToday, overdue } = counts.orders;
    const open = counts.orders.open + (counts.pending ?? 0);
    if (!open) return null;
    const alert = overdue > 0 || dueToday > 0;
    return (
      <span
        className={`absolute top-1 left-2 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center ${
          alert ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary'
        }`}
        data-badge={alert ? 'alert' : 'count'}
        title={overdue ? `متأخّر ${overdue}` : dueToday ? `موعده اليوم ${dueToday}` : undefined}
      >
        {open}
      </span>
    );
  };

  return (
    <aside
      className="fixed right-0 top-0 h-full w-20 bg-surface-container-lowest z-50 flex flex-col items-center py-space-sm gap-1 shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
      data-sidebar="rail"
    >
      {/* رأس السكّة (المرحلة ٦): علامة MT و«ديوان»، و«MADA TECH» تحتها — على كحليّ السكّة بألوانها. */}
      <button
        className="mb-space-xs w-[68px] pt-1 pb-1.5 rounded-xl flex flex-col items-center gap-0.5 hover:bg-surface-container-high"
        data-act="sidebar-about"
        title={`${officeName ? `${officeName} — ` : ''}${version ? `ديوان ${version}` : 'ديوان'} — عن البرنامج`}
        type="button"
        onClick={onAbout}
      >
        <span className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center" data-brand-mark="">
          <img alt="MT" className="w-8 object-contain" src={mark} />
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
        <div className="absolute bottom-0 right-[76px] z-50 w-52 rounded-xl bg-surface-container-lowest shadow-2xl p-space-xs flex flex-col gap-0.5" data-channels-menu="">
          <span className="px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">قنواتنا</span>
          {list.map((c) => (
            <a
              key={c.key}
              className="flex items-center gap-space-sm px-space-sm h-9 rounded-lg hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
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
