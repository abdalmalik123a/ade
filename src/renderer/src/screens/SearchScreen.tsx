/**
 * البحث والتقارير الدورية — data-path="administrative-archive-search"
 *
 * لا يوجد لها تصميم Stitch. صُمّمت بنفس اللغة البصرية:
 * صفّ بطاقات مؤشرات كما في شاشة الأرشيف، ثم شريط مرشّحات، ثم جدول بترويسة لاصقة
 * وتخطيط حمار وحشي — وهي مواصفة «Document Archive Tables» في DESIGN.md حرفيًا.
 */
import { useState } from 'react';

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'year', label: 'هذه السنة' },
  { value: 'custom', label: 'مدة مخصّصة' }
];

const COLUMNS = [
  'رقم الصادر',
  'المواطن والمستمسك',
  'الوثيقة الرسمية',
  'الجهة الموجه إليها',
  'التوقيت والنسخ',
  'الرسوم'
];

export default function SearchScreen() {
  const [period, setPeriod] = useState<Period>('today');
  const [query, setQuery] = useState('');

  const stats = [
    { icon: 'inventory_2', label: 'الكتب الصادرة', value: '0', unit: 'وثيقة رسمية' },
    { icon: 'payments', label: 'الإيراد المالي المستوفى', value: '0', unit: 'د.ع' },
    { icon: 'groups', label: 'المواطنون المخدومون', value: '0', unit: 'مواطن' },
    { icon: 'print', label: 'النسخ المطبوعة', value: '0', unit: 'نسخة' }
  ];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg space-y-space-md">
        {/* بطاقات المؤشرات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between"
            >
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {s.label}
                </span>
                <span className="font-headline-xl text-headline-xl text-on-surface tabular">
                  {s.value}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">{s.unit}</span>
              </div>
              <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[24px]">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* شريط المرشّحات */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[20px]">
              manage_search
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              البحث في الأرشيف الإداري
            </h3>
          </div>

          <div className="flex flex-col lg:flex-row gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="ابحث برقم الصادر، اسم المواطن، البطاقة الوطنية، أو الجهة..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-space-xs flex-wrap">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  className={
                    period === p.value
                      ? 'px-space-md h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all'
                      : 'px-space-md h-10 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md transition-all'
                  }
                  type="button"
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-space-sm pt-space-xs">
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>تقرير إحصائي Excel</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>

        {/* جدول النتائج */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-space-md py-space-md flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">نتائج البحث</h3>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
              0 سجل
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="sticky top-0 bg-surface-container-low">
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c}
                      className="px-space-md py-space-sm font-label-sm text-label-sm text-on-surface-variant font-semibold whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[40px]">search_off</span>
                      <span className="font-body-md text-body-md">الأرشيف فارغ</span>
                      <span className="font-label-sm text-label-sm">
                        ستظهر هنا كل الكتب فور إصدارها من المحرر
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
