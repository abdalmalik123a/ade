/**
 * تبويبات الوجهة (الزبائن: أشخاص وجهات…) في رأس الشاشة — بمساراتها، فيصلها الرابط والسيناريو. منقولةٌ من App كما هي (تقسيم App
 * بعد ١٫٧٫٠). و`undefined` لوجهةٍ بلا تبويبات — فلا يُرسم مكانها في الرأس.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ROUTES, type RouteKey } from '@shared/routes';
import { tabsOf } from '../lib/destinations';

export function tabBarFor({ route, setSearch, navigate }: { route: RouteKey; setSearch: Dispatch<SetStateAction<string>>; navigate: (key: RouteKey) => void }) {
  const tabs = tabsOf(route);
  const tabBar = tabs ? (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]" data-tabs="">
      {tabs.map((t) => (
        <a
          key={t.route}
          aria-current={t.route === route ? 'page' : undefined}
          className={`h-8 px-space-md rounded-lg flex items-center font-label-md text-label-md transition-colors ${
            t.route === route ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
          data-path={ROUTES[t.route]}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSearch('');
            navigate(t.route);
          }}
        >
          {t.label}
        </a>
      ))}
    </nav>
  ) : undefined;
  return tabBar;
}
