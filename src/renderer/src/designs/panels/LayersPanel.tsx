/**
 * «الطبقات» (DESIGNS.md ١٫٦): العناصر من الأعلى إلى الأسفل.
 * يدعم التحديد، الإخفاء، القفل، والتكرار والحذف والترتيب للأمام وللخلف.
 */
import { kindName } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';

const ROW_ICON =
  'w-6 h-6 shrink-0 rounded flex items-center justify-center hover:bg-surface-container-highest transition-colors';

export default function LayersPanel({ ed }: { ed: DesignEditor }) {
  const { canvas, selection, setSelection, layer } = ed;
  if (canvas.elements.length === 0) return null;
  /** رقم المجموعة بترتيب ظهورها — «مجموعة ١». */
  const groups = [...new Set(canvas.elements.filter((el) => el.group).map((el) => el.group!))];

  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-body-md text-body-md text-on-surface font-semibold">الطبقات ({canvas.elements.length})</h2>
        {selection.length > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              className={ROW_ICON}
              title="خطوة للأمام (Ctrl+])"
              type="button"
              onClick={() => layer('forward')}
            >
              <span className="material-symbols-outlined text-[15px]">keyboard_arrow_up</span>
            </button>
            <button
              className={ROW_ICON}
              title="خطوة للخلف (Ctrl+[)"
              type="button"
              onClick={() => layer('backward')}
            >
              <span className="material-symbols-outlined text-[15px]">keyboard_arrow_down</span>
            </button>
            <button
              className={ROW_ICON}
              title="تكرار الطبقة (Ctrl+D)"
              type="button"
              onClick={ed.duplicateSelected}
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
            </button>
            <button
              className={`${ROW_ICON} text-error hover:bg-error-container/40`}
              title="حذف الطبقة (Delete)"
              type="button"
              onClick={ed.removeSelected}
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1 max-h-[380px] overflow-y-auto">
        {[...canvas.elements]
          .sort((a, b) => b.z - a.z)
          .map((el) => {
            const on = selection.includes(el.id);
            return (
              <div
                key={el.id}
                className={`flex items-center gap-0.5 rounded-lg border border-transparent transition-colors ${
                  on ? 'bg-primary-container text-on-primary border-primary/30' : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <button
                  className={`flex-1 min-w-0 text-right px-space-sm py-1 font-label-sm text-label-sm flex items-center gap-1.5 ${el.hidden ? 'opacity-50' : ''}`}
                  data-layer={el.id}
                  type="button"
                  onClick={(e) => setSelection((s) => (e.ctrlKey ? (s.includes(el.id) ? s.filter((id) => id !== el.id) : [...s, el.id]) : [el.id]))}
                >
                  <span className="truncate">{kindName(el)}</span>
                  {el.group && (
                    <span className="shrink-0 px-1.5 rounded-full bg-secondary-container text-on-secondary text-[10px]" data-layer-group={el.group}>
                      مجموعة {groups.indexOf(el.group) + 1}
                    </span>
                  )}
                </button>
                <button
                  className={ROW_ICON}
                  data-layer-hide={el.id}
                  title={el.hidden ? 'أظهره' : 'أخفِه — لا يُرسم ولا يُطبع'}
                  type="button"
                  onClick={() => ed.toggleOf(el.id, 'hidden')}
                >
                  <span className="material-symbols-outlined text-[16px]">{el.hidden ? 'visibility_off' : 'visibility'}</span>
                </button>
                <button
                  className={ROW_ICON}
                  data-layer-lock={el.id}
                  title={el.locked ? 'افتح القفل' : 'اقفله — فلا يُسحب بالخطأ'}
                  type="button"
                  onClick={() => ed.toggleOf(el.id, 'locked')}
                >
                  <span className="material-symbols-outlined text-[16px]">{el.locked ? 'lock' : 'lock_open'}</span>
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
