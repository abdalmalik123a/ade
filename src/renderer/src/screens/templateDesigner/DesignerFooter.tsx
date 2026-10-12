/**
 * تذييل مصمّم النماذج (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `TemplateDesigner` كما هو: الخطأ، والحذف بتأكيده، والإغلاق والحفظ.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count } from '@shared/arabic';

type Props = {
  restored: number | null;
  error: string | null;
  editing: boolean;
  confirmDelete: boolean;
  usage: number;
  remove: () => Promise<void>;
  setConfirmDelete: Dispatch<SetStateAction<boolean>>;
  closeDesigner: () => Promise<void>;
  saving: boolean;
  save: () => Promise<boolean>;
};

export default function DesignerFooter({ restored, error, editing, confirmDelete, usage, remove, setConfirmDelete, closeDesigner, saving, save }: Props) {
  return (
    <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
      <div className="flex items-center gap-space-sm min-w-0">
        {restored !== null && !error && (
          <span className="flex items-center gap-space-xs font-label-md text-label-md text-secondary truncate" data-restored="">
            <span className="material-symbols-outlined text-[18px]">history</span>
            حُمّلت النسخة {restored} — احفظ لتعتمدها، أو أغلق لتبقى الحالية
          </span>
        )}
        {error && (
          <span className="flex items-center gap-space-xs font-label-md text-label-md text-error truncate">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {error}
          </span>
        )}
      </div>
      <div className="flex items-center gap-space-sm shrink-0">
        {editing &&
          (confirmDelete ? (
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-error">
                {usage > 0 ? `صدر عنه ${count(usage, 'كتاب')} — احذف؟` : 'تأكيد الحذف؟'}
              </span>
              <button
                className="px-space-md h-9 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold"
                type="button"
                onClick={() => void remove()}
              >
                نعم، احذف
              </button>
              <button
                className="px-space-md h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                تراجع
              </button>
            </div>
          ) : (
            <button
              className="px-space-md h-9 rounded-lg text-error hover:bg-error-container transition-colors font-label-md text-label-md flex items-center gap-space-xs"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span>حذف النموذج</span>
            </button>
          ))}
        <button
          className="px-space-md h-9 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
          type="button"
          onClick={() => void closeDesigner()}
        >
          إلغاء
        </button>
        <button
          className="px-space-lg h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-space-xs transition-all disabled:opacity-40"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          <span>{saving ? 'جارٍ الحفظ...' : 'حفظ النموذج'}</span>
        </button>
      </div>
    </div>
  );
}
