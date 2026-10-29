/** شريط الأدوات السريعة: إضافة العناصر الأساسية بضغطةٍ واحدة على الزرّ، بلا اختصاراتٍ لوحية. */
import { barcodeElement, clampBox, imageElement, shapeElement, tableElement, textElement } from '@shared/canvas';
import { inlinesOf } from './kit';
import type { DesignEditor } from './useDesignEditor';

const DOCK_BTN =
  'w-11 h-10 rounded-btn flex items-center justify-center transition-colors text-on-surface hover:bg-surface-container-high active:scale-95 border border-outline-variant/60 shadow-2xs';

export default function DesignToolDock({ ed }: { ed: DesignEditor }) {
  const { add, setSelection } = ed;

  const addText = () => {
    add(
      textElement({
        box: clampBox({ x: 0.3, y: 0.45, w: 0.4, h: 0.1 }),
        inlines: inlinesOf('نص جديد'),
        size: 16
      })
    );
  };

  const addField = () => {
    add(
      textElement({
        box: clampBox({ x: 0.3, y: 0.45, w: 0.4, h: 0.1 }),
        inlines: inlinesOf('{الاسم}'),
        size: 16
      })
    );
  };

  const addImage = () => {
    add(
      imageElement({
        box: clampBox({ x: 0.06, y: 0.2, w: 0.24, h: 0.55 }),
        ref: 'صورة'
      })
    );
  };

  const addShape = () => {
    add(
      shapeElement({
        box: clampBox({ x: 0.35, y: 0.35, w: 0.3, h: 0.2 }),
        fill: '#e2e8f0',
        stroke: '#475569',
        strokeWidth: 1
      })
    );
  };

  const addBarcode = () => {
    add(
      barcodeElement({
        box: clampBox({ x: 0.35, y: 0.78, w: 0.3, h: 0.14 }),
        ref: 'الرقم',
        symbology: 'code128'
      })
    );
  };

  const addTable = () => {
    add(
      tableElement({
        box: clampBox({ x: 0.08, y: 0.35, w: 0.84, h: 0.35 })
      })
    );
  };

  return (
    <div className="flex flex-col items-center gap-1 bg-surface-container-lowest p-1 border-r border-outline-variant shrink-0 w-14 overflow-y-auto" data-tool-dock="">
      <button
        className={`${DOCK_BTN} ${ed.selection.length === 0 ? 'bg-primary-fixed text-primary' : 'bg-surface-container-lowest'}`}
        title="أداة التحديد والتحريك"
        type="button"
        onClick={() => setSelection([])}
      >
        <span className="material-symbols-outlined text-[18px]">near_me</span>
      </button>

      <div className="w-7 h-px bg-outline-variant shrink-0" />

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="إضافة نص مباشر" type="button" onClick={addText}>
        <span className="material-symbols-outlined text-[18px] text-primary">title</span>
      </button>

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="إضافة حقل متغير {الاسم}" type="button" onClick={addField}>
        <span className="material-symbols-outlined text-[18px] text-secondary">data_object</span>
      </button>

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="إطار صورة حقل" type="button" onClick={addImage}>
        <span className="material-symbols-outlined text-[18px] text-amber-600">image</span>
      </button>

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="مستطيل / شكل هندسي" type="button" onClick={addShape}>
        <span className="material-symbols-outlined text-[18px] text-emerald-600">crop_square</span>
      </button>

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="باركود / QR" type="button" onClick={addBarcode}>
        <span className="material-symbols-outlined text-[18px] text-indigo-600">qr_code_2</span>
      </button>

      <button className={`${DOCK_BTN} bg-surface-container-lowest`} title="جدول بيانات" type="button" onClick={addTable}>
        <span className="material-symbols-outlined text-[18px] text-cyan-600">table_chart</span>
      </button>
    </div>
  );
}
