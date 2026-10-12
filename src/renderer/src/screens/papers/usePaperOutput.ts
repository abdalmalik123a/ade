/**
 * حفظ ورقة الأسئلة وإخراجها (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: الحفظ، وما لم يُحفظ عند المغادرة، والطباعة
 * بنسخها، وPDF، وفتح ورقةٍ محفوظة أو جديدة، وورقة الدور الثاني.
 */
import { useCallback, useState, useRef } from 'react';
import { EXAM_CATEGORY, questionsOf, headOf, newQuestion, emptyHead } from '@shared/examPaper';
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
    sheetsFor: () => { html: string; copies: number; } | null;
    versions: boolean;
    copies: number;
    sheetRef: RefObject<HTMLDivElement>;
    versionPage: (node: HTMLElement, version: string) => string;
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
    sheetsFor, versions, copies, sheetRef, versionPage, setHead, setItems, setPick, setDir, setNumerals, setOmr, setOmrEpoch,
    setRebase, items
  } = ctx;

  const save = useCallback(async (): Promise<boolean> => {
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
  }, [written, paperId, title, head, doc, omr, loadPapers, onChanged, say]);

  const leave = useLeaveGuard({ label: 'أوراق الأسئلة', dirty, save });

  /** ما خرج آخر مرّة — يقوله شريط الإخراج، ومنه «أعد الطبع» بالنسخ نفسها (المرحلة ٥). */
  const [after, setAfter] = useState<Outcome | null>(null);
  const lastJob = useRef<{ sheetHtml: string; copies: number; printer: string; system: boolean; what: string } | null>(null);

  const send = useCallback(
    async (job: { sheetHtml: string; copies: number; printer: string; system: boolean; what: string }) => {
      setBusy(true);
      try {
        // بلا إصدار: لا رقم صادر ولا بصمة. ثلاثون نسخةً لا تحرق ثلاثين رقمًا.
        const out = await window.diwan.output.print({ sheetHtml: job.sheetHtml, printer: job.printer, copies: job.copies, silent: !job.system });
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
    [say]
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
      what: versions ? `${count(copies, 'نسخة')} («أ» و«ب» بالتناوب)` : count(copies, 'نسخة')
    });
  }, [copies, versions, sheetsFor, send]);

  const exportPdf = useCallback(async () => {
    // PDF النموذجين ورقتان: «أ» ثم «ب» — للمدرّس يطبع منه ما شاء.
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return;
    node.style.transform = '';
    const html = versions ? versionPage(node, 'أ') + versionPage(node, 'ب') : node.outerHTML;
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: html,
        suggestedName: versions ? `${title} — نموذجان` : title
      });
      if (path) say('حُفظت نسخة PDF');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), 'warn');
    }
  }, [title, versions, versionPage, say]);

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
        setRebase(true);
        say('فُتحت الورقة');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح الورقة'), 'warn');
      }
    },
    [say, leave]
  );

  const fresh = useCallback(async () => {
    if (!(await leave())) return;
    setHead(emptyHead());
    setItems([newQuestion()]);
    setPick(undefined);
    setOmr(newOmr());
    setOmrEpoch((n) => n + 1);
    setPaperId(null);
    setRebase(true);
    say('ورقة جديدة');
  }, [say, leave]);

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
