/**
 * الشبّاك — ١ «اختر» (تقسيم الشبّاك بعد ١٫٧٫٠): منقولةٌ من `ServiceScreen` كما هي — ما خرج الآن، وبطاقات الخدمات وصفّ
 * الموسم، و«الملفّات»، وعرض حفظ الزبون الجديد، والأكثر استخدامًا، والبحث والتصنيفات وبطاقات النماذج — بمظهر «ب٢» (D157، ر175):
 * الخدمات سطحٌ واحد، والمختار بحدٍّ سماويّ يرتفع. والمعاملات المعلّقة و«املأ» في «سلّة النماذج» (`CounterBasket`).
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
import type { AfterIssue, NewCitizen, Step } from './types';

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
  saveNewCitizen
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 px-1 pt-0.5">
        <h1 className="m-0 text-[21px] leading-[30px] font-bold text-on-surface">ماذا يطلب الزبون؟</h1>
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
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
          className="grid grid-cols-2 md:grid-cols-4 gap-0.5 p-1.5 bg-grad-surface rounded-frame shadow-card border border-white/90"
          data-cards=""
          onKeyDown={(e) => handleGridKeyDown(e, 'button[data-card]')}
        >
            {cards.map((c) => (
              <button
                key={c.id}
                className="px-2.5 py-2 rounded-card hover:bg-surface-container-high text-right flex items-center gap-2.5 min-w-0 transition-colors"
                data-card={c.id}
                data-path={'route' in c.target ? ROUTES[c.target.route as RouteKey] : undefined}
                type="button"
                onClick={() => onOpenTool?.(c.target, citizenId)}
              >
                <span className="w-[38px] h-[38px] shrink-0 rounded-ico bg-secondary-fixed text-primary flex items-center justify-center">
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
            <span className="flex items-center gap-1 font-label-md text-label-md text-tertiary font-semibold">
              <span className="material-symbols-outlined text-[18px] text-orange">event</span>
              {season.title}
            </span>
            {chips.map((it) => (
              <button
                key={it.label}
                className="h-7 px-3 rounded-chip border border-tertiary-fixed-dim/60 bg-tertiary-container hover:bg-tertiary-fixed-dim/40 text-tertiary font-label-md text-label-md font-semibold"
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
        <div className="p-space-sm rounded-card bg-secondary-fixed flex flex-wrap items-center gap-space-sm" data-new-citizen="">
          <span className="material-symbols-outlined text-[20px] text-secondary">person_add</span>
          <span className="flex-1 font-label-md text-label-md text-on-surface">
            «{newCitizen.input.fullName}» ليس في «الزبائن» — أيُحفظ بما كُتب له، فتُجلب بياناته بـ«هات الزبون»
            في المرّة القادمة وتُربط به كتبه؟
          </span>
          <button
            className="h-9 px-4 btn-act font-label-md text-label-md font-bold"
            data-act="save-new-citizen"
            type="button"
            onClick={() => void saveNewCitizen()}
          >
            احفظه في السجل
          </button>
          <button
            className="h-9 px-3 rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
            type="button"
            onClick={() => setNewCitizen(null)}
          >
            لا — زبونٌ عابر
          </button>
        </div>
      )}
      {/* الأكثر استخداماً — الوصول السريع */}
      {topFavorites.length > 0 && !query.trim() && !activeCategory && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface font-semibold">
            <span className="material-symbols-outlined text-[18px] text-orange" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            الأكثر استخداماً في المكتب (وصول سريع)
          </div>
          <div
            className="flex flex-wrap gap-2"
            data-top-favorites=""
            onKeyDown={(e) => handleGridKeyDown(e, 'button[data-favorite-card]')}
          >
            {topFavorites.map((f) => {
              const on = picked.includes(f.id);
              return (
                <button
                  key={f.id}
                  data-favorite-card={f.id}
                  className={`h-[34px] max-w-[260px] ps-2.5 pe-3 rounded-chip text-right flex items-center gap-1.5 transition-all ${
                    on
                      ? 'border-[1.5px] border-cyan bg-grad-sel text-primary font-bold shadow-sel'
                      : 'border border-outline-variant bg-surface-container-lowest text-on-surface shadow-low hover:bg-surface-container-high'
                  }`}
                  type="button"
                  onClick={() => toggle(f.id)}
                >
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0" style={on ? { fontVariationSettings: "'FILL' 1" } : undefined}>
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
          className="w-full h-10 ps-3 input-field text-on-surface font-label-md text-label-md"
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
              className={`px-3 py-1.5 rounded-chip font-label-sm text-label-sm shrink-0 transition-colors ${
                activeCategory === null
                  ? 'bg-primary-fixed text-primary font-semibold shadow-[inset_0_0_0_1px_rgb(var(--i-cyan)/.4)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              type="button"
              onClick={() => setActiveCategory(null)}
            >
              الكل ({items.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                className={`px-3 py-1.5 rounded-chip font-label-sm text-label-sm shrink-0 transition-colors ${
                  activeCategory === c.name
                    ? 'bg-primary-fixed text-primary font-semibold shadow-[inset_0_0_0_1px_rgb(var(--i-cyan)/.4)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
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
          // «اكتبه على ورقة فارغة» يفتح المحرّر بورقة بيضاء نظيفة دون تمرير استعلام البحث نوعًا للكتاب (S16)
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
                className={`relative rounded-card text-right flex flex-col gap-space-sm transition-all ${
                  on
                    ? 'p-[15px] border-2 border-cyan bg-grad-sel shadow-sel'
                    : 'p-space-md border border-outline-variant bg-grad-surface shadow-soft hover:border-outline'
                }`}
                data-template-card={t.id}
                type="button"
                onClick={() => toggle(t.id)}
              >
                <span
                  className={`absolute top-2.5 left-2.5 w-[22px] h-[22px] rounded-[7px] flex items-center justify-center transition-colors ${
                    on ? 'bg-secondary-fixed-dim text-on-surface' : 'border-[1.5px] border-outline bg-surface-container-lowest'
                  }`}
                >
                  {on && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </span>
                {/* وكان رقمه على لوحة المفاتيح (١–٩) — زالت الأرقام مع الاختصارات غير المعروفة (ن١٥). */}
                <span className="w-11 h-11 rounded-ico bg-secondary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                  {t.title}
                </span>
                <span className="mt-auto font-label-sm text-label-sm text-primary font-semibold">
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
