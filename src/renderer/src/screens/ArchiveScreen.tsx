/**
 * الأرشيف والبحث — data-path="transactions-archive-ledger"
 *
 * كانا شاشتين: «سجل المعاملات» لليوم ببطاقتي أرقامٍ كبيرتين، و«البحث والتقارير»
 * للمدد بثلاث بطاقاتٍ أخرى — والجدول نفسه في الاثنتين (د١٠). فصارا شاشةً واحدة:
 * سطرُ أرقامٍ يُقرأ ولا يُتأمَّل، ثم المدّة والبحث، ثم الكتب. والبحث الشامل (Ctrl+F)
 * يصل هنا ويُري معه ما ليس كتابًا: ملفّ المواطن، ونموذجه، ونصَّ مستمسكه (د٢).
 *
 * الكتاب الصادر لا يُعدَّل في مكانه: بصمته تشهد على متنه. «كرّره» يفتح نسخةً منه
 * من حيث كُتب، تصدر برقمٍ جديد، والأصل يبقى كما صدر. وما صدر خطأً **يُبطَل** بسببه
 * (د٣): يبقى برقمه وبصمته ولا يُعاد طبعه.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArchiveStats, AuditEntry, DocumentDetail, DocumentRow, PeriodStats, SearchHits } from '@shared/api';
import { errorText } from '../lib/errors';
import { auditLabel } from '@shared/auditLabels';

const COLUMNS = ['رقم الصادر', 'صاحب العلاقة', 'نوع الكتاب', 'الجهة', 'التاريخ والنسخ'];

const nf = new Intl.NumberFormat('en-US');

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'year', label: 'هذه السنة' },
  { value: 'all', label: 'كامل الأرشيف' },
  { value: 'custom', label: 'مدة مخصّصة' }
];

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** حدود المدة. الأسبوع يبدأ بالسبت — أوّل أيام الدوام الرسمي. */
function rangeOf(period: Period, from: string, to: string): { from: string | null; to: string | null } {
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
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return { from: from || null, to: to || null };
  }
}

type Props = {
  /** ما كُتب في البحث الشامل — يصل هنا فيُبحث في الأرشيف كلّه. */
  query?: string;
  onOpenInEditor?: (documentId: number) => void;
  onOpenCitizen?: (citizenId: number) => void;
  onOpenTemplate?: (templateId: number) => void;
  onChanged?: () => void;
};

export default function ArchiveScreen({ query: globalQuery = '', onOpenInEditor, onOpenCitizen, onOpenTemplate, onChanged }: Props) {
  const [today, setToday] = useState<ArchiveStats | null>(null);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [hits, setHits] = useState<SearchHits | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inspected, setInspected] = useState<number | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState(globalQuery);
  // من البحث الشامل: الأرشيف كلّه — فالمطلوب قد صدر قبل سنة.
  const [period, setPeriod] = useState<Period>(globalQuery.trim() ? 'all' : 'today');
  const [customFrom, setCustomFrom] = useState(iso(new Date()));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    setQuery(globalQuery);
    if (globalQuery.trim()) setPeriod('all');
  }, [globalQuery]);

  const range = rangeOf(period, customFrom, customTo);
  const label = PERIODS.find((p) => p.value === period)?.label ?? '';

  const load = useCallback(async () => {
    try {
      const [t, s, list] = await Promise.all([
        window.diwan.archive.stats(),
        window.diwan.documents.stats({ from: range.from, to: range.to }),
        window.diwan.documents.list({ from: range.from, to: range.to, query })
      ]);
      setToday(t);
      setStats(s);
      setRows(list);
      setSelected((prev) => new Set([...prev].filter((id) => list.some((r) => r.id === id))));
      // أوّل كتابٍ يُفتح للتدقيق — بصمته وما طُبع منه وتاريخه في السجلّ.
      setInspected((cur) => (cur !== null && list.some((r) => r.id === cur) ? cur : (list[0]?.id ?? null)));
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة الأرشيف'));
    }
  }, [range.from, range.to, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  // ما ليس كتابًا: المواطن والنموذج والمستمسك — يظهر حين يُبحث.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => void window.diwan.search.others(q).then(setHits).catch(() => setHits(null)), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const loadDetail = useCallback(async (id: number | null) => {
    if (id === null) {
      setDetail(null);
      setHistory([]);
      return;
    }
    const [d, h] = await Promise.all([window.diwan.documents.get(id), window.diwan.audit.list({ documentId: id })]);
    setDetail(d);
    setHistory(h);
  }, []);

  useEffect(() => {
    setVoidOpen(false);
    setVoidReason('');
    void loadDetail(inspected);
  }, [inspected, loadDetail]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(kind: string, work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setBusy(null);
    }
  }

  const reprint = (ids: number[]) =>
    run('print', async () => {
      const r = await window.diwan.documents.reprint(ids, 1);
      const parts = [`أُعيدت طباعة ${nf.format(r.printed)}`];
      if (r.voided) parts.push(`وتُرك ${nf.format(r.voided)} مُبطَلًا لا يُطبع`);
      if (r.failed) parts.push(`وتعذّر ${nf.format(r.failed)}`);
      setToast(parts.join(' — '));
      void loadDetail(inspected);
      onChanged?.();
    });

  const exportReport = () =>
    run('excel', async () => {
      const result = await window.diwan.documents.exportReport({
        from: range.from,
        to: range.to,
        query,
        title: `${label}${range.from ? ` (${range.from} ← ${range.to})` : ''}`
      });
      if (result) setToast(`حُفظ التقرير (${nf.format(result.count)} سجلًا): ${result.path}`);
    });

  const backup = () =>
    run('backup', async () => {
      const result = await window.diwan.documents.backup();
      if (result) setToast(`حُفظت نسخة احتياطية (${(result.bytes / 1024 / 1024).toFixed(1)} م.ب): ${result.path}`);
    });

  const savePdf = (id: number) =>
    run('pdf', async () => {
      const path = await window.diwan.documents.exportPdf(id);
      if (path) setToast(`حُفظ PDF: ${path}`);
    });

  const voidDoc = (id: number) =>
    run('void', async () => {
      const settings = await window.diwan.settings.get();
      const d = await window.diwan.documents.void(id, voidReason, settings.operatorName || null);
      if (d) setToast(`أُبطل ${d.serial} — يبقى في الأرشيف برقمه وسببه`);
      setVoidOpen(false);
      setVoidReason('');
      await load();
      void loadDetail(id);
      onChanged?.();
    });

  const summary = useMemo(() => {
    if (!today) return '';
    const parts = [`اليوم ${nf.format(today.issuedToday)} كتابًا`, `أمس ${nf.format(today.issuedYesterday)}`];
    if (today.topTemplate) parts.push(`الأكثر: ${today.topTemplate.title} (${nf.format(today.topTemplate.count)})`);
    return parts.join(' · ');
  }, [today]);

  const others = hits && (hits.citizens.length || hits.templates.length || hits.attachments.length);

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-archive="">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* الأرقام سطرٌ يُقرأ — لا بطاقاتٌ تُتأمَّل */}
        <header className="flex flex-wrap items-baseline justify-between gap-space-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">الأرشيف والبحث</h1>
          <span className="font-label-md text-label-md text-on-surface-variant" data-archive-today="">
            الكتب الصادرة اليوم: {summary}
          </span>
        </header>

        {(error || toast) && (
          <div
            className={`flex items-start gap-space-xs p-space-sm rounded-lg font-label-md text-label-md ${
              error ? 'bg-error-container text-on-error-container' : 'bg-secondary-fixed text-on-secondary-fixed'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">{error ? 'error' : 'check_circle'}</span>
            <span className="flex-1 break-all">{error ?? toast}</span>
            <button className="material-symbols-outlined text-[16px]" type="button" onClick={() => (error ? setError(null) : setToast(null))}>
              close
            </button>
          </div>
        )}

        {/* المدّة والبحث والأوامر */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                data-archive-search=""
                placeholder="ابحث برقم الصادر، الاسم، الرقم الوطني، الجهة، أو كلمة من المتن..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-lg">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  className={`h-8 px-space-sm rounded font-label-sm text-label-sm transition-colors ${
                    period === p.value
                      ? 'bg-primary-container text-on-primary font-semibold'
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
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            {/* أرقام المدّة: الكتب والمخدومون والنسخ — سطرٌ واحد */}
            <span className="font-label-md text-label-md text-on-surface" data-period-stats="">
              {label}: <b className="tabular">{nf.format(stats?.issued ?? 0)}</b> من الكتب الصادرة ·{' '}
              <b className="tabular">{nf.format(stats?.citizens ?? 0)}</b> مخدومًا ·{' '}
              <b className="tabular">{nf.format(stats?.printedCopies ?? 0)}</b> من النسخ المطبوعة
            </span>
            <div className="flex items-center gap-space-xs flex-wrap">
              <button
                className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md disabled:opacity-40"
                data-act="print-selected"
                type="button"
                disabled={selected.size === 0 || busy !== null}
                onClick={() => void reprint([...selected])}
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                {busy === 'print' ? 'يطبع...' : `طباعة المحددة (${nf.format(selected.size)})`}
              </button>
              <button
                className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40"
                type="button"
                disabled={busy !== null || rows.length === 0}
                onClick={() => void exportReport()}
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                {busy === 'excel' ? 'يُصدَّر...' : 'تصدير التقرير Excel'}
              </button>
              <button
                className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40"
                type="button"
                disabled={busy !== null}
                onClick={() => void backup()}
              >
                <span className="material-symbols-outlined text-[18px]">backup</span>
                {busy === 'backup' ? 'ينسخ...' : 'نسخ احتياطي فوري'}
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

        {/* البحث الشامل: ما ليس كتابًا */}
        {others ? (
          <section className="grid md:grid-cols-3 gap-space-sm" data-search-others="">
            <HitList title="المواطنون" icon="badge" empty="لا مواطن">
              {hits!.citizens.map((c) => (
                <HitButton key={c.id} act="open-citizen" onClick={() => onOpenCitizen?.(c.id)} title={c.fullName} sub={c.nationalId ?? c.jobTitle ?? ''} />
              ))}
            </HitList>
            <HitList title="النماذج" icon="description" empty="لا نموذج">
              {hits!.templates.map((t) => (
                <HitButton key={t.id} act="open-template" onClick={() => onOpenTemplate?.(t.id)} title={t.title} sub={t.category ?? ''} />
              ))}
            </HitList>
            <HitList title="نصّ المستمسكات" icon="id_card" empty="لا مستمسك">
              {hits!.attachments.map((a) => (
                <HitButton key={a.id} act="open-attachment" onClick={() => onOpenCitizen?.(a.citizenId)} title={`${a.docType} — ${a.citizenName}`} sub={a.snippet} />
              ))}
            </HitList>
          </section>
        ) : null}

        {/* الكتب */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-space-md flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{query.trim() ? 'نتائج البحث' : 'سجل الصادر'}</h3>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
              {nf.format(rows.length)} كتابًا
            </span>
          </div>

          {/* تدقيق الكتاب المحدَّد: بصمته، وما طُبع منه، وتاريخه في السجلّ — وإبطاله */}
          {detail && (
            <div className="mx-space-md mb-space-sm p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs font-label-sm text-label-sm text-on-surface-variant" data-inspect="">
              <div className="flex flex-wrap items-center gap-space-md">
                <span className="flex items-center gap-1 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-secondary">fingerprint</span>
                  {detail.serial}
                </span>
                {detail.status === 'void' && (
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold" data-void-badge="">
                    مُبطَل: {detail.voidReason}
                  </span>
                )}
                <span className="font-mono text-[10px] break-all flex-1" title={detail.sha256}>
                  {detail.sha256}
                </span>
                <span>{nf.format(detail.printedCopies)} نسخة مطبوعة</span>
                {detail.status !== 'void' && (
                  <>
                    <button
                      className="text-secondary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void savePdf(detail.id)}
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      حفظ نسخة PDF
                    </button>
                    <button
                      className="text-error font-semibold hover:underline flex items-center gap-1"
                      data-act="void"
                      type="button"
                      onClick={() => setVoidOpen((o) => !o)}
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      أبطِل
                    </button>
                  </>
                )}
              </div>
              {voidOpen && (
                <div className="flex items-center gap-space-xs flex-wrap" data-void-form="">
                  <span className="text-on-surface">سبب الإبطال — يبقى الكتاب برقمه ولا يُعاد طبعه:</span>
                  <input
                    autoFocus
                    className="flex-1 min-w-[16rem] h-8 px-2 rounded bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-error"
                    data-void-reason=""
                    placeholder="مثال: صدر باسمٍ خاطئ، وأُعيد برقمٍ جديد"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                  />
                  <button
                    className="h-8 px-3 rounded bg-error text-on-error font-semibold disabled:opacity-40"
                    data-act="void-confirm"
                    type="button"
                    disabled={!voidReason.trim() || busy !== null}
                    onClick={() => void voidDoc(detail.id)}
                  >
                    أبطِله
                  </button>
                </div>
              )}
              {history.length > 0 && (
                <div className="flex flex-wrap gap-x-space-md gap-y-0.5" data-history="">
                  {[...history].reverse().map((h) => (
                    <span key={h.id}>
                      {auditLabel(h)} · {h.at.slice(0, 16)}
                      {h.operator ? ` · ${h.operator}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto w-full max-h-[62vh]">
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm select-none">
                  <th className="p-space-md w-12 text-center">
                    <input
                      className="w-4 h-4 accent-secondary cursor-pointer"
                      type="checkbox"
                      checked={allChecked}
                      disabled={rows.length === 0}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(rows.filter((r) => r.status !== 'void').map((r) => r.id)))}
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
              <tbody className="font-body-sm text-body-sm text-on-surface">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2}>
                      <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[40px]">{query ? 'manage_search' : 'inbox'}</span>
                        <span className="font-body-md text-body-md">
                          {query
                            ? period === 'today'
                              ? 'لا كتاب يطابق البحث اليوم'
                              : 'لا كتاب يطابق هذا البحث في المدة المختارة'
                            : period === 'today'
                              ? 'لم يصدر أي كتاب اليوم'
                              : 'لا كتب في المدة المختارة'}
                        </span>
                        <span className="font-label-sm text-label-sm">كل كتابٍ يصدر يُقيَّد هنا برقم صادرٍ وبصمة توثيق</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`${row.id === inspected ? 'bg-surface-container-highest/60' : i % 2 ? 'bg-surface-container-low/40' : ''} ${
                        row.status === 'void' ? 'text-on-surface-variant' : ''
                      } hover:bg-surface-container-high transition-colors cursor-pointer`}
                      data-row-status={row.status}
                      onClick={() => setInspected(row.id)}
                    >
                      <td className="p-space-md text-center">
                        <input
                          className="w-4 h-4 accent-secondary cursor-pointer"
                          type="checkbox"
                          checked={selected.has(row.id)}
                          disabled={row.status === 'void'}
                          onChange={() => toggle(row.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-space-md font-mono">
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-1 rounded bg-surface-container font-bold text-label-md ${row.status === 'void' ? 'line-through' : 'text-secondary'}`}>
                            {row.serial}
                          </span>
                          {row.status === 'void' && (
                            <span className="px-1.5 rounded-full bg-error-container text-on-error-container text-[10px] font-sans font-semibold" title={row.voidReason ?? ''}>
                              مُبطَل
                            </span>
                          )}
                          <button
                            className="p-1 text-on-surface-variant hover:text-on-surface rounded"
                            title="نسخ رقم الصادر"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(row.serial);
                              setToast(`نُسخ ${row.serial} إلى الحافظة`);
                            }}
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-bold text-label-lg">{row.citizenName || '—'}</span>
                          {row.nationalId && <span className="font-mono text-label-sm text-on-surface-variant">وطنية: {row.nationalId}</span>}
                        </div>
                      </td>
                      <td className="p-space-md">{row.docType ?? '—'}</td>
                      <td className="p-space-md">{row.destination ?? '—'}</td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-mono text-label-sm font-semibold">
                            {row.issuedDate} {row.issuedTime}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {row.copies === 1 ? 'نسخة واحدة' : `${nf.format(row.copies)} نسخ`}
                          </span>
                        </div>
                      </td>
                      <td className="p-space-md text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-all disabled:opacity-30"
                            title={row.status === 'void' ? 'مُبطَل — لا يُعاد طبعه' : 'إعادة طباعة طبق الأصل'}
                            type="button"
                            disabled={busy !== null || row.status === 'void'}
                            onClick={(e) => {
                              e.stopPropagation();
                              void reprint([row.id]);
                            }}
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          <button
                            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center transition-all"
                            title="كرّره — نسخةٌ جديدة من حيث كُتب (الشبّاك أو المحرّر)، والأصل يبقى كما صدر"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInEditor?.(row.id);
                            }}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit_square</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function HitList({ title, icon, empty, children }: { title: string; icon: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col gap-1 min-w-0">
      <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
        {title} ({children.length})
      </span>
      {children.length ? children : <span className="font-label-sm text-label-sm text-on-surface-variant py-1">{empty}</span>}
    </div>
  );
}

function HitButton({ act, title, sub, onClick }: { act: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      className="text-right p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col min-w-0"
      data-act={act}
      type="button"
      onClick={onClick}
    >
      <span className="font-label-md text-label-md text-on-surface truncate">{title}</span>
      {sub && <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{sub}</span>}
    </button>
  );
}
