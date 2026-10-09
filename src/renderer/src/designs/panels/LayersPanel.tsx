/**
 * «الطبقات»: العناصر من الأعلى إلى الأسفل، والضغط يحدّد (ومع Ctrl يضيف أو يرفع)، والمقفل بعلامته.
 */
import { kindName } from '../editor/kit';
import type { DesignEditor } from '../editor/useDesignEditor';

export default function LayersPanel({ ed }: { ed: DesignEditor }) {
  const { canvas, selection, setSelection } = ed;
  if (canvas.elements.length === 0) return null;
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">الطبقات ({canvas.elements.length})</h2>
      {[...canvas.elements]
        .sort((a, b) => b.z - a.z)
        .map((el) => (
          <button
            key={el.id}
            className={`w-full text-right rounded-lg px-space-sm py-1 font-label-sm text-label-sm flex items-center gap-1.5 ${
              selection.includes(el.id) ? 'bg-primary-container text-on-primary' : 'text-on-surface hover:bg-surface-container-high'
            }`}
            data-layer={el.id}
            type="button"
            onClick={(e) => setSelection((s) => (e.ctrlKey ? (s.includes(el.id) ? s.filter((id) => id !== el.id) : [...s, el.id]) : [el.id]))}
          >
            {el.locked && <span className="material-symbols-outlined text-[14px]">lock</span>}
            <span className="truncate">{kindName(el)}</span>
          </button>
        ))}
    </div>
  );
}
