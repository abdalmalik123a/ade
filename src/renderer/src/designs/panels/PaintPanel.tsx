/**
 * ملء الشكل وحدّه (DESIGNS.md ١٫٢ و١٫٣): بلا · لون · تدرّج — والحدّ بلونه وسُمكه ونقشه (متّصل · متقطّع · منقّط). واحدٌ
 * للشكل والشكل الحرّ.
 */
import type { PathElement, ShapeElement } from '@shared/canvas';
import { isGradient, type Dash, type Paint } from '@shared/design/paint';
import { NUM, toHexColor } from '../editor/kit';
import GradientControl, { gradientFrom } from './GradientControl';

const ROW = 'flex items-center gap-space-sm flex-wrap font-label-sm text-label-sm text-on-surface-variant';
const SELECT = 'h-8 px-1 rounded-card bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface';
const COLOR = 'w-10 h-8 rounded border border-outline-variant bg-surface-container-low';

type Painted = ShapeElement | PathElement;
/** ما تغيّره هذه اللوحة وحده — مشتركٌ بين النوعين. */
type PaintPatch = { fill?: Paint; stroke?: string; strokeWidth?: number; dash?: Dash };

export default function PaintPanel({ el, patch }: { el: Painted; patch: (p: PaintPatch) => void }) {
  const mode = el.fill === undefined || el.fill === 'transparent' ? 'none' : isGradient(el.fill) ? 'gradient' : 'color';
  const solid = typeof el.fill === 'string' && el.fill !== 'transparent' ? el.fill : undefined;
  /** سُمك الشكل بالبكسل عند ٩٦ (قديم)، والشكل الحرّ بالملّم. */
  const unit = el.kind === 'path' ? 'ملم' : 'نقطة';
  const width = el.strokeWidth ?? (el.kind === 'path' ? 0.5 : 1);
  return (
    <div className="space-y-space-xs" data-panel="paint">
      <div className={ROW}>
        ملء
        <select
          className={SELECT}
          data-act="paint-fill"
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            const fill: Paint | undefined = v === 'none' ? undefined : v === 'gradient' ? gradientFrom(solid) : (solid ?? (isGradient(el.fill) ? el.fill.stops[0]!.color : '#1f3a8a'));
            patch({ fill });
          }}
        >
          <option value="none">بلا</option>
          <option value="color">لون</option>
          <option value="gradient">تدرّج</option>
        </select>
        {mode === 'color' && <input className={COLOR} data-act="paint-fill-color" title="لون الملء" type="color" value={toHexColor(solid ?? '#1f3a8a')} onChange={(e) => patch({ fill: e.target.value })} />}
        {isGradient(el.fill) && <GradientControl act="paint-gradient" value={el.fill} onChange={(fill) => patch({ fill })} />}
      </div>
      <div className={ROW}>
        <label className="flex items-center gap-1">
          <input checked={Boolean(el.stroke)} data-act="paint-stroke-on" type="checkbox" onChange={(e) => patch({ stroke: e.target.checked ? '#333333' : undefined })} />
          حدّ
        </label>
        {el.stroke && (
          <>
            <input className={COLOR} data-act="paint-stroke" title="لون الحدّ" type="color" value={toHexColor(el.stroke)} onChange={(e) => patch({ stroke: e.target.value })} />
            <label className="flex items-center gap-1">
              <input className={NUM} data-act="paint-stroke-width" inputMode="decimal" title={`سُمك الحدّ (${unit})`} value={width} onChange={(e) => patch({ strokeWidth: Number(e.target.value) || width })} />
              {unit}
            </label>
            <select className={SELECT} data-act="paint-dash" title="نقش الحدّ" value={el.dash ?? 'solid'} onChange={(e) => patch({ dash: e.target.value === 'solid' ? undefined : (e.target.value as Dash) })}>
              <option value="solid">متّصل</option>
              <option value="dashed">متقطّع</option>
              <option value="dotted">منقّط</option>
            </select>
          </>
        )}
      </div>
    </div>
  );
}
