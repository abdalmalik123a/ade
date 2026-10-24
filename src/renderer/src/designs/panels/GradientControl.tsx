/**
 * التدرّج (DESIGNS.md ١٫٣): لونان، وخطّيٌّ بزاويته أو دائريّ — واحدٌ للشكل والشكل الحرّ والنصّ.
 */
import type { Gradient } from '@shared/design/paint';
import { NUM, toHexColor } from '../editor/kit';

const COLOR = 'w-9 h-8 rounded border border-outline-variant bg-surface-container-low';

/** تدرّجٌ يبدأ من لونٍ قائم — فالتبديل من لونٍ إلى تدرّجٍ لا يفقد اللون. */
export const gradientFrom = (color: string | undefined): Gradient => ({
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: color ?? '#c9a45c' },
    { offset: 1, color: '#7a5a1e' }
  ]
});

export default function GradientControl({ value, onChange, act }: { value: Gradient; onChange: (g: Gradient) => void; act: string }) {
  const stop = (i: number, color: string) => onChange({ ...value, stops: value.stops.map((s, k) => (k === i ? { ...s, color } : s)) });
  const first = value.stops[0]!;
  const last = value.stops[value.stops.length - 1]!;
  return (
    <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant" data-gradient={act}>
      <input className={COLOR} data-act={`${act}-from`} title="أوّل التدرّج" type="color" value={toHexColor(first.color)} onChange={(e) => stop(0, e.target.value)} />
      <input className={COLOR} data-act={`${act}-to`} title="آخر التدرّج" type="color" value={toHexColor(last.color)} onChange={(e) => stop(value.stops.length - 1, e.target.value)} />
      <select
        className="h-8 px-1 rounded-field bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
        data-act={`${act}-type`}
        title="نوع التدرّج"
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value === 'radial' ? 'radial' : 'linear' })}
      >
        <option value="linear">خطّي</option>
        <option value="radial">دائري</option>
      </select>
      {value.type === 'linear' && (
        <label className="flex items-center gap-1">
          <input className={NUM} data-act={`${act}-angle`} inputMode="numeric" title="زاوية التدرّج بالدرجات" value={value.angle} onChange={(e) => onChange({ ...value, angle: Number(e.target.value) || 0 })} />°
        </label>
      )}
    </span>
  );
}
