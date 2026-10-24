/**
 * أقسام مكتبة النماذج وبحثها وترتيبها (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Chip } from './Chip';
import { nf, SORTS } from './shared';
import type { TemplateStats } from '@shared/api';

type Props = {
  active: string | null;
  setActive: Dispatch<SetStateAction<string | null>>;
  stats: TemplateStats | null;
  categories: { name: string; count: number; }[];
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  sort: 'used' | 'recent' | 'title';
  setSort: Dispatch<SetStateAction<'used' | 'recent' | 'title'>>;
};

export default function LibraryFilters({ active, setActive, stats, categories, query, setQuery, sort, setSort }: Props) {
  return (
    <section className="bg-surface-container-lowest p-space-md rounded-card shadow-low flex flex-col gap-space-md" data-library-sections="">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <Chip active={active === null} onClick={() => setActive(null)}>
            الكل ({nf.format(stats?.activeTemplates ?? 0)})
          </Chip>
          {categories.map((c) => (
            <Chip key={c.name} active={active === c.name} onClick={() => setActive(c.name)}>
              {c.name} ({nf.format(c.count)})
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-space-sm shrink-0 self-end lg:self-auto">
          <div className="relative">
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              className="input-field h-9 w-56 pr-9 pl-3 text-on-surface placeholder:text-on-surface-variant font-label-sm text-label-sm"
              placeholder="ابحث في النماذج..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-surface-container-highest" />
          <select
            className="input-field h-9 px-space-sm text-on-surface font-label-sm text-label-sm cursor-pointer"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
