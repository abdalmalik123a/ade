/**
 * تدقيق الكتاب المحدَّد: بصمته، وما طُبع منه، وتاريخه في السجلّ — وإبطاله (تقسيم الأرشيف بعد ١٫٧٫٠) — منقولٌ من `ArchiveScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count } from '@shared/arabic';
import { auditLabel } from '@shared/auditLabels';
import { localStamp } from '@shared/dates';
import type { DocumentDetail, AuditEntry } from '@shared/api';

type Props = {
  detail: DocumentDetail;
  busy: string | null;
  savePdf: (id: number) => Promise<void>;
  setVoidOpen: Dispatch<SetStateAction<boolean>>;
  voidOpen: boolean;
  voidReason: string;
  setVoidReason: Dispatch<SetStateAction<string>>;
  voidDoc: (id: number) => Promise<void>;
  history: AuditEntry[];
};

export default function DocumentInspect({ detail, busy, savePdf, setVoidOpen, voidOpen, voidReason, setVoidReason, voidDoc, history }: Props) {
  return (
    <div className="mx-space-md mb-space-sm p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs font-label-sm text-label-sm text-on-surface-variant" data-inspect="">
      <div className="flex flex-wrap items-center gap-space-md">
        <span className="flex items-center gap-1 text-on-surface font-semibold">
          <span className="material-symbols-outlined text-[16px] text-secondary">fingerprint</span>
          {detail.serial}
        </span>
        {detail.status === 'void' && (
          <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold" data-void-badge="">
            مُبطَل: {detail.voidReason}
          </span>
        )}
        {/* البصمة لمن يتحقّق — خلف «تفاصيل التوثيق» لا سطرًا من ٦٤ حرفًا يتصدّر الكتاب (البند ١٦). */}
        <details className="flex-1 min-w-0" data-fingerprint="">
          <summary className="cursor-pointer select-none">تفاصيل التوثيق</summary>
          <span className="block font-mono text-[10px] break-all" dir="ltr">
            {detail.sha256}
          </span>
        </details>
        <span>طُبع منه: {count(detail.printedCopies, 'نسخة')}</span>
        {detail.status !== 'void' && (
          <>
            <button
              className="text-secondary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
              type="button"
              disabled={busy !== null}
              onClick={() => void savePdf(detail.id)}
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              حفظ نسخة PDF
            </button>
            <button
              className="text-error font-semibold hover:underline flex items-center gap-1"
              data-act="void"
              type="button"
              onClick={() => setVoidOpen((o) => !o)}
            >
              <span className="material-symbols-outlined text-[16px]">block</span>
              أبطِل
            </button>
          </>
        )}
      </div>
      {voidOpen && (
        <div className="flex items-center gap-space-xs flex-wrap" data-void-form="">
          <span className="text-on-surface">سبب الإبطال — يبقى الكتاب برقمه ولا يُعاد طبعه:</span>
          <input
            autoFocus
            className="flex-1 min-w-[16rem] h-8 px-2 rounded bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-error"
            data-void-reason=""
            placeholder="مثال: صدر باسمٍ خاطئ، وأُعيد برقمٍ جديد"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <button
            className="h-8 px-3 rounded bg-error text-on-error font-semibold disabled:opacity-40"
            data-act="void-confirm"
            type="button"
            disabled={!voidReason.trim() || busy !== null}
            onClick={() => void voidDoc(detail.id)}
          >
            أبطِله
          </button>
        </div>
      )}
      {history.length > 0 && (
        <div className="flex flex-wrap gap-x-space-md gap-y-0.5" data-history="">
          {[...history].reverse().map((h) => (
            <span key={h.id}>
              {auditLabel(h)} · {localStamp(h.at)}
              {h.operator ? ` · ${h.operator}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
