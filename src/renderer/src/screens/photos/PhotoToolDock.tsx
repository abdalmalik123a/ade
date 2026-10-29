/** أدوات الصورة على يسار مساحة العمل؛ لا حالة معالجة جديدة هنا. */
import type { PhotoFrameProps } from './PhotoFrame';
export default function PhotoToolDock({ tools, tool, setTool, src }: Pick<PhotoFrameProps,'tools'|'tool'|'setTool'|'src'>) {
 return <div className="w-16 shrink-0 border-r border-outline-variant bg-surface-container-lowest p-1 flex flex-col gap-1 overflow-y-auto" data-tools data-photo-dock dir="rtl">
  {tools.map(t=><button type="button" key={t.key} data-tool={t.key} aria-pressed={tool===t.key} disabled={!src||!t.on} onClick={()=>setTool(t.key)}
   className={`min-h-14 rounded-btn flex flex-col items-center justify-center font-label-xs text-label-xs border transition-colors disabled:opacity-40 ${tool===t.key?'bg-primary-fixed text-primary border-primary':'text-on-surface-variant border-transparent hover:bg-surface-container-high'}`}>
    <span className="material-symbols-outlined text-[20px]">{t.icon}</span>{t.label}
  </button>)}
 </div>;
}
