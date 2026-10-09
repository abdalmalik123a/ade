/**
 * الشكل الحرّ المحدَّد (DESIGNS.md ١٫٢): ملؤه وحدّه بلونه وسُمكه بالملّم، والقلب أفقيًّا ورأسيًّا — فالموجة العلوية
 * تصير سفلية، والزاوية تنتقل إلى الزاوية المقابلة.
 */
import type { PathElement } from '@shared/canvas';
import { ICON, NUM, toHexColor } from '../editor/kit';

const ROW = 'flex items-center gap-space-sm flex-wrap font-label-sm text-label-sm text-on-surface-variant';

export default function PathPanel({ path, patch }: { path: PathElement; patch: (p: Partial<PathElement>) => void }) {
  return (
    <div className="space-y-space-xs" data-panel="path">
      <div className={ROW}>
        <label className="flex items-center gap-1">
          <input checked={Boolean(path.fill)} data-act="path-fill-on" type="checkbox" onChange={(e) => patch({ fill: e.target.checked ? '#1f3a8a' : undefined })} />
          ملء
        </label>
        {path.fill && (
          <input className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low" data-act="path-fill" title="لون الملء" type="color" value={toHexColor(path.fill)} onChange={(e) => patch({ fill: e.target.value })} />
        )}
        <label className="flex items-center gap-1">
          <input checked={Boolean(path.stroke)} data-act="path-stroke-on" type="checkbox" onChange={(e) => patch({ stroke: e.target.checked ? '#333333' : undefined, strokeWidth: e.target.checked ? (path.strokeWidth ?? 0.5) : undefined })} />
          حدّ
        </label>
        {path.stroke && (
          <>
            <input className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low" data-act="path-stroke" title="لون الحدّ" type="color" value={toHexColor(path.stroke)} onChange={(e) => patch({ stroke: e.target.value })} />
            <label className="flex items-center gap-1">
              <input className={NUM} data-act="path-stroke-width" inputMode="decimal" title="سُمك الحدّ بالملّم" value={path.strokeWidth ?? 0.5} onChange={(e) => patch({ strokeWidth: Number(e.target.value) || path.strokeWidth })} />
              ملم
            </label>
          </>
        )}
      </div>
      <div className={ROW}>
        قلب
        <button className={`${ICON} ${path.flipX ? 'bg-primary-container/40' : ''}`} data-act="path-flip-x" title="اقلبه أفقيًّا" type="button" onClick={() => patch({ flipX: !path.flipX })}>
          <span className="material-symbols-outlined text-[18px]">flip</span>
        </button>
        <button className={`${ICON} ${path.flipY ? 'bg-primary-container/40' : ''}`} data-act="path-flip-y" title="اقلبه رأسيًّا" type="button" onClick={() => patch({ flipY: !path.flipY })}>
          <span className="material-symbols-outlined text-[18px] rotate-90">flip</span>
        </button>
      </div>
    </div>
  );
}
