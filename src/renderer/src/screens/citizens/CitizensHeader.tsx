/**
 * رأس «الأشخاص» وإجراءاته (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `CitizensScreen` كما هو. عرضٌ وحده: الحال والدوالّ تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { ScannerDevice, CitizenDetail } from '@shared/api';

type Props = {
  busy: string | null;
  checkScanner: () => Promise<void>;
  scanners: ScannerDevice[] | null;
  setIdDuplexOpen: Dispatch<SetStateAction<boolean>>;
  setIdSheetOpen: Dispatch<SetStateAction<boolean>>;
  setImportOpen: Dispatch<SetStateAction<boolean>>;
  setForm: Dispatch<SetStateAction<{ open: boolean; initial: CitizenDetail | null; }>>;
};

export default function CitizensHeader({ busy, checkScanner, scanners, setIdDuplexOpen, setIdSheetOpen, setImportOpen, setForm }: Props) {
  return (
    <section className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
      <div className="flex flex-col gap-space-xs">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">
          الأشخاص
        </h2>
        <div className="flex items-center gap-space-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
          <span className="font-label-sm text-label-sm">
            أرشيف محلي مؤمّن — لا تغادر بيانات المواطن هذا الجهاز
          </span>
        </div>
      </div>
      <div className="flex items-center gap-space-sm">
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-btn bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-low disabled:opacity-40"
          type="button"
          disabled={busy === 'scanner'}
          onClick={() => void checkScanner()}
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">
            document_scanner
          </span>
          <span>فحص الماسح الضوئي</span>
          {scanners !== null && (
            <span
              className={
                scanners.length > 0
                  ? 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed'
                  : 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant'
              }
            >
              {scanners.length > 0 ? 'متصل' : 'غير متصل'}
            </span>
          )}
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-btn bg-surface-container-lowest text-secondary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-semibold shadow-low"
          type="button"
          title="الهوية والبطاقة بوجهيها بمقاسها الحقيقي على ورقة A4"
          onClick={() => setIdDuplexOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>استنساخ هوية</span>
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-btn bg-surface-container-lowest text-secondary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-semibold shadow-low"
          data-act="open-id-sheet"
          type="button"
          title="عدّة مستمسكاتٍ بمقاسها الحقيقي على ورقة A4 واحدة — الوطنية والسكن وجهًا وظهرًا"
          onClick={() => setIdSheetOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>ورقة المستمسكات</span>
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-btn bg-surface-container-lowest text-secondary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-semibold shadow-low"
          data-act="citizens-import"
          type="button"
          title="قائمة زبائن من ملف Excel أو CSV — من له ملفٌّ يُكمل فارغه ولا يتكرّر"
          onClick={() => setImportOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          <span>استورد من Excel</span>
        </button>
        <button
          className="flex items-center gap-space-xs px-space-lg h-10 btn-act font-label-md text-label-md font-bold transition-all"
          type="button"
          onClick={() => setForm({ open: true, initial: null })}
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>إضافة ملف مواطن</span>
        </button>
      </div>
    </section>
  );
}
