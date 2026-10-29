/** مساطر خارج الورقة والرسام؛ تتبع موضعها طبيعيًا عند التكبير والتمرير. */
import { SCREEN_DPI, mmToPx, type Canvas } from '@shared/canvas';
import { rulerTicks } from '@shared/design/ruler';
export default function Rulers({ canvas, zoom }: { canvas: Canvas; zoom: number }) {
  const width = mmToPx(canvas.size.w + canvas.bleed * 2, SCREEN_DPI) * zoom;
  const height = mmToPx(canvas.size.h + canvas.bleed * 2, SCREEN_DPI) * zoom;
  const label = (n: number) => n.toLocaleString('ar-IQ');
  return <div className="pointer-events-none text-on-surface-variant" data-design-rulers aria-label="مسطرة بالملّيمتر">
    <svg className="absolute bg-surface-container-low" data-ruler-axis="x" style={{ right: 0, top: -24, width, height: 24 }}>
      {rulerTicks(canvas.size.w, canvas.bleed, zoom).map((t) => <g key={t.mm}>
        <line data-ruler-tick={t.mm} x1={width-t.px} x2={width-t.px} y1={t.major ? 16 : 20} y2={24} stroke="currentColor" />
        {t.major && <text x={width-t.px} y={11} textAnchor="middle" fill="currentColor" fontSize={9}>{label(t.mm)}</text>}
      </g>)}
    </svg>
    <svg className="absolute bg-surface-container-low" data-ruler-axis="y" style={{ right: -24, top: 0, width: 24, height }}>
      {rulerTicks(canvas.size.h, canvas.bleed, zoom).map((t) => <g key={t.mm}>
        <line data-ruler-tick={t.mm} x1={0} x2={t.major ? 8 : 4} y1={t.px} y2={t.px} stroke="currentColor" />
        {t.major && <text x={10} y={t.px+3} fill="currentColor" fontSize={9}>{label(t.mm)}</text>}
      </g>)}
    </svg>
    <span className="absolute bg-surface-container-high flex items-center justify-center" style={{ right: -24, top: -24, width: 24, height: 24, fontSize: 9 }}>ملم</span>
  </div>;
}
