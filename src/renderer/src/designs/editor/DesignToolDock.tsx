/** أوضاع الأدوات؛ اختيار الزر لا يضيف عنصرًا، والموضع يُختار على الورقة. */
import { DESIGN_TOOLS } from './toolElements';
import type { DesignEditor } from './useDesignEditor';
export default function DesignToolDock({ ed }: { ed: DesignEditor }) {
  return <div className="flex flex-col items-center gap-1 bg-surface-container-lowest p-1 border-r border-outline-variant shrink-0 w-14 overflow-y-auto" data-tool-dock>
    {DESIGN_TOOLS.map((t) => <button key={t.id} type="button" data-design-tool={t.id} title={t.title} aria-pressed={ed.tool === t.id}
      className={`w-11 min-h-12 rounded-btn flex flex-col items-center justify-center transition-colors border ${ed.tool === t.id ? 'bg-primary-fixed text-primary border-primary' : 'text-on-surface-variant border-transparent hover:bg-surface-container-high'}`}
      onClick={() => ed.chooseTool(t.id)}>
      <span className="material-symbols-outlined text-[18px]">{t.icon}</span><span className="font-label-xs text-label-xs">{t.label}</span>
    </button>)}
  </div>;
}
