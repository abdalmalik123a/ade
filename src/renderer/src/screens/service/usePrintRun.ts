/**
 * طباعة ما صدر في الشبّاك (خطة Production، ٢٫٣) — منقولةٌ من `ServiceScreen` كما هي (تقسيم الشبّاك بعد ١٫٧٫٠).
 */
import { useState } from 'react';
import type { PrintJobResult } from '@shared/api';
import { errorText } from '../../lib/errors';
import type { Toast } from '../../kit/useToast';
import type { PrintRun } from './types';

export function usePrintRun(say: (text: string, tone?: Toast['tone']) => void) {
  /**
   * الأوراق تُرسل ورقةً ورقة بسجلٍّ على القرص، والموظف يرى كم طُبع: «طُبعت ٣ من ٥». وما توقّف
   * (طابعةٌ لا تستجيب، ورقٌ نفد) يبقى معروضًا ليُكمَل من حيث وقف أو يُترك — الكتب صدرت وفي
   * الأرشيف، فلا تُصدر ثانيةً لتُطبع.
   */
  const [printRun, setPrintRun] = useState<PrintRun | null>(null);

  async function followPrint(run: () => Promise<PrintJobResult>, total: number, from = 0) {
    setPrintRun((r) => ({ id: r?.id, sent: from, total, running: true }));
    const off = window.diwan.output.onPrintProgress((p) =>
      setPrintRun((r) => (r ? { ...r, id: p.id, sent: p.sent, total: p.total } : r))
    );
    try {
      const out = await run();
      if (out.ok) {
        setPrintRun(null);
        say(`طُبعت ${out.sent} من ${out.total}`);
      } else {
        setPrintRun({ id: out.id, sent: out.sent, total: out.total, reason: out.reason, running: false });
      }
    } catch (e) {
      setPrintRun((r) => ({
        id: r?.id,
        sent: r?.sent ?? from,
        total,
        reason: errorText(e, 'تعذّرت الطباعة'),
        running: false
      }));
    } finally {
      off();
    }
  }

  const printIssued = (ids: number[], printer: string, mode: 'full' | 'values', label: string, n = 1) =>
    followPrint(() => window.diwan.documents.printIssued({ ids, printer, mode, label, copies: n }), ids.length * n);

  async function resumePrint() {
    const run = printRun;
    if (!run?.id) return;
    await followPrint(() => window.diwan.output.resumeJob(run.id!, run.sent), run.total, run.sent);
  }

  async function dropPrint() {
    if (printRun?.id) await window.diwan.output.discardJob(printRun.id);
    setPrintRun(null);
    say('تُركت الطباعة — الكتب صدرت، وتُعاد طباعتها من الأرشيف');
  }

  return { printRun, printIssued, resumePrint, dropPrint };
}
