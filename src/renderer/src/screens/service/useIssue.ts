/**
 * الإصدار في الشبّاك (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: الأوراق كما رآها الموظف (وبقيم صفٍّ بعينه في الدمج)،
 * والمعاملة قيدًا واحدًا لزبون واحد ثم طباعتها وإبطال الأصل إن اختير، والدمج معاملةً لكلّ اسمٍ بجنسه — وما لم يُعرف يُسأل عنه.
 * والحال كلّها في الشاشة: الخطّاف يقرؤها بأسمائها.
 */
import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { count, countIn } from '@shared/arabic';
import type { DocField } from '@shared/doc';
import { renderDocHtml } from '@shared/docHtml';
import { printsHijri } from '@shared/letterhead';
import type { OfficeSettings, TransactionSheet } from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import { GENDER_KEY, guessGender, unsureNames, type Gender } from '@shared/gender';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { SCREEN_DPI } from '@shared/canvas';
import { choosePrinter } from '../../lib/printChoice';
import type { useToast } from '../../kit/useToast';
import type { AfterIssue, Loaded, NewCitizen, RepeatOf } from './types';

export function useIssue(
  ctx: {
    settings: OfficeSettings | null;
    loaded: Loaded[];
    fields: DocField[];
    values: Record<string, string>;
    asPrinted: (v: Record<string, string>) => Record<string, string>;
    sheets: MutableRefObject<Map<number, HTMLDivElement | null>>;
    byRole: (role: DocField['role']) => string;
    citizenName: string;
    citizenId: number | null;
    copies: number;
    merge: boolean;
    nameField: DocField | null;
    rows: string[];
    valuesOnly: boolean;
    genderByHand: boolean;
    needsGender: boolean;
    learned: Record<string, Gender>;
    remember: (answers: { name: string; gender: Gender }[]) => void;
    setGenderReview: Dispatch<SetStateAction<{ names: string[]; print: boolean } | null>>;
    repeatOf: RepeatOf | null;
    setAfter: Dispatch<SetStateAction<AfterIssue | null>>;
    papersWithCopies: (papers: number, n: number) => string;
    printIssued: (ids: number[], printer: string, mode: 'full' | 'values', label: string, n?: number) => Promise<void>;
    offerToRegistry: (transactionId: number) => void;
    setNewCitizen: Dispatch<SetStateAction<NewCitizen | null>>;
    reset: () => void;
    setBusy: Dispatch<SetStateAction<boolean>>;
    onIssued: (() => void) | undefined;
    say: ReturnType<typeof useToast>['say'];
    sayError: (e: unknown, fallback: string) => void;
  }
) {
  const { settings, loaded, fields, values, asPrinted, sheets, byRole, citizenName, citizenId, copies, merge, nameField, rows, valuesOnly, genderByHand, needsGender, learned, remember, setGenderReview, repeatOf, setAfter, papersWithCopies, printIssued, offerToRegistry, setNewCitizen, reset, setBusy, onIssued, say, sayError } = ctx;

  /**
   * ورقةٌ بقيم صفٍّ بعينه.
   *
   * الترويسة واحدة لا تتبدّل فتُؤخذ من المعاينة كما رآها الموظف، والمتن وحده
   * يُعاد رسمه بالمحرّك نفسه — فورقة الاسم الثلاثين مثلُ ورقة الأول تمامًا.
   */
  const collect = useCallback((rowValues?: Record<string, string>): TransactionSheet[] => {
    const use = asPrinted(rowValues ?? values);
    return loaded.map((l) => {
      const node = sheets.current.get(l.summary.id)?.cloneNode(true) as HTMLElement | undefined;
      if (node) {
        // معاينة «القيم وحدها» صفةُ شاشة لا صفةُ كتاب: الأرشيف يقيّد الورقة كاملة.
        node.classList.remove('values-preview');
        if (rowValues) {
          const body = node.querySelector('[data-body]');
          if (body)
            body.innerHTML =
              l.doc.kind === 'canvas'
                ? renderCanvasHtml(l.doc, use, { dpi: SCREEN_DPI, marks: false, missing: l.doc.meta.form ? 'hide' : 'blank' })
                : renderDocHtml(l.doc, use, { missing: 'blank', paragraphs: 'blocks' });
        }
      }
      return {
        sheetHtml: node?.outerHTML ?? '',
        templateId: l.summary.id,
        letterheadId: l.detail.letterheadId,
        authorityId: null,
        docType: l.summary.title,
        destination: byRole('destination') || null,
        purpose: byRole('purpose') || null,
        values: use,
        copies,
        copyKind: 'نسخة أصلية',
        // المال صامت (§١): العمود باقٍ في القاعدة بلا قيمة.
        fee: 0
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, values, fields, asPrinted, copies]);

  const common = (printer: string | null) => ({
    operator: settings?.operatorName || null,
    printer,
    serialPrefix: settings?.serialPrefix ?? 'م',
    serialYear: settings?.serialYear ?? new Date().getFullYear(),
    gregorianDate: formatGregorian(new Date()),
    // الهجري يُقيَّد إن طبعته الترويسة — فالسجلّ يقول ما على الورقة.
    hijriDate: loaded.some((l) => printsHijri(l.layout)) ? formatHijri(new Date()) : null
  });

  async function issue(print: boolean) {
    if (!settings) return;
    if (merge) return issueMerged(print);
    if (!citizenName) {
      say('اكتب اسم صاحب العلاقة أولًا', 'warn');
      return;
    }
    // الطابعة قبل الإصدار: تُقيَّد مع الكتاب، وإلغاء السؤال لا يُصدر شيئًا.
    const pick = print ? await choosePrinter('documents') : null;
    if (print && !pick) return;
    const mode = valuesOnly ? 'values' : 'full';
    setBusy(true);
    try {
      const out = await window.diwan.documents.issueTransaction({
        ...common(pick?.printer ?? null),
        citizenId,
        citizenName,
        nationalId: byRole('nationalId') || null,
        sheets: collect()
      });
      const customer = { values: { ...values }, citizenId: out.citizenId ?? citizenId, genderByHand };
      const label = `معاملة ${citizenName} — ${out.documents[0]?.serial ?? ''}`;
      const n = copies;
      const original = repeatOf?.voidIt ? repeatOf : null;
      setAfter({
        outcome: { what: papersWithCopies(out.documents.length, n), printer: pick?.printer ?? null, serial: out.documents[0]?.serial ?? '' },
        ids: out.documents.map((d) => d.id),
        mode,
        label,
        copies: n,
        customer
      });
      onIssued?.();
      // جنسٌ حسمه الموظف لاسمٍ لم يُعرف، أو قلب فيه الاقتراح: يُحفظ فلا يُسأل عنه ثانيةً.
      const chosen = values[GENDER_KEY] as Gender | undefined;
      const guessed = guessGender(citizenName, learned);
      if (needsGender && genderByHand && chosen && (!guessed?.sure || guessed.gender !== chosen)) {
        remember([{ name: citizenName, gender: chosen }]);
      }
      // لا ملفّ له في السجل (لم يُختر ولم يدلّ عليه رقمه)؟ يُعرض حفظه قبل أن تُمحى الحقول.
      if (out.citizenId === null) offerToRegistry(out.transactionId);
      else setNewCitizen(null);
      reset();
      if (original) {
        try {
          await window.diwan.documents.void(original.id, original.reason.trim() || 'خطأ في الكتابة', settings?.operatorName || null);
          say(`صدرت النسخة الصحيحة ${out.documents[0]?.serial ?? ''}، وأُبطل الأصل ${original.serial} بسببه`);
          // وشريط ما خرج يقوله ثابتًا — فرسالة الطباعة بعده لا تمحوه.
          setAfter((a) => (a ? { ...a, outcome: { ...a.outcome, what: `${a.outcome.what} — وأُبطل الأصل ${original.serial}` } } : a));
        } catch (e) {
          // الإصدار تمّ؛ والإبطال يُقال وحده — ويُبطَل الأصل من الأرشيف.
          sayError(e, `صدرت النسخة، وتعذّر إبطال الأصل ${original.serial} — أبطله من الأرشيف`);
        }
      }
      if (pick) {
        await printIssued(out.documents.map((d) => d.id), pick.printer, mode, label, n);
      }
    } catch (e) {
      sayError(e, 'تعذّر الإصدار');
    } finally {
      setBusy(false);
    }
  }

  /**
   * الدمج: معاملةٌ لكل اسم، والدفعة كلّها أو لا شيء.
   *
   * ولكلّ اسمٍ جنسُه من اسمه — وما لم يُعرف يقينًا يُسأل عنه قبل الطباعة (ج٤)، فلا
   * يخرج «الطالب رسل» تخمينًا. و`decided` ما أجاب عنه الموظف للتوّ.
   */
  async function issueMerged(print: boolean, decided: Record<string, Gender> = {}) {
    if (!settings || !nameField) return;
    if (rows.length === 0) {
      say('اكتب أسماء القائمة أولًا — سطرٌ لكل اسم', 'warn');
      return;
    }
    const unsure = needsGender ? unsureNames(rows, learned, decided) : [];
    if (unsure.length > 0) {
      setGenderReview({ names: unsure, print });
      return;
    }
    const pick = print ? await choosePrinter('documents') : null;
    if (print && !pick) return;
    const mode = valuesOnly ? 'values' : 'full';
    setBusy(true);
    try {
      const all = await window.diwan.documents.issueBatch(
        rows.map((name) => {
          const rowValues = { ...values, [nameField.key]: name };
          // ولكلّ اسمٍ في القائمة جنسُه من اسمه: «زينب» طالبةٌ و«أحمد» طالب — وما سُئل عنه بجوابه.
          const g = needsGender ? (decided[name] ?? guessGender(name, learned)?.gender) : undefined;
          if (g) rowValues[GENDER_KEY] = g;
          return {
            ...common(pick?.printer ?? null),
            citizenId: null,
            citizenName: name,
            nationalId: byRole('nationalId') || null,
            sheets: collect(rowValues)
          };
        })
      );
      const papers = all.reduce((n, t) => n + t.documents.length, 0);
      const ids = all.flatMap((t) => t.documents.map((d) => d.id));
      const label = `دمج ${countIn(all.length, 'اسم')} — ${all[0]?.documents[0]?.serial ?? ''}`;
      const n = copies;
      setAfter({
        outcome: { what: `${papersWithCopies(papers, n)} — ${count(all.length, 'اسم')}`, printer: pick?.printer ?? null, serial: all[0]?.documents[0]?.serial ?? '' },
        ids,
        mode,
        label,
        copies: n,
        customer: null
      });
      onIssued?.();
      reset();
      if (pick) await printIssued(ids, pick.printer, mode, label, n);
    } catch (e) {
      sayError(e, 'تعذّر الإصدار');
    } finally {
      setBusy(false);
    }
  }

  return { issue, issueMerged };
}
