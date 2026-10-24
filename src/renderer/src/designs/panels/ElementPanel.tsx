/**
 * خصائص العنصر المحدَّد وحده: القفل والتكرار والحذف، ونصّه وحجمه ومحاذاته واتجاهه وعرضه ولونه وتأثيراته، وحقل الصورة والباركود
 * ونوع رمزه — والجدول في لوحته.
 */
import type { TextElement } from '@shared/canvas';
import { ICON, NUM, inlinesOf, kindName, textOf, toHexColor } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';
import TablePanel from './TablePanel';
import ImageShapePanel from './ImageShapePanel';
import PathPanel from './PathPanel';
import FontSelect from '../../components/FontSelect';
import { familyOf, stackOf } from '@shared/fonts';
import PaintPanel from './PaintPanel';
import GradientControl, { gradientFrom } from './GradientControl';
import TextEffectsPanel from './TextEffectsPanel';

const SELECT = 'h-8 px-space-sm rounded-card bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface';

export default function ElementPanel({ ed }: { ed: DesignEditor }) {
  const { single, patchElement, doc, imageKeys } = ed;
  if (!single) return null;
  return (
    <div className="rounded-card bg-surface-container-lowest p-space-md space-y-space-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-body-md text-body-md text-on-surface font-semibold truncate">{kindName(single)}</h2>
        <div className="flex items-center gap-1 shrink-0">
          <button className={ICON} title="اقفل / افتح" type="button" onClick={ed.toggleLock}>
            <span className="material-symbols-outlined text-[18px]">{single.locked ? 'lock' : 'lock_open'}</span>
          </button>
          <button className={ICON} title="كرّر (Ctrl+D)" type="button" onClick={ed.duplicateSelected}>
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
          </button>
          <button className={ICON} title="احذف" type="button" onClick={ed.removeSelected}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      {single.kind === 'text' && (
        <>
          <input
            className="w-full h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
            data-element-text
            value={textOf(single.inlines)}
            onChange={(e) => patchElement(single.id, { inlines: inlinesOf(e.target.value) })}
          />
          {/* الخطّ من «خطوط ديوان» (DESIGNS.md ١٫٥) — والغائب في التصميم يُقال باسمه ويُضاف من Windows بضغطة. */}
          <FontSelect
            act="element-font"
            blank="خطّ التصميم"
            className={SELECT}
            title="خطّ هذا النصّ"
            used={ed.canvas.elements.flatMap((el) => (el.kind === 'text' || el.kind === 'table' ? [familyOf(el.font)] : []))}
            value={familyOf(single.font) || null}
            onChange={(family) => patchElement(single.id, { font: family ? stackOf(family) : undefined })}
          />
          <div className="flex items-center gap-space-sm flex-wrap">
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              حجم
              <input className={NUM} inputMode="numeric" title="حجم الخط بالنقاط" value={single.size} onChange={(e) => patchElement(single.id, { size: Number(e.target.value) || single.size })} />
              نقطة
            </label>
            <select className={SELECT} title="المحاذاة" value={single.align} onChange={(e) => patchElement(single.id, { align: e.target.value as TextElement['align'] })}>
              <option value="right">يمين</option>
              <option value="center">وسط</option>
              <option value="left">يسار</option>
            </select>
            <select className={SELECT} title="اتجاه النصّ" value={single.dir ?? 'rtl'} onChange={(e) => patchElement(single.id, { dir: e.target.value as 'rtl' | 'ltr' })}>
              <option value="rtl">عربي</option>
              <option value="ltr">لاتيني</option>
            </select>
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <input checked={single.bold ?? false} type="checkbox" onChange={(e) => patchElement(single.id, { bold: e.target.checked })} />
              عريض
            </label>
            <input
              className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low"
              title="اللون"
              type="color"
              value={toHexColor(single.color)}
              onChange={(e) => patchElement(single.id, { color: e.target.value })}
            />
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <input checked={Boolean(single.gradient)} data-act="text-gradient-on" type="checkbox" onChange={(e) => patchElement(single.id, { gradient: e.target.checked ? gradientFrom(single.color) : undefined })} />
              تدرّج
            </label>
            {single.gradient && <GradientControl act="text-gradient" value={single.gradient} onChange={(gradient) => patchElement(single.id, { gradient })} />}
          </div>
          <TextEffectsPanel el={single} patch={(p) => patchElement(single.id, p)} />
        </>
      )}

      {single.kind === 'shape' && <PaintPanel el={single} patch={(p) => patchElement(single.id, p)} />}

      {(single.kind === 'image' || single.kind === 'barcode') && (
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">اسم الحقل الذي يملؤه</span>
          <input
            className="h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
            data-element-ref
            value={single.ref ?? ''}
            onChange={(e) => patchElement(single.id, { ref: e.target.value.trim() })}
          />
        </label>
      )}

      {single.kind === 'image' && (
        <ImageShapePanel
          frameRatio={(single.box.w * ed.canvas.size.w) / Math.max(0.001, single.box.h * ed.canvas.size.h)}
          image={single}
          patch={(p) => patchElement(single.id, p)}
        />
      )}
      {single.kind === 'path' && <PathPanel path={single} patch={(p) => patchElement(single.id, p)} />}

      {single.kind === 'barcode' && (
        <select
          className={SELECT}
          title="نوع الرمز"
          value={single.symbology}
          onChange={(e) => {
            const symbology = e.target.value as 'code128' | 'qr' | 'seal';
            // النقش بذرتُه الاسم والرقم: تُقترح وسومُ حقول التصميم النصّية بذرةً له.
            const seed =
              symbology === 'seal' && !single.value
                ? doc.fields
                    .filter((f) => !imageKeys.includes(f.key))
                    .map((f) => `{${f.key}}`)
                    .join(' ')
                : single.value;
            patchElement(single.id, { symbology, value: seed });
          }}
        >
          <option value="code128">Code128 — للأرقام واللاتيني</option>
          <option value="qr">QR — يُقرأ بالهاتف</option>
          <option value="seal">نقش أمان فريد لكل بطاقة</option>
        </select>
      )}

      {single.kind === 'table' && <TablePanel canvas={ed.canvas} table={single} patch={(p) => patchElement(single.id, p)} />}

      {/* الشفافية لكلّ عنصر (DESIGNS.md ١٫٣) */}
      <label className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
        الشفافية
        <input
          className="flex-1"
          data-act="opacity"
          max={100}
          min={5}
          step={5}
          type="range"
          value={Math.round((single.opacity ?? 1) * 100)}
          onChange={(e) => patchElement(single.id, { opacity: Number(e.target.value) >= 100 ? undefined : Number(e.target.value) / 100 })}
        />
        <span className="w-10 tabular">{Math.round((single.opacity ?? 1) * 100)}٪</span>
      </label>
    </div>
  );
}
