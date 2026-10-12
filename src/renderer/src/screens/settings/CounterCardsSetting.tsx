/**
 * بطاقات الشبّاك في الإعدادات (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */
import type { ReactNode } from 'react';
import { type CounterCardId, COUNTER_CARDS } from '@shared/counterCards';
import type { OfficeSettings } from '@shared/api';

/**
 * بطاقات الشبّاك (المرحلة ٢، ن١): ما يقدّمه المكتب يظهر، وما لا يقدّمه يُخفى — ولا يُمحى منه شيء،
 * والترتيب ثابتٌ بيد المكتب لا يتعلّم من الاستعمال. وحلّت محلّ «الأقسام الظاهرة» و«تثبيت الشريط»:
 * السكّة خمس وجهاتٍ ظاهرة دائمًا، والأدوات بطاقات.
 */
export function CounterCardsSetting({
  card,
  title,
  cards,
  onChange
}: {
  card: string;
  title: ReactNode;
  cards: CounterCardId[];
  onChange: (next: Pick<OfficeSettings, 'counterCards'>) => void;
}) {
  // الظاهرة بترتيبها أوّلًا، ثم المخفيّة — فتُعاد من مكانها.
  const ordered = [...cards.map((id) => COUNTER_CARDS.find((c) => c.id === id)!), ...COUNTER_CARDS.filter((c) => !cards.includes(c.id))];
  const move = (id: CounterCardId, dir: -1 | 1) => {
    const at = cards.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= cards.length) return;
    const next = [...cards];
    [next[at], next[to]] = [next[to]!, next[at]!];
    onChange({ counterCards: next });
  };
  return (
    <section className={card} data-counter-cards="">
      {title}
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        ما يقدّمه مكتبك يظهر في الشبّاك بهذا الترتيب. وما لا تقدّمه أخفِه — ولا يُمحى شيء، ويعود من هنا.
      </p>
      <div className="flex flex-col gap-1">
        {ordered.map((c) => {
          const on = cards.includes(c.id);
          return (
            <div key={c.id} className={`flex items-center gap-space-xs p-1.5 rounded-lg ${on ? 'bg-surface-container-low' : ''}`} data-card-row={c.id}>
              <label className={`flex-1 min-w-0 flex items-center gap-space-xs font-label-md text-label-md cursor-pointer ${on ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                <input
                  checked={on}
                  className="w-4 h-4 accent-secondary"
                  data-card={c.id}
                  type="checkbox"
                  onChange={(e) => onChange({ counterCards: e.target.checked ? [...cards, c.id] : cards.filter((x) => x !== c.id) })}
                />
                <span className="material-symbols-outlined text-[18px] text-secondary">{c.icon}</span>
                <span className="truncate">{c.label}</span>
              </label>
              {on && (
                <>
                  <button className="w-7 h-7 rounded text-on-surface-variant hover:bg-surface-container-high" data-act="card-up" title="قبل" type="button" onClick={() => move(c.id, -1)}>
                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                  </button>
                  <button className="w-7 h-7 rounded text-on-surface-variant hover:bg-surface-container-high" data-act="card-down" title="بعد" type="button" onClick={() => move(c.id, 1)}>
                    <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
