/**
 * البحث والتقارير الدورية — data-path="administrative-archive-search"
 *
 * لا يوجد لها تصميم Stitch. صُمّمت بنفس اللغة البصرية:
 * صفّ بطاقات مؤشرات كما في شاشة الأرشيف، ثم شريط مرشّحات، ثم جدول بترويسة لاصقة
 * وتخطيط حمار وحشي — وهي مواصفة «Document Archive Tables» في DESIGN.md حرفيًا.
 *
 * الفرق عن شاشة الأرشيف: تلك سجلّ اليوم الجاري، وهذه تفتّش المدد كلها وتُخرج
 * تقريرًا. والبحث متساهل مع الهمزة: «احمد» تجد «أحمد» لأن الصورة المطبَّعة
 * تُخزَّن مع كل كتاب وقت إصداره.
 */
import { useCallback, useEffect, useState } from 'react';
import type { DocumentRow, PeriodStats } from '@shared/api';
import { errorText } from '../lib/errors';

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
  'التوقيت والنسخ'
];

const nf = new Intl.NumberFormat('en-US');

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** حدود المدة. الأسبوع يبدأ بالسبت — أوّل أيام الدوام الرسمي. */
function rangeOf(period: Period, from: string, to: string): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 1) % 7));
      return { from: iso(start), to: today };
    }
    case 'month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today };
    case 'custom':
      return { from, to };
  }
}

export default function SearchScreen({ query: initialQuery = '' }: { query?: string }) {
  const [period, setPeriod] = useState<Period>('today');
  const [query, setQuery] = useState(initialQuery);
  const [customFrom, setCustomFrom] = useState(iso(new Date()));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const range = rangeOf(period, customFrom, customTo);
  const label = PERIODS.find((p) => p.value === period)?.label ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        window.diwan.documents.list({ from: range.from, to: range.to, query }),
        window.diwan.documents.stats({ from: range.from, to: range.to })
      ]);
      setRows(r);
      setStats(s);
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة السجل'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function exportReport() {
    setBusy(true);
    setError(null);
    try {
      const result = await window.diwan.documents.exportReport({
        from: range.from,
        to: range.to,
        query,
        title: `${label} (${range.from} ← ${range.to})`
      });
      if (result) setToast(`حُفظ التقرير (${nf.format(result.count)} سجلًا): ${result.path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر تصدير التقرير'));
    } finally {
      setBusy(false);
    }
  }

  async function savePdf(id: number) {
    setBusy(true);
    try {
      const path = await window.diwan.documents.exportPdf(id);
      if (path) setToast(`حُفظ PDF: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الملف'));
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    {
      icon: 'inventory_2',
      label: 'الكتب الصادرة',
      value: nf.format(stats?.issued ?? 0),
      unit: 'وثيقة رسمية'
    },
    {
      icon: 'groups',
      label: 'المواطنون المخدومون',
      value: nf.format(stats?.citizens ?? 0),
      unit: 'مواطن'
    },
    {
      icon: 'print',
      label: 'النسخ المطبوعة',
      value: nf.format(stats?.printedCopies ?? 0),
      unit: 'نسخة'
    }
  ];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg space-y-space-md">
        {/* بطاقات المؤشرات */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          {cards.map((s) => (
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

        {(error || toast) && (
          <div
            className={`flex items-start gap-space-xs p-space-sm rounded-lg font-label-md text-label-md ${
              error
                ? 'bg-error-container text-on-error-container'
                : 'bg-secondary-fixed text-on-secondary-fixed'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">
              {error ? 'error' : 'check_circle'}
            </span>
            <span className="flex-1 break-all">{error ?? toast}</span>
            <button
              className="material-symbols-outlined text-[16px]"
              type="button"
              onClick={() => (error ? setError(null) : setToast(null))}
            >
              close
            </button>
          </div>
        )}

        {/* شريط المرشّحات */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="ابحث برقم الصادر، الاسم، البطاقة الوطنية، الجهة، أو كلمة من المتن..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  className={`h-8 px-space-sm rounded font-label-sm text-label-sm transition-colors ${
                    period === p.value
                      ? 'bg-primary-container text-on-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md flex items-center gap-space-xs disabled:opacity-40"
              type="button"
              disabled={busy || rows.length === 0}
              onClick={() => void exportReport()}
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>{busy ? 'يُصدَّر...' : 'تصدير التقرير Excel'}</span>
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-space-sm">
              <label className="font-label-sm text-label-sm text-on-surface-variant">من</label>
              <input
                className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <label className="font-label-sm text-label-sm text-on-surface-variant">إلى</label>
              <input
                className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          <div className="font-label-sm text-label-sm text-on-surface-variant">
            المدة المعروضة: {range.from} ← {range.to}
            {query && <> · البحث: «{query}»</>}
          </div>
        </div>

        {/* توزيع حسب نوع الوثيقة — الخلاصة التي يبدأ بها التقرير الدوري */}
        {stats && stats.byType.length > 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
              توزيع الكتب حسب نوع الوثيقة
            </h3>
            <div className="space-y-space-xs">
              {stats.byType.map((t) => (
                <div key={t.name} className="flex items-center gap-space-sm">
                  <span className="font-label-md text-label-md text-on-surface w-56 truncate">
                    {t.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-secondary"
                      style={{
                        width: `${stats.issued ? Math.round((t.count / stats.issued) * 100) : 0}%`
                      }}
                    />
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant tabular w-24 text-left">
                    {nf.format(t.count)} كتاب
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الجدول */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-space-md flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">نتائج البحث</h3>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
              {nf.format(rows.length)} سجل
            </span>
          </div>

          <div className="overflow-x-auto w-full max-h-[60vh]">
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm tracking-wider select-none">
                  <th className="p-space-md font-bold">التاريخ</th>
                  {COLUMNS.map((c) => (
                    <th key={c} className="p-space-md font-bold">
                      {c}
                    </th>
                  ))}
                  <th className="p-space-md font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2}>
                      <div className="py-space-xl text-center text-on-surface-variant font-label-md text-label-md">
                        جارٍ البحث...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2}>
                      <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[40px]">manage_search</span>
                        <span className="font-body-md text-body-md">
                          {query ? 'لا كتاب يطابق هذا البحث في المدة المختارة' : 'لا كتب في المدة المختارة'}
                        </span>
                        <span className="font-label-sm text-label-sm">
                          كل كتاب يصدر من المحرر يظهر هنا ويدخل في التقارير
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`${
                        i % 2 === 1 ? 'bg-surface-container-low/40' : ''
                      } hover:bg-surface-container-high transition-colors`}
                    >
                      <td className="p-space-md font-mono text-label-sm text-on-surface-variant">
                        {row.issuedDate}
                      </td>
                      <td className="p-space-md font-mono">
                        <span className="px-2 py-1 rounded bg-surface-container font-bold text-secondary text-label-md">
                          {row.serial}
                        </span>
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
                      <td className="p-space-md text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-secondary hover:text-on-secondary text-on-surface flex items-center justify-center transition-all disabled:opacity-40"
                            title="حفظ نسخة PDF"
                            type="button"
                            disabled={busy}
                            onClick={() => void savePdf(row.id)}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              picture_as_pdf
                            </span>
                          </button>
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-secondary hover:text-on-secondary text-on-surface flex items-center justify-center transition-all disabled:opacity-40"
                            title="إعادة طباعة طبق الأصل"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setBusy(true);
                              void window.diwan.documents
                                .reprint([row.id], 1)
                                .then((r) =>
                                  setToast(
                                    r.printed > 0
                                      ? `أُعيدت طباعة ${row.serial}`
                                      : 'تعذّرت إعادة الطباعة'
                                  )
                                )
                                .finally(() => setBusy(false));
                            }}
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {stats && stats.byDay.length > 0 && (
            <div className="p-space-md border-t border-outline-variant flex flex-wrap items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">أيام المدة:</span>
              {stats.byDay.slice(0, 10).map((d) => (
                <span key={d.day} className="font-mono">
                  {d.day}: {nf.format(d.count)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
