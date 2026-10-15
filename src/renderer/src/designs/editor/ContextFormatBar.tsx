/**
 * شريط التنسيق السياقي السريع (Contextual Quick-Format Bar):
 * يظهر في الشريط العلوي عند تحديد عنصر (أو عناصر) لتمكين التعديل الفوري
 * للخط، والحجم، والألوان، والمحاذاة، والحدود، والظلال دون الحاجة للتمرير في الأشرطة الجانبية.
 */
import { familyOf, stackOf } from '@shared/fonts';
import FontSelect from '../../components/FontSelect';
import { toHexColor } from './kit';
import type { DesignEditor } from './useDesignEditor';

const ICON_BTN =
  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface active:scale-95';
const SELECT =
  'h-8 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm text-on-surface';

export default function ContextFormatBar({ ed }: { ed: DesignEditor }) {
  const { single, patchElement, canvas, align } = ed;
  if (!single) return null;

  return (
    <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant shrink-0" data-context-bar="">
      {single.kind === 'text' && (
        <>
          {/* اختيار الخط */}
          <FontSelect
            act="quick-font"
            blank="الخط الافتراضي"
            className={`${SELECT} max-w-[130px] truncate`}
            title="نوع الخط"
            used={canvas.elements.flatMap((el) => (el.kind === 'text' || el.kind === 'table' ? [familyOf(el.font)] : []))}
            value={familyOf(single.font) || null}
            onChange={(family) => patchElement(single.id, { font: family ? stackOf(family) : undefined })}
          />

          {/* تصغير وتكبير الحجم */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden h-8">
            <button
              className="w-6 h-full flex items-center justify-center hover:bg-surface-container-high text-on-surface"
              title="تصغير الخط"
              type="button"
              onClick={() => patchElement(single.id, { size: Math.max(6, single.size - 1) })}
            >
              -
            </button>
            <input
              className="w-10 h-full text-center font-label-sm text-label-sm text-on-surface bg-transparent"
              inputMode="numeric"
              title="حجم الخط بالنقاط"
              value={single.size}
              onChange={(e) => patchElement(single.id, { size: Number(e.target.value) || single.size })}
            />
            <button
              className="w-6 h-full flex items-center justify-center hover:bg-surface-container-high text-on-surface"
              title="تكبير الخط"
              type="button"
              onClick={() => patchElement(single.id, { size: single.size + 1 })}
            >
              +
            </button>
          </div>

          {/* لون النص */}
          <label className="flex items-center gap-1 cursor-pointer" title="لون النص">
            <input
              className="w-7 h-7 rounded border border-outline-variant cursor-pointer p-0 bg-transparent"
              type="color"
              value={toHexColor(single.color)}
              onChange={(e) => patchElement(single.id, { color: e.target.value })}
            />
          </label>

          {/* غامق / مائل */}
          <button
            className={`${ICON_BTN} ${single.bold ? 'bg-primary-container text-on-primary font-bold' : ''}`}
            title="عريض (Bold)"
            type="button"
            onClick={() => patchElement(single.id, { bold: !single.bold })}
          >
            <span className="font-bold text-[14px]">B</span>
          </button>

          {/* محاذاة النص */}
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5">
            <button
              className={`w-7 h-7 rounded flex items-center justify-center ${single.align === 'right' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant'}`}
              title="محاذاة لليمين"
              type="button"
              onClick={() => patchElement(single.id, { align: 'right' })}
            >
              <span className="material-symbols-outlined text-[16px]">format_align_right</span>
            </button>
            <button
              className={`w-7 h-7 rounded flex items-center justify-center ${single.align === 'center' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant'}`}
              title="توسيط"
              type="button"
              onClick={() => patchElement(single.id, { align: 'center' })}
            >
              <span className="material-symbols-outlined text-[16px]">format_align_center</span>
            </button>
            <button
              className={`w-7 h-7 rounded flex items-center justify-center ${single.align === 'left' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant'}`}
              title="محاذاة لليسار"
              type="button"
              onClick={() => patchElement(single.id, { align: 'left' })}
            >
              <span className="material-symbols-outlined text-[16px]">format_align_left</span>
            </button>
          </div>

          {/* حدود النص (Outline) */}
          <label className="flex items-center gap-1 cursor-pointer" title="لون التحديد الخارجي (Outline)">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">border_color</span>
            <input
              className="w-7 h-7 rounded border border-outline-variant cursor-pointer p-0 bg-transparent"
              type="color"
              value={toHexColor(single.outline?.color)}
              onChange={(e) => patchElement(single.id, { outline: { color: e.target.value, width: single.outline?.width || 1 } })}
            />
          </label>
          {single.outline && (
            <input
              className="w-8 h-8 px-1 text-center font-label-xs text-label-xs bg-surface-container-lowest border border-outline-variant rounded"
              title="سمك التحديد"
              type="number"
              min="0"
              max="10"
              value={single.outline.width}
              onChange={(e) => patchElement(single.id, { outline: { ...single.outline!, width: Number(e.target.value) || 0 } })}
            />
          )}

          {/* الظل (Shadow toggle) */}
          <button
            className={`${ICON_BTN} ${single.shadow ? 'bg-primary-container text-on-primary' : ''}`}
            title="تفعيل/تعطيل الظل"
            type="button"
            onClick={() =>
              patchElement(single.id, {
                shadow: single.shadow ? undefined : { blur: 4, dx: 2, dy: 2, color: 'rgba(0,0,0,0.4)' }
              })
            }
          >
            <span className="material-symbols-outlined text-[16px]">shadow</span>
          </button>
        </>
      )}

      {(single.kind === 'shape' || single.kind === 'path' || single.kind === 'image') && (
        <>
          {'fill' in single && typeof single.fill === 'string' && (
            <label className="flex items-center gap-1 cursor-pointer" title="لون التعبئة">
              <span className="font-label-xs text-label-xs text-on-surface-variant">تعبئة</span>
              <input
                className="w-7 h-7 rounded border border-outline-variant cursor-pointer p-0 bg-transparent"
                type="color"
                value={toHexColor(single.fill)}
                onChange={(e) => patchElement(single.id, { fill: e.target.value })}
              />
            </label>
          )}

          {'stroke' in single && (
            <label className="flex items-center gap-1 cursor-pointer" title="لون الإطار">
              <span className="font-label-xs text-label-xs text-on-surface-variant">إطار</span>
              <input
                className="w-7 h-7 rounded border border-outline-variant cursor-pointer p-0 bg-transparent"
                type="color"
                value={toHexColor(single.stroke)}
                onChange={(e) => patchElement(single.id, { stroke: e.target.value, strokeWidth: single.strokeWidth || 1 })}
              />
            </label>
          )}

          {'strokeWidth' in single && single.stroke && (
            <input
              className="w-10 h-8 px-1 text-center font-label-xs text-label-xs bg-surface-container-lowest border border-outline-variant rounded"
              title="سمك الإطار"
              type="number"
              min="0"
              max="20"
              value={single.strokeWidth ?? 1}
              onChange={(e) => patchElement(single.id, { strokeWidth: Number(e.target.value) || 0 })}
            />
          )}

          {/* الشفافية */}
          <label className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant" title="الشفافية">
            <span className="material-symbols-outlined text-[16px]">opacity</span>
            <input
              className="w-14 accent-primary"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={single.opacity ?? 1}
              onChange={(e) => patchElement(single.id, { opacity: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      <div className="w-px h-5 bg-outline-variant shrink-0" />

      {/* أزرار المحاذاة السريعة لوسط الصفحة */}
      <button className={ICON_BTN} title="توسيط أفقي في الصفحة" type="button" onClick={() => align('hCenter')}>
        <span className="material-symbols-outlined text-[18px]">align_horizontal_center</span>
      </button>
      <button className={ICON_BTN} title="توسيط عمودي في الصفحة" type="button" onClick={() => align('vCenter')}>
        <span className="material-symbols-outlined text-[18px]">align_vertical_center</span>
      </button>
    </div>
  );
}
