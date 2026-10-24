/**
 * أزرار استنساخ الهوية (تقسيم النافذة بعد ١٫٧٫٠) — منقولةٌ من `IdDuplexDialog` كما هي: الرسالة، والطابعة، والحفظ PDF والطباعة.
 */
import { PrinterNote } from '../../components/OutputBar';
import type { Toast } from '../../kit/useToast';
import type { PrintRoles } from '@shared/printRoles';

type Props = {
  onClose: () => void;
  toast: Toast | null;
  printRoles: PrintRoles | null;
  busy: boolean;
  pagesHtml: string[];
  handleSavePdf: () => Promise<void>;
  handlePrint: () => Promise<void>;
};

export default function IdActions({ onClose, toast, printRoles, busy, pagesHtml, handleSavePdf, handlePrint }: Props) {
  return (
    <footer className="px-6 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-4 h-10 rounded-btn text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
          onClick={onClose}
        >
          إغلاق
        </button>
        {toast && (
          <span
            className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
              toast.tone === 'warn' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-secondary'
            }`}
          >
            {toast.text}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        {/* الطابعة مكتوبةً قبل «اطبع» — كشريط الإخراج في كلّ أداة (المرحلة ٥). */}
        <PrinterNote role="copies" roles={printRoles} />
        <button
          type="button"
          disabled={busy || pagesHtml.length === 0}
          className="px-4 h-10 rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-40"
          onClick={() => void handleSavePdf()}
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          حفظ كملف PDF
        </button>

        <button
          type="button"
          disabled={busy || pagesHtml.length === 0}
          className="px-6 h-10 btn-act font-label-md text-label-md font-semibold flex items-center gap-2 transition-all disabled:opacity-40"
          onClick={() => void handlePrint()}
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          اطبع A4 بمقاسها (١:١)
        </button>
      </div>
    </footer>
  );
}
