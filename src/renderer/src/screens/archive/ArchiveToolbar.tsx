/**
 * المدّة والبحث والأوامر في الأرشيف: خانة البحث، والمدد، وأرقام المدّة، وطباعة المحدّدة والتصدير والنسخة الاحتياطية، وتوزيع الكتب
 * حسب نوعها (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `ArchiveScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { PERIODS, nf, type Period } from './shared';
import type { PeriodStats, DocumentRow } from '@shared/api';

type Props = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  period: Period;
  setPeriod: Dispatch<SetStateAction<Period>>;
  customFrom: string;
  setCustomFrom: Dispatch<SetStateAction<string>>;
  customTo: string;
  setCustomTo: Dispatch<SetStateAction<string>>;
  label: string;
  stats: PeriodStats | null;
  searching: boolean;
  selected: Set<number>;
  busy: string | null;
  reprint: (ids: number[]) => Promise<void>;
  rows: DocumentRow[];
  exportReport: () => Promise<void>;
  setBackupOpen: Dispatch<SetStateAction<boolean>>;
};

export default function ArchiveToolbar({ query, setQuery, period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, label, stats, searching, selected, busy, reprint, rows, exportReport, setBackupOpen }: Props) {
  return (
    <section className="surface-panel p-space-md flex flex-col gap-space-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-space-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            className="input-field w-full h-10 pr-10 pl-3 text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm"
            data-archive-search=""
            placeholder="ابحث برقم الصادر، الاسم، الرقم الوطني، الجهة، أو كلمة من المتن..."
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-card">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`h-8 px-space-sm rounded font-label-sm text-label-sm transition-colors ${
                period === p.value
                  ? 'bg-primary-fixed text-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              data-period={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-space-sm">
          <label className="font-label-sm text-label-sm text-on-surface-variant">من</label>
          <input
            className="input-field h-9 px-3 text-on-surface font-label-md text-label-md"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <label className="font-label-sm text-label-sm text-on-surface-variant">إلى</label>
          <input
            className="input-field h-9 px-3 text-on-surface font-label-md text-label-md"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        {/* أرقام المدّة: الكتب والمخدومون والنسخ — سطرٌ واحد */}
        <span className="font-label-md text-label-md text-on-surface" data-period-stats="">
          {label}: <b className="tabular">{nf.format(stats?.issued ?? 0)}</b> من الكتب الصادرة ·{' '}
          <b className="tabular">{nf.format(stats?.citizens ?? 0)}</b> مخدومًا ·{' '}
          <b className="tabular">{nf.format(stats?.printedCopies ?? 0)}</b> من النسخ المطبوعة
          {searching && (
            <span className="ms-space-sm text-secondary font-semibold" data-search-all="">
              · البحث في السجلّ كلّه — امسح البحث لتعود إلى «{label}»
            </span>
          )}
        </span>
        <div className="flex items-center gap-space-xs flex-wrap">
          <button
            className="flex items-center gap-space-xs px-space-md h-9 btn-act font-label-md text-label-md disabled:opacity-40"
            data-act="print-selected"
            type="button"
            disabled={selected.size === 0 || busy !== null}
            onClick={() => void reprint([...selected])}
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {busy === 'print' ? 'يطبع...' : `طباعة المحددة (${nf.format(selected.size)})`}
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40"
            type="button"
            disabled={busy !== null || rows.length === 0}
            onClick={() => void exportReport()}
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            {busy === 'excel' ? 'يُصدَّر...' : 'تصدير التقرير Excel'}
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40"
            type="button"
            disabled={busy !== null}
            onClick={() => setBackupOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">backup</span>
            نسخة احتياطية…
          </button>
        </div>
      </div>
      {stats && stats.byType.length > 0 && (
        <details className="font-label-sm text-label-sm" data-by-type="">
          <summary className="cursor-pointer text-on-surface-variant select-none">
            توزيع الكتب حسب نوع الوثيقة ({nf.format(stats.byType.length)})
          </summary>
          <div className="mt-space-xs space-y-1">
            {stats.byType.map((t) => (
              <div key={t.name} className="flex items-center gap-space-sm">
                <span className="w-56 truncate text-on-surface">{t.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: `${stats.issued ? Math.round((t.count / stats.issued) * 100) : 0}%` }} />
                </div>
                <span className="w-20 text-left tabular text-on-surface-variant">{nf.format(t.count)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
