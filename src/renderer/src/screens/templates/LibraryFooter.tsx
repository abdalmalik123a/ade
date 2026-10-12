/**
 * تذييل مكتبة النماذج (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `TemplatesScreen` كما هو: حزم المحتوى تصديرًا واستيرادًا.
 */

type Props = {
  busy: boolean;
  exportContent: () => Promise<void>;
};

export default function LibraryFooter({ busy, exportContent }: Props) {
  return (
    <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row items-center justify-between gap-space-md">
      <div className="flex items-center gap-space-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px] text-secondary">folder_zip</span>
        <span className="font-label-sm text-label-sm">
          مكتبة محلية بالكامل — وحزمة المحتوى تنقلها إلى جهازٍ أو مكتبٍ آخر
        </span>
      </div>
      <div className="flex items-center gap-space-sm">
        <button
          className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
          data-act="content-export"
          title="النماذج والترويسات والكليشات وصورها في ملفٍّ واحد — بلا بيانات الناس"
          type="button"
          disabled={busy}
          onClick={() => void exportContent()}
        >
          <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
          <span>صدّر حزمة المحتوى</span>
        </button>
      </div>
    </section>
  );
}
