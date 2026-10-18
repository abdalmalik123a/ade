/**
 * إخراج الكتاب وإصداره (تقسيم المحرّر بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو: PDF وWord والصورة، و«اطبع» بقائمة التحقّق
 * أوّلًا ثم الإصدار (رقمٌ وقيدٌ وطباعة)، والطباعة التجريبية، و«اجعله نموذجًا».
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { IssueOutcome, OfficeSettings, TemplateSummary } from '@shared/api';
import { formatGregorian } from '@shared/dates';
import { docText, pageMm, type Doc, type DocField } from '@shared/doc';
import { resolveLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import { GENDER_KEY, guessGender, type Gender, type LearnedGenders } from '@shared/gender';
import { letterValues, type letterChecks, type Registry } from '@shared/letterDraft';
import { errorText } from '../../lib/errors';
import { choosePrinter } from '../../lib/printChoice';

export function useEditorOutput(
  ctx: {
    printRef: MutableRefObject<HTMLDivElement | null>;
    doc: Doc;
    docType: string;
    ownerName: string;
    values: Record<string, string>;
    effective: Record<string, string>;
    headLayout: LetterheadLayout | null;
    resolvePrinted: (text: string) => string;
    regValues: { number: string; date: string };
    registry: Registry;
    checks: ReturnType<typeof letterChecks>;
    settings: OfficeSettings | null;
    activeTemplate: number | null;
    linkedCitizen: number | null;
    letterhead: Letterhead | null;
    letterheadId: number | null;
    byRole: (role: DocField['role']) => string;
    savedLetter: () => Parameters<typeof letterValues>[0];
    learned: LearnedGenders;
    needsGender: boolean;
    genderByHand: boolean;
    remember: (answers: { name: string; gender: Gender }[]) => void;
    draft: number | null;
    setDraft: Dispatch<SetStateAction<number | null>>;
    dirty: MutableRefObject<boolean>;
    setExporting: Dispatch<SetStateAction<boolean>>;
    setBusy: Dispatch<SetStateAction<boolean>>;
    setError: Dispatch<SetStateAction<string | null>>;
    setToast: Dispatch<SetStateAction<string | null>>;
    setTrial: Dispatch<SetStateAction<boolean>>;
    setIssueOpen: Dispatch<SetStateAction<boolean>>;
    setIssued: Dispatch<SetStateAction<IssueOutcome | null>>;
    setRepeated: Dispatch<SetStateAction<{ text: string; count: number }[]>>;
    setTemplates: Dispatch<SetStateAction<TemplateSummary[]>>;
    setTemplateOpen: Dispatch<SetStateAction<boolean>>;
    onIssued: (() => void) | undefined;
  }
) {
  const { printRef, doc, docType, ownerName, values, effective, headLayout, resolvePrinted, regValues, registry, checks, settings, activeTemplate, linkedCitizen, letterhead, letterheadId, byRole, savedLetter, learned, needsGender, genderByHand, remember, draft, setDraft, dirty, setExporting, setBusy, setError, setToast, setTrial, setIssueOpen, setIssued, setRepeated, setTemplates, setTemplateOpen, onIssued } = ctx;

  /** علامات الورقة كما تُطبع — وتُقيَّد كما هي، فلا شيء يُملأ فيها بعد الإصدار. */
  const sheetHtml = () => printRef.current?.outerHTML ?? '';
  const sheetName = docType || ownerName || 'كتاب';
  const pageOf = () => pageMm(doc.pageSetup);

  async function run(label: string, work: () => Promise<string | null | undefined | void>) {
    setExporting(true);
    setError(null);
    try {
      const path = await work();
      if (path) setToast(`${label}: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setExporting(false);
    }
  }
  const exportPdf = () => run('حُفظ PDF', () => window.diwan.output.savePdf({ sheetHtml: sheetHtml(), suggestedName: sheetName, page: pageOf() }));
  // من الوثيقة وقيمها وترويستها — فيخرج Word بجداوله وأعمدته ومحاذاته (تعميق الموجود ٩).
  const exportWord = () =>
    run('حُفظ مستند Word', () =>
      window.diwan.output.saveDocx({
        doc,
        values: effective,
        head: headLayout ? { layout: resolveLayout(headLayout, resolvePrinted), registry: regValues } : null,
        suggestedName: sheetName,
        title: docType || 'كتاب رسمي'
      })
    );
  const exportPng = () =>
    run('حُفظت صورة بدقة 300 نقطة/إنش', () => window.diwan.output.savePng300({ sheetHtml: sheetHtml(), suggestedName: sheetName, page: pageOf() }));

  /** الإصدار: قائمة التحقّق أولًا — وما يمنعه يُقال ولا يُفتح الحوار. */
  function requestIssue() {
    setTrial(false);
    const first = checks.find((c) => c.level === 'block');
    if (first) {
      setError(`لا يصدر الكتاب بعد: ${first.text}`);
      return;
    }
    setError(null);
    setIssueOpen(true);
  }

  async function issue(opts: { copies: number; copyKind: string; print: boolean }) {
    if (!settings) return;
    // الطابعة قبل الإصدار: تُقيَّد مع الكتاب، وإلغاء السؤال لا يُصدر شيئًا.
    const pick = opts.print ? await choosePrinter('documents', { allowSystem: true }) : null;
    if (opts.print && !pick) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await window.diwan.documents.issue(
        {
          sheetHtml: sheetHtml(),
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          authorityId: letterhead?.authorityId ?? null,
          citizenName: ownerName,
          nationalId: byRole('nationalId') || null,
          docType: docType.trim() || null,
          destination: byRole('destination') || null,
          purpose: byRole('purpose') || null,
          values: letterValues(savedLetter()),
          copies: opts.copies,
          copyKind: opts.copyKind,
          gregorianDate: registry.dateGreg || formatGregorian(new Date()),
          hijriDate: registry.dateHijri || null,
          operator: settings.operatorName || null,
          printer: pick?.printer ?? null,
          printDialog: pick?.system ?? false,
          serialPrefix: settings.serialPrefix,
          serialYear: settings.serialYear,
          letterheadId
        },
        opts.print
      );
      setIssued(outcome);
      setIssueOpen(false);
      dirty.current = false;
      // الصياغة التي تتكرّر (لا الأسماء): فقراتُ الورقة بقيمها تُقارن بما صدر.
      void window.diwan.clips
        .repeated(docText(doc, effective).split('\n'))
        .then(setRepeated)
        .catch(() => setRepeated([]));
      // جنسٌ حسمه الموظف لاسمٍ لم يُعرف، أو قلب فيه الاقتراح: يُحفظ فلا يُسأل عنه ثانيةً.
      const chosen = values[GENDER_KEY] as Gender | undefined;
      const guessed = guessGender(ownerName, learned);
      if (needsGender && genderByHand && chosen && (!guessed?.sure || guessed.gender !== chosen)) {
        remember([{ name: ownerName, gender: chosen }]);
      }
      if (draft !== null) {
        await window.diwan.drafts.delete(draft);
        setDraft(null);
      }
      onIssued?.();
      if (outcome.archiveError) {
        setError(
          `صدر الكتاب برقم ${outcome.serial}، لكن نسخته PDF لم تُحفظ في الأرشيف (${outcome.archiveError}) — متنه محفوظ في السجل.`
        );
      } else if (outcome.printed === 'failed') {
        setError(
          `صدر الكتاب برقم ${outcome.serial} وقُيّد، لكن الطباعة لم تتم${outcome.printError ? ` (${outcome.printError})` : ''} — أعِدها من الأرشيف.`
        );
      }
    } catch (e) {
      setError(errorText(e, 'تعذّر الطبع'));
    } finally {
      setBusy(false);
    }
  }

  /** طباعة للمراجعة — بلا قيدٍ في الأرشيف. */
  async function printDraftSheet() {
    const pick = await choosePrinter('documents', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      const r = await window.diwan.output.print({ sheetHtml: sheetHtml(), printer: pick.printer, copies: 1, silent: !pick.system, page: pageOf() });
      if (!r.ok && r.reason) setError(`تعذّرت الطباعة: ${r.reason}`);
    } catch (e) {
      setError(errorText(e, 'تعذّرت الطباعة'));
    } finally {
      setBusy(false);
    }
  }

  /** «اجعله نموذجًا»: الكتاب يصير نموذجًا في المكتبة — بحقوله فارغةً لا بقيمه (§١٠، البند ٦). */
  async function saveAsTemplate(title: string) {
    try {
      await window.diwan.templates.save({
        id: null,
        code: null,
        title,
        subtitle: null,
        category: null,
        subjectLine: null,
        bodyHtml: docText(doc),
        letterheadId,
        variables: doc.fields.map((f) => ({ token: f.key, label: f.label, source: f.source ? 'citizen' : 'manual', required: f.required })),
        doc
      });
      setTemplates(await window.diwan.templates.list());
      setTemplateOpen(false);
      setToast(`حُفظ «${title}» نموذجًا في المكتبة — يُملأ مرارًا من الشبّاك`);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ نموذجًا'));
    }
  }

  return { exportPdf, exportWord, exportPng, requestIssue, issue, printDraftSheet, saveAsTemplate };
}
