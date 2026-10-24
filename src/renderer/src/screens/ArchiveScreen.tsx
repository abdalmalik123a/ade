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
import { weekStart, isoDate } from '@shared/dates';
import { LIST_LIMITS, limitNote } from '@shared/limits';
import type { ArchiveStats, AuditEntry, DocumentDetail, DocumentRow, PeriodStats, SearchHits } from '@shared/api';
import { errorText } from '../lib/errors';
import { choosePrinter } from '../lib/printChoice';
import { confirmAction } from '../kit/ask';
import BackupDialog from '../components/BackupDialog';
import { count, countIn, toIndic } from '@shared/arabic';
import { type Period, PERIODS, nf } from './archive/shared';
import ArchiveToolbar from './archive/ArchiveToolbar';
import SearchOthers from './archive/SearchOthers';
import DocumentInspect from './archive/DocumentInspect';
import DocumentsTable from './archive/DocumentsTable';

/** فوق هذا العدد من الكتب تسأل «طباعة المحدّدة» قبل أن تُرسلها كلّها إلى الطابعة. */
const BULK_PRINT_CONFIRM = 10;

/** حدود المدة. الأسبوع يبدأ بالسبت (`weekStart`) — كالملخّص الأسبوعي في «التنبيهات». */
function rangeOf(period: Period, from: string, to: string): { from: string | null; to: string | null } {
  const now = new Date();
  const today = isoDate(now);
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: isoDate(weekStart(now)), to: today };
    case 'month':
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'year':
      return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: today };
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return { from: from || null, to: to || null };
  }
}

/** طلب مدّةٍ من خارج الشاشة — ملخّص الأسبوع في «التنبيهات» يفتح «هذا الأسبوع». ويُنفَّذ مرّةً لكلّ مفتاح. */
let periodRequestSeen = 0;

type Props = {
  /** ما كُتب في البحث الشامل — يصل هنا فيُبحث في الأرشيف كلّه. */
  query?: string;
  request?: { key: number; period: Period } | null;
  onOpenInEditor?: (documentId: number) => void;
  onOpenCitizen?: (citizenId: number) => void;
  onOpenTemplate?: (templateId: number) => void;
  onChanged?: () => void;
};

export default function ArchiveScreen({ query: globalQuery = '', request = null, onOpenInEditor, onOpenCitizen, onOpenTemplate, onChanged }: Props) {
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
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    setQuery(globalQuery);
    if (globalQuery.trim()) setPeriod('all');
  }, [globalQuery]);

  useEffect(() => {
    if (!request || request.key === periodRequestSeen) return;
    periodRequestSeen = request.key;
    setQuery('');
    setPeriod(request.period);
  }, [request?.key]);

  const range = rangeOf(period, customFrom, customTo);
  const label = PERIODS.find((p) => p.value === period)?.label ?? '';
  // ما دام في خانة البحث نصّ يُبحث في السجلّ كلّه (د١١): من يكتب رقمًا أو اسمًا يطلب كتابًا قد صدر قبل
  // سنة، وكان أوّل بحثٍ من السكّة يفشل لأنّ الفترة «اليوم». ومسح النصّ يعيد الفترة. وأرقام المدّة تبقى للفترة.
  const searching = query.trim() !== '';

  const load = useCallback(async () => {
    try {
      const [t, s, list] = await Promise.all([
        window.diwan.archive.stats(),
        window.diwan.documents.stats({ from: range.from, to: range.to }),
        window.diwan.documents.list(searching ? { from: null, to: null, query } : { from: range.from, to: range.to, query })
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
  /** القائمة بلغت حدّها: يُقال ذلك تحتها لا يُظنّ أنها كلّ ما في الأرشيف. */
  const capNote = limitNote(rows.length, LIST_LIMITS.documents, 'كتاب', 'الأحدث أوّلًا؛ ضيّق المدّة أو ابحث بالاسم أو الرقم لترى غيرها');
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

  const reprint = async (ids: number[]) => {
    // «المحدّدة» حتى خمسمئة كتاب بنقرة (ج٢): فوق عشرة يُسأل، وتُقيَّد طبعاتها في السجلّ.
    if (ids.length > BULK_PRINT_CONFIRM) {
      const ok = await confirmAction({
        title: `طباعة ${countIn(ids.length, 'كتاب')}؟`,
        message: 'تُرسل كلّها إلى الطابعة، وتُقيَّد طبعاتها في السجلّ.',
        confirm: 'اطبعها'
      });
      if (!ok) return;
    }
    const pick = await choosePrinter('documents');
    if (!pick) return;
    await run('print', async () => {
      const r = await window.diwan.documents.reprint(ids, 1, pick.printer);
      const parts = [`أُعيدت طباعة ${nf.format(r.printed)}`];
      if (r.voided) parts.push(`وتُرك ${nf.format(r.voided)} مُبطَلًا لا يُطبع`);
      if (r.failed) parts.push(`وتعذّر ${nf.format(r.failed)}`);
      setToast(parts.join(' — '));
      void loadDetail(inspected);
      onChanged?.();
    });
  };

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

  /** النسخة الاحتياطية بحوارها — بكلمة مرورٍ إن شاء المكتب (خطة Production، ٤٫١). */
  const [backupOpen, setBackupOpen] = useState(false);

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
    const parts = [`اليوم ${count(today.issuedToday, 'كتاب')}`, `أمس ${count(today.issuedYesterday, 'كتاب')}`];
    if (today.topTemplate) parts.push(`الأكثر: ${today.topTemplate.title} (${toIndic(today.topTemplate.count)})`);
    return parts.join(' · ');
  }, [today]);

  const others = hits && (hits.citizens.length || hits.templates.length || hits.attachments.length);

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-archive="">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* الأرقام سطرٌ يُقرأ — لا بطاقاتٌ تُتأمَّل */}
        <header className="flex flex-wrap items-baseline justify-between gap-space-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">الصادر</h1>
          <span className="font-label-md text-label-md text-on-surface-variant" data-archive-today="">
            {summary}
          </span>
        </header>

        {(error || toast) && (
          <div
            className={`flex items-start gap-space-xs p-space-sm rounded-card font-label-md text-label-md ${
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
        <ArchiveToolbar
          query={query}
          setQuery={setQuery}
          period={period}
          setPeriod={setPeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          label={label}
          stats={stats}
          searching={searching}
          selected={selected}
          busy={busy}
          reprint={reprint}
          rows={rows}
          exportReport={exportReport}
          setBackupOpen={setBackupOpen}
        />

        {/* البحث الشامل: ما ليس كتابًا */}
        {others ? (
          <SearchOthers
            hits={hits}
            onOpenCitizen={onOpenCitizen}
            onOpenTemplate={onOpenTemplate}
          />
        ) : null}

        {/* الكتب */}
        <section className="surface-panel overflow-hidden">
          <div className="p-space-md flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{query.trim() ? 'نتائج البحث' : 'كلّ الكتب'}</h3>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
              {count(rows.length, 'كتاب')}
            </span>
          </div>
          {capNote && (
            <p className="mx-space-md mb-space-sm font-label-sm text-label-sm text-on-surface-variant" data-list-limit="">
              {capNote}
            </p>
          )}

          {/* تدقيق الكتاب المحدَّد: بصمته، وما طُبع منه، وتاريخه في السجلّ — وإبطاله */}
          {detail && (
            <DocumentInspect
              detail={detail}
              busy={busy}
              savePdf={savePdf}
              setVoidOpen={setVoidOpen}
              voidOpen={voidOpen}
              voidReason={voidReason}
              setVoidReason={setVoidReason}
              voidDoc={voidDoc}
              history={history}
            />
          )}

          <DocumentsTable
            allChecked={allChecked}
            rows={rows}
            setSelected={setSelected}
            query={query}
            period={period}
            inspected={inspected}
            setInspected={setInspected}
            selected={selected}
            toggle={toggle}
            setToast={setToast}
            busy={busy}
            reprint={reprint}
            onOpenInEditor={onOpenInEditor}
          />
        </section>
      </div>
      {backupOpen && (
        <BackupDialog
          onClose={() => setBackupOpen(false)}
          onDone={(r) => setToast(`حُفظت نسخة احتياطية ${r.encrypted ? 'مشفّرة ' : ''}(${(r.bytes / 1024 / 1024).toFixed(1)} م.ب): ${r.path}`)}
        />
      )}
    </main>
  );
}

