/**
 * مكتبة النماذج والمسودات — data-path="templates-library-drafts"
 *
 * علاماتها من stitch_/_3/code.html بأصنافها كما هي، لكن لا نموذج مبرمَج:
 * الشبكة والتصنيفات والعدّادات كلها من قاعدة البيانات، وتبدأ فارغة.
 */
import { useCallback, useEffect, useState } from 'react';
import type { TemplateStats, TemplateSummary } from '@shared/api';

const nf = new Intl.NumberFormat('en-US');

const SORTS = [
  { value: 'used', label: 'الأكثر استخداماً' },
  { value: 'recent', label: 'المضافة حديثاً' },
  { value: 'title', label: 'أبجدياً حسب العنوان الإداري' }
] as const;

type Props = { onOpenInEditor?: (templateId: number) => void };

export default function TemplatesScreen({ onOpenInEditor }: Props) {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('used');

  const reload = useCallback(async (category: string | null) => {
    const [s, c, list] = await Promise.all([
      window.diwan.templates.stats(),
      window.diwan.templates.categories(),
      window.diwan.templates.list(category)
    ]);
    setStats(s);
    setCategories(c);
    setItems(list);
  }, []);

  useEffect(() => {
    void reload(active);
  }, [active, reload]);

  const visible = items
    .filter((t) => {
      if (!query.trim()) return true;
      const q = query.trim();
      return [t.title, t.subtitle, t.code, t.category].some((v) => v?.includes(q));
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ar');
      if (sort === 'recent') return b.id - a.id;
      return b.printCount - a.printCount;
    });

  const usedTokens = [...new Set(items.flatMap((t) => t.variables))].slice(0, 6);

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* مؤشرات + إجراء رئيسي */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {[
            {
              label: 'النماذج الرسمية المعتمدة',
              value: stats?.activeTemplates ?? 0,
              unit: 'صيغة نافذة',
              icon: 'verified',
              hint:
                (stats?.activeTemplates ?? 0) === 0
                  ? 'لم يُعتمد أي نموذج بعد'
                  : 'جاهزة للاستعمال في المحرر'
            },
            {
              label: 'مسودات المكتب الخاصة',
              value: stats?.drafts ?? 0,
              unit: 'مسودة',
              icon: 'edit_note',
              hint: (stats?.drafts ?? 0) === 0 ? 'لا مسودات محفوظة' : 'محفوظة محليًا'
            },
            {
              label: 'الكتب المطبوعة هذا الشهر',
              value: stats?.issuedThisMonth ?? 0,
              unit: 'كتاب رسمي',
              icon: 'print',
              hint:
                (stats?.issuedThisMonth ?? 0) === 0
                  ? 'لم يُطبع أي كتاب هذا الشهر'
                  : 'من سجل الصادر'
            }
          ].map((card) => (
            <div
              key={card.label}
              className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between"
            >
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
                  {card.label}
                </span>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight tabular">
                    {nf.format(card.value)}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-semibold">
                    {card.unit}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {card.hint}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container shadow-sm">
                <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
              </div>
            </div>
          ))}

          <div className="bg-primary-container text-on-primary p-space-md rounded-xl shadow-md flex flex-col justify-between gap-space-sm">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px]">post_add</span>
              <span className="font-label-md text-label-md font-semibold">محرر التكويد الذكي</span>
            </div>
            <span className="font-headline-sm text-headline-sm">+ إنشاء نموذج جديد</span>
            <span className="font-label-sm text-label-sm opacity-80">
              مع الحقول الديناميكية والمتغيرات التلقائية
            </span>
            <button
              className="h-9 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs transition-colors hover:bg-surface-container-high"
              type="button"
            >
              <span className="font-mono">{'{ }'}</span>
              <span>فتح مصمّم النماذج</span>
            </button>
          </div>
        </section>

        {/* المرشّحات */}
        <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              <button
                className={
                  active === null
                    ? 'px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold shrink-0 transition-colors'
                    : 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors'
                }
                type="button"
                onClick={() => setActive(null)}
              >
                الكل ({nf.format(stats?.activeTemplates ?? 0)})
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  className={
                    active === c.name
                      ? 'px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold shrink-0 transition-colors'
                      : 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors'
                  }
                  type="button"
                  onClick={() => setActive(c.name)}
                >
                  {c.name} ({nf.format(c.count)})
                </button>
              ))}
              {categories.length === 0 && (
                <span className="font-label-sm text-label-sm text-on-surface-variant px-space-sm">
                  التصنيفات تظهر هنا حسب ما تُدخله من نماذج
                </span>
              )}
            </div>

            <div className="flex items-center gap-space-sm shrink-0 self-end lg:self-auto">
              <div className="relative">
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  className="h-9 w-56 pr-9 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-label-sm text-label-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="ابحث في النماذج..."
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="h-6 w-px bg-surface-container-highest" />
              <select
                className="h-9 px-space-sm bg-surface-container-low text-on-surface rounded-lg font-label-sm text-label-sm focus:outline-none cursor-pointer"
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

          {usedTokens.length > 0 && (
            <div className="flex flex-wrap items-center gap-space-xs pt-space-xs text-on-surface-variant font-label-sm text-label-sm">
              <span className="font-semibold text-on-surface">وسوم المتغيرات الحية:</span>
              {usedTokens.map((t) => (
                <span
                  key={t}
                  className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* الشبكة */}
        {visible.length === 0 ? (
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] py-space-xl flex flex-col items-center gap-space-sm">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant">
              library_add
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {items.length === 0 ? 'مكتبة النماذج فارغة' : 'لا نتائج مطابقة'}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {items.length === 0
                ? 'أنشئ نموذجك الأول ليظهر هنا بمعاينته على الورق'
                : 'جرّب كلمة بحث أخرى أو تصنيفًا مختلفًا'}
            </span>
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
            {visible.map((t) => (
              <article
                key={t.id}
                className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden"
              >
                <div className="p-space-md flex items-start justify-between gap-space-sm">
                  <div className="flex flex-col gap-space-xs min-w-0">
                    <div className="flex items-center gap-space-xs">
                      {t.category && (
                        <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-secondary font-semibold">
                          {t.category}
                        </span>
                      )}
                      {t.code && (
                        <span className="font-code-sm text-code-sm text-on-surface-variant font-mono">
                          CODE: {t.code}
                        </span>
                      )}
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                      {t.title}
                    </h3>
                    {t.subtitle && (
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                        {t.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="font-headline-md text-headline-md text-on-surface font-bold tabular">
                      {nf.format(t.issuedThisMonth)}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant text-center">
                      طبعة هذا الشهر
                    </span>
                  </div>
                </div>

                <div className="mx-space-md rounded bg-surface-container-lowest border border-outline-variant aspect-[1/1.38] overflow-hidden p-space-sm">
                  <div
                    className="font-body-sm text-body-sm text-on-surface leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: t.bodyHtml }}
                  />
                </div>

                {t.variables.length > 0 && (
                  <div className="p-space-md flex flex-wrap items-center gap-space-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      المتغيرات المحقونة:
                    </span>
                    {t.variables.map((v) => (
                      <span
                        key={v}
                        className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm"
                      >
                        [{v}]
                      </span>
                    ))}
                  </div>
                )}

                <div className="p-space-md pt-0 flex items-center gap-space-xs">
                  <button
                    className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs transition-all"
                    type="button"
                    onClick={() => onOpenInEditor?.(t.id)}
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    <span>فتح في المحرر</span>
                    <span className="font-code-sm text-code-sm opacity-70">Ctrl+Enter</span>
                  </button>
                  <button
                    className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                    title="تعديل المتغيرات"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                  </button>
                  <button
                    className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                    title="معاينة مكبّرة"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
