/**
 * إخراج ورقة الأسئلة (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: النسخ، والحفظ، وPDF، والطباعة.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { ToolOutput } from '../../components/ToolFrame';
import { NUM_INPUT } from './shared';
import type { Outcome } from '../../components/OutputBar';

type Props = {
  after: Outcome | null;
  setAfter: Dispatch<SetStateAction<Outcome | null>>;
  lastJob: MutableRefObject<{ sheetHtml: string; copies: number; printer: string; system: boolean; what: string; } | null>;
  send: (job: { sheetHtml: string; copies: number; printer: string; system: boolean; what: string; }) => Promise<void>;
  copies: number;
  setCopies: Dispatch<SetStateAction<number>>;
  busy: boolean;
  save: () => Promise<boolean>;
  exportPdf: () => Promise<void>;
  print: () => Promise<void>;
};

export default function PaperOutput({ after, setAfter, lastJob, send, copies, setCopies, busy, save, exportPdf, print }: Props) {
  return (
    <ToolOutput
      bar
      after={after}
      role="papers"
      onDismiss={() => setAfter(null)}
      onReprint={lastJob.current ? () => void send(lastJob.current!) : undefined}
    >
      <div className="flex-1" />
        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
          نسخ
          <input
            className={NUM_INPUT}
            inputMode="numeric"
            title="عدد النسخ"
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
          />
        </label>

        <button
          className="h-9 px-space-md rounded-btn bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
          data-act="save"
          title="احفظ ورقة الأسئلة"
          type="button"
          disabled={busy}
          onClick={() => void save()}
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          حفظ
        </button>
        <button
          className="h-9 px-space-md rounded-btn bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
          data-act="pdf"
          title="احفظ نسخة PDF"
          type="button"
          onClick={() => void exportPdf()}
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          PDF
        </button>
        <button
          className="h-9 px-space-md btn-act font-label-md text-label-md font-semibold flex items-center gap-1.5 disabled:opacity-50"
          data-act="print"
          title="اطبع الورقة بعدد النسخ — بلا إصدار"
          type="button"
          disabled={busy}
          onClick={() => void print()}
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          اطبع
        </button>
    </ToolOutput>
  );
}
