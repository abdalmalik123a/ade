/**
 * عمود الصفحات في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: المصغّرات وتحديدها وترتيبها بالسحب.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { pagesWord } from './pdfPages';
import { toIndic } from '@shared/arabic';
import type { PageRef, FracBox } from '@shared/pdfEdit';

type Props = {
  targets: string[];
  rotate: (by: 90 | 270) => void;
  move: (delta: -1 | 1) => void;
  duplicate: () => void;
  remove: () => void;
  pages: PageRef[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  current: string | null;
  setCurrent: Dispatch<SetStateAction<string | null>>;
  setCrop: Dispatch<SetStateAction<FracBox | null>>;
  dragPage: MutableRefObject<string | null>;
  dropPage: (onto: string) => void;
  thumbs: Record<string, string>;
  thumbKey: (r: PageRef) => string;
};

export default function PagesRail({ targets, rotate, move, duplicate, remove, pages, selected, setSelected, current, setCurrent, setCrop, dragPage, dropPage, thumbs, thumbKey }: Props) {
  return (
    <aside className="w-52 shrink-0 border-l border-outline-variant bg-surface-container-low flex flex-col">
      <div className="flex items-center justify-between gap-0.5 p-space-xs border-b border-outline-variant">
        <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-rotate-right" disabled={!targets.length} title="دوّر مع عقارب الساعة" type="button" onClick={() => rotate(90)}>
          <span className="material-symbols-outlined text-[18px]">rotate_right</span>
        </button>
        <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-rotate-left" disabled={!targets.length} title="دوّر عكس عقارب الساعة" type="button" onClick={() => rotate(270)}>
          <span className="material-symbols-outlined text-[18px]">rotate_left</span>
        </button>
        <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-up" disabled={!targets.length} title="قدّم" type="button" onClick={() => move(-1)}>
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
        <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-down" disabled={!targets.length} title="أخّر" type="button" onClick={() => move(1)}>
          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
        </button>
        <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-duplicate" disabled={!targets.length} title="كرّر بعدها" type="button" onClick={duplicate}>
          <span className="material-symbols-outlined text-[18px]">content_copy</span>
        </button>
        <button className="h-8 w-8 rounded hover:bg-error-container text-error" data-act="pdf-delete" disabled={!targets.length} title="احذف من الملف الجديد" type="button" onClick={remove}>
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div className="px-space-xs py-1 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
        <span>
          {pagesWord(pages.length)}
          {selected.length ? ` — ${toIndic(selected.length)} محدَّدة` : ''}
        </span>
        <button
          className="text-secondary hover:underline"
          data-act="pdf-select-all"
          type="button"
          onClick={() => setSelected(selected.length === pages.length ? [] : pages.map((p) => p.id))}
        >
          {selected.length === pages.length ? 'ألغِ التحديد' : 'حدّد الكل'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-space-xs space-y-space-xs" data-pdf-pages="">
        {pages.map((p, i) => (
          <div
            key={p.id}
            className={`relative rounded-lg p-1 cursor-pointer border-2 ${p.id === current ? 'border-secondary' : 'border-transparent hover:border-outline-variant'}`}
            data-pdf-page={i + 1}
            draggable
            onClick={() => {
              setCurrent(p.id);
              setCrop(null);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragStart={() => (dragPage.current = p.id)}
            onDrop={() => dropPage(p.id)}
          >
            {thumbs[thumbKey(p)] ? (
              <img alt="" className="w-full shadow border border-outline-variant bg-white" src={thumbs[thumbKey(p)]} />
            ) : (
              <div className="w-full aspect-[1/1.414] bg-surface-container-high animate-pulse" />
            )}
            <div className="flex items-center justify-between mt-1 font-label-sm text-label-sm">
              <span className="font-semibold">{toIndic(i + 1)}</span>
              <input
                checked={selected.includes(p.id)}
                data-pdf-check={i + 1}
                type="checkbox"
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {(p.rotate || p.crop) && (
              <span className="absolute top-2 left-2 rounded bg-secondary text-on-secondary text-[10px] px-1">
                {p.rotate ? `${toIndic(p.rotate)}°` : ''} {p.crop ? 'مقصوصة' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
