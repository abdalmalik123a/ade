/**
 * إطار الصورة في «الصور الشخصية» (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: الصورة بقاطها وقصّها، ودليل الرأس،
 * والسحب والفرشاة.
 */
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Tool } from './photoShared';
import type { Size } from '@shared/photoSheet';
import type { PhotoPreset } from '@shared/photoPresets';

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
  frameEl: RefObject<HTMLDivElement>;
  cutState: 'none' | 'running' | 'done';
  frame: Size;
  onDown: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  view: RefObject<HTMLCanvasElement>;
  preset: PhotoPreset;
  cursor: { x: number; y: number; } | null;
};

export default function PhotoFrame({ onUp, setCursor, onMove, src, box, tools, chip, tool, setTool, brush, setBrush, frameEl, cutState, frame, onDown, onWheel, view, preset, cursor }: Props) {
  return (
    <section className="flex-1 min-w-0 flex items-center justify-center" onMouseLeave={() => (onUp(), setCursor(null))} onMouseMove={onMove} onMouseUp={onUp}>
      {src && box ? (
        <div className="flex flex-col items-center gap-space-sm">
          <div className="flex gap-1" data-tools="">
            {tools.map((t) => (
              <button key={t.key} className={`${chip(tool === t.key)} flex items-center gap-1`} data-tool={t.key} disabled={!t.on} type="button" onClick={() => setTool(t.key)}>
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
            {(tool === 'keep' || tool === 'remove') && (
              <input className="w-28" data-act="brush-size" max={80} min={3} type="range" value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
            )}
          </div>
          <div
            ref={frameEl}
            className={`relative overflow-hidden bg-white shadow-2xl select-none ${tool === 'move' || tool === 'suit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-none'}`}
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
            {cursor && (tool === 'keep' || tool === 'remove') && (
              <div
                className={`absolute pointer-events-none rounded-full border-2 ${tool === 'keep' ? 'border-emerald-500' : 'border-rose-500'}`}
                style={{ left: cursor.x - brush, top: cursor.y - brush, width: brush * 2, height: brush * 2 }}
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
