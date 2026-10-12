/**
 * ما خرج الآن في الشبّاك (ن٩) (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: إعادة طبعه، وحفظه PDF من السجلّ، و«شيءٌ آخر لنفس الزبون».
 */
import { useState, type Dispatch, type SetStateAction } from 'react';
import type { AfterIssue } from './types';
import { choosePrinter } from '../../lib/printChoice';
import { count } from '@shared/arabic';
import type { Toast, ToastAction } from '../../kit/useToast';

export function useAfterIssue(
  ctx: {
    printIssued: (ids: number[], printer: string, mode: 'full' | 'values', label: string, n?: number) => Promise<void>;
    say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    setCitizenId: Dispatch<SetStateAction<number | null>>;
    setGenderByHand: Dispatch<SetStateAction<boolean>>;
  }
) {
  const { printIssued, say, setValues, setCitizenId, setGenderByHand } = ctx;

  /**
   * ما خرج الآن (ن٩): يُقال في شريطٍ بعد الطبع — وأين خرج، وبرقمه في السجلّ — ومنه «أعد الطبع»
   * و«شيءٌ آخر لنفس الزبون» (تعود قيمه إلى ورقة الإدخال للمختار التالي).
   */
  const [after, setAfter] = useState<AfterIssue | null>(null);

  async function reprintAfter() {
    if (!after) return;
    const printer = after.outcome.printer ?? (await choosePrinter('documents'))?.printer;
    if (!printer) return;
    setAfter({ ...after, outcome: { ...after.outcome, printer } });
    await printIssued(after.ids, printer, after.mode, after.label, after.copies);
  }

  /** ما قُيِّد الآن ملفًّا للزبون (واتساب، بريد) — كلّ كتابٍ ملفّه، من السجلّ كما صدر. */
  async function pdfAfter() {
    if (!after) return;
    let saved = 0;
    for (const id of after.ids) if (await window.diwan.documents.exportPdf(id)) saved++;
    if (saved) say(saved === 1 ? 'حُفظ PDF من السجلّ كما صدر' : `حُفظت من السجلّ ${count(saved, 'ملف')} PDF`);
  }

  function sameCustomer() {
    if (!after?.customer) return;
    setValues(after.customer.values);
    setCitizenId(after.customer.citizenId);
    setGenderByHand(after.customer.genderByHand);
    setAfter(null);
    say('الزبون نفسه — اختر ما يريده بعدُ، وحقوله مملوءة');
  }

  return { setAfter, after, reprintAfter, pdfAfter, sameCustomer };
}
