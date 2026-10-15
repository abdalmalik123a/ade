import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Tool, Worn } from './photoShared';
import type { Size, Crop } from '@shared/photoSheet';
import type { PhotoPreset } from '@shared/photoPresets';
import ColorEraseBar from '../../components/ColorEraseBar';
import type { ColorErase } from '../../lib/useColorErase';
import RepairStroke from '../../components/RepairStroke';
import type { Repair } from '../../lib/useRepair';
import SuitTransformOverlay, { type HandleType } from './SuitTransformOverlay';
import BrushToolbar from './BrushToolbar';
import type { HistoryControls } from './usePhotoHistory';

type Props = {
  onUp: () => void;
  setCursor: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
  onMove: (e: React.MouseEvent) => void;
  src: string | null;
  box: { left: number; top: number; width: number; height: number; x: number; y: number; } | null;
  tools: { key: Tool; label: string; icon: string; on: boolean; }[];
  chip: (on: boolean) => string;
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
  brush: number;
  setBrush: Dispatch<SetStateAction<number>>;
  hardness: number;
  setHardness: Dispatch<SetStateAction<number>>;
  frameEl: RefObject<HTMLDivElement>;
  cutState: 'none' | 'running' | 'done';
  frame: Size;
  natural: Size | null;
  worn: Worn | null;
  onDown: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onHandleDown?: (e: React.MouseEvent, handle: HandleType) => void;
  view: RefObject<HTMLCanvasElement>;
  preset: PhotoPreset;
  cursor: { x: number; y: number; } | null;
  erase: ColorErase;
  repair: Repair & { stroke: { x: number; y: number }[] | null; lineY: number | null };
  history?: HistoryControls;
  crop: Crop;
  setCrop: Dispatch<SetStateAction<Crop>>;
};

export default function PhotoFrame({
  onUp, setCursor, onMove, src, box, tools, chip, tool, setTool, brush, setBrush, hardness, setHardness,
  frameEl, cutState, frame, natural, worn, onDown, onWheel, onHandleDown, view, preset, cursor, erase, repair, history,
  crop, setCrop
}: Props) {
  const isBrushTool = tool === 'keep' || tool === 'remove' || tool === 'repair';

  return (
    <section className="flex-1 min-w-0 flex items-center justify-center p-space-md" onMouseLeave={() => (onUp(), setCursor(null))} onMouseMove={onMove} onMouseUp={onUp}>
      {src && box ? (
        <div className="flex flex-col items-center gap-space-sm max-w-full">
          {/* شريط الأدوات العلوي مع أزرار التراجع والإعادة والتكبير */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-[640px] px-2 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant shadow-sm">
            <div className="flex items-center gap-1" data-tools="">
              {tools.map((t) => (
                <button
                  key={t.key}
                  className={`${chip(tool === t.key)} flex items-center gap-1 text-[13px]`}
                  data-tool={t.key}
                  disabled={!t.on}
                  type="button"
                  onClick={() => setTool(t.key)}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 border-r border-outline-variant pe-2">
              <button
                className="h-8 px-2 rounded-lg hover:bg-surface-container-high flex items-center gap-1 text-on-surface text-[12px] font-semibold disabled:opacity-30"
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
                className="h-8 px-2 rounded-lg hover:bg-surface-container-high flex items-center gap-1 text-on-surface text-[12px] font-semibold disabled:opacity-30"
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
                className="h-8 px-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant text-[12px] disabled:opacity-30"
                data-act="history-reset"
                title="إعادة ضبط الصورة للأصل"
                type="button"
                onClick={history?.resetAll}
              >
                أصل
              </button>
              <div className="h-4 w-px bg-outline-variant mx-1" />
              <button
                className="h-8 px-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant text-[12px]"
                title="التركيز على الوجه والرقبة (Zoom)"
                type="button"
                onClick={() => setCrop((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.3) }))}
              >
                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
              </button>
              <button
                className="h-8 px-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant text-[12px]"
                title="إعادة تكبير الصورة 100%"
                type="button"
                onClick={() => setCrop((c) => ({ ...c, zoom: 1 }))}
              >
                100%
              </button>
            </div>
          </div>

          {/* شريط التحكم بالفرشاة عند تفعيل إحدى أدوات الرسم */}
          {isBrushTool && (
            <BrushToolbar brush={brush} hardness={hardness} setBrush={setBrush} setHardness={setHardness} tool={tool} />
          )}

          {tool === 'color' && <ColorEraseBar erase={erase} />}
          <div
            ref={frameEl}
            className={`relative overflow-hidden bg-white shadow-2xl select-none ${tool === 'move' || tool === 'suit' ? 'cursor-grab active:cursor-grabbing' : tool === 'color' ? 'cursor-crosshair' : 'cursor-none'}`}
            data-cutout={cutState}
            data-photo-frame=""
            style={{ width: frame.w, height: frame.h }}
            onMouseDown={onDown}
            onWheel={onWheel}
          >
            <canvas ref={view} data-box={JSON.stringify(box)} data-photo-canvas="" style={{ position: 'absolute', inset: 0, width: frame.w, height: frame.h }} />
            {/* دليل الرأس — لا يُطبع: قمّة الرأس على الخطّ، والذقن في الشريط. */}
            {preset.head ? (
              <>
                <div className="absolute pointer-events-none left-0 right-0 border-t-2 border-dashed border-sky-500/80" style={{ top: `${preset.head.top * 100}%` }} />
                <div
                  className="absolute pointer-events-none left-0 right-0 bg-sky-500/10 border-y border-dashed border-sky-500/70"
                  style={{ top: `${(preset.head.top + preset.head.min) * 100}%`, height: `${(preset.head.max - preset.head.min) * 100}%` }}
                />
              </>
            ) : (
              <div
                className="absolute pointer-events-none rounded-[50%] border-2 border-dashed border-white/90"
                style={{ left: '20%', width: '60%', top: '12%', height: '58%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.18)' }}
              />
            )}
            {tool === 'repair' && repair.lineY !== null && (
              <div className="absolute pointer-events-none left-0 right-0 border-t-2 border-dashed border-amber-500/90" data-repair-line="" style={{ top: repair.lineY }}>
                <span className="absolute left-1 -top-5 px-1 rounded bg-amber-500/90 text-white font-label-sm text-[11px]">تحت الذقن وحده</span>
              </div>
            )}
            {tool === 'repair' && <RepairStroke points={repair.stroke} radius={brush} />}
            {cursor && (tool === 'keep' || tool === 'remove' || tool === 'repair') && (
              <div
                className={`absolute pointer-events-none rounded-full border-2 ${tool === 'keep' ? 'border-emerald-500' : tool === 'repair' ? 'border-amber-500' : 'border-rose-500'}`}
                style={{ left: cursor.x - brush, top: cursor.y - brush, width: brush * 2, height: brush * 2 }}
              />
            )}
            {/* إطار التحكم التفاعلي بالبدلة */}
            {worn && box && natural && (
              <SuitTransformOverlay
                active={tool === 'suit' || Boolean(worn)}
                box={box}
                natural={natural}
                worn={worn}
                onHandleDown={(e, h) => onHandleDown?.(e, h)}
              />
            )}
            {cutState === 'running' && (
              <div className="absolute inset-x-0 bottom-0 py-1 text-center bg-black/55 text-white font-label-sm text-label-sm">تُزال الخلفية على الجهاز…</div>
            )}
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {tool === 'move'
              ? 'اسحب الصورة وكبّرها بعجلة الفأرة حتى يقع الرأس في الدليل — والدليل لا يُطبع'
              : tool === 'suit'
                ? 'اسحب القاط حتى تلتقي ياقته بالرقبة، وكبّره بالعجلة'
                : tool === 'color'
                  ? 'اضغط على لونٍ بقي من الخلفية فيُمسح — والسماحية تضبط كم يُمسح معه'
                  : tool === 'repair'
                    ? 'امسح على ما تحت الذقن (طرف ياقةٍ أو بقعة) فيُملأ من جواره — والوجه لا يُمسّ'
                    : 'امسح بالفأرة — وحجم الفرشاة بالعجلة'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-space-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[56px]">portrait</span>
          <span className="font-body-md text-body-md">افتح صورة الزبون أو الصقها (Ctrl+V) — من هاتفه أو الماسح</span>
        </div>
      )}
    </section>
  );
}
