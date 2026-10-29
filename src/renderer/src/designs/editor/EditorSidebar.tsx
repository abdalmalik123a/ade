/** الخصائص والطبقات ثابتتان ظاهرتان معًا؛ كل لوحة تتمرر دون دفع الإخراج خارج الشاشة. */
import ElementPanel from '../panels/ElementPanel';
import LayersPanel from '../panels/LayersPanel';
import ImportNotes from '../ImportNotes';
import type { DesignEditor } from './useDesignEditor';

export default function EditorSidebar({ ed }: { ed: DesignEditor }) {
  return <aside dir="rtl" className="w-[300px] xl:w-[320px] shrink-0 min-h-0 flex flex-col bg-surface-container-low border-l border-outline-variant" data-fixed-panels>
    <div className="px-space-sm py-space-xs shrink-0 font-label-sm text-label-sm text-on-surface-variant flex flex-wrap justify-between gap-1">
      <span data-size-chip>{ed.canvas.size.w.toFixed(1)} × {ed.canvas.size.h.toFixed(1)} ملم</span>
      {ed.draftSavedAt && <span data-status="design-draft" title="تُحفظ مسودّة وحدها">مسودّة {ed.draftSavedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>}
    </div>
    {ed.importNotes && <div className="max-h-32 overflow-auto px-space-sm"><ImportNotes where={ed.importNotes.where} lines={ed.importNotes.lines} onClose={() => ed.setImportNotes(null)} /></div>}
    <section className="flex-[3] min-h-0 flex flex-col border-b border-outline-variant" data-design-properties>
      <h2 className="shrink-0 px-space-sm py-space-xs font-label-md text-label-md font-semibold text-on-surface">الخصائص</h2>
      <div className="flex-1 min-h-0 overflow-auto p-space-xs">
        {ed.single ? <ElementPanel ed={ed} /> : <p className="p-space-sm font-label-sm text-label-sm text-on-surface-variant">اختر عنصرًا من اللوحة أو من الطبقات لتعديل خصائصه.</p>}
      </div>
    </section>
    <section className="flex-[2] min-h-0 flex flex-col" data-design-layers>
      <h2 className="shrink-0 px-space-sm py-space-xs font-label-md text-label-md font-semibold text-on-surface">الطبقات</h2>
      <div className="flex-1 min-h-0 overflow-auto p-space-xs"><LayersPanel ed={ed} /></div>
    </section>
  </aside>;
}
