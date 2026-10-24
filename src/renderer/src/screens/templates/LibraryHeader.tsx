/**
 * رأس مكتبة النماذج (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `TemplatesScreen` كما هو: ورقةٌ فارغة، و«استورد» بطرقه كلّها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count } from '@shared/arabic';
import type { TemplateStats } from '@shared/api';

type Props = {
  stats: TemplateStats | null;
  openDesigner: (id: number | null) => Promise<void>;
  importing: boolean;
  busy: boolean;
  setImporting: Dispatch<SetStateAction<boolean>>;
  importTemplate: () => Promise<void>;
  importFolder: () => Promise<void>;
  importExcel: () => Promise<void>;
  setPaperOpen: Dispatch<SetStateAction<boolean>>;
  setFormOpen: Dispatch<SetStateAction<boolean>>;
  onImportDesign: (() => void) | undefined;
  openPacksModal: () => Promise<void>;
};

export default function LibraryHeader({ stats, openDesigner, importing, busy, setImporting, importTemplate, importFolder, importExcel, setPaperOpen, setFormOpen, onImportDesign, openPacksModal }: Props) {
  return (
    <section className="flex flex-wrap items-center gap-space-sm" data-new-template="">
      <div className="me-auto">
        <h1 className="font-headline-md text-headline-md text-on-surface font-bold">المكتبة</h1>
        <p className="font-label-md text-label-md text-on-surface-variant">
          ما يُبنى مرّةً ويُطبع كثيرًا — {count(stats?.activeTemplates ?? 0, 'نموذج', 'لا نماذج بعد')} بأقسام جهاتها
        </p>
      </div>
      <button
        className="h-11 px-space-lg btn-act font-label-lg text-label-lg font-bold flex items-center gap-space-xs"
        data-act="new-blank"
        title="اكتب على الورقة، وظلّل ما يتغيّر واضغط F4"
        type="button"
        onClick={() => void openDesigner(null)}
      >
        <span className="material-symbols-outlined text-[20px]">note_add</span>
        ورقة فارغة
      </button>
      <div className="relative">
        <button
          aria-expanded={importing}
          className="h-11 px-space-lg rounded-card bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold flex items-center gap-space-xs shadow-low disabled:opacity-50"
          data-act="import-menu"
          disabled={busy}
          type="button"
          onClick={() => setImporting((v) => !v)}
        >
          <span className="material-symbols-outlined text-[20px] text-secondary">upload_file</span>
          استورد
          <span className="material-symbols-outlined text-[18px]">expand_more</span>
        </button>
        {/* في الصفحة دائمًا ومخفيّةٌ حتى تُفتح — فالطرق تُعدّ وتُختبر بأسمائها. */}
        <div
          className={`${importing ? '' : 'hidden'} absolute z-30 top-full mt-1 end-0 w-[22rem] p-space-xs surface-panel border border-outline-variant`}
          data-import-menu=""
        >
          {(
            [
              { act: 'new-word', icon: 'description', label: 'ملفّ Word', hint: 'بتنسيقه كما رُسم في Word', run: () => void importTemplate() },
              { act: 'new-folder', icon: 'folder_open', label: 'مجلّد ملفّات Word', hint: 'ملفات المكتب كلّها دفعةً واحدة', run: () => void importFolder() },
              { act: 'new-excel', icon: 'table_view', label: 'كتب من ملف Excel', hint: 'كلّ ورقةٍ كتاب، وبيانات المدرسة خانات', run: () => void importExcel() },
              { act: 'new-photo', icon: 'document_scanner', label: 'صورة ورقة', hint: 'تُقرأ على هذا الجهاز — والتواقيع والأختام لا تُنقل', run: () => setPaperOpen(true) },
              { act: 'new-form-image', icon: 'dynamic_form', label: 'صورة استمارة', hint: 'صورة الدائرة كما هي، والخانات فوقها', run: () => setFormOpen(true) },
              { act: 'new-design-import', icon: 'layers', label: 'تصميم من Photoshop أو PDF', hint: 'شهادة أو بطاقة بطبقاتها — في التصاميم', run: () => onImportDesign?.() },
              { act: 'content-import', icon: 'inventory_2', label: 'حزمة جهةٍ أو مكتب', hint: 'نماذج وترويسات جاهزة — ما ليس عندك يُضاف', run: () => void openPacksModal() }
            ] as const
          ).map((o) => (
            <button
              key={o.act}
              className="w-full px-space-sm py-1.5 rounded-btn hover:bg-surface-container-high transition-colors text-right flex items-center gap-space-sm disabled:opacity-50"
              data-act={o.act}
              disabled={busy}
              type="button"
              onClick={() => {
                setImporting(false);
                o.run();
              }}
            >
              <span className="material-symbols-outlined text-[20px] text-secondary">{o.icon}</span>
              <span className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-semibold">{o.label}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
