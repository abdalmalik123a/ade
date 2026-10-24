/**
 * جدول الكتب الصادرة: التحديد، ورقم الصادر ونسخه، وصاحب العلاقة، وإعادة الطبع، و«كرّره» (تقسيم الأرشيف بعد ١٫٧٫٠) — منقولٌ
 * من `ArchiveScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import { COLUMNS, nf, type Period } from './shared';
import type { DocumentRow } from '@shared/api';

type Props = {
  allChecked: boolean;
  rows: DocumentRow[];
  setSelected: Dispatch<SetStateAction<Set<number>>>;
  query: string;
  period: Period;
  inspected: number | null;
  setInspected: Dispatch<SetStateAction<number | null>>;
  selected: Set<number>;
  toggle: (id: number) => void;
  setToast: Dispatch<SetStateAction<string | null>>;
  busy: string | null;
  reprint: (ids: number[]) => Promise<void>;
  onOpenInEditor: ((documentId: number) => void) | undefined;
};

export default function DocumentsTable({ allChecked, rows, setSelected, query, period, inspected, setInspected, selected, toggle, setToast, busy, reprint, onOpenInEditor }: Props) {
  return (
    <div className="overflow-x-auto w-full max-h-[62vh]">
      <table className="w-full text-right border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm select-none">
            <th className="p-space-md w-12 text-center">
              <input
                className="w-4 h-4 accent-secondary cursor-pointer"
                type="checkbox"
                checked={allChecked}
                disabled={rows.length === 0}
                onChange={() => setSelected(allChecked ? new Set() : new Set(rows.filter((r) => r.status !== 'void').map((r) => r.id)))}
              />
            </th>
            {COLUMNS.map((c) => (
              <th key={c} className="p-space-md font-bold">
                {c}
              </th>
            ))}
            <th className="p-space-md font-bold text-center">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="font-body-sm text-body-sm text-on-surface">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 2}>
                <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px]">{query ? 'manage_search' : 'inbox'}</span>
                  <span className="font-body-md text-body-md">
                    {query
                      ? 'لا كتاب يطابق هذا البحث في السجلّ كلّه'
                      : period === 'today'
                        ? 'لم يصدر أي كتاب اليوم'
                        : 'لا كتب في المدة المختارة'}
                  </span>
                  <span className="font-label-sm text-label-sm">كل كتابٍ يصدر يُقيَّد هنا برقم صادرٍ وبصمة توثيق</span>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id}
                className={`${row.id === inspected ? 'bg-surface-container-highest/60' : i % 2 ? 'bg-surface-container-low/40' : ''} ${
                  row.status === 'void' ? 'text-on-surface-variant' : ''
                } hover:bg-surface-container-high transition-colors cursor-pointer`}
                data-row-status={row.status}
                onClick={() => setInspected(row.id)}
              >
                <td className="p-space-md text-center">
                  <input
                    className="w-4 h-4 accent-secondary cursor-pointer"
                    type="checkbox"
                    checked={selected.has(row.id)}
                    disabled={row.status === 'void'}
                    onChange={() => toggle(row.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="p-space-md font-mono">
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-1 rounded bg-surface-container font-bold text-label-md ${row.status === 'void' ? 'line-through' : 'text-secondary'}`}>
                      {row.serial}
                    </span>
                    {row.status === 'void' && (
                      <span className="px-1.5 rounded-full bg-error-container text-on-error-container text-[10px] font-sans font-semibold" title={row.voidReason ?? ''}>
                        مُبطَل
                      </span>
                    )}
                    <button
                      className="p-1 text-on-surface-variant hover:text-on-surface rounded"
                      title="نسخ رقم الصادر"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void window.diwan.ui.copyText(row.serial);
                        setToast(`نُسخ ${row.serial} إلى الحافظة`);
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </td>
                <td className="p-space-md">
                  <div className="flex flex-col">
                    <span className="font-bold text-label-lg">{row.citizenName || '—'}</span>
                    {row.nationalId && <span className="font-mono text-label-sm text-on-surface-variant">وطنية: {row.nationalId}</span>}
                  </div>
                </td>
                <td className="p-space-md">{row.docType ?? '—'}</td>
                <td className="p-space-md">{row.destination ?? '—'}</td>
                <td className="p-space-md">
                  <div className="flex flex-col">
                    <span className="font-mono text-label-sm font-semibold">
                      {row.issuedDate} {row.issuedTime}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {row.copies === 1 ? 'نسخة واحدة' : `${nf.format(row.copies)} نسخ`}
                    </span>
                  </div>
                </td>
                <td className="p-space-md text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      className="w-8 h-8 rounded-btn bg-surface-container-high hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-all disabled:opacity-30"
                      title={row.status === 'void' ? 'مُبطَل — لا يُعاد طبعه' : 'إعادة طباعة طبق الأصل'}
                      type="button"
                      disabled={busy !== null || row.status === 'void'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void reprint([row.id]);
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                    </button>
                    <button
                      className="w-8 h-8 rounded-btn bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center transition-all"
                      title="كرّره — نسخةٌ جديدة من حيث كُتب (الشبّاك أو المحرّر)، والأصل يبقى كما صدر"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInEditor?.(row.id);
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit_square</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
