/** خيارات الصورة والتراجع والقاط مرتبطة بالحالة الأصلية؛ توزيع عرض فقط. */
import BrushToolbar from './BrushToolbar';
import ColorEraseBar from '../../components/ColorEraseBar';
import type { PhotoFrameProps } from './PhotoFrame';
type Props = Pick<PhotoFrameProps, 'src'|'tool'|'brush'|'setBrush'|'hardness'|'setHardness'|'erase'|'history'|'crop'|'setCrop'>;
export default function PhotoOptions({ src, tool, brush, setBrush, hardness, setHardness, erase, history, setCrop }: Props) {
 const isBrushTool = tool === 'keep' || tool === 'remove' || tool === 'repair';
 return <div className="shrink-0 border-b border-outline-variant bg-surface-container-lowest px-space-sm py-space-xs space-y-1" data-photo-options dir="rtl">
 <fieldset disabled={!src} className="flex items-center gap-space-sm min-h-9 overflow-x-auto">
            <div className="flex items-center gap-1 border-r border-outline-variant pe-2">
              <button
                className="h-8 px-2 rounded-btn hover:bg-surface-container-high flex items-center gap-1 text-on-surface text-[12px] font-semibold disabled:opacity-30"
                data-act="history-undo"
                disabled={!history?.canUndo}
                title="تراجع (Ctrl+Z)"
                type="button"
                onClick={history?.undo}
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                تراجع
              </button>
              <button
                className="h-8 px-2 rounded-btn hover:bg-surface-container-high flex items-center gap-1 text-on-surface text-[12px] font-semibold disabled:opacity-30"
                data-act="history-redo"
                disabled={!history?.canRedo}
                title="إعادة (Ctrl+Y أو Ctrl+Shift+Z)"
                type="button"
                onClick={history?.redo}
              >
                <span className="material-symbols-outlined text-[16px]">redo</span>
                إعادة
              </button>
              <button
                className="h-8 px-2 rounded-btn hover:bg-surface-container-high text-on-surface-variant text-[12px] disabled:opacity-30"
                data-act="history-reset"
                title="إعادة ضبط الصورة للأصل"
                type="button"
                onClick={history?.resetAll}
              >
                أصل
              </button>
              <div className="h-4 w-px bg-outline-variant mx-1" />
              <button
                className="h-8 px-2 rounded-btn hover:bg-surface-container-high text-on-surface-variant text-[12px]"
                title="التركيز على الوجه والرقبة (Zoom)"
                type="button"
                onClick={() => setCrop((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.3) }))}
              >
                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
              </button>
              <button
                className="h-8 px-2 rounded-btn hover:bg-surface-container-high text-on-surface-variant text-[12px]"
                title="إعادة تكبير الصورة 100%"
                type="button"
                onClick={() => setCrop((c) => ({ ...c, zoom: 1 }))}
              >
                100%
              </button>
            </div>
  <span className="font-label-sm text-label-sm text-on-surface-variant">{src ? 'خيارات الأداة المختارة' : 'افتح صورة لتظهر أدواتها'}</span>
 </fieldset>
 <div className="overflow-x-auto min-h-11 flex items-center">
          {/* شريط التحكم بالفرشاة عند تفعيل إحدى أدوات الرسم */}
          {isBrushTool && (
            <BrushToolbar brush={brush} hardness={hardness} setBrush={setBrush} setHardness={setHardness} tool={tool} />
          )}

          {tool === 'color' && <ColorEraseBar erase={erase} />}

 </div></div>;
}
