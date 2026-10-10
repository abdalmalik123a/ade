/**
 * شكل الصورة وإطارها (DESIGNS.md ١٫١): قصٌّ بشكلٍ من ثمانية — كلٌّ بلمحته — وإطارٌ على حدّه، حلقةً أو حلقتين بفسحة.
 * و«أزل الخلفية» (٢٫٣) للصورة المُدرَجة: المنتج أو الشعار على خلفيةٍ شفّافة؛ و«استبدل الصورة» (٢٫١) لما ليس حقلًا —
 * توقيع المدير في قالب Photoshop، والشعار، وصورة المنتج.
 */
import { useState } from 'react';
import type { ImageElement, ImageFrame } from '@shared/canvas';
import { IMAGE_SHAPES, SHAPE_LABELS, shapePath, type ImageShape } from '@shared/design/shapes';
import { NUM, toHexColor } from '../editor/kit';
import CutoutModal from '../cutout/CutoutModal';

const TILE = 'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors';

export default function ImageShapePanel({ image, patch }: { image: ImageElement; patch: (p: Partial<ImageElement>) => void }) {
  const frame = image.frame;
  const [cutting, setCutting] = useState(false);
  // الرسمة المتّجهة (SVG من «رسومات») بلا خلفيةٍ أصلًا — والصورة الفارغة لا شيء فيها.
  const photo = Boolean(image.src) && !image.src.startsWith('data:image/svg');
  const setFrame = (next: Partial<ImageFrame> | null) => patch({ frame: next ? { color: '#ffffff', width: 1, ...frame, ...next } : undefined });
  const tile = (shape: ImageShape | undefined, label: string) => {
    const on = image.shape === shape;
    return (
      <button
        key={shape ?? 'none'}
        className={`${TILE} ${on ? 'border-primary bg-primary-container/30' : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high'}`}
        data-image-shape={shape ?? 'none'}
        title={label}
        type="button"
        onClick={() => patch({ shape })}
      >
        {shape ? (
          <svg height="26" viewBox="0 0 26 26" width="26">
            <path d={shapePath(shape, 26, 26, 2)} fill="currentColor" className="text-on-surface-variant" />
          </svg>
        ) : (
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">crop_free</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-space-xs" data-panel="image-shape">
      {!image.ref && (
        <button
          className="w-full h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
          data-act="replace-image"
          title="صورةٌ من الجهاز مكانها، بموضعها ومقاسها"
          type="button"
          onClick={async () => {
            const src = await window.diwan.files.pickImage('designs');
            if (src) patch({ src });
          }}
        >
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          استبدل الصورة
        </button>
      )}
      {photo && (
        <button
          className="w-full h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
          data-act="cutout"
          title="المنتج أو الشعار على خلفيةٍ شفّافة — على هذا الجهاز"
          type="button"
          onClick={() => setCutting(true)}
        >
          <span className="material-symbols-outlined text-[18px]">background_replace</span>
          أزل الخلفية
        </button>
      )}
      {cutting && (
        <CutoutModal
          src={image.src}
          onClose={() => setCutting(false)}
          onDone={(src) => {
            patch({ src });
            setCutting(false);
          }}
        />
      )}
      <span className="font-label-sm text-label-sm text-on-surface-variant">القصّ بشكل</span>
      <div className="flex flex-wrap gap-1">
        {tile(undefined, 'بلا قصّ')}
        {IMAGE_SHAPES.filter((s) => s !== 'rect').map((s) => tile(s, SHAPE_LABELS[s]))}
      </div>
      <div className="flex items-center gap-space-sm flex-wrap">
        <select
          className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
          data-act="image-frame"
          title="الإطار على حدّ الشكل"
          value={frame ? String(frame.rings ?? 1) : '0'}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFrame(v === 0 ? null : v === 2 ? { rings: 2, gap: frame?.gap ?? 1.5 } : { rings: undefined, gap: undefined });
          }}
        >
          <option value="0">بلا إطار</option>
          <option value="1">إطار</option>
          <option value="2">حلقتان</option>
        </select>
        {frame && (
          <>
            <input
              className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low"
              data-act="image-frame-color"
              title="لون الإطار"
              type="color"
              value={toHexColor(frame.color)}
              onChange={(e) => setFrame({ color: e.target.value })}
            />
            <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <input className={NUM} data-act="image-frame-width" inputMode="decimal" title="سُمك الإطار بالملّم" value={frame.width} onChange={(e) => setFrame({ width: Number(e.target.value) || frame.width })} />
              ملم
            </label>
            <select
              className="h-8 px-1 rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
              data-act="image-frame-dash"
              title="نقش الإطار"
              value={frame.dash ?? 'solid'}
              onChange={(e) => setFrame({ dash: e.target.value === 'solid' ? undefined : (e.target.value as 'dashed' | 'dotted') })}
            >
              <option value="solid">متّصل</option>
              <option value="dashed">متقطّع</option>
              <option value="dotted">منقّط</option>
            </select>
            {frame.rings === 2 && (
              <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                فسحة
                <input className={NUM} data-act="image-frame-gap" inputMode="decimal" title="الفسحة بين الحلقتين بالملّم" value={frame.gap ?? 1.5} onChange={(e) => setFrame({ gap: Number(e.target.value) || 0 })} />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}
