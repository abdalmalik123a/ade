import { useEffect, useState } from 'react';
import { BUILTIN_CLIPARTS, type ClipartItem } from '@shared/clipart';
import type { LibraryElement } from '@shared/design/elements';
import { BUNDLED_ELEMENTS, type BundledElement } from '@shared/assets/elements';
import { useEscape } from '../kit/useEscape';

export type ClipartModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ClipartItem) => void;
  /** عنصرٌ من «مكتبة العناصر» (DESIGNS.md ٠٫٨) — يُدرج بمساره في المخزن. */
  onSelectElement?: (el: LibraryElement) => void;
  /** أيقونةٌ أو زخرفةٌ من عناصر ديوان (DESIGNS.md ١٫٤) — تُدرج شكلًا حرًّا يُلوَّن. */
  onSelectVector?: (item: BundledElement) => void;
};

/** ما استورده المكتب إلى «المكتبة ← العناصر». */
const OFFICE = 'ما أضافه المكتب';

const CATEGORIES = [
  'الكل',
  OFFICE,
  'أيقونات',
  'زخارف',
  'صور ظلّية',
  'دينية وإسلامية',
  'شخصيات وأطفال',
  'تكريم وشهادات'
] as const;

export default function ClipartModal({ isOpen, onClose, onSelect, onSelectElement, onSelectVector }: ClipartModalProps) {
  useEscape(onClose, isOpen);
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [search, setSearch] = useState('');
  const [office, setOffice] = useState<LibraryElement[]>([]);
  useEffect(() => {
    if (isOpen) void window.diwan.elements.list().then(setOffice, () => setOffice([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const officeShown = activeCategory === 'الكل' || activeCategory === OFFICE ? office.filter((el) => !q || el.name.toLowerCase().includes(q) || el.category.includes(q)) : [];
  const vectors = BUNDLED_ELEMENTS.filter(
    (v) => (activeCategory === 'الكل' || v.category === activeCategory) && (!q || v.name.includes(q) || v.tags.some((t) => t.includes(q)))
  );
  const filtered = BUILTIN_CLIPARTS.filter((item) => {
    if (activeCategory !== 'الكل' && item.category !== activeCategory) {
      return false;
    }
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto" data-clipart-modal="">
      <div className="relative w-full max-w-3xl bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md text-right">
        {/* الرأس */}
        <header className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[24px]">category</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                مكتبة الرسومات والأيقونات المتجهة (Vector Clipart)
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                اختر رسمة أو شعارًا لإدراجه فورًا في التصميم كطبقة عالية الدقة وقابلة للتحريك
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* شريط التصنيفات والبحث */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors shrink-0 ${
                  activeCategory === cat
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                }`}
                data-category={cat}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-sm font-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              data-clipart-search=""
              placeholder="ابحث (قرآن، كارتون، كأس، رمضان، موقع...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* شبكة الرسومات */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-space-sm max-h-[55vh] overflow-y-auto p-1">
          {officeShown.map((el) => (
            <button
              key={`office-${el.id}`}
              type="button"
              className="group p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant hover:border-primary hover:shadow-md transition-all flex flex-col items-center gap-space-xs text-center"
              data-act="insert-element"
              data-element={el.name}
              onClick={() => {
                onSelectElement?.(el);
                onClose();
              }}
            >
              <img alt={el.name} className="w-20 h-20 object-contain p-2 rounded-lg bg-surface-container-low group-hover:scale-105 transition-transform" src={`diwan://store/${el.file}`} />
              <span className="font-label-sm text-label-sm font-bold text-on-surface truncate w-full">{el.name}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">{el.category}</span>
            </button>
          ))}
          {vectors.map((v) => (
            <button
              key={`vec-${v.key}`}
              type="button"
              className="group p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant hover:border-primary hover:shadow-md transition-all flex flex-col items-center gap-space-xs text-center"
              data-act="insert-vector"
              data-vector={v.key}
              onClick={() => {
                onSelectVector?.(v);
                onClose();
              }}
            >
              <svg className="w-20 h-20 p-3 rounded-lg bg-surface-container-low group-hover:scale-105 transition-transform text-primary" viewBox="0 0 100 100">
                <path d={v.d} fill="currentColor" />
              </svg>
              <span className="font-label-sm text-label-sm font-bold text-on-surface truncate w-full">{v.name}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">{v.category}</span>
            </button>
          ))}
          {activeCategory === OFFICE ? (
            officeShown.length === 0 && (
              <div className="col-span-full py-12 text-center text-on-surface-variant">لم يُضَف عنصرٌ بعد — من «المكتبة ← العناصر»</div>
            )
          ) : filtered.length === 0 && vectors.length === 0 ? (
            <div className="col-span-full py-12 text-center text-on-surface-variant">
              لا توجد رسومات مطابقة لبحثك
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="group p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant hover:border-primary hover:shadow-md transition-all flex flex-col items-center gap-space-xs text-center"
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <div
                  className="w-20 h-20 flex items-center justify-center p-2 rounded-lg bg-surface-container-low group-hover:scale-105 transition-transform"
                  dangerouslySetInnerHTML={{ __html: item.svg }}
                />
                <span className="font-label-sm text-label-sm font-bold text-on-surface truncate w-full">
                  {item.name}
                </span>
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* التذييل */}
        <footer className="flex items-center justify-between pt-space-xs border-t border-outline-variant">
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            جميع الرسومات متجهة (SVG) نقية ولا تفقد دقتها عند الطباعة بأي مقاس.
          </span>
          <button
            type="button"
            className="h-9 px-4 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container font-label-md text-label-md"
            onClick={onClose}
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
}
