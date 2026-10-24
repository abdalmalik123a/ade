/**
 * قائمة الجهات: البحث، و«جهة جديدة»، وبطاقة كلّ جهةٍ بشعارها ولونها (تقسيم شاشة الجهات بعد ١٫٧٫٠) — منقولٌ من `ClientsScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Client } from '@shared/orders';

type Props = {
  setSelected: Dispatch<SetStateAction<number | 'new' | null>>;
  input: 'input-field h-10 px-3 font-label-md text-label-md text-on-surface w-full';
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  clients: Client[];
  selected: number | 'new' | null;
};

export default function ClientsList({ setSelected, input, query, setQuery, clients, selected }: Props) {
  return (
    <aside className="w-[340px] shrink-0 border-l border-outline-variant bg-surface-container-low flex flex-col">
      <div className="p-space-md space-y-space-sm">
        <div className="flex items-center justify-between">
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">الجهات</h1>
          <button
            className="h-9 px-space-md btn-act font-label-md text-label-md font-semibold flex items-center gap-1"
            data-act="new-client"
            type="button"
            onClick={() => setSelected('new')}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            جهة جديدة
          </button>
        </div>
        <input
          className={input}
          placeholder="بحث بالاسم أو الهاتف…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto px-space-sm pb-space-md space-y-1">
        {clients.map((c) => (
          <button
            key={c.id}
            className={`w-full p-space-sm rounded-btn text-right flex items-center gap-space-sm ${selected === c.id ? 'bg-primary-fixed text-primary' : 'hover:bg-surface-container-high text-on-surface'}`}
            data-client={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
          >
            <span className="w-9 h-9 rounded-chip bg-white shrink-0 flex items-center justify-center overflow-hidden" style={c.color ? { boxShadow: `inset 0 -3px 0 ${c.color}` } : undefined}>
              {c.logo ? (
                <img alt="" className="w-full h-full object-contain" src={`diwan://store/${c.logo}`} />
              ) : (
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">domain</span>
              )}
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="font-label-md text-label-md font-semibold truncate">{c.name}</span>
              <span className={`font-label-sm text-label-sm truncate ${selected === c.id ? 'opacity-80' : 'text-on-surface-variant'}`}>
                {[c.kind, c.openOrders ? `${c.openOrders} طلب مفتوح` : null].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
          </button>
        ))}
        {clients.length === 0 && (
          <p className="p-space-md text-center font-label-md text-label-md text-on-surface-variant">
            {query ? 'لا جهة بهذا الاسم' : 'أضف المدارس والدوائر التي تعمل لها — مرّةً واحدة'}
          </p>
        )}
      </div>
    </aside>
  );
}
