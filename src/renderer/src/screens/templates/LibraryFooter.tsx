/**
 * تذييل مكتبة النماذج (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `TemplatesScreen` كما هو: حزم المحتوى تصديرًا واستيرادًا.
 */

import { useState } from 'react';
import { CONTENT_SECTIONS, SECTION_LABEL, type ContentSection } from '@shared/sealedPack';

type Props = {
  busy: boolean;
  exportContent: (section?: ContentSection) => Promise<void>;
};

export default function LibraryFooter({ busy, exportContent }: Props) {
  const [section, setSection] = useState<ContentSection>('templates');
  return (
    <section className="bg-surface-container-lowest rounded-card p-space-md shadow-low flex flex-col lg:flex-row items-center justify-between gap-space-md">
      <div className="flex items-center gap-space-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px] text-secondary">folder_zip</span>
        <span className="font-label-sm text-label-sm">
          مكتبة محلية بالكامل — وحزمة المحتوى تنقلها إلى جهازٍ أو مكتبٍ آخر
        </span>
      </div>
      <div className="flex items-center gap-space-sm flex-wrap">
        <select aria-label="القسم المراد تصديره" data-content-section value={section} disabled={busy}
          onChange={(e) => setSection(e.target.value as ContentSection)}
          className="h-9 px-space-sm rounded-btn border border-outline-variant bg-surface-container-low text-on-surface font-label-md text-label-md">
          {CONTENT_SECTIONS.map((key) => <option key={key} value={key}>{SECTION_LABEL[key]}</option>)}
        </select>
        <button type="button" data-act="content-export-section" disabled={busy} onClick={() => void exportContent(section)}
          className="h-9 px-space-md rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40">
          صدّر القسم
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
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
