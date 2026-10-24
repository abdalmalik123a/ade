/**
 * المكتبة الفارغة بأقصر الطرق إليها (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */
import type { TemplateSummary } from '@shared/api';

type Props = {
  items: TemplateSummary[];
  busy: boolean;
  importFolder: () => Promise<void>;
  openDesigner: (id: number | null) => Promise<void>;
};

export default function LibraryEmpty({ items, busy, importFolder, openDesigner }: Props) {
  return (
    <section className="bg-surface-container-lowest rounded-card shadow-low py-space-xl flex flex-col items-center gap-space-sm">
      <span className="material-symbols-outlined text-[44px] text-on-surface-variant">
        library_add
      </span>
      <span className="font-headline-sm text-headline-sm text-on-surface">
        {items.length === 0 ? 'مكتبة النماذج فارغة' : 'لا نتائج مطابقة'}
      </span>
      <span className="font-label-md text-label-md text-on-surface-variant">
        {items.length === 0
          ? 'ابدأ من «ورقة فارغة» أو «استورد» أعلاه: ملف Word، أو مجلد ملفاتك كلّه، أو حزمة جهة'
          : 'جرّب كلمة بحث أخرى أو تصنيفًا مختلفًا'}
      </span>
      {/* المكتبة الفارغة تعرض أقصر الطرق إليها في مكانها (خطة Production، ٣٫٥): مجلد ملفات المكتب كلّه. */}
      {items.length === 0 && (
        <div className="flex flex-wrap justify-center gap-space-sm pt-space-xs">
          <button
            className="h-11 px-space-lg btn-act font-label-lg text-label-lg font-bold flex items-center gap-space-xs disabled:opacity-50"
            data-act="empty-import-folder"
            disabled={busy}
            type="button"
            onClick={() => void importFolder()}
          >
            <span className="material-symbols-outlined text-[20px]">folder_open</span>
            استورد مجلدي
          </button>
          <button
            className="h-11 px-space-md rounded-card bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-space-xs"
            data-act="empty-new-blank"
            type="button"
            onClick={() => void openDesigner(null)}
          >
            <span className="material-symbols-outlined text-[20px]">note_add</span>
            ورقة فارغة
          </button>
        </div>
      )}
    </section>
  );
}
