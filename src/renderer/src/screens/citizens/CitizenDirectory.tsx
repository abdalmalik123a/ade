/**
 * دليل «الأشخاص» (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `CitizensScreen` كما هو: البحث والأصناف والقائمة بحدّها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { nf, storeUrl } from './shared';
import { Chip } from '../CitizenBits';
import type { CitizenStats, CitizenSummary } from '@shared/api';

type Props = {
  stats: CitizenStats | null;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  active: string | null;
  setActive: Dispatch<SetStateAction<string | null>>;
  categories: { name: string; count: number; }[];
  items: CitizenSummary[];
  capNote: string | null;
  selectedId: number | null;
  setSelectedId: Dispatch<SetStateAction<number | null>>;
};

export default function CitizenDirectory({ stats, query, setQuery, active, setActive, categories, items, capNote, selectedId, setSelectedId }: Props) {
  return (
    <section className="surface-panel p-space-md flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-secondary text-[20px]">contacts</span>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            دليل المواطنين والموظفين
          </h4>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
          {nf.format(stats?.activeFiles ?? 0)} ملف
        </span>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          className="input-field w-full h-10 pr-10 pl-3 text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm"
          placeholder="ابحث بالاسم أو الرقم الوطني..."
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
        <Chip active={active === null} onClick={() => setActive(null)}>
          الكل ({nf.format(stats?.activeFiles ?? 0)})
        </Chip>
        {categories.map((c) => (
          <Chip key={c.name} active={active === c.name} onClick={() => setActive(c.name)}>
            {c.name} ({nf.format(c.count)})
          </Chip>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[32px]">person_search</span>
          <span className="font-label-md text-label-md">
            {query ? 'لا نتائج مطابقة' : 'الدليل فارغ'}
          </span>
          <span className="font-label-sm text-label-sm text-center">
            {query ? 'جرّب اسمًا آخر' : 'أضف أول ملف مواطن ليظهر هنا'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-space-xs max-h-[560px] overflow-y-auto">
          {capNote && (
            <p className="font-label-sm text-label-sm text-on-surface-variant px-space-xs" data-list-limit="">
              {capNote}
            </p>
          )}
          {items.map((c) => (
            <button
              key={c.id}
              className={
                c.id === selectedId
                  ? 'text-right rounded-btn p-space-sm bg-primary-fixed text-primary border-r-2 border-cyan transition-colors'
                  : 'text-right rounded-btn p-space-sm hover:bg-surface-container-low transition-colors'
              }
              type="button"
              onClick={() => setSelectedId(c.id)}
            >
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-card bg-surface-container-high overflow-hidden flex items-center justify-center shrink-0">
                  {c.photoPath ? (
                    <img alt="" className="w-full h-full object-cover" src={storeUrl(c.photoPath)} />
                  ) : (
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                      person
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                    {c.fullName}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {[c.jobTitle, c.workplace].filter(Boolean).join(' — ') || '—'}
                  </span>
                  {c.nationalId && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                      ID: {c.nationalId}
                    </span>
                  )}
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                  {nf.format(c.attachmentCount)} مستمسك
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
