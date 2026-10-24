/**
 * «الخلفية والمقاس»: صورة التصميم أو ملفّه بمقاسه، والمقاسات المعيارية، والنزف وعلامات القصّ، وكم بطاقةً في الورقة،
 * والظهر المحفوظ خلف كلّ بطاقة.
 */
import { BLEED_MM, SIZE_PRESETS } from '@shared/canvas';
import { NUM } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';
import { relayoutCanvas } from '@shared/canvasEdit';

export default function PagePanel({ ed }: { ed: DesignEditor }) {
  const { canvas, apply, activeSide, history, say, askSize, imp, backId, backChoices, backDoc } = ed;
  const sideName = activeSide === 'front' ? 'الوجه' : 'الظهر';
  return (
    <div className="rounded-card bg-surface-container-lowest p-space-md space-y-space-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-body-md text-body-md text-on-surface font-semibold">الخلفية والمقاس ({sideName})</h2>
        {activeSide === 'back' && (
          <button
            type="button"
            className="font-label-xs text-label-xs text-secondary hover:underline flex items-center gap-1"
            title="مطابقة مقاس ونزف الوجه للظهر"
            onClick={() => {
              apply({
                ...canvas,
                size: { ...history.present.size },
                bleed: history.present.bleed,
                cropMarks: history.present.cropMarks
              });
              say('تمت مطابقة مقاس الظهر مع الوجه');
            }}
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            مطابقة مقاس الوجه
          </button>
        )}
      </div>
      <button
        className="w-full h-10 btn-act font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5"
        data-act="background"
        type="button"
        onClick={() => void ed.openBackground()}
      >
        <span className="material-symbols-outlined text-[18px]">image</span>
        افتح تصميمًا (صورة {sideName})
      </button>
      <button
        className="w-full h-9 rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
        data-act="import"
        title="Word · Photoshop · PDF — المقاس والمواضع من الملف"
        type="button"
        onClick={() => void ed.importDesign()}
      >
        <span className="material-symbols-outlined text-[18px]">upload_file</span>
        استورد {sideName} (Photoshop / PDF / Word)
      </button>
      {activeSide === 'back' && ed.backHasContent && (
        <button
          type="button"
          className="w-full h-8 rounded-btn bg-error-container/20 text-error hover:bg-error-container/40 font-label-xs text-label-xs flex items-center justify-center gap-1 transition-colors"
          onClick={() => {
            if (window.confirm('هل تريد مسح ظهر التصميم بالكامل والعودة لوجه واحد فقط؟')) {
              ed.setBackHistory(null);
              ed.setActiveSide('front');
              say('تم تفريغ الظهر — التصميم أصبح بوجه واحد');
            }
          }}
        >
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
          مسح الظهر بالكامل (العودة لوجه واحد)
        </button>
      )}
      <p className="font-label-sm text-label-sm text-on-surface-variant" data-size>
        المقاس {canvas.size.w.toFixed(1)} × {canvas.size.h.toFixed(1)} ملم
        {canvas.background.kind === 'image' && canvas.background.dpi
          ? ` · ${canvas.background.dpi} نقطة/إنش`
          : canvas.background.kind === 'image'
            ? ' · الدقّة مجهولة'
            : ''}
      </p>

      {/* «غيّر المقاس» (DESIGNS.md ١٫٧): العناصر تتوزّع وحدها — لا تتمطّط — بقيدٍ واحدٍ يُتراجع عنه. */}
      <select
        className="w-full h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
        data-preset
        title="غيّر المقاس — تتوزّع العناصر وحدها"
        value=""
        onChange={(e) => {
          const preset = SIZE_PRESETS.find((p) => p.key === e.target.value);
          if (!preset) return;
          apply({ ...relayoutCanvas(canvas, preset.size), bleed: preset.bleed ? BLEED_MM : 0, cropMarks: preset.bleed });
          ed.setAskSize(false);
        }}
      >
        <option value="">{askSize ? 'اختر مقاسًا معياريًّا…' : 'غيّر المقاس — تتوزّع العناصر وحدها…'}</option>
        <optgroup label="للطباعة">
          {SIZE_PRESETS.filter((p) => !p.px).map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} — {p.size.w} × {p.size.h} ملم
            </option>
          ))}
        </optgroup>
        <optgroup label="للشاشة والواتساب">
          {SIZE_PRESETS.filter((p) => p.px).map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </optgroup>
      </select>
      {canvas.background.kind !== 'none' && canvas.elements.length > 0 && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">الخلفية تملأ المقاس الجديد — وما رُسم لمقاسه (كإطار التصاميم الجاهزة) قد يُقصّ طرفاه.</p>
      )}

      {(askSize || canvas.background.kind !== 'image') && (
        <div className="space-y-space-xs">
          <div className="flex items-center gap-space-sm">
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              عرض
              <input className={NUM} inputMode="decimal" value={canvas.size.w} onChange={(e) => apply({ ...canvas, size: { ...canvas.size, w: Number(e.target.value) || canvas.size.w } })} />
            </label>
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              ارتفاع
              <input className={NUM} inputMode="decimal" value={canvas.size.h} onChange={(e) => apply({ ...canvas, size: { ...canvas.size, h: Number(e.target.value) || canvas.size.h } })} />
            </label>
            <span className="font-label-sm text-label-sm text-on-surface-variant">ملم</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-space-xs pt-1">
        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
          <input checked={canvas.bleed > 0} type="checkbox" onChange={(e) => apply({ ...canvas, bleed: e.target.checked ? BLEED_MM : 0, cropMarks: e.target.checked })} />
          نزفٌ ٣ ملم وعلامات قصّ
        </label>

        <p className="font-label-sm text-label-sm text-on-surface-variant" data-imposition="">
          {imp.single ? `يُطبع على ورقةٍ بمقاسه ${imp.sheet.w} × ${imp.sheet.h} ملم` : `${imp.per} في ورقة A4 ${imp.sheet.w > imp.sheet.h ? 'أفقيّة' : 'عموديّة'}، بعلامات القصّ`}
        </p>
        {!imp.single && (
          <label className="flex flex-col gap-1" data-back="">
            <span className="font-label-sm text-label-sm text-on-surface-variant">الظهر — يُطبع خلف كل بطاقة على الوجه الآخر من الورقة</span>
            <select
              className="h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
              data-back-select=""
              value={backId ?? ''}
              onChange={(e) => ed.setBackId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— وجهٌ واحد —</option>
              {backChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            {backChoices.length === 0 && <span className="font-label-sm text-label-sm text-on-surface-variant">احفظ «ظهر الهويّة» من المعرض بالمقاس نفسه فيظهر هنا</span>}
            {backDoc && <span className="font-label-sm text-label-sm text-secondary">تُطبع الورقة بوجهيها. اطبع ورقةً واحدة أولًا وتأكّد أن كل ظهرٍ وقع خلف وجهه.</span>}
          </label>
        )}
      </div>
    </div>
  );
}
