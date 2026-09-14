/**
 * سجل المعاملات والأرشيف — data-path="transactions-archive-ledger"
 *
 * مبنيّة على العلامات المنقولة من stitch_/_1/code.html بأصنافها كما هي،
 * لكن كل رقم وكل صفّ يأتي من قاعدة البيانات. المنظومة تبدأ فارغة،
 * فالحالة الطبيعية أول يوم هي: أصفار وجدول خالٍ برسالة تشرح ما يملؤه.
 */
import { useEffect, useState } from 'react';
import type { ArchiveStats, DocumentRow } from '@shared/api';

const COLUMNS = [
  'رقم الصادر',
  'المواطن والمستمسك',
  'الوثيقة الرسمية',
  'الجهة الموجه إليها',
  'التوقيت والنسخ',
  'الرسوم'
];

const nf = new Intl.NumberFormat('en-US');

/** نسبة التغيّر عن الأمس — تُخفى ما لم يكن للأمس رصيد يُقارن به. */
function changeVsYesterday(today: number, yesterday: number): string | null {
  if (yesterday === 0) return null;
  const pct = ((today - yesterday) / yesterday) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export default function ArchiveScreen() {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inspected, setInspected] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, r] = await Promise.all([window.diwan.archive.stats(), window.diwan.archive.today()]);
      setStats(s);
      setRows(r);
      setInspected(r[0]?.id ?? null);
    })();
  }, []);

  const change = stats ? changeVsYesterday(stats.issuedToday, stats.issuedYesterday) : null;
  const allChecked = rows.length > 0 && selected.size === rows.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* شريط المؤشرات */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md flex items-center justify-between relative overflow-hidden group">
            <div className="flex flex-col gap-space-xs z-10">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
                الكتب الصادرة اليوم
              </span>
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight tabular">
                  {nf.format(stats?.issuedToday ?? 0)}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  وثيقة رسمية
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {change ? (
                  <>
                    <span className="material-symbols-outlined text-secondary text-[16px]">
                      trending_up
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary font-bold">
                      {change}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      مقارنة بالأمس
                    </span>
                  </>
                ) : (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    لا يوجد رصيد أمس للمقارنة
                  </span>
                )}
              </div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container z-10 shadow-sm">
              <span className="material-symbols-outlined text-[28px]">article</span>
            </div>
            <svg
              className="absolute left-0 bottom-0 opacity-15 w-28 h-16 pointer-events-none text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 100 50"
            >
              <path d="M0 45 Q 25 10 50 35 T 100 15" strokeLinecap="round" strokeWidth="4" />
            </svg>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md flex items-center justify-between relative overflow-hidden group">
            <div className="flex flex-col gap-space-xs z-10">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
                الإيراد المالي المستوفى
              </span>
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight tabular">
                  {nf.format(stats?.revenueToday ?? 0)}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
                  د.ع
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-secondary text-[16px]">
                  payments
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {stats && stats.revenueToday > 0
                    ? 'تم تدقيق الجباية النقدية'
                    : 'لم تُستوفَ رسوم بعد'}
                </span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container z-10 shadow-sm">
              <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md flex items-center justify-between relative overflow-hidden">
            <div className="flex flex-col gap-space-xs z-10 max-w-[65%]">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
                النموذج الأكثر طلباً
              </span>
              <span className="font-headline-md text-headline-md text-on-surface truncate font-bold">
                {stats?.topTemplate?.title ?? '—'}
              </span>
              <div className="flex items-center gap-space-xs mt-1">
                {stats?.topTemplate ? (
                  <>
                    <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-secondary font-bold">
                      {nf.format(stats.topTemplate.count)} معاملة
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      ({Math.round(stats.topTemplate.share * 100)}% من المجموع)
                    </span>
                  </>
                ) : (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    لم يصدر أي كتاب اليوم
                  </span>
                )}
              </div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container z-10 shadow-sm">
              <span className="material-symbols-outlined text-[28px]">stars</span>
            </div>
          </div>

          {/* مستلزمات الطباعة — تُقاس من الطابعة لا من تخمين، فتبقى صامتة حتى تُربط */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md flex flex-col justify-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
              مؤشر رصيد مستلزمات الطباعة
            </span>
            <div className="flex items-center gap-space-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">print_disabled</span>
              <span className="font-label-md text-label-md">لم تُربط طابعة بعد</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              اخترها من إعدادات الطباعة ليظهر الحبر والورق
            </span>
          </div>
        </section>

        {/* شريط الأوامر */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm flex-1">
            <div className="relative flex-1 max-w-xl">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                filter_alt
              </span>
              <input
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="ابحث برقم الصادر، اسم المواطن، البطاقة الوطنية، أو الجهة..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md transition-all disabled:opacity-40"
              type="button"
              disabled={selected.size === 0}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>طباعة المحددة دفعة واحدة</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
                {selected.size}
              </span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>تقرير إحصائي Excel</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">backup</span>
              <span>نسخ احتياطي فوري</span>
            </button>
          </div>
        </section>

        {/* السجل */}
        <section className="bg-surface-container-lowest rounded-xl shadow-md overflow-hidden">
          <div className="p-space-md flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                سجل الصادر اليومي المعتمد
              </h3>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                {nf.format(rows.length)} سجل موثق
              </span>
            </div>
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-sm text-label-sm">تحديث أرشيف حي (محلي)</span>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider select-none">
                  <th className="p-space-md w-12 text-center">
                    <input
                      className="rounded text-secondary focus:ring-0 cursor-pointer w-4 h-4 accent-secondary"
                      type="checkbox"
                      checked={allChecked}
                      disabled={rows.length === 0}
                      onChange={() =>
                        setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
                      }
                    />
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c} className="p-space-md font-bold">
                      {c}
                    </th>
                  ))}
                  <th className="p-space-md font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface divide-y-0">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2}>
                      <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[40px]">inbox</span>
                        <span className="font-body-md text-body-md">
                          لم يصدر أي كتاب اليوم
                        </span>
                        <span className="font-label-sm text-label-sm">
                          كل كتاب تطبعه من المحرر يُسجَّل هنا برقم صادر وبصمة توثيق
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.id === inspected
                          ? 'bg-surface-container-highest/60 hover:bg-surface-container-high transition-colors cursor-pointer group'
                          : 'hover:bg-surface-container-high transition-colors cursor-pointer group'
                      }
                      onClick={() => setInspected(row.id)}
                    >
                      <td className="p-space-md text-center">
                        <input
                          className="rounded text-secondary focus:ring-0 cursor-pointer w-4 h-4 accent-secondary"
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-space-md font-mono">
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-1 rounded bg-surface-container font-bold text-secondary text-label-md">
                            {row.serial}
                          </span>
                          <button
                            className="p-1 text-on-surface-variant hover:text-on-surface rounded"
                            title="نسخ رقم الصادر"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(row.serial);
                            }}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              content_copy
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface text-label-lg">
                            {row.citizenName || '—'}
                          </span>
                          {row.nationalId && (
                            <span className="font-mono text-label-sm text-on-surface-variant">
                              وطنية: {row.nationalId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-space-md">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-semibold text-label-sm text-on-surface">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          {row.docType ?? '—'}
                        </span>
                      </td>
                      <td className="p-space-md font-medium text-on-surface">
                        {row.destination ?? '—'}
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-mono text-label-sm text-on-surface font-semibold">
                            {row.issuedTime}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {row.copies === 1 ? 'نسخة واحدة' : `${nf.format(row.copies)} نسخ`}
                          </span>
                        </div>
                      </td>
                      <td className="p-space-md font-mono font-bold text-on-surface">
                        {nf.format(row.fee)} د.ع
                      </td>
                      <td className="p-space-md text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-secondary hover:text-on-secondary text-on-surface flex items-center justify-center transition-all shadow-sm"
                            title="إعادة طباعة طبق الأصل"
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-all"
                            title="تعديل المتغيرات السريعة"
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit_square
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-space-md flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>
              عرض السجلات {rows.length === 0 ? 0 : 1} - {rows.length} من أصل{' '}
              {nf.format(rows.length)} معاملة مسجلة
            </span>
            <div className="flex items-center gap-space-sm">
              <span className="font-mono">Ctrl+P طباعة فورية</span>
              <span className="font-mono">Ctrl+F بحث سريع</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
