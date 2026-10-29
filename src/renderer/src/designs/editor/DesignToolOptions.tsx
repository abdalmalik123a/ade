/** خيارات الإدراج فقط؛ تنسيق العنصر الموجود يبقى في ContextFormatBar. */
import { DESIGN_TOOLS } from './toolElements';
import type { DesignEditor } from './useDesignEditor';
export default function DesignToolOptions({ ed }: { ed: DesignEditor }) {
  const { tool, toolDefaults: d, setToolDefaults: set } = ed;
  const input = 'input-field h-8 px-2 font-label-sm text-label-sm';
  return <div className="flex items-center gap-space-sm font-label-sm text-label-sm" data-tool-options={tool}>
    <strong>{DESIGN_TOOLS.find((t) => t.id === tool)?.label}</strong>
    {(tool === 'text' || tool === 'field') && <>
      <input className={`${input} w-40`} aria-label={tool === 'field' ? 'اسم الحقل' : 'النص الأولي'} value={tool === 'field' ? d.field : d.text} onChange={(e) => set({ ...d, [tool]: e.target.value })} />
      <label>حجم الخط <input className={`${input} w-16`} type="number" min={6} max={144} value={d.size} onChange={(e) => set({ ...d, size: Math.max(6, Math.min(144, Number(e.target.value) || 16)) })} /></label>
    </>}
    {tool === 'shape' && <label>التعبئة <input type="color" value={d.fill} onChange={(e) => set({ ...d, fill: e.target.value })} /></label>}
    {tool === 'barcode' && <select className={input} aria-label="نوع الرمز" value={d.symbology} onChange={(e) => set({ ...d, symbology: e.target.value as 'qr' | 'code128' })}><option value="code128">باركود</option><option value="qr">QR</option></select>}
    <span className="text-on-surface-variant">انقر للموضع أو اسحب للمقاس</span>
    <button type="button" className="h-8 px-2 rounded-btn bg-surface-container-high" data-cancel-tool onClick={() => ed.chooseTool('select')}>إلغاء الأداة (Esc)</button>
  </div>;
}
