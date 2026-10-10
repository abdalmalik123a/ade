/**
 * عمود الأدوات بجانب اللوحة: العودة إلى المعرض، واسم التصميم ومقاسه، ثم اللوحات بترتيب العمل — املأ، والدفعة،
 * والخلفية والمقاس، والإضافة، وخصائص المحدَّد، والطبقات.
 */
import BatchPanel from '../BatchPanel';
import FillPanel from '../panels/FillPanel';
import PagePanel from '../panels/PagePanel';
import AddPanel from '../panels/AddPanel';
import ElementPanel from '../panels/ElementPanel';
import LayersPanel from '../panels/LayersPanel';
import ImportNotes from '../ImportNotes';
import type { DesignEditor } from './useDesignEditor';

export default function EditorSidebar({ ed }: { ed: DesignEditor }) {
  const { canvas, designId, doc } = ed;
  return (
    <section className="w-[420px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md">
      <header className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-1.5">
          <button
            className="h-9 px-space-sm -mx-space-sm rounded-lg hover:bg-surface-container-high font-label-md text-label-md text-on-surface-variant flex items-center gap-1"
            data-act="gallery"
            type="button"
            onClick={() => ed.setView('gallery')}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            كل التصاميم
          </button>
          <button
            className="h-8 px-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant font-label-xs text-label-xs text-on-surface flex items-center gap-1"
            title="بدء تصميم فارغ جديد (البدء من الصفر)"
            type="button"
            onClick={() => ed.setNewBlankModalOpen(true)}
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            جديد
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {designId !== null && (
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary font-label-xs text-[11px] font-bold">تعديل محفوظ</span>
          )}
          <span className="font-label-sm text-label-sm text-on-surface-variant tabular" data-size-chip="">
            {canvas.size.w} × {canvas.size.h} ملم
          </span>
        </div>
      </header>

      <input
        className="w-full h-9 px-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface"
        data-title
        placeholder="اسم التصميم — مثال: هوية طالب"
        value={ed.title}
        onChange={(e) => ed.setTitle(e.target.value)}
      />

      {ed.importNotes && <ImportNotes where={ed.importNotes.where} lines={ed.importNotes.lines} onClose={() => ed.setImportNotes(null)} />}

      <FillPanel ed={ed} />

      {doc.fields.length > 0 && (
        <BatchPanel
          key={ed.batchKey}
          fields={doc.fields}
          imageKeys={ed.imageKeys}
          imp={ed.imp}
          initialText={ed.batchSeed}
          photoSize={ed.photoSize}
          onPreview={() => ed.setSheetsOpen(true)}
          onRows={ed.setBatchRows}
          seedPhotos={ed.batchPhotos}
          onFromRegistry={() => ed.setRegistryOpen(true)}
          mapping={ed.batchMap}
          onMapping={(map) => {
            // في التصميم نفسه، ويُكتب فورًا إن كان محفوظًا — فلا يضيع بنسيان «حفظ».
            ed.setBatchMap(map);
            if (designId !== null) void window.diwan.learning.setBatchMap(designId, map);
          }}
        />
      )}

      <PagePanel ed={ed} />
      <AddPanel ed={ed} />
      <ElementPanel ed={ed} />
      <LayersPanel ed={ed} />
    </section>
  );
}
