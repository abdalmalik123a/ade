/**
 * الشبّاك — «سلّة النماذج» (ر175، D157): لوحٌ ثابت على يسار «اختر» لا يمرّ مع النماذج. فيه المختار **بترتيب اختياره** وتصنيفه، و✕ لكلٍّ،
 * و«املأ» (انتقلت إليها من شريط القرار بنصّها وسلوكها)، والمعاملات المعلّقة في أسفلها (من أعلى «اختر»).
 * عرضٌ وحده: الحال والدوالّ كلّها في الشاشة، وتمرّ إليها بأسمائها.
 */
import { toIndic } from '@shared/arabic';
import type { TemplateSummary } from '@shared/api';
import type { Parked } from './types';

type Props = {
  picked: number[];
  items: TemplateSummary[];
  toggle: (id: number) => void;
  goFill: (ids?: number[]) => Promise<void>;
  busy: boolean;
  parked: Parked[];
  resume: (key: number) => Promise<void>;
  dropParked: (p: Parked) => void;
};

export default function CounterBasket({ picked, items, toggle, goFill, busy, parked, resume, dropParked }: Props) {
  const chosen = picked.map((id) => items.find((t) => t.id === id)).filter((t): t is TemplateSummary => Boolean(t));
  return (
    <aside
      aria-label="سلّة النماذج"
      className="w-[280px] shrink-0 flex flex-col bg-grad-surface rounded-frame shadow-card border border-white/90 overflow-hidden"
      data-basket=""
    >
      <div className="shrink-0 flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="w-[38px] h-[38px] shrink-0 rounded-ico bg-secondary-fixed text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px]">shopping_basket</span>
        </span>
        <span className="flex flex-col min-w-0">
          <span className="font-headline-sm text-headline-sm text-on-surface">سلّة النماذج</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">ما اختاره الزبون بترتيبه</span>
        </span>
        <span
          className="ms-auto min-w-[28px] h-7 px-1.5 rounded-full bg-grad-orange text-on-surface font-label-lg text-label-lg font-bold flex items-center justify-center shadow-low"
          data-basket-count=""
        >
          {toIndic(picked.length)}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-1">
        {chosen.length === 0 ? (
          <p className="m-0 px-1 py-space-sm font-body-sm text-body-sm text-on-surface-variant">انقر نموذجًا ليُضاف هنا بترتيبه.</p>
        ) : (
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {chosen.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-card bg-surface-container-lowest border border-outline-variant shadow-low"
                data-basket-item={t.id}
              >
                <span className="w-[26px] h-[26px] shrink-0 rounded-full bg-primary-fixed text-primary font-label-md text-label-md font-bold flex items-center justify-center">
                  {toIndic(i + 1)}
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface truncate">{t.title}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{t.category ?? 'بلا تصنيف'}</span>
                </span>
                <button
                  aria-label={`أزل ${t.title} من السلّة`}
                  className="w-[30px] h-[30px] shrink-0 rounded-btn bg-surface-container-low text-on-surface-variant hover:text-error flex items-center justify-center"
                  type="button"
                  onClick={() => toggle(t.id)}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5 flex flex-col gap-2.5">
        <p className="m-0 flex items-start gap-1.5 px-3 py-2 rounded-btn bg-secondary-fixed text-primary font-body-sm text-body-sm font-medium shadow-[inset_0_0_0_1px_rgb(var(--i-cyan)/.4)]">
          <span className="material-symbols-outlined text-[17px]">info</span>
          بيانات الزبون تُكتب مرّةً واحدة لكلّ النماذج.
        </p>
        {/* «املأ» كما كانت في شريط القرار حرفًا بحرف — فالسيناريوهات التي تضغطها بنصّها تجدها. */}
        <button
          className="h-12 px-5 btn-act rounded-card font-headline-sm text-headline-sm font-bold disabled:opacity-40"
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={() => void goFill()}
        >
          املأ {picked.length > 0 ? `(${picked.length})` : ''}
        </button>
      </div>

      {parked.length > 0 && (
        <div className="shrink-0 px-4 py-2.5 border-t border-outline-variant bg-surface-container-low flex flex-col gap-1.5" data-parked="">
          {parked.map((p) => (
            <span key={p.key} className="flex items-center gap-2 font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[18px] text-orange">pending_actions</span>
              <span className="flex-1 min-w-0 truncate text-on-surface font-semibold">معاملات معلّقة: {p.label}</span>
              <button
                className="h-[30px] px-3 rounded-btn bg-surface-container-lowest border border-outline-variant shadow-low text-primary font-label-md text-label-md font-semibold"
                data-act="resume"
                type="button"
                onClick={() => void resume(p.key)}
              >
                استأنف
              </button>
              <button
                className="w-[30px] h-[30px] rounded-btn text-on-surface-variant hover:text-error flex items-center justify-center"
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
    </aside>
  );
}
