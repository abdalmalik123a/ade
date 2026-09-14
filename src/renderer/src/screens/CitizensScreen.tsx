/**
 * سجل المواطنين والمستمسكات — data-path="citizens-identity-records"
 *
 * علاماتها من stitch_/_2/code.html بأصنافها كما هي، بلا أي مواطن مبرمَج.
 * البحث يستعمل التطبيع المتساهل للهمزة، فيجد الموظفُ «أحمد» بكتابة «احمد».
 */
import { useCallback, useEffect, useState } from 'react';
import type { CitizenStats, CitizenSummary } from '@shared/api';

const nf = new Intl.NumberFormat('en-US');
const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

export default function CitizensScreen() {
  const [stats, setStats] = useState<CitizenStats | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [items, setItems] = useState<CitizenSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const reload = useCallback(async () => {
    const [s, c, list] = await Promise.all([
      window.diwan.citizens.stats(),
      window.diwan.citizens.categories(),
      window.diwan.citizens.list({ query, category: active })
    ]);
    setStats(s);
    setCategories(c);
    setItems(list);
    if (list.length > 0 && !list.some((x) => x.id === selectedId)) setSelectedId(list[0]!.id);
    if (list.length === 0) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [query, active, selectedId]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, active]);

  useEffect(() => {
    if (selectedId === null) return;
    void window.diwan.citizens.get(selectedId).then(setDetail);
  }, [selectedId]);

  const attachments = (detail?.attachments as Record<string, unknown>[] | undefined) ?? [];
  const field = (key: string) => (detail?.[key] as string | null) || '—';

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* الترويسة والإجراءات */}
        <section className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              سجل المواطنين والمستمسكات الرسمية
            </h2>
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
              <span className="font-label-sm text-label-sm">
                أرشيف محلي مؤمّن — لا يغادر بيانات المواطن هذا الجهاز
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">scanner</span>
              <span>فحص الماسح الضوئي (WIA)</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-lg h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>إضافة ملف مواطن</span>
              <span className="font-code-sm text-code-sm opacity-70">F2</span>
            </button>
          </div>
        </section>

        {/* المؤشرات */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {[
            {
              label: 'الملفات المسجلة النشطة',
              value: nf.format(stats?.activeFiles ?? 0),
              unit: 'ملف',
              icon: 'folder_shared',
              hint:
                (stats?.activeFiles ?? 0) === 0
                  ? 'لم يُسجَّل أي مواطن بعد'
                  : `${nf.format(stats?.verifiedFiles ?? 0)} موثّق رسميًا`
            },
            {
              label: 'المستمسكات المؤرشفة',
              value: nf.format(stats?.attachments ?? 0),
              unit: 'مستمسك',
              icon: 'inventory_2',
              hint:
                (stats?.attachments ?? 0) === 0
                  ? 'لم يُمسح أي مستمسك بعد'
                  : 'ممسوحة ومحفوظة محليًا'
            },
            {
              label: 'دقة استخراج النصوص OCR',
              value: stats?.ocrAccuracy === null || stats?.ocrAccuracy === undefined
                ? '—'
                : `${(stats.ocrAccuracy * 100).toFixed(1)}%`,
              unit: '',
              icon: 'document_scanner',
              hint: stats?.ocrAccuracy == null ? 'تُقاس بعد أول مسح ضوئي' : 'متوسط الملفات الممسوحة'
            },
            {
              label: 'الكتب الصادرة هذا الشهر',
              value: nf.format(stats?.issuedThisMonth ?? 0),
              unit: 'كتاب',
              icon: 'history_edu',
              hint:
                (stats?.issuedThisMonth ?? 0) === 0
                  ? 'لم يصدر أي كتاب هذا الشهر'
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
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {card.unit}
                    </span>
                  )}
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
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-space-md items-start">
          {/* ملف المواطن */}
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] p-space-md flex flex-col gap-space-md">
            {detail === null ? (
              <div className="py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[44px]">badge</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  لم يُفتح أي ملف
                </span>
                <span className="font-label-md text-label-md">
                  أضف ملف مواطن أو اختر واحدًا من الدليل على اليسار
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-space-md">
                  <div className="flex items-center gap-space-md">
                    <div className="w-16 h-20 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center">
                      {detail.photo_path ? (
                        <img
                          alt=""
                          className="w-full h-full object-cover"
                          src={storeUrl(detail.photo_path as string)}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                          person
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-space-xs">
                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {field('full_name')}
                      </h3>
                      <div className="flex items-center gap-space-xs">
                        {detail.verified === 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-secondary font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            موثّق ومعتمد رسميًا
                          </span>
                        )}
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                          {field('employee_code')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>إدراج في محرر الكتب</span>
                    <span className="font-code-sm text-code-sm opacity-70">Ctrl+Enter</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-space-sm">
                  {[
                    ['الرقم الوطني الموحد', 'national_id'],
                    ['العنوان الوظيفي والدرجة', 'job_title'],
                    ['دائرة الانتساب الرسمية', 'enrollment_dept'],
                    ['تاريخ ومحل الولادة', 'birth_date'],
                    ['رقم بطاقة السكن', 'housing_card_no'],
                    ['المحلة والزقاق والدار', 'address'],
                    ['أقرب نقطة دالة', 'landmark'],
                    ['رقم هاتف الاتصال', 'phone']
                  ].map(([label, key]) => (
                    <div
                      key={key}
                      className="rounded-lg bg-surface-container-low p-space-sm flex flex-col gap-space-xs"
                    >
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {label}
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        {field(key as string)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* خزنة المستمسكات */}
                <div className="flex flex-col gap-space-sm pt-space-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h4 className="font-headline-sm text-headline-sm text-on-surface">
                        خزنة المستمسكات الرسمية الممسوحة ضوئياً
                      </h4>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {attachments.length === 0
                          ? 'لا مستمسكات لهذا الملف'
                          : `${nf.format(attachments.length)} وثائق مؤرشفة`}
                      </span>
                    </div>
                    <button
                      className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">scanner</span>
                      <span>مسح ضوئي فوري</span>
                    </button>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="py-space-lg rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                      <span className="font-label-md text-label-md">
                        امسح المستمسك ضوئيًا أو استورده من الحاسوب
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
                      {attachments.map((a) => (
                        <div
                          key={String(a.id)}
                          className="rounded-lg bg-surface-container-low overflow-hidden flex flex-col"
                        >
                          <img
                            alt=""
                            className="w-full aspect-[1.6/1] object-cover bg-surface-container-high"
                            src={storeUrl(a.filePath as string)}
                          />
                          <div className="p-space-sm flex flex-col gap-space-xs">
                            <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                              {String(a.docType)}
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              {a.fileFormat ? String(a.fileFormat) : ''}
                              {a.dpi ? ` · DPI ${String(a.dpi)}` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* دليل المواطنين */}
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  contacts
                </span>
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
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="ابحث بالاسم أو الرقم الوطني..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
              <button
                className={
                  active === null
                    ? 'px-space-sm py-1 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shrink-0'
                    : 'px-space-sm py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm shrink-0'
                }
                type="button"
                onClick={() => setActive(null)}
              >
                الكل ({nf.format(stats?.activeFiles ?? 0)})
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  className={
                    active === c.name
                      ? 'px-space-sm py-1 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shrink-0'
                      : 'px-space-sm py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm shrink-0'
                  }
                  type="button"
                  onClick={() => setActive(c.name)}
                >
                  {c.name} ({nf.format(c.count)})
                </button>
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
              <div className="flex flex-col gap-space-xs max-h-[520px] overflow-y-auto">
                {items.map((c) => (
                  <button
                    key={c.id}
                    className={
                      c.id === selectedId
                        ? 'text-right rounded-lg p-space-sm bg-surface-container-high border-r-2 border-secondary transition-colors'
                        : 'text-right rounded-lg p-space-sm hover:bg-surface-container-low transition-colors'
                    }
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center shrink-0">
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
        </div>
      </div>
    </main>
  );
}
