/**
 * مكتبة الأشكال الحرّة (DESIGNS.md ١٫٢): موجاتٌ وزوايا مائلة وأشرطة وأقواسٌ وإطاراتٌ وشارات — كلٌّ بلمحته، ويُدرج في
 * صندوقه الافتراضيّ (الموجة السفلية بعرض البطاقة، والشارة مربّعةً بالملّم) ثم يُسحب.
 */
import { pathElement, type Box, type CanvasSize } from '@shared/canvas';
import { PATH_PRESETS, type PathPreset } from '@shared/design/pathPresets';
import type { DesignEditor } from '../editor/useDesignEditor';

const GROUPS = [...new Set(PATH_PRESETS.map((p) => p.group))];

/** الشارة والختم مربّعان بالملّم: أقصر الضلعين في صندوقه، حول مركزه. */
function boxFor(p: PathPreset, size: CanvasSize): Box {
  if (!p.square) return p.box;
  const side = Math.min(p.box.w * size.w, p.box.h * size.h);
  const w = side / size.w;
  const h = side / size.h;
  const corner = p.box.x === 0 && p.box.y === 0;
  return corner ? { x: 0, y: 0, w, h } : { x: p.box.x + (p.box.w - w) / 2, y: p.box.y + (p.box.h - h) / 2, w, h };
}

export default function ShapeLibrary({ ed, onDone }: { ed: DesignEditor; onDone: () => void }) {
  const insert = (p: PathPreset) => {
    ed.add(
      pathElement({
        box: boxFor(p, ed.canvas.size),
        d: p.d,
        preset: p.key,
        ...(p.stroke ? { fill: undefined, stroke: '#c9a45c', strokeWidth: 0.8 } : { fill: '#1f3a8a' }),
        ...(p.evenodd ? { evenodd: true } : {})
      })
    );
    onDone();
  };
  return (
    <div className="rounded-card border border-outline-variant bg-surface-container-low p-space-sm space-y-space-xs" data-panel="shape-library">
      {GROUPS.map((g) => (
        <div key={g} className="space-y-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">{g}</span>
          <div className="flex flex-wrap gap-1">
            {PATH_PRESETS.filter((p) => p.group === g).map((p) => (
              <button
                key={p.key}
                className="w-11 h-11 rounded-btn bg-surface-container-lowest border border-outline-variant hover:border-primary flex items-center justify-center"
                data-preset={p.key}
                title={p.label}
                type="button"
                onClick={() => insert(p)}
              >
                <svg height="34" preserveAspectRatio="none" viewBox="0 0 100 100" width="34">
                  <path
                    d={p.d}
                    fill={p.stroke ? 'none' : 'currentColor'}
                    fillRule={p.evenodd ? 'evenodd' : undefined}
                    stroke={p.stroke ? 'currentColor' : undefined}
                    strokeWidth={p.stroke ? 6 : undefined}
                    className="text-secondary"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
