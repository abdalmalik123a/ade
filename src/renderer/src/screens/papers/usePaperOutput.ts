/**
 * حفظ ورقة الأسئلة وإخراجها (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: الحفظ، وما لم يُحفظ عند المغادرة، والطباعة
 * بنسخها، وPDF، وفتح ورقةٍ محفوظة أو جديدة، وورقة الدور الثاني. والحفظ التلقائي مسودّةٌ لا الورقة (D134).
 */
import { useCallback, useState, useRef, useEffect } from 'react';
import { EXAM_CATEGORY, questionsOf, headOf, newQuestion, emptyHead, splitExamPagesHtml } from '@shared/examPaper';
import { textOf } from '../papersTree';
import { errorText } from '../../lib/errors';
import { onBeforeClose } from '../../lib/beforeClose';
import { useLeaveGuard } from '../../kit/useLeaveGuard';
import type { Outcome } from '../../components/OutputBar';
import { choosePrinter } from '../../lib/printChoice';
import { count } from '@shared/arabic';
import { newOmr, freshCopy, roundTwoHead } from './shared';
import { secondRound } from '@shared/examAnalysis';
import type { ListItem, Dir, Numerals } from '@shared/doc';
import type { OmrSpec } from '@shared/omr';
import type { Dispatch, SetStateAction, MutableRefObject, RefObject } from 'react';
import type { Doc } from '@shared/doc';

export function usePaperOutput(
  ctx: {
    written: ListItem[];
    say: (text: string, tone?: 'ok' | 'warn') => void;
    signatureNow: MutableRefObject<string>;
    setBusy: Dispatch<SetStateAction<boolean>>;
    paperId: number | null;
    title: string;
    head: Record<string, string>;
    omr: OmrSpec;
    doc: Doc;
    setPaperId: Dispatch<SetStateAction<number | null>>;
    setBaseline: Dispatch<SetStateAction<string | null>>;
    loadPapers: () => Promise<void>;
    onChanged: (() => void) | undefined;
    dirty: boolean;
    versions: boolean;
    copies: number;
    sheetRef: RefObject<HTMLDivElement>;
    renderVersion: (version: string | null) => string;
    /** «بوجهين»: الطباعة على الوجهين وحدها — والصفحات من القياس. */
    duplex: boolean;
    /** صفحات الورقة المعروضة، وعدد أسئلة كلّ صفحةٍ لكلّ نموذج (`papers/examPagination.ts`). */
    pages: string[];
    pageCounts: Record<string, number[]>;
    numerals: Numerals;
    dir: Dir;
    margins: { top: number; right: number; bottom: number; left: number };
    setHead: Dispatch<SetStateAction<Record<string, string>>>;
    setItems: Dispatch<SetStateAction<ListItem[]>>;
    setPick: Dispatch<SetStateAction<number | undefined>>;
    setDir: Dispatch<SetStateAction<Dir>>;
    setNumerals: Dispatch<SetStateAction<Numerals>>;
    setOmr: Dispatch<SetStateAction<OmrSpec>>;
    setOmrEpoch: Dispatch<SetStateAction<number>>;
    setRebase: Dispatch<SetStateAction<boolean>>;
    items: ListItem[];
    pick: number | undefined;
  }
) {
  const {
    written, say, signatureNow, setBusy, paperId, title, head, omr, doc, setPaperId, setBaseline, loadPapers, onChanged, dirty,
    versions, copies, sheetRef, renderVersion, duplex, pages, pageCounts, numerals, dir, margins,
    setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setRebase, items, pick
  } = ctx;

  /** صفحةٌ من الورقة ورقةً تُطبع — وفاصل الصفحة بعدها إلا الأخيرة. */
  const sheetOf = useCallback(
    (html: string, page: number, more: boolean) =>
      `<div class="a4-sheet print-sheet"${more ? ' style="break-after:page;page-break-after:always"' : ''}><div class="text-black font-body-md text-body-md leading-relaxed" dir="${dir}"${page === 1 ? ' data-paper' : ''} data-paper-page="${page}" style="padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm">${html}</div></div>`,
    [dir, margins]
  );

  const versionPage = useCallback(
    (node: HTMLElement, version: string) => {
      const fullVHtml = renderVersion(version);
      const counts = pageCounts[version] ?? [];
      // ونموذجٌ بصفحةٍ والمعروض بصفحتين (أو العكس) لا يُنسخ من المعاينة: تبقى فيها صفحة النموذج الآخر.
      if (counts.length > 1 || node.querySelectorAll('[data-sheet-page]').length !== 1) {
        return splitExamPagesHtml(fullVHtml, counts, head, numerals).map((html, i) => sheetOf(html, i + 1, true)).join('');
      }
      const clone = node.cloneNode(true) as HTMLElement;
      clone.style.breakAfter = 'page';
      const body = clone.querySelector('[data-paper]');
      if (body) body.innerHTML = fullVHtml;
      return clone.outerHTML;
    },
    [renderVersion, pageCounts, head, numerals, sheetOf]
  );

  /** الأوراق كما تخرج: الطباعة بعدد النسخ («أ» و«ب» بالتناوب)، وPDF النموذجين «أ» ثم «ب» مرّةً — للمدرّس يطبع منه ما شاء. */
  const sheetsFor = useCallback((target: 'print' | 'pdf' = 'print'): { html: string; copies: number } | null => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return null;
    node.style.transform = '';
    if (versions) {
      const a = versionPage(node, 'أ');
      const b = versionPage(node, 'ب');
      const sheets = target === 'pdf' ? 2 : Math.max(1, copies);
      return { html: Array.from({ length: sheets }, (_, i) => (i % 2 ? b : a)).join(''), copies: 1 };
    }
    // صفحاتٌ عدّة تُبنى من نصّها لا من المعاينة: «الصفحة ٢» وحدها معروضةً لا تُسقط الأولى من الطباعة.
    if (pages.length > 1) return { html: pages.map((html, i) => sheetOf(html, i + 1, i < pages.length - 1)).join(''), copies: Math.max(1, copies) };
    return { html: node.outerHTML, copies: Math.max(1, copies) };
  }, [versions, copies, versionPage, pages, sheetOf, sheetRef]);

  // ── مسودّة الورقة (D134، ر151): ما كُتب لا يضيع بانقطاع الكهرباء، ولا يُكتب فوق ورقةٍ محفوظة إلا بـ«حفظ» ──
  // الحفظ التلقائي يكتب مسودّةً واحدة (`papers.setDraft`) ما دامت الورقة تخالف آخر حفظ، وتُمحى حين تعود إليه، وبـ«حفظ» ناجح،
  // و«ورقة جديدة»، وفتح ورقةٍ أخرى، و«اترك بلا حفظ»؛ وحذف ورقتها يمحوها في الرئيسة (`deleteTemplate`).
  const autosaveTimer = useRef<number | null>(null);
  const paperIdRef = useRef<number | null>(paperId);
  paperIdRef.current = paperId;
  const dirtyNow = useRef(dirty);
  dirtyNow.current = dirty;
  /** في القاعدة مسودّةٌ من هذه الشاشة — فتُمحى حين لا يبقى ما لم يُحفظ. */
  const drafted = useRef(false);

  const dropDraft = useCallback(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    drafted.current = false;
    return window.diwan.papers.setDraft(null).catch(() => undefined);
  }, []);

  // عند فتح الشاشة: ورقةٌ لم تُحفظ تُستعاد كما تُركت — وعلى ورقتها المحفوظة إن كانت، فيحفظ «حفظ» فوقها بنسختها السابقة —
  // وإلا ورقةٌ جديدة كما قبل D115 (لا يُفتح آخر ما حُفظ).
  useEffect(() => {
    let alive = true;
    void window.diwan.papers
      .draft()
      .then((draft) => {
        if (!alive || !draft) return;
        setHead(draft.head);
        setItems(draft.items.length ? draft.items : [newQuestion()]);
        setPick(draft.pick ?? undefined);
        setDir(draft.dir === 'ltr' ? 'ltr' : 'rtl');
        setNumerals(draft.numerals === 'indic' ? 'indic' : 'arabic');
        setOmr(draft.omr ?? newOmr());
        setOmrEpoch((n) => n + 1);
        setPaperId(draft.paperId);
        paperIdRef.current = draft.paperId;
        // «لم تُحفظ» حتى تُحفظ: فيسأل الحارس عند المغادرة، ويبقى الحفظ التلقائي يكتبها.
        setBaseline('');
        drafted.current = true;
        say('استُعيدت ورقةٌ لم تُحفظ');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [say, setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setPaperId, setBaseline]);

  const autosave = useCallback(async () => {
    try {
      await window.diwan.papers.setDraft({ paperId: paperIdRef.current, head, items, pick: pick ?? null, dir, numerals, omr });
      drafted.current = true;
    } catch {
      // مسودّةٌ تعثّرت تُكتب مع التغيير التالي — والورقة كما هي.
    }
  }, [head, items, pick, dir, numerals, omr]);

  // ١٫٥ ث بعد آخر تغيير ما دامت الورقة تخالف آخر حفظ؛ وعادت إليه ← تُمحى مسودّتها.
  useEffect(() => {
    if (!dirty) {
      if (drafted.current) void dropDraft();
      return;
    }
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => void autosave(), 1500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [dirty, autosave, dropDraft]);

  // «اترك بلا حفظ»: الشاشة لا تُغادَر ولا يُغلق البرنامج وفيها ما لم يُحفظ إلا بعد السؤال — فما بقي عندها متروكٌ بقول الموظف.
  // (وانقطاع الكهرباء لا يمرّ بهما: تبقى المسودّة.)
  useEffect(() => {
    const leftUnsaved = () => (dirtyNow.current ? dropDraft() : undefined);
    const offClose = onBeforeClose(leftUnsaved);
    return () => {
      offClose();
      void leftUnsaved();
    };
  }, [dropDraft]);

  const save = useCallback(async (): Promise<boolean> => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    if (!written.length) {
      say('اكتب نصّ سؤالٍ واحدٍ على الأقل قبل الحفظ', 'warn');
      return false;
    }
    const savedSignature = signatureNow.current;
    setBusy(true);
    try {
      const saved = await window.diwan.templates.save({
        id: paperId,
        code: null,
        title,
        subtitle: head['المدرسة']?.trim() || null,
        category: EXAM_CATEGORY,
        subjectLine: null,
        bodyHtml: written.map((it) => textOf(it.inlines)).join('\n'),
        letterheadId: null,
        variables: [],
        // مفتاح الدوائر يُحفظ مع الورقة ولا يغيّر صورتها.
        doc: omr.key.length ? { ...doc, meta: { ...doc.meta, omr } } : doc
      });
      setPaperId(saved.id);
      paperIdRef.current = saved.id;
      await dropDraft();
      setBaseline(savedSignature);
      await loadPapers();
      onChanged?.();
      say('حُفظت الورقة في قسم الأسئلة');
      return true;
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ الورقة'), 'warn');
      return false;
    } finally {
      setBusy(false);
    }
  }, [written, paperId, title, head, doc, omr, loadPapers, onChanged, say, signatureNow, setBaseline, setBusy, setPaperId, dropDraft]);

  const leave = useLeaveGuard({ label: 'أوراق الأسئلة', dirty, save });

  /** ما خرج آخر مرّة — يقوله شريط الإخراج، ومنه «أعد الطبع» بالنسخ نفسها (المرحلة ٥). */
  const [after, setAfter] = useState<Outcome | null>(null);
  const lastJob = useRef<{ sheetHtml: string; copies: number; printer: string; system: boolean; what: string; duplex?: boolean } | null>(null);

  const send = useCallback(
    async (job: { sheetHtml: string; copies: number; printer: string; system: boolean; what: string; duplex?: boolean }) => {
      setBusy(true);
      try {
        // بلا إصدار: لا رقم صادر ولا بصمة. ثلاثون نسخةً لا تحرق ثلاثين رقمًا.
        const out = await window.diwan.output.print({
          sheetHtml: job.sheetHtml,
          printer: job.printer,
          copies: job.copies,
          silent: !job.system,
          duplex: job.duplex
        });
        if (!out.ok) {
          say(out.reason || 'لم تتم الطباعة', 'warn');
          return;
        }
        lastJob.current = job;
        setAfter({ what: job.what, printer: job.printer });
      } catch (e) {
        say(errorText(e, 'تعذّرت الطباعة'), 'warn');
      } finally {
        setBusy(false);
      }
    },
    [say, setBusy]
  );

  const print = useCallback(async () => {
    const sheets = sheetsFor();
    if (!sheets) return;
    const pick = await choosePrinter('papers', { allowSystem: true });
    if (!pick) return;
    await send({
      sheetHtml: sheets.html,
      copies: sheets.copies,
      printer: pick.printer,
      system: pick.system,
      what: versions ? `${count(copies, 'نسخة')} («أ» و«ب» بالتناوب)` : count(copies, 'نسخة'),
      duplex
    });
  }, [copies, versions, sheetsFor, send, duplex]);

  const exportPdf = useCallback(async () => {
    const sheets = sheetsFor('pdf');
    if (!sheets) return;
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: sheets.html,
        suggestedName: versions ? `${title} — نموذجان` : title
      });
      if (path) say('حُفظت نسخة PDF');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), 'warn');
    }
  }, [title, versions, sheetsFor, say]);

  const openPaper = useCallback(
    async (id: number) => {
      if (!(await leave())) return;
      try {
        const loaded = await window.diwan.templates.doc(id);
        const list = questionsOf(loaded);
        setHead(headOf(loaded));
        setItems(list?.items.length ? list.items : [newQuestion()]);
        setPick(list?.pick);
        setDir(list?.dir === 'ltr' ? 'ltr' : 'rtl');
        setNumerals(loaded.pageSetup.numerals);
        setOmr(loaded.meta.omr ?? newOmr());
        setOmrEpoch((n) => n + 1);
        setPaperId(id);
        paperIdRef.current = id;
        void dropDraft();
        setRebase(true);
        say('فُتحت الورقة');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح الورقة'), 'warn');
      }
    },
    [say, leave, dropDraft, setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setPaperId, setRebase]
  );

  const fresh = useCallback(async () => {
    if (!(await leave())) return;
    void dropDraft();
    setHead(emptyHead());
    setItems([newQuestion()]);
    setPick(undefined);
    setOmr(newOmr());
    setOmrEpoch((n) => n + 1);
    setPaperId(null);
    paperIdRef.current = null;
    setRebase(true);
    say('ورقة جديدة');
  }, [say, leave, dropDraft, setHead, setItems, setPick, setOmr, setOmrEpoch, setPaperId, setRebase]);

  /** «الدور الثاني» من البنك (د٩) — ورقةٌ جديدة لا تُكتب فوق الأولى. */
  async function secondRoundPaper() {
    if (!(await leave())) return;
    const bank = await window.diwan.bank.list({ subject: head['المادة'] || null, grade: head['الصف'] || null });
    const { picks, missing } = secondRound(items, bank);
    if (!picks.length) {
      say('لا أسئلة في البنك لهذه المادة والصفّ غير أسئلة هذه الورقة — احفظ أسئلةً في البنك أولًا', 'warn');
      return;
    }
    void dropDraft();
    setItems(picks.map((p) => freshCopy(p.item)));
    setHead((h) => roundTwoHead(h));
    setPaperId(null);
    // ورقةٌ جديدة لم تُحفظ قطّ — فتبقى «غير محفوظة» حتى تُحفظ باسمها.
    setBaseline('');
    for (const p of picks) void window.diwan.bank.used(p.id);
    say(
      missing.length
        ? `ورقة الدور الثاني: ${count(picks.length, 'سؤال')} من البنك — ولم يُوجد بديلٌ للسؤال ${missing.join('، ')}؛ أكمله بيدك`
        : `ورقة الدور الثاني: ${count(picks.length, 'سؤال')} من البنك بدرجاتها — احفظها باسمها`,
      missing.length ? 'warn' : 'ok'
    );
  }

  return { print, save, exportPdf, fresh, secondRoundPaper, openPaper, after, setAfter, lastJob, send };
}
