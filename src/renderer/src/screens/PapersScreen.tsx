/**
 * الأسئلة — قسمٌ قائمٌ بذاته، لا فرعٌ من مكتبة الكتب.
 *
 * ورقة الامتحان لا تُبنى كما يُبنى الكتاب: لا كليشة ولا شبّاك ولا رقم صادر،
 * ولا محرّرَ كتلٍ يُدرج فيه المدرّس فقرةً ثم يبحث عن مكانها. فالرأس هنا **ثابت**
 * لا يُحرَّر — تُملأ متغيّراته في خانات، والثابت يبقى ثابتًا. والمتنُ يُركَّب على
 * الترتيب الذي يكتب به المدرّس فعلًا:
 *
 *     سؤالٌ ← درجتُه ← نصُّه ← [+ فرع] ← سؤالٌ ثانٍ ← ...
 *
 * والترقيم يُحسب عند الرسم لا يُكتب، فحذفُ سؤالٍ يعيد ترقيم ما بعده وحده —
 * وهذا أكثر ما يكسر ورقة Word عند كل تعديل.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import type { TemplateSummary } from '@shared/api';
import {
  listScore,
  pageMm,
  type Dir,
  type ListItem,
  type Numerals
} from '@shared/doc';
import { renderDocHtml } from '@shared/docHtml';
import {
  emptyHead,
  examDoc,
  examList,
  newQuestion,
  paperTitle,
  questionsOf,
  splitExamPagesHtml,
  VERSION_KEY,
  versionItems
} from '@shared/examPaper';
import { errorText } from '../lib/errors';
import { ToolHeader } from '../components/ToolFrame';
import SymbolPalette from '../components/SymbolPalette';
import type { OmrSpec } from '@shared/omr';
import { flatten, textOf } from './papersTree';
import { newOmr, type Toast, SHEET_WIDTH } from './papers/shared';
import PaperHead from './papers/PaperHead';
import PaperBody from './papers/PaperBody';
import SavedPapers from './papers/SavedPapers';
import PreviewBar from './papers/PreviewBar';
import PaperOutput from './papers/PaperOutput';
import { usePaperTree } from './papers/usePaperTree';
import { usePaperOutput } from './papers/usePaperOutput';
import { useExamPages } from './papers/examPagination';

// ── الشاشة ───────────────────────────────────────────────────────────

export type PapersScreenProps = {
  onChanged?: () => void;
};

/**
 * ما يناديه الشريط العلوي.
 *
 * أزراره كانت تقفز بالمدرّس إلى محرّر الكتب — يضغط «طباعة» فيجد نفسه في كتابٍ
 * رسمي. فالشاشة تُعرِّف ما تفعله بنفسها، والشريط ينادي المعروض.
 */
export type PapersHandle = {
  print: () => void;
  save: () => void;
  exportPdf: () => void;
};

function PapersScreenInner(
  { onChanged }: PapersScreenProps,
  ref: React.Ref<PapersHandle>
) {
  const [head, setHead] = useState<Record<string, string>>(emptyHead);
  const [items, setItems] = useState<ListItem[]>(() => [newQuestion()]);
  const [pick, setPick] = useState<number | undefined>(undefined);
  const [dir, setDir] = useState<Dir>('rtl');
  const [numerals, setNumerals] = useState<Numerals>('arabic');
  const [answers, setAnswers] = useState(false);
  const [copies, setCopies] = useState(30);
  /** نموذجان «أ» و«ب»: الفروع بترتيبين، والنسخ تتناوب — فلا ينقل الطالب عن جاره. */
  const [versions, setVersions] = useState(false);
  const [showB, setShowB] = useState(false);
  const [duplex, setDuplex] = useState(false);
  const [pageView, setPageView] = useState<number | 'all'>('all');
  const [paperId, setPaperId] = useState<number | null>(null);
  const [omr, setOmr] = useState<OmrSpec>(newOmr);
  const [omrOpen, setOmrOpen] = useState(false);
  /** يزيد مع كل ورقةٍ تُفتح أو تُبدأ — فتُبنى لوحة الدوائر من مفتاح الورقة الجديدة. */
  const [omrEpoch, setOmrEpoch] = useState(0);
  const [papers, setPapers] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [zoom, setZoom] = useState(0.68);

  const sheetRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const toastTimer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadPapers = useCallback(async () => {
    try {
      setPapers(await window.diwan.templates.list(null, 'print-only'));
    } catch (e) {
      // قائمةٌ فارغةٌ بلا خبر تُقرأ «لا أوراق محفوظة» — والقاعدة هي التي تعذّرت.
      setPapers([]);
      say(errorText(e, 'تعذّر تحميل الأوراق المحفوظة'), 'warn');
    }
  }, [say]);

  useEffect(() => {
    void loadPapers();
  }, [loadPapers]);

  useEffect(() => {
    const fit = () => {
      const desk = deskRef.current;
      if (desk) setZoom(Math.min(1, Math.max(0.4, (desk.clientWidth - 48) / SHEET_WIDTH)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ── الورقة: مشتقّةٌ من القيم والأسئلة، لا محرَّرةٌ كتلةً كتلة ────────
  const build = useCallback(
    (list: ListItem[]) => {
      const body = examList(list, dir);
      if (pick) body.pick = pick;
      const built = examDoc(head, body);
      built.pageSetup = { ...built.pageSetup, numerals };
      return built;
    },
    [head, pick, dir, numerals]
  );
  const doc = useMemo(() => build(items), [build, items]);
  const margins = doc.pageSetup.margins;

  /** الورقة بنموذجها: «أ» الأسئلة كما كُتبت، و«ب» بفروعٍ مخلوطة. */
  const renderVersion = useCallback(
    (version: string | null) =>
      renderDocHtml(
        version === 'ب' ? build(versionItems(items)) : doc,
        version ? { ...head, [VERSION_KEY]: version } : head,
        {
          missing: 'blank',
          paragraphs: 'blocks',
          answers: answers ? 'show' : 'hide',
          numerals
        }
      ),
    [build, items, doc, head, answers, numerals]
  );

  // الصفحات بقياس الأسئلة مرسومةً (`papers/examPagination.ts`) — لكلّ نموذجٍ ترتيب فروعه فتُقاس صفحاته وحده.
  const variants = useMemo(
    (): Record<string, string> => (versions ? { 'أ': renderVersion('أ'), 'ب': renderVersion('ب') } : { '': renderVersion(null) }),
    [renderVersion, versions]
  );
  const pageCounts = useExamPages(variants, { dir, margins, pageH: pageMm(doc.pageSetup).h, numerals, head, halves: duplex });
  const shown = versions ? (showB ? 'ب' : 'أ') : '';
  const pages = useMemo(
    () => splitExamPagesHtml(variants[shown] ?? '', pageCounts[shown] ?? [], head, numerals),
    [variants, shown, pageCounts, head, numerals]
  );
  const view = pageView !== 'all' && pageView <= pages.length ? pageView : 'all';

  const total = useMemo(() => {
    const list = questionsOf(doc);
    return list ? listScore(list) : 0;
  }, [doc]);

  const written = useMemo(() => flatten(items).filter((it) => textOf(it.inlines).trim()), [items]);
  const title = paperTitle(head);

  // ── ما لم يُحفظ (ج٣) ─────────────────────────────────────────────────
  // الانتقال و«ورقة جديدة» و«افتح محفوظة» وإغلاق البرنامج تسأل عمّا كُتب ولم يُحفظ (ر104)، ومسودّته تحفظه من انقطاع الكهرباء
  // (D134، `papers/usePaperOutput.ts`). والحالة توقيعُ ما تحمله الورقة مقابل توقيع آخر حفظٍ أو فتحٍ أو ورقةٍ جديدة.
  const signature = useMemo(() => JSON.stringify([head, items, pick ?? null, dir, numerals, omr]), [head, items, pick, dir, numerals, omr]);
  const signatureNow = useRef(signature);
  signatureNow.current = signature;
  /** توقيع آخر حالةٍ حُفظت أو فُتحت؛ و`''` ورقةٌ لم تُحفظ قطّ (الدور الثاني). */
  const [baseline, setBaseline] = useState<string | null>(null);
  /** يُرفع حين تُفتح ورقةٌ أو تُبدأ: يُسجَّل توقيعها بعد أن تُرسم بحالتها الجديدة (وعند التركيب مرّةً). */
  const [rebase, setRebase] = useState(true);
  useEffect(() => {
    if (!rebase) return;
    setBaseline(signature);
    setRebase(false);
  }, [rebase, signature]);
  const dirty = baseline !== null && signature !== baseline;

  // ── تحريرُ الشجرة ──────────────────────────────────────────────────
  // ── تحرير شجرة الأسئلة: الفروع والحذف والترتيب والبنك والرموز — `papers/usePaperTree.ts` ──
  const { patchItem, branch, remove, move, saveToBank, addQuestion, setBankOpen, bankOpen, bankTick, insertSymbol } = usePaperTree({
    setItems, head, say, focused
  });

  // ── الحفظ والطباعة ─────────────────────────────────────────────────
  // ── الحفظ والطباعة وPDF وفتح ورقةٍ محفوظة والدور الثاني — `papers/usePaperOutput.ts` ──
  const { print, save, exportPdf, fresh, secondRoundPaper, openPaper, after, setAfter, lastJob, send } = usePaperOutput({
    written, say, signatureNow, setBusy, paperId, title, head, omr, doc, setPaperId, setBaseline, loadPapers, onChanged, dirty,
    versions, copies, sheetRef, renderVersion, duplex, pages, pageCounts, numerals, dir, margins,
    setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setRebase, items, pick
  });

  useImperativeHandle(
    ref,
    () => ({
      print: () => void print(),
      save: () => void save(),
      exportPdf: () => void exportPdf()
    }),
    [print, save, exportPdf]
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── المؤلِّف ─────────────────────────────────────────────── */}
        {/* يضيق على الشاشات الصغيرة فتبقى للمعاينة وأزرارها مساحة (خطة Production، ٣٫١). */}
        <section className="w-[clamp(440px,45%,620px)] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-lg">
          <ToolHeader hint="ورقةٌ تُطبع ولا تُقيَّد — لا رقم صادر ولا بصمة" icon="quiz" title="الأسئلة">
            <button
              className="h-8 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
              type="button"
              onClick={() => void fresh()}
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              ورقة جديدة
            </button>
          </ToolHeader>

          {/* ── الرأس الثابت ──────────────────────────────────────── */}
          <PaperHead setHead={setHead} head={head} focused={focused} />

          {/* ── المتن ─────────────────────────────────────────────── */}
          <PaperBody
            numerals={numerals} setNumerals={setNumerals} dir={dir} setDir={setDir} pick={pick} setPick={setPick}
            items={items} answers={answers} patchItem={patchItem} branch={branch} remove={remove} move={move}
            saveToBank={saveToBank} focused={focused} addQuestion={addQuestion} setBankOpen={setBankOpen} bankOpen={bankOpen}
            head={head} bankTick={bankTick} setItems={setItems} say={say} secondRoundPaper={secondRoundPaper}
            setOmrOpen={setOmrOpen} omrOpen={omrOpen} omrEpoch={omrEpoch} omr={omr} title={title} setOmr={setOmr}
          />

          {/* ── الرموز ────────────────────────────────────────────── */}
          <div className="rounded-xl bg-surface-container-lowest p-space-sm">
            <div className="font-label-sm text-label-sm text-on-surface-variant mb-space-xs">
              رموزُ المواد — تُدرج عند المؤشّر
            </div>
            <SymbolPalette compact onPick={insertSymbol} />
          </div>

          {/* ── الأوراق المحفوظة ──────────────────────────────────── */}
          {papers.length > 0 && (
            <SavedPapers
              papers={papers}
              openPaper={openPaper}
              paperId={paperId}
              setPaperId={setPaperId}
              loadPapers={loadPapers}
              onChanged={onChanged}
              say={say}
            />
          )}
        </section>

        {/* ── المعاينة ─────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* يلتفّ سطرين إن ضاق — كان يُمرَّر أفقيًّا فتختفي «اطبع» و«حفظ» خلف طرف النافذة. */}
          <PreviewBar
            total={total}
            answers={answers}
            setAnswers={setAnswers}
            versions={versions}
            setVersions={setVersions}
            setShowB={setShowB}
            showB={showB}
            duplex={duplex}
            setDuplex={setDuplex}
            pageCount={pages.length}
            pageView={view}
            setPageView={setPageView}
          />

          <div
            ref={deskRef}
            className="flex-1 overflow-auto flex flex-col items-center py-space-lg gap-space-lg"
          >
            <div
              ref={sheetRef}
              className="flex flex-col items-center gap-space-lg shrink-0"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center'
              }}
            >
              {pages.map(
                (html, i) =>
                  (view === 'all' || view === i + 1) && (
                    <div
                      key={i}
                      className="a4-sheet print-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0"
                      data-sheet-page={i + 1}
                      style={pages.length > 1 ? { breakAfter: 'page', pageBreakAfter: 'always' } : undefined}
                    >
                      <div
                        className="text-black font-body-md text-body-md leading-relaxed"
                        dir={dir}
                        data-paper={i === 0 ? '' : undefined}
                        data-paper-page={i + 1}
                        dangerouslySetInnerHTML={{ __html: html }}
                        style={{
                          padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
                        }}
                      />
                    </div>
                  )
              )}
            </div>
          </div>

          <PaperOutput
            after={after}
            setAfter={setAfter}
            lastJob={lastJob}
            send={send}
            copies={copies}
            setCopies={setCopies}
            busy={busy}
            save={save}
            exportPdf={exportPdf}
            print={print}
          />
        </section>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

const PapersScreen = forwardRef(PapersScreenInner);
export default PapersScreen;
