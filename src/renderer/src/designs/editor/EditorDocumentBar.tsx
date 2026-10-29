/** اسم المستند ومداخله وحفظه؛ منفصلة عن خيارات العنصر المختار. */
import type { DesignEditor } from './useDesignEditor';

const BTN = 'h-8 px-2 rounded-btn bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 shrink-0 disabled:opacity-40';
export default function EditorDocumentBar({ ed, openPanel }: { ed: DesignEditor; openPanel: (panel: 'page' | 'fill') => void }) {
  return <header className="min-h-12 px-space-sm py-space-xs flex flex-wrap items-center gap-space-xs bg-surface-container-lowest border-b border-outline-variant shrink-0" data-design-document-bar>
    <button type="button" className={BTN} data-act="gallery" onClick={() => ed.setView('gallery')}>كل التصاميم</button>
    <button type="button" className={BTN} title="بدء تصميم فارغ جديد (البدء من الصفر)" onClick={() => ed.setNewBlankModalOpen(true)}>＋ جديد</button>
    <input className="input-field flex-1 w-32 min-w-24 h-8 px-2 font-label-md text-label-md" data-title aria-label="اسم التصميم"
      placeholder="اسم التصميم — مثال: هوية طالب" value={ed.title} onChange={(e) => ed.setTitle(e.target.value)} />
    <button type="button" className={BTN} data-design-panel="page" onClick={() => openPanel('page')}>الصفحة والاستيراد</button>
    <button type="button" className={BTN} data-design-panel="fill" onClick={() => openPanel('fill')}>تعبئة ودفعة</button>
    <button type="button" className={BTN} data-act="save" disabled={ed.busy} title={ed.designId !== null ? 'احفظ التعديلات على نفس التصميم' : 'احفظ التصميم'} onClick={() => void ed.save(false)}>
      <span className="material-symbols-outlined text-[17px]">save</span>{ed.designId !== null ? 'حفظ التعديلات' : 'حفظ التصميم'}
    </button>
    {ed.designId !== null && <button type="button" className={BTN} data-act="save-copy" disabled={ed.busy} title="احفظ كنسخة جديدة منفصلة" onClick={() => void ed.save(true)}>حفظ كنسخة</button>}
  </header>;
}
