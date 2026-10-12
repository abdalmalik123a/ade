/**
 * كتب الزبون الصادرة في ملفّه (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `CitizensScreen` كما هي، و«كرّره» و«أعد الطبع» لكلٍّ.
 */
import type { CitizenDetail } from '@shared/api';

type Props = {
  detail: CitizenDetail;
  onRepeatDocument: ((documentId: number) => void) | undefined;
  reprintDocument: (id: number) => Promise<void>;
};

export default function CitizenDocuments({ detail, onRepeatDocument, reprintDocument }: Props) {
  return (
    <div className="flex flex-col gap-space-sm pt-space-xs">
      <h4 className="font-headline-sm text-headline-sm text-on-surface">
        سجل المعاملات والكتب الإدارية الصادرة للمواطن
      </h4>
      {detail.documents.length === 0 ? (
        <div className="py-space-lg rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[28px]">history_edu</span>
          <span className="font-label-md text-label-md">
            لم يصدر أي كتاب لهذا المواطن بعد
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                {['رقم الصادر', 'نوع الكتاب', 'الجهة', 'التاريخ', 'الإجراء'].map((c) => (
                  <th key={c} className="p-space-sm font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm">
              {detail.documents.map((d) => (
                <tr key={d.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="p-space-sm font-mono font-bold text-secondary">
                    {d.serial}
                  </td>
                  <td className="p-space-sm">{d.docType ?? '—'}</td>
                  <td className="p-space-sm text-on-surface-variant">
                    {d.destination ?? '—'}
                  </td>
                  <td className="p-space-sm font-mono text-label-sm">{d.issuedDate}</td>
                  <td className="p-space-sm">
                    <div className="flex items-center gap-1">
                      {/* الكتاب نفسه بقيمه — لا ورقةٌ فارغة باسم الزبون (د١): كان يمرّر رقم الزبون. */}
                      <button
                        className="px-space-sm h-8 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-sm text-label-sm flex items-center gap-1"
                        data-act="repeat-document"
                        type="button"
                        title="كرّره: الكتاب نفسه بقيمه برقم صادر جديد وتأريخ اليوم — والأصل يبقى في السجلّ كما خرج"
                        onClick={() => onRepeatDocument?.(d.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        <span>كرّره</span>
                      </button>
                      <button
                        className="px-space-sm h-8 rounded-lg text-on-surface hover:bg-surface-container-highest font-label-sm text-label-sm flex items-center gap-1"
                        data-act="reprint-document"
                        type="button"
                        title="أعد طبعه كما صدر — برقمه نفسه، وتُقيَّد الطبعة في السجلّ"
                        onClick={() => void reprintDocument(d.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        <span>أعد الطبع</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
