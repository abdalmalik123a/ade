/**
 * «من سجل المواطنين» — اختيار عدّة أسماءٍ من السجل (د١٥، د١٢).
 *
 * هويّات موظفي دائرةٍ كلّها، أو قائمة دمجٍ لتأييدات صفٍّ مسجَّل: بحثٌ، وتصنيفٌ يُختار
 * كلّه بضغطة، وعلامةٌ لكلّ اسم. والنتيجة معرّفاتٌ بترتيب اختيارها.
 * و`single`: اسمٌ واحد (صورة المعاملة تُحفظ في ملف صاحبها).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CitizenSummary } from '@shared/api';

export default function CitizenMultiPicker({
  title,
  confirmLabel,
  onPick,
  onClose,
  single = false
}: {
  title: string;
  confirmLabel: string;
  single?: boolean;
  onPick: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [list, setList] = useState<CitizenSummary[]>([]);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    void window.diwan.citizens.categories().then(setCategories);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void window.diwan.citizens.list({ query, category, limit: 1000 }).then(setList);
    }, query ? 200 : 0);
    return () => clearTimeout(t);
  }, [query, category]);

  const shownIds = useMemo(() => list.map((c) => c.id), [list]);
  const allShown = shownIds.length > 0 && shownIds.every((id) => picked.includes(id));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : single ? [id] : [...p, id]));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-citizen-picker="">
      <div className="w-full max-w-2xl h-[80vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low flex flex-col gap-space-xs">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <input
            autoFocus
            className="h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
            data-picker-search=""
            placeholder="ابحث بالاسم أو الرقم أو الوظيفة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {[{ name: null as string | null, count: 0 }, ...categories].map((c) => (
                <button
                  key={c.name ?? 'all'}
                  className={`h-7 px-2 rounded-full font-label-sm text-label-sm ${
                    category === c.name ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  type="button"
                  onClick={() => setCategory(c.name)}
                >
                  {c.name ?? 'الكل'}
                  {c.name ? ` (${c.count})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`px-space-md py-space-xs items-center justify-between font-label-md text-label-md ${single ? 'hidden' : 'flex'}`}>
          <label className="flex items-center gap-space-xs cursor-pointer text-on-surface">
            <input
              checked={allShown}
              className="w-4 h-4 accent-secondary"
              data-act="picker-all"
              type="checkbox"
              onChange={() =>
                setPicked((p) => (allShown ? p.filter((id) => !shownIds.includes(id)) : [...p, ...shownIds.filter((id) => !p.includes(id))]))
              }
            />
            اختر كلّ المعروض ({list.length})
          </label>
          <span className="text-on-surface-variant">اختير {picked.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-space-md flex flex-col gap-1">
          {list.map((c) => (
            <label key={c.id} className="flex items-center gap-space-sm p-space-xs rounded-lg hover:bg-surface-container-high cursor-pointer" data-picker-row={c.fullName}>
              <input checked={picked.includes(c.id)} className="w-4 h-4 accent-secondary" type="checkbox" onChange={() => toggle(c.id)} />
              {c.photoPath ? (
                <img alt="" className="w-8 h-10 rounded object-cover" src={`diwan://store/${c.photoPath}`} />
              ) : (
                <span className="w-8 h-10 rounded bg-surface-container-high flex items-center justify-center material-symbols-outlined text-[18px] text-on-surface-variant">
                  person
                </span>
              )}
              <span className="flex flex-col min-w-0 flex-1">
                <span className="font-label-lg text-label-lg text-on-surface truncate">{c.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                  {[c.jobTitle, c.workplace, c.nationalId].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          ))}
          {list.length === 0 && <p className="py-space-lg text-center font-label-md text-label-md text-on-surface-variant">لا أحد في السجل يطابق</p>}
        </div>
        <div className="p-space-md bg-surface-container-low flex justify-between gap-space-sm">
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="picker-confirm"
            type="button"
            disabled={picked.length === 0}
            onClick={() => onPick(picked)}
          >
            {confirmLabel}
            {single ? '' : ` (${picked.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
