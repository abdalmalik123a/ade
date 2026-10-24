/**
 * «ضع عنصرًا فوق التصميم»: نصٌّ ثابت أو حقلٌ `{اسم}`، ورسمةٌ، وصورةٌ من الجهاز، وصورةُ حقل، وباركود، وجدول، وشكل —
 * ثم يُسحب إلى مكانه.
 */
import { useState } from 'react';
import { barcodeElement, clampBox, imageElement, shapeElement, tableElement, textElement } from '@shared/canvas';
import { inlinesOf } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';
import ShapeLibrary from './ShapeLibrary';

const BTN = 'h-8 px-space-sm rounded-card bg-surface-container-low hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface';
const BTN_ICON = `${BTN} flex items-center gap-1 shadow-xs border border-outline-variant/60`;

export default function AddPanel({ ed }: { ed: DesignEditor }) {
  const { add } = ed;
  const [library, setLibrary] = useState(false);
  return (
    <div className="rounded-card bg-surface-container-lowest p-space-md space-y-space-sm">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">ضع عنصرًا فوق التصميم</h2>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        اكتبه هكذا: <span className="font-mono">{'{اسم الطالب}'}</span> — والنصّ الثابت يُكتب كما هو. ثم اسحبه إلى مكانه.
      </p>
      <AddBox onAdd={(label) => add(textElement({ box: clampBox({ x: 0.3, y: 0.45, w: 0.4, h: 0.1 }), inlines: inlinesOf(label) }))} />
      <div className="flex items-center gap-space-xs flex-wrap">
        <button className={BTN_ICON} data-add="clipart" type="button" onClick={() => ed.setClipartModalOpen(true)}>
          <span className="material-symbols-outlined text-[16px] text-secondary">auto_awesome</span>
          <span>+ رسمة / أيقونة</span>
        </button>
        <button className={BTN_ICON} data-add="local-image" type="button" onClick={() => void ed.pickLocalImage()}>
          <span className="material-symbols-outlined text-[16px] text-secondary">image</span>
          <span>+ صورة من الجهاز</span>
        </button>
        <button className={BTN} data-add="image" type="button" onClick={() => add(imageElement({ box: clampBox({ x: 0.06, y: 0.2, w: 0.24, h: 0.55 }), ref: 'صورة الطالب' }))}>
          + صورة حقل
        </button>
        <button className={BTN} data-add="barcode" type="button" onClick={() => add(barcodeElement({ box: clampBox({ x: 0.35, y: 0.78, w: 0.55, h: 0.14 }), ref: 'الرقم' }))}>
          + باركود
        </button>
        <button className={BTN_ICON} data-add="table" type="button" onClick={() => add(tableElement({ box: clampBox({ x: 0.08, y: 0.35, w: 0.84, h: 0.35 }) }))}>
          <span className="material-symbols-outlined text-[16px] text-secondary">table_chart</span>
          <span>+ جدول</span>
        </button>
        <button
          className={BTN}
          data-add="shape"
          type="button"
          onClick={() => add(shapeElement({ box: clampBox({ x: 0.1, y: 0.1, w: 0.3, h: 0.1 }), fill: 'transparent', stroke: '#333333', strokeWidth: 1 }))}
        >
          + شكل
        </button>
        <button className={BTN_ICON} data-add="shapes" type="button" onClick={() => setLibrary((o) => !o)}>
          <span className="material-symbols-outlined text-[16px] text-secondary">interests</span>
          <span>+ موجات وأشرطة وإطارات</span>
        </button>
      </div>
      {library && <ShapeLibrary ed={ed} onDone={() => setLibrary(false)} />}
    </div>
  );
}

/** صندوقُ إضافةٍ صغير — يُكتب النصّ ويُضاف، ثم يُسحب إلى مكانه. */
function AddBox({ onAdd }: { onAdd: (label: string) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  };
  return (
    <div className="flex items-center gap-space-sm">
      <input
        className="flex-1 h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
        data-add-text
        placeholder="{اسم الطالب}"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <button className="h-9 px-space-md rounded-btn bg-surface-container-high text-on-surface font-label-md text-label-md whitespace-nowrap" data-act="add" type="button" onClick={add}>
        أضف
      </button>
    </div>
  );
}
