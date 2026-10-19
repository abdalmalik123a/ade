/**
 * «أزل الخلفية» لصورةٍ في التصميم (DESIGNS.md ٢٫٣): المنتج أو الكوب أو الشعار يُفصل عن خلفيّته على الجهاز، فيظهر على
 * مربّعاتٍ رمادية (الشفافية)، و«أبقِ» لما نقص و«امسح» لما بقي من الخلفية — كما في «الصور الشخصية» — ثم «استعمل الصورة».
 * و«امسح لونًا» (البند ٣٨): ضغطةٌ على لونٍ بقي (البطاقة البيضاء حول الشعار) تزيله، ويُقترح وحده إن بقيت حوافّ الصورة لونًا واحدًا.
 */
import { useRef, useState } from 'react';
import type { BrushMode } from '@shared/portraitMask';
import { useCutout } from './useCutout';
import { useEscape } from '../../kit/useEscape';
import ColorEraseBar, { ColorEraseHint } from '../../components/ColorEraseBar';

const CHECKER = 'repeating-conic-gradient(#d4d4d4 0% 25%, #f5f5f5 0% 50%) 50% / 20px 20px';
const TOOL = 'h-9 px-space-sm rounded-lg flex items-center gap-1 font-label-md text-label-md transition-colors';

export default function CutoutModal({ src, onClose, onDone }: { src: string; onClose: () => void; onDone: (src: string) => void }) {
  useEscape(onClose);
  const [tool, setTool] = useState<BrushMode | 'color'>('remove');
  const c = useCutout(src, tool === 'color');
  const [brush, setBrush] = useState(18);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  /** موضع المؤشّر بإحداثيّات الصورة، ونسبة بكسل الصورة إلى بكسل الشاشة. */
  const at = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = (c.size?.w ?? r.width) / r.width;
    return { p: { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }, k, screen: { x: e.clientX - r.left, y: e.clientY - r.top } };
  };
  const ready = c.phase === 'ready';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-cutout={c.phase}>
      <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">أزل الخلفية</h2>
          <p className="font-label-md text-label-md text-on-surface-variant" data-cutout-status>
            {c.phase === 'loading' || c.phase === 'running'
              ? 'يُفصل الشيء عن خلفيّته على هذا الجهاز… ثوانٍ قليلة'
              : c.phase === 'error'
                ? c.error
                : tool === 'color'
                  ? 'اضغط على لونٍ بقي من الخلفية فيُمسح — والسماحية تضبط كم يُمسح معه، و«الصورة كلّها» لما بين الحروف'
                  : `تمّ في ${(c.ms / 1000).toFixed(1)} ثانية — «أبقِ» وامسح على ما نقص، و«امسح» على ما بقي من الخلفية، أو «امسح لونًا»`}
          </p>
          {ready && (
            <div className="mt-space-xs">
              <ColorEraseHint erase={c.erase} onAccept={() => setTool('color')} />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-space-md flex items-center justify-center bg-surface-container">
          {ready || c.phase === 'saving' ? (
            <div className="relative" style={{ background: CHECKER }}>
              <canvas
                ref={c.mount}
                className={`block max-w-full max-h-[62vh] ${tool === 'color' ? 'cursor-crosshair' : 'cursor-none'}`}
                data-cutout-canvas
                onMouseDown={(e) => {
                  if (!ready) return;
                  const { p, k } = at(e);
                  if (tool === 'color') return void c.erase.pick(p.x, p.y);
                  last.current = p;
                  c.paint(p, p, brush * k, tool);
                }}
                onMouseMove={(e) => {
                  const { p, k, screen } = at(e);
                  setCursor(screen);
                  if (!last.current || !(e.buttons & 1) || tool === 'color') return;
                  c.paint(last.current, p, brush * k, tool);
                  last.current = p;
                }}
                onMouseUp={() => (last.current = null)}
                onMouseLeave={() => {
                  last.current = null;
                  setCursor(null);
                }}
              />
              {cursor && tool !== 'color' && (
                <div
                  className={`pointer-events-none absolute rounded-full border-2 ${tool === 'keep' ? 'border-secondary' : 'border-error'}`}
                  style={{ left: cursor.x - brush, top: cursor.y - brush, width: brush * 2, height: brush * 2 }}
                />
              )}
            </div>
          ) : c.phase === 'error' ? (
            <span className="material-symbols-outlined text-[48px] text-error">error</span>
          ) : (
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant animate-spin">progress_activity</span>
          )}
        </div>

        <div className="p-space-md bg-surface-container-low flex flex-wrap items-center gap-space-sm">
          {(['keep', 'remove'] as const).map((m) => (
            <button
              key={m}
              className={`${TOOL} ${tool === m ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'}`}
              data-cutout-tool={m}
              disabled={!ready}
              title={m === 'keep' ? 'امسح على ما نقص من الشيء فيعود' : 'امسح على ما بقي من الخلفية'}
              type="button"
              onClick={() => setTool(m)}
            >
              <span className="material-symbols-outlined text-[18px]">{m === 'keep' ? 'brush' : 'ink_eraser'}</span>
              {m === 'keep' ? 'أبقِ' : 'امسح'}
            </button>
          ))}
          <button
            className={`${TOOL} ${tool === 'color' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'}`}
            data-cutout-tool="color"
            disabled={!ready}
            title="اضغط على لونٍ بقي من الخلفية فيُمسح"
            type="button"
            onClick={() => setTool('color')}
          >
            <span className="material-symbols-outlined text-[18px]">format_color_reset</span>
            امسح لونًا
          </button>
          {tool === 'color' && ready ? (
            <ColorEraseBar erase={c.erase} />
          ) : (
            <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              حجم الفرشاة
              <input className="w-28" data-act="cutout-brush" disabled={!ready} max={80} min={3} type="range" value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
            </label>
          )}
          <button className={`${TOOL} bg-surface-container-high text-on-surface`} data-act="cutout-reset" disabled={!ready} title="القناع كما خرج من النموذج" type="button" onClick={c.reset}>
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            أعِد
          </button>
          <div className="flex-1" />
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" data-act="cutout-cancel" type="button" onClick={onClose}>
            ألغِ
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="cutout-done"
            disabled={!ready}
            type="button"
            onClick={async () => {
              const path = await c.save();
              if (path) onDone(path);
            }}
          >
            استعمل الصورة
          </button>
        </div>
      </div>
    </div>
  );
}
