/**
 * عمود الأدوات بجانب اللوحة:
 * مقسّم إلى 4 تبويبات واضحة واحترافية:
 * 1. الخصائص (Properties): خصائص العنصر المحدّد وحقول التعبئة الفردية.
 * 2. الطبقات (Layers): قائمة الطبقات مع أدوات الإخفاء والقفل والترتيب والتكرار والحذف.
 * 3. الصفحة والاستيراد (Page & Import): مقاس التصميم، الخلفية، الهوامش، استيراد PSD، ومجموعة الهوية (BrandKit).
 * 4. إضافة وتعبئة (Add & Batch): إضافة العناصر، الدفعة (Excel/CSV)، والإمساكية.
 */
import { useEffect, useState } from 'react';
import BatchPanel from '../BatchPanel';
import FillPanel from '../panels/FillPanel';
import PagePanel from '../panels/PagePanel';
import AddPanel from '../panels/AddPanel';
import ElementPanel from '../panels/ElementPanel';
import LayersPanel from '../panels/LayersPanel';
import ImportNotes from '../ImportNotes';
import BrandKitBar from '../panels/BrandKitBar';
import ImsakiyaPanel from '../imsakiya/ImsakiyaPanel';
import { imsakiyaTable } from '@shared/design/imsakiya';
import type { DesignEditor } from './useDesignEditor';

type SidebarTab = 'properties' | 'layers' | 'page' | 'add';

const TAB_BTN =
  'flex-1 py-2 px-1 text-center font-label-sm text-label-sm font-semibold rounded-btn transition-all flex flex-col items-center gap-1';

export default function EditorSidebar({ ed }: { ed: DesignEditor }) {
  const { canvas, designId, doc, selection } = ed;
  const imsakiya = imsakiyaTable(canvas);
  const [activeTab, setActiveTab] = useState<SidebarTab>('properties');

  // عند تحديد عنصر جديد، التبديل تلقائياً لتبويب الخصائص ليسهل التعديل
  useEffect(() => {
    if (selection.length > 0) {
      setActiveTab('properties');
    }
  }, [selection]);

  return (
    <section className="w-[420px] shrink-0 flex flex-col h-full border-l border-outline-variant bg-surface-container-low">
      {/* الترويسة العلوية */}
      <div className="p-space-md border-b border-outline-variant space-y-space-sm shrink-0">
        <header className="flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-1.5">
            <button
              className="h-8 px-space-sm rounded-btn hover:bg-surface-container-high font-label-md text-label-md text-on-surface-variant flex items-center gap-1"
              data-act="gallery"
              type="button"
              onClick={() => ed.setView('gallery')}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              كل التصاميم
            </button>
            <button
              className="h-8 px-2 rounded-btn bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant font-label-xs text-label-xs text-on-surface flex items-center gap-1"
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
              <span className="px-2 py-0.5 rounded-chip bg-primary-fixed text-primary font-label-xs text-[11px] font-bold">تعديل محفوظ</span>
            )}
            <span className="font-label-sm text-label-sm text-on-surface-variant tabular" data-size-chip="">
              {/* بمنزلةٍ واحدة كما يقوله التنبيه بعد الاستيراد — Word وPDF يعطيان كسورًا طويلة (D172). */}
              {canvas.size.w.toFixed(1)} × {canvas.size.h.toFixed(1)} ملم
            </span>
          </div>
        </header>

        <input
          className="w-full h-8 px-space-sm rounded-field bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface"
          data-title
          placeholder="اسم التصميم — مثال: هوية طالب"
          value={ed.title}
          onChange={(e) => ed.setTitle(e.target.value)}
        />

        {/* أزرار التبويبات الأربعة */}
        <div className="flex items-center bg-surface-container-lowest p-1 rounded-card border border-outline-variant" data-sidebar-tabs="">
          <button
            className={`${TAB_BTN} ${activeTab === 'properties' ? 'bg-primary-fixed text-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            type="button"
            onClick={() => setActiveTab('properties')}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>الخصائص</span>
          </button>

          <button
            className={`${TAB_BTN} ${activeTab === 'layers' ? 'bg-primary-fixed text-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            type="button"
            onClick={() => setActiveTab('layers')}
          >
            <span className="material-symbols-outlined text-[18px]">layers</span>
            <span>الطبقات ({canvas.elements.length})</span>
          </button>

          <button
            className={`${TAB_BTN} ${activeTab === 'page' ? 'bg-primary-fixed text-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            type="button"
            onClick={() => setActiveTab('page')}
          >
            <span className="material-symbols-outlined text-[18px]">aspect_ratio</span>
            <span>الصفحة</span>
          </button>

          <button
            className={`${TAB_BTN} ${activeTab === 'add' ? 'bg-primary-fixed text-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            type="button"
            onClick={() => setActiveTab('add')}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>إضافة وتعبئة</span>
          </button>
        </div>
      </div>

      {/* محتوى التبويب النشط */}
      <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
        {ed.importNotes && <ImportNotes where={ed.importNotes.where} lines={ed.importNotes.lines} onClose={() => ed.setImportNotes(null)} />}

        {/* كلّ التبويبات تبقى مركّبة وتُخفى بالصنف: فلا يضيع نصّ الدفعة ولا حالة اللوحات بتبديل التبويب. */}
        <div className={activeTab === 'properties' ? 'space-y-space-md' : 'hidden'}>
          <div className="space-y-space-md">
            {ed.single ? (
              <ElementPanel ed={ed} />
            ) : (
              <div className="p-space-lg rounded-card bg-surface-container-lowest border border-dashed border-outline-variant text-center space-y-2">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/70">touch_app</span>
                <p className="font-label-md text-label-md text-on-surface-variant font-medium">اختر عنصراً من اللوحة لتعديل خصائصه</p>
                <p className="font-label-xs text-label-xs text-on-surface-variant/70">أو أضف عنصراً جديداً من شريط الأدوات العلوي</p>
              </div>
            )}
            <FillPanel ed={ed} />
          </div>
        </div>

        <div className={activeTab === 'layers' ? '' : 'hidden'}>
          <LayersPanel ed={ed} />
        </div>

        <div className={activeTab === 'page' ? 'space-y-space-md' : 'hidden'}>
          <BrandKitBar ed={ed} />
          <PagePanel ed={ed} />
        </div>

        <div className={activeTab === 'add' ? 'space-y-space-md' : 'hidden'}>
          <div className="space-y-space-md">
            {imsakiya && <ImsakiyaPanel key={imsakiya.id} ed={ed} table={imsakiya} />}
            <AddPanel ed={ed} />
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
                  ed.setBatchMap(map);
                  if (designId !== null) void window.diwan.learning.setBatchMap(designId, map);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
