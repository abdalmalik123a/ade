/**
 * الشبّاك — ١ «اختر» (تقسيم الشبّاك بعد ١٫٧٫٠): منقولةٌ من `ServiceScreen` كما هي — ما خرج الآن، وبطاقات الخدمات وصفّ
 * الموسم، و«الملفّات»، وعرض حفظ الزبون الجديد، والمعاملات المعلّقة، والأكثر استخدامًا، والبحث والتصنيفات وبطاقات النماذج.
 * عرضٌ وحده: الحال والدوالّ كلّها في الشاشة، وتمرّ إليها بأسمائها.
 */
import type { Dispatch, MutableRefObject, SetStateAction, KeyboardEvent } from 'react';
import { countIn } from '@shared/arabic';
import type { InboxFile, OfficeSettings, TemplateSummary } from '@shared/api';
import { ROUTES, type RouteKey } from '@shared/routes';
import { COUNTER_CARDS, cardMatches, normalizeCounterCards, type CounterCard } from '@shared/counterCards';
import { seasonItems, seasonOf } from '@shared/seasons';
import InboxPanel, { type InboxOpen } from '../../components/InboxPanel';
import CounterEmpty from '../../components/CounterEmpty';
import { AfterPrint } from '../../components/OutputBar';
import SearchField from '../../components/SearchField';
import type { AfterIssue, NewCitizen, Parked, Step } from './types';

type Props = {
  after: AfterIssue | null;
  setAfter: Dispatch<SetStateAction<AfterIssue | null>>;
  reprintAfter: () => Promise<void>;
  pdfAfter: () => Promise<void>;
  sameCustomer: () => void;
  settings: OfficeSettings | null;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  items: TemplateSummary[];
  categories: { name: string; count: number }[];
  activeCategory: string | null;
  setActiveCategory: Dispatch<SetStateAction<string | null>>;
  topFavorites: TemplateSummary[];
  shown: TemplateSummary[];
  ordered: TemplateSummary[];
  picked: number[];
  toggle: (id: number) => void;
  searchRef: MutableRefObject<HTMLInputElement | null>;
  citizenId: number | null;
  onOpenTool: ((target: CounterCard['target'], citizenId: number | null) => void) | undefined;
  onOpenFile: ((file: InboxFile, as: InboxOpen) => Promise<void>) | undefined;
  active: boolean;
  step: Step;
  newCitizen: NewCitizen | null;
  setNewCitizen: Dispatch<SetStateAction<NewCitizen | null>>;
  saveNewCitizen: () => Promise<void>;
  parked: Parked[];
  resume: (key: number) => Promise<void>;
  dropParked: (p: Parked) => void;
};

export default function CounterPick({
  after,
  setAfter,
  reprintAfter,
  pdfAfter,
  sameCustomer,
  settings,
  query,
  setQuery,
  items,
  categories,
  activeCategory,
  setActiveCategory,
  topFavorites,
  shown,
  ordered,
  picked,
  toggle,
  searchRef,
  citizenId,
  onOpenTool,
  onOpenFile,
  active,
  step,
  newCitizen,
  setNewCitizen,
  saveNewCitizen,
  parked,
  resume,
  dropParked
}: Props) {
  const handleGridKeyDown = (e: KeyboardEvent<HTMLElement>, selector: string) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const container = e.currentTarget;
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute('disabled')
    );
    if (!items.length) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLElement);
    if (currentIdx === -1) return;

    e.preventDefault();
    let nextIdx = currentIdx;
    if (e.key === 'ArrowRight') {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
    } else if (e.key === 'ArrowDown') {
      nextIdx = Math.min(items.length - 1, currentIdx + (typeof window !== 'undefined' && window.innerWidth >= 768 ? 4 : 2));
    } else if (e.key === 'ArrowUp') {
      nextIdx = Math.max(0, currentIdx - (typeof window !== 'undefined' && window.innerWidth >= 768 ? 4 : 2));
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = items.length - 1;
    }
    items[nextIdx]?.focus();
  };

  const cards = (settings?.counterCards ?? normalizeCounterCards(undefined))
    .map((id) => COUNTER_CARDS.find((c) => c.id === id))
    .filter((c): c is CounterCard => Boolean(c) && cardMatches(c!, query));

  return (
    <div className="flex flex-col gap-space-md">
      <div className="text-center max-w-2xl mx-auto mt-space-xs mb-space-xs">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          ماذا يطلب الزبون؟
        </h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          انقر ما يريده — واحدةً أو عدّة أوراقٍ معًا — ثم املأها مرّةً واحدة.
        </p>
      </div>
      {after && (
        <AfterPrint
          outcome={after.outcome}
          onReprint={() => void reprintAfter()}
          onPdf={() => void pdfAfter()}
          onSameCustomer={after.customer ? sameCustomer : undefined}
          onClose={() => setAfter(null)}
        />
      )}
      {/* بطاقات الخدمات (ن١): الغرض أوّلًا — والبحث تحتها يصفّيها مع النماذج. */}
      {cards.length > 0 ? (
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-space-sm"
          data-cards=""
          onKeyDown={(e) => handleGridKeyDown(e, 'button[data-card]')}
        >
            {cards.map((c) => (
              <button
                key={c.id}
                className="p-space-sm rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-right flex items-center gap-space-sm shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-colors"
                data-card={c.id}
                data-path={'route' in c.target ? ROUTES[c.target.route as RouteKey] : undefined}
                type="button"
                onClick={() => onOpenTool?.(c.target, citizenId)}
              >
                <span className="w-10 h-10 shrink-0 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">{c.label}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{c.hint}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      {/* صفّ الموسم (ن١): ما يكثر طلبه الآن — وما لا يقدّمه المكتب ولا تجده نماذجه لا يُعرض (البند ٧). */}
      {(() => {
        const season = query.trim() ? null : seasonOf();
        const offered = settings?.counterCards ?? normalizeCounterCards(undefined);
        const chips = season ? seasonItems(season, offered, items.map((t) => `${t.title} ${t.subtitle ?? ''} ${t.category ?? ''}`)) : [];
        return season && chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-space-xs px-1" data-season="">
            <span className="flex items-center gap-1 font-label-md text-label-md text-on-surface font-semibold">
              <span className="material-symbols-outlined text-[18px] text-secondary">event</span>
              {season.title}
            </span>
            {chips.map((it) => (
              <button
                key={it.label}
                className="h-8 px-3 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
                data-season-item={'card' in it ? 'card' : 'search'}
                type="button"
                onClick={() => {
                  if ('card' in it) {
                    const card = COUNTER_CARDS.find((c) => c.id === it.card);
                    if (card) onOpenTool?.(card.target, citizenId);
                  } else setQuery(it.search);
                }}
              >
                {it.label}
              </button>
            ))}
            <span className="font-label-sm text-label-sm text-on-surface-variant">يتبدّل مع المواسم</span>
          </div>
        ) : null;
      })()}
      {/* «الملفّات» (ن٨): ما وصل الآن، ومنطقة الإفلات. */}
      {onOpenFile && !query.trim() && <InboxPanel active={active && step === 'pick'} onOpen={onOpenFile} />}
      {newCitizen && (
        <div className="p-space-sm rounded-xl bg-secondary-fixed flex flex-wrap items-center gap-space-sm" data-new-citizen="">
          <span className="material-symbols-outlined text-[20px] text-secondary">person_add</span>
          <span className="flex-1 font-label-md text-label-md text-on-surface">
            «{newCitizen.input.fullName}» ليس في «الزبائن» — أيُحفظ بما كُتب له، فتُجلب بياناته بـ«هات الزبون»
            في المرّة القادمة وتُربط به كتبه؟
          </span>
          <button
            className="h-9 px-4 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold"
            data-act="save-new-citizen"
            type="button"
            onClick={() => void saveNewCitizen()}
          >
            احفظه في السجل
          </button>
          <button
            className="h-9 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
            type="button"
            onClick={() => setNewCitizen(null)}
          >
            لا — زبونٌ عابر
          </button>
        </div>
      )}
      {parked.length > 0 && (
        <div className="p-space-sm rounded-xl bg-tertiary-fixed/40 flex flex-wrap items-center gap-space-xs" data-parked="">
          <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px] text-secondary">pending_actions</span>
            معاملات معلّقة
          </span>
          {parked.map((p) => (
            <span key={p.key} className="flex items-center rounded-lg bg-surface-container-lowest overflow-hidden">
              <button
                className="h-9 px-3 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
                data-act="resume"
                type="button"
                onClick={() => void resume(p.key)}
              >
                {p.label} — استأنف
              </button>
              <button
                className="h-9 px-2 text-on-surface-variant hover:text-error"
                title="ألغِ المعاملة المعلّقة"
                type="button"
                onClick={() => dropParked(p)}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
      {/* الأكثر استخداماً — الوصول السريع */}
      {topFavorites.length > 0 && !query.trim() && !activeCategory && (
        <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary font-bold px-1">
            <span className="material-symbols-outlined text-[18px]">star</span>
            الأكثر استخداماً في المكتب (وصول سريع)
          </div>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-space-xs"
            data-top-favorites=""
            onKeyDown={(e) => handleGridKeyDown(e, 'button[data-favorite-card]')}
          >
            {topFavorites.map((f) => {
              const on = picked.includes(f.id);
              return (
                <button
                  key={f.id}
                  data-favorite-card={f.id}
                  className={`p-space-sm rounded-lg text-right flex items-center gap-2 transition-all ${
                    on
                      ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                  }`}
                  type="button"
                  onClick={() => toggle(f.id)}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                    {on ? 'check_circle' : 'bolt'}
                  </span>
                  <span className="font-label-md text-label-md truncate">{f.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-sm">
        <SearchField
          inputRef={searchRef}
          className="w-full h-10 ps-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
          data-counter-search=""
          placeholder="ابحث بما يقوله الزبون: تأييد، صور، PDF — وEnter تملأ"
          value={query}
          wrapClassName="w-full max-w-md"
          onChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (picked.length === 0) {
                if (ordered.length > 0) {
                  e.preventDefault();
                  toggle(ordered[0].id);
                } else if (cards.length > 0) {
                  e.preventDefault();
                  onOpenTool?.(cards[0].target, citizenId);
                }
              }
            }
          }}
        />
        {/* شرائح التصنيف */}
        {categories.length > 0 && (
          <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
            <button
              className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm shrink-0 transition-colors ${
                activeCategory === null
                  ? 'bg-primary-container text-on-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
              type="button"
              onClick={() => setActiveCategory(null)}
            >
              الكل ({items.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm shrink-0 transition-colors ${
                  activeCategory === c.name
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
                type="button"
                onClick={() => setActiveCategory(c.name)}
              >
                {c.name} ({c.count})
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <CounterEmpty
          empty={items.length === 0}
          onBlank={() => onOpenTool?.({ route: 'editor' }, citizenId)}
          onImport={() => onOpenTool?.({ route: 'templates' }, null)}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
          {ordered.map((t) => {
            const on = picked.includes(t.id);
            return (
              <button
                key={t.id}
                className={`relative p-space-md rounded-xl text-right flex flex-col gap-space-sm bg-surface-container-lowest border transition-all ${
                  on
                    ? 'border-secondary ring-2 ring-secondary shadow-md'
                    : 'border-outline-variant hover:border-outline hover:shadow-md'
                }`}
                data-template-card={t.id}
                type="button"
                onClick={() => toggle(t.id)}
              >
                <span
                  className={`absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    on ? 'bg-secondary text-on-secondary' : 'border border-outline-variant'
                  }`}
                >
                  {on && (
                    <span className="material-symbols-outlined text-[15px]">check</span>
                  )}
                </span>
                {/* وكان رقمه على لوحة المفاتيح (١–٩) — زالت الأرقام مع الاختصارات غير المعروفة (ن١٥). */}
                <span className="w-11 h-11 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                  {t.title}
                </span>
                <span className="mt-auto font-label-sm text-label-sm text-secondary font-semibold">
                  {t.category ?? 'بلا تصنيف'}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  طُلب {countIn(t.printCount, 'مرة')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
