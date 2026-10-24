/**
 * شريط «ملفات PDF» (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: الفتح والمسح، والتراجع والإعادة، وعمليات الصفحات
 * والإضافات والقصّ والإخراج. عرضٌ وحده: الحال والدوالّ تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ToolHeader } from '../../components/ToolFrame';

type Props = {
  btn: 'h-9 px-space-sm rounded-card bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  open: () => Promise<void>;
  hasDoc: boolean;
  scan: () => Promise<void>;
  canUndo: boolean;
  undo: () => void;
  canRedo: boolean;
  redo: () => void;
  current: string | null;
  addText: () => void;
  openLogos: () => Promise<void>;
  addWatermark: () => Promise<void>;
  addNumbers: () => void;
  startCrop: () => void;
  targets: string[];
  extract: () => Promise<void>;
  setSplitText: Dispatch<SetStateAction<string | null>>;
  toImages: () => Promise<void>;
  startOver: () => Promise<void>;
};

export default function PdfToolbar({ btn, open, hasDoc, scan, canUndo, undo, canRedo, redo, current, addText, openLogos, addWatermark, addNumbers, startCrop, targets, extract, setSplitText, toImages, startOver }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-space-xs px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant">
      <ToolHeader bar icon="picture_as_pdf" title="ملفات PDF" />
      <span className="w-px h-6 bg-outline-variant mx-1" />
      <button className={btn} data-act="pdf-open" type="button" onClick={() => void open()}>
        <span className="material-symbols-outlined text-[18px]">{hasDoc ? 'library_add' : 'folder_open'}</span>
        {hasDoc ? 'أضف ملفّات (دمج)' : 'افتح PDF أو صورًا'}
      </button>
      <button className={btn} data-act="pdf-scan" title="صفحةٌ من الماسح في آخر الملف" type="button" onClick={() => void scan()}>
        <span className="material-symbols-outlined text-[18px]">scanner</span>امسح
      </button>
      {hasDoc && (
        <>
          <button className={btn} data-act="pdf-undo" disabled={!canUndo} title="تراجع (Ctrl+Z)" type="button" onClick={undo}>
            <span className="material-symbols-outlined text-[18px]">undo</span>
          </button>
          <button className={btn} data-act="pdf-redo" disabled={!canRedo} title="أعد (Ctrl+Y)" type="button" onClick={redo}>
            <span className="material-symbols-outlined text-[18px]">redo</span>
          </button>
          <span className="w-px h-6 bg-outline-variant mx-1" />
          <button className={btn} data-act="pdf-text" disabled={!current} type="button" onClick={addText}>
            <span className="material-symbols-outlined text-[18px]">title</span>نصّ
          </button>
          <button className={btn} data-act="pdf-logo" disabled={!current} type="button" onClick={() => void openLogos()}>
            <span className="material-symbols-outlined text-[18px]">image</span>شعار أو صورة
          </button>
          <button className={btn} data-act="pdf-watermark" type="button" onClick={() => void addWatermark()}>
            <span className="material-symbols-outlined text-[18px]">branding_watermark</span>علامة مائية
          </button>
          <button className={btn} data-act="pdf-number" title="رقم الصفحة أسفل كلّ صفحة" type="button" onClick={addNumbers}>
            <span className="material-symbols-outlined text-[18px]">format_list_numbered_rtl</span>رقّم
          </button>
          <button className={btn} data-act="pdf-crop" disabled={!current} type="button" onClick={startCrop}>
            <span className="material-symbols-outlined text-[18px]">crop</span>قصّ
          </button>
          <span className="w-px h-6 bg-outline-variant mx-1" />
          <button className={btn} data-act="pdf-extract" disabled={!targets.length} type="button" onClick={() => void extract()}>
            <span className="material-symbols-outlined text-[18px]">file_export</span>استخرج المحدَّد
          </button>
          <button className={btn} data-act="pdf-split" type="button" onClick={() => setSplitText('')}>
            <span className="material-symbols-outlined text-[18px]">call_split</span>قسّم
          </button>
          <button className={btn} data-act="pdf-images" type="button" onClick={() => void toImages()}>
            <span className="material-symbols-outlined text-[18px]">photo_library</span>صفحاتٌ صورًا
          </button>
          <div className="flex-1" />
          <button className={btn} data-act="pdf-reset" title="أغلق الملف وابدأ من جديد" type="button" onClick={() => void startOver()}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </>
      )}
    </div>
  );
}
