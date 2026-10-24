/**
 * «ملفات PDF» قبل أن يُفتح ملفّ (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو.
 */

type Props = {
  open: () => Promise<void>;
  scan: () => Promise<void>;
};

export default function PdfEmpty({ open, scan }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-space-md text-center p-space-lg" data-pdf-empty="">
      <span className="material-symbols-outlined text-[64px] text-secondary">picture_as_pdf</span>
      <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">ملفات PDF</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
        أضف نصًّا أو شعارًا أو علامةً مائية أو رقم الصفحة، وقصّ وقسّم وادمج ورتّب، وصغّر الملف لحدّ خانة الرفع — على
        هذا الجهاز، فلا تُرفع مستمسكات الزبائن إلى مواقع الإنترنت. والحفظ ملفٌّ جديد، والأصل يبقى كما وصل.
      </p>
      <div className="flex items-center gap-space-sm">
        <button
          className="h-11 px-space-lg btn-act font-label-lg text-label-lg font-semibold flex items-center gap-2"
          type="button"
          onClick={() => void open()}
        >
          <span className="material-symbols-outlined">folder_open</span>افتح PDF أو صورًا
        </button>
        <button
          className="h-11 px-space-lg rounded-card bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold flex items-center gap-2"
          type="button"
          onClick={() => void scan()}
        >
          <span className="material-symbols-outlined">scanner</span>امسح من الماسح
        </button>
      </div>
    </div>
  );
}
