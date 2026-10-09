/**
 * «الطبقات» (DESIGNS.md ١٫٦): العناصر من الأعلى إلى الأسفل — الضغط يحدّد العنصر وحده (ولو كان في مجموعة، فيُعدَّل عضوٌ
 * بعينه) ومع Ctrl يضيف أو يرفع؛ ولكلّ صفٍّ عينُه (إخفاءٌ لا يُرسم ولا يُطبع) وقفلُه، والمجموعة بعلامتها.
 */
import { kindName } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';

const ROW_ICON = 'w-7 h-7 shrink-0 rounded-md flex items-center justify-center hover:bg-surface-container-highest';

export default function LayersPanel({ ed }: { ed: DesignEditor }) {
  const { canvas, selection, setSelection } = ed;
  if (canvas.elements.length === 0) return null;
  /** رقم المجموعة بترتيب ظهورها — «مجموعة ١». */
  const groups = [...new Set(canvas.elements.filter((el) => el.group).map((el) => el.group!))];
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">الطبقات ({canvas.elements.length})</h2>
      {[...canvas.elements]
        .sort((a, b) => b.z - a.z)
        .map((el) => {
          const on = selection.includes(el.id);
          return (
            <div key={el.id} className={`flex items-center gap-0.5 rounded-lg ${on ? 'bg-primary-container text-on-primary' : 'text-on-surface hover:bg-surface-container-high'}`}>
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
              <button className={ROW_ICON} data-layer-hide={el.id} title={el.hidden ? 'أظهره' : 'أخفِه — لا يُرسم ولا يُطبع'} type="button" onClick={() => ed.toggleOf(el.id, 'hidden')}>
                <span className="material-symbols-outlined text-[16px]">{el.hidden ? 'visibility_off' : 'visibility'}</span>
              </button>
              <button className={ROW_ICON} data-layer-lock={el.id} title={el.locked ? 'افتح القفل' : 'اقفله — فلا يُسحب بالخطأ'} type="button" onClick={() => ed.toggleOf(el.id, 'locked')}>
                <span className="material-symbols-outlined text-[16px]">{el.locked ? 'lock' : 'lock_open'}</span>
              </button>
            </div>
          );
        })}
    </div>
  );
}
