/**
 * الشكل الحرّ المحدَّد (DESIGNS.md ١٫٢): ملؤه وحدّه في `PaintPanel`، وهنا القلب أفقيًّا ورأسيًّا — فالموجة العلوية تصير
 * سفلية، والزاوية تنتقل إلى الزاوية المقابلة.
 */
import type { PathElement } from '@shared/canvas';
import { ICON } from '../editor/kit';
import PaintPanel from './PaintPanel';

export default function PathPanel({ path, patch }: { path: PathElement; patch: (p: Partial<PathElement>) => void }) {
  return (
    <div className="space-y-space-xs" data-panel="path">
      <PaintPanel el={path} patch={patch} />
      <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
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
