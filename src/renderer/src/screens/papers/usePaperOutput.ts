/**
 * حفظ ورقة الأسئلة وإخراجها (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: الحفظ، وما لم يُحفظ عند المغادرة، والطباعة
 * بنسخها، وPDF، وفتح ورقةٍ محفوظة أو جديدة، وورقة الدور الثاني.
 */
import { useCallback, useState, useRef, useEffect } from 'react';
import { EXAM_CATEGORY, questionsOf, headOf, newQuestion, emptyHead, splitExamPagesHtml } from '@shared/examPaper';
import { textOf } from '../papersTree';
import { errorText } from '../../lib/errors';
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
    isDuplex?: boolean;
    page1Length: number;
    page2Length: number;
    page1Html: string;
    page2Html: string;
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
  }
) {
  const {
    written, say, signatureNow, setBusy, paperId, title, head, omr, doc, setPaperId, setBaseline, loadPapers, onChanged, dirty,
    versions, copies, sheetRef, renderVersion, isDuplex = false, page1Length, page2Length, page1Html, page2Html, dir, margins,
    setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setRebase, items
  } = ctx;

  const versionPage = useCallback(
    (node: HTMLElement, version: string) => {
      const fullVHtml = renderVersion(version);
      if (isDuplex && page2Length > 0) {
        const { page1Html: p1, page2Html: p2 } = splitExamPagesHtml(fullVHtml, page1Length, head, 2);
        return (
          `<div class="a4-sheet print-sheet" style="break-after:page;page-break-after:always"><div class="text-black font-body-md text-body-md leading-relaxed" dir="${dir}" data-paper data-paper-page="1" style="padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm">${p1}</div></div>` +
          `<div class="a4-sheet print-sheet" style="break-after:page;page-break-after:always"><div class="text-black font-body-md text-body-md leading-relaxed" dir="${dir}" data-paper-page="2" style="padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm">${p2}</div></div>`
        );
      }
      const clone = node.cloneNode(true) as HTMLElement;
      clone.style.breakAfter = 'page';
      const body = clone.querySelector('[data-paper]');
      if (body) body.innerHTML = fullVHtml;
      return clone.outerHTML;
    },
    [renderVersion, isDuplex, page1Length, page2Length, head, dir, margins]
  );

  const sheetsFor = useCallback((): { html: string; copies: number } | null => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return null;
    node.style.transform = '';
    if (versions) {
      const a = versionPage(node, 'أ');
      const b = versionPage(node, 'ب');
      return { html: Array.from({ length: Math.max(1, copies) }, (_, i) => (i % 2 ? b : a)).join(''), copies: 1 };
    }
    if (isDuplex && page2Length > 0) {
      const duplexHtml =
        `<div class="a4-sheet print-sheet" style="break-after:page;page-break-after:always"><div class="text-black font-body-md text-body-md leading-relaxed" dir="${dir}" data-paper data-paper-page="1" style="padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm">${page1Html}</div></div>` +
        `<div class="a4-sheet print-sheet"><div class="text-black font-body-md text-body-md leading-relaxed" dir="${dir}" data-paper-page="2" style="padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm">${page2Html}</div></div>`;
      return { html: duplexHtml, copies: Math.max(1, copies) };
    }
    return { html: node.outerHTML, copies: Math.max(1, copies) };
  }, [versions, copies, versionPage, isDuplex, page2Length, page1Html, page2Html, dir, margins, sheetRef]);

  const autosaveTimer = useRef<number | null>(null);
  const paperIdRef = useRef<number | null>(paperId);
  paperIdRef.current = paperId;

  // استرجاع المسودّة التلقائية لورقة الأسئلة عند فتح الشاشة
  useEffect(() => {
    if (paperIdRef.current !== null) return;
    try {
      const lastIdStr = localStorage.getItem('diwan_paper_autosave_id');
      if (lastIdStr) {
        const lastId = parseInt(lastIdStr, 10);
        if (Number.isFinite(lastId)) {
          void window.diwan.templates
            .doc(lastId)
            .then((loaded) => {
              const list = questionsOf(loaded);
              setHead(headOf(loaded));
              setItems(list?.items.length ? list.items : [newQuestion()]);
              setPick(list?.pick);
              setDir(list?.dir === 'ltr' ? 'ltr' : 'rtl');
              setNumerals(loaded.pageSetup.numerals);
              setOmr(loaded.meta.omr ?? newOmr());
              setOmrEpoch((n) => n + 1);
              setPaperId(lastId);
              paperIdRef.current = lastId;
              setRebase(true);
            })
            .catch(() => {
              localStorage.removeItem('diwan_paper_autosave_id');
            });
        }
      }
    } catch {
      // ignore
    }
  }, [setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setPaperId, setRebase]);

  const lastAutosavedSig = useRef<string | null>(null);

  // حفظ تلقائي دوري مؤجّل (debounce ~1.5 ث) مع وسم isAutosave لمنع تكرار المراجعات
  const autosave = useCallback(async () => {
    if (!written.length) return;
    const currentSig = signatureNow.current;
    try {
      const saved = await (window.diwan.templates.save as any)({
        id: paperIdRef.current,
        code: null,
        title,
        subtitle: head['المدرسة']?.trim() || null,
        category: EXAM_CATEGORY,
        subjectLine: null,
        bodyHtml: written.map((it) => textOf(it.inlines)).join('\n'),
        letterheadId: null,
        variables: [],
        doc: omr.key.length ? { ...doc, meta: { ...doc.meta, omr } } : doc,
        isAutosave: true
      });
      if (paperIdRef.current !== saved.id) {
        setPaperId(saved.id);
        paperIdRef.current = saved.id;
      }
      try {
        localStorage.setItem('diwan_paper_autosave_id', String(saved.id));
      } catch {
        // ignore
      }
      lastAutosavedSig.current = currentSig;
      setBaseline(currentSig);
      void loadPapers();
      onChanged?.();
    } catch {
      // Autosave fails silently
    }
  }, [written, title, head, doc, omr, loadPapers, onChanged, setPaperId, setBaseline, signatureNow]);

  useEffect(() => {
    if (!written.length || !dirty) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void autosave();
    }, 1500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [written, dirty, autosave]);

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
      try {
        localStorage.setItem('diwan_paper_autosave_id', String(saved.id));
      } catch {
        // ignore
      }
      lastAutosavedSig.current = savedSignature;
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
  }, [written, paperId, title, head, doc, omr, loadPapers, onChanged, say, signatureNow, setBaseline, setBusy, setPaperId]);

  const effectiveDirty = dirty && signatureNow.current !== lastAutosavedSig.current;
  const leave = useLeaveGuard({ label: 'أوراق الأسئلة', dirty: effectiveDirty, save });

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
      duplex: isDuplex
    });
  }, [copies, versions, sheetsFor, send, isDuplex]);

  const exportPdf = useCallback(async () => {
    const sheets = sheetsFor();
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
        try {
          localStorage.setItem('diwan_paper_autosave_id', String(id));
        } catch {
          // ignore
        }
        setRebase(true);
        say('فُتحت الورقة');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح الورقة'), 'warn');
      }
    },
    [say, leave, setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch, setPaperId, setRebase]
  );

  const fresh = useCallback(async () => {
    if (!(await leave())) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    try {
      localStorage.removeItem('diwan_paper_autosave_id');
    } catch {
      // ignore
    }
    setHead(emptyHead());
    setItems([newQuestion()]);
    setPick(undefined);
    setOmr(newOmr());
    setOmrEpoch((n) => n + 1);
    setPaperId(null);
    paperIdRef.current = null;
    setRebase(true);
    say('ورقة جديدة');
  }, [say, leave, setHead, setItems, setPick, setOmr, setOmrEpoch, setPaperId, setRebase]);

  /** «الدور الثاني» من البنك (د٩) — ورقةٌ جديدة لا تُكتب فوق الأولى. */
  async function secondRoundPaper() {
    if (!(await leave())) return;
    const bank = await window.diwan.bank.list({ subject: head['المادة'] || null, grade: head['الصف'] || null });
    const { picks, missing } = secondRound(items, bank);
    if (!picks.length) {
      say('لا أسئلة في البنك لهذه المادة والصفّ غير أسئلة هذه الورقة — احفظ أسئلةً في البنك أولًا', 'warn');
      return;
    }
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
