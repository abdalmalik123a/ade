/**
 * «حسّن الصورة» لصورةٍ في التصميم (DESIGNS.md ٢٫٢): تدويرٌ وقلبٌ واستقامة، وقصٌّ حرٌّ أو بنسبة (مربّع، ٤:٣، ٣:٤، ١٦:٩،
 * ومثل إطار العنصر)، وإضاءةٌ وتباينٌ وظلالٌ ودفءٌ وتشبّعٌ وتنعيمٌ وضجيج — تُرى فورًا، ثم «استعمل الصورة».
 * و«رمّم» (البند ٤٠): فرشاةٌ تُمسح على شائبةٍ أو شيءٍ صغير فيُملأ مكانه من جواره بلونه وملمسه.
 */
import { useEffect, useRef, useState } from 'react';
import { cropForRatio, FULL } from '@shared/photoEdit';
import CropOverlay from './CropOverlay';
import RepairStroke from '../../components/RepairStroke';
import { straightFrame, toSource } from './photoCanvas';
import { usePhotoEdit } from './usePhotoEdit';
import { useEscape } from '../../kit/useEscape';

const BTN = 'h-9 px-space-sm rounded-card bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
const RATIOS: [string, number][] = [
  ['مربّع', 1],
  ['٤:٣', 4 / 3],
  ['٣:٤', 3 / 4],
  ['١٦:٩', 16 / 9]
];

export default function PhotoEditModal({ src, frameRatio, onClose, onDone }: { src: string; frameRatio?: number; onClose: () => void; onDone: (src: string) => void }) {
  useEscape(onClose);
  const p = usePhotoEdit(src);
  const { edit } = p;
  const [ratio, setRatio] = useState<number | null>(null);
  const view = useRef<HTMLCanvasElement | null>(null);
  const [repairOn, setRepairOn] = useState(false);
  const [brush, setBrush] = useState(14);
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = view.current;
    if (!c || !p.preview) return;
    c.width = p.preview.width;
    c.height = p.preview.height;
    c.getContext('2d')!.drawImage(p.preview, 0, 0);
  }, [p.preview]);

  const frame = p.size ? straightFrame(p.size.w, p.size.h, edit) : { w: 1, h: 1 };
  const chooseRatio = (r: number | null) => {
    setRatio(r);
    p.patch({ crop: cropForRatio(frame.w, frame.h, r) });
  };
  // الدوران يغيّر الإطار: القصّ يعود كاملًا.
  const turn = (by: 1 | 3) => {
    setRatio(null);
    p.patch({ quarter: ((edit.quarter + by) % 4) as 0 | 1 | 2 | 3, crop: FULL });
  };
  /** موضع الفأرة على المعاينة ← بكسل الأصل (عكس التدوير والقلب والاستقامة)، ونسبة بكسل الأصل إلى بكسل الشاشة. */
  const toSrc = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    const src = toSource(p.size!.w, p.size!.h, edit, (screen.x / r.width) * frame.w, (screen.y / r.height) * frame.h);
    return { src, k: frame.w / r.width, screen };
  };
  const endStroke = () => {
    if (!p.repair.painting()) return;
    setStroke(null);
    p.repair.end();
  };
  const slider = (label: string, act: string, value: number, min: number, max: number, set: (v: number) => void) => (
    <label className="flex items-center gap-space-sm">
      <span className="w-16 font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <input className="flex-1" data-act={act} disabled={!p.ready} max={max} min={min} step={(max - min) / 100} type="range" value={value} onChange={(e) => set(Number(e.target.value))} />
      <span className="w-8 font-label-sm text-label-sm text-on-surface-variant tabular">{Math.round(value * (max > 1 ? 1 : 100))}</span>
    </label>
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-photo-edit={p.ready ? 'ready' : 'loading'}>
      <div className="w-full max-w-5xl max-h-[92vh] surface-panel flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">حسّن الصورة</h2>
          <p className="font-label-md text-label-md text-on-surface-variant">
            {p.error ?? (repairOn ? 'امسح على شائبةٍ أو شيءٍ صغير فيُملأ مكانه من جواره — و«تراجع» يعيده' : 'ما تراه هنا هو ما يُحفظ — والأصل باقٍ: التراجع يعيده')}
          </p>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 flex items-center justify-center bg-surface-container p-space-md overflow-auto">
            {p.preview ? (
              <div className="relative">
                <canvas ref={view} className="block max-w-full max-h-[64vh]" data-photo-preview="" />
                <CropOverlay crop={edit.crop} frame={frame} ratio={ratio} onChange={(crop) => p.patch({ crop })} />
                {repairOn && (
                  <div
                    className="absolute inset-0 cursor-none"
                    data-repair-layer=""
                    onMouseDown={(e) => {
                      const { src, k, screen } = toSrc(e);
                      p.repair.begin(src, brush * k);
                      setStroke([screen]);
                    }}
                    onMouseLeave={() => (endStroke(), setCursor(null))}
                    onMouseMove={(e) => {
                      const { src, k, screen } = toSrc(e);
                      setCursor(screen);
                      if (!p.repair.painting() || !(e.buttons & 1)) return;
                      p.repair.extend(src, brush * k);
                      setStroke((s) => (s ? [...s, screen] : [screen]));
                    }}
                    onMouseUp={endStroke}
                  >
                    <RepairStroke points={stroke} radius={brush} />
                    {cursor && <div className="absolute pointer-events-none rounded-full border-2 border-amber-500" style={{ left: cursor.x - brush, top: cursor.y - brush, width: brush * 2, height: brush * 2 }} />}
                  </div>
                )}
              </div>
            ) : (
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant animate-spin">progress_activity</span>
            )}
          </div>

          <aside className="w-80 shrink-0 overflow-auto p-space-md space-y-space-md border-r border-outline-variant">
            <section className="space-y-space-xs">
              <h3 className="font-label-md text-label-md font-semibold text-on-surface">الإطار</h3>
              <div className="flex flex-wrap gap-1">
                <button className={BTN} data-act="photo-rotate-left" disabled={!p.ready} title="ربع دورةٍ عكس العقارب" type="button" onClick={() => turn(3)}>
                  <span className="material-symbols-outlined text-[18px]">rotate_left</span>
                </button>
                <button className={BTN} data-act="photo-rotate-right" disabled={!p.ready} title="ربع دورةٍ مع العقارب" type="button" onClick={() => turn(1)}>
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button className={BTN} data-act="photo-flip" disabled={!p.ready} title="اقلب يمينًا ويسارًا" type="button" onClick={() => p.patch({ flip: !edit.flip })}>
                  <span className="material-symbols-outlined text-[18px]">flip</span>
                </button>
              </div>
              {slider('استقامة', 'photo-straighten', edit.straighten, -15, 15, (straighten) => p.patch({ straighten }))}
              <div className="flex flex-wrap gap-1" data-crop-ratios="">
                <button className={BTN} data-crop-ratio="free" disabled={!p.ready} type="button" onClick={() => chooseRatio(null)}>
                  {ratio === null ? '• ' : ''}حرّ
                </button>
                {[...RATIOS, ...(frameRatio ? ([['مثل الإطار', frameRatio]] as [string, number][]) : [])].map(([label, r]) => (
                  <button key={label} className={BTN} data-crop-ratio={label} disabled={!p.ready} type="button" onClick={() => chooseRatio(r)}>
                    {ratio === r ? '• ' : ''}
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-space-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">الضوء واللون</h3>
                <div className="flex gap-1">
                  <button className={BTN} data-act="photo-auto" disabled={!p.ready} title="توازن الأبيض والإضاءة من الصورة نفسها" type="button" onClick={p.auto}>
                    تلقائي
                  </button>
                  <button className={BTN} data-act="photo-reset-light" disabled={!p.ready} type="button" onClick={p.resetLight}>
                    أعِد
                  </button>
                </div>
              </div>
              {slider('الإضاءة', 'photo-exposure', edit.enhance.exposure, -1, 1, (exposure) => p.light({ exposure }))}
              {slider('التباين', 'photo-contrast', edit.enhance.contrast, -1, 1, (contrast) => p.light({ contrast }))}
              {slider('الظلال', 'photo-shadows', edit.enhance.shadows, 0, 1, (shadows) => p.light({ shadows }))}
              {slider('الدفء', 'photo-warmth', edit.enhance.warmth, -1, 1, (warmth) => p.light({ warmth }))}
              {slider('التشبّع', 'photo-saturation', edit.saturation, -1, 1, (saturation) => p.patch({ saturation }))}
              {slider('التنعيم', 'photo-smooth', edit.smooth, 0, 1, (smooth) => p.patch({ smooth }))}
              {slider('الضجيج', 'photo-denoise', edit.enhance.denoise, 0, 1, (denoise) => p.light({ denoise }))}
            </section>

            <section className="space-y-space-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">رمّم</h3>
                <button className={BTN} data-act="photo-repair-undo" disabled={!p.repair.canUndo} type="button" onClick={p.repair.undo}>
                  <span className="material-symbols-outlined text-[18px]">undo</span>
                  تراجع
                </button>
              </div>
              <button
                className={`${BTN} w-full justify-center ${repairOn ? '!bg-primary-container !text-on-primary' : ''}`}
                data-act="photo-repair"
                disabled={!p.ready}
                title="امسح على شائبةٍ أو شيءٍ صغير فيُملأ مكانه من جواره بلونه وملمسه"
                type="button"
                onClick={() => setRepairOn((v) => !v)}
              >
                <span className="material-symbols-outlined text-[18px]">healing</span>
                {repairOn ? 'الفرشاة مختارة — امسح على المعاينة' : 'فرشاة الترميم'}
              </button>
              {repairOn && slider('الفرشاة', 'photo-repair-brush', brush, 3, 60, setBrush)}
            </section>
          </aside>
        </div>

        <div className="p-space-md bg-surface-container-low flex items-center gap-space-sm">
          <button className={BTN} data-act="photo-reset" disabled={!p.ready} type="button" onClick={() => (setRatio(null), p.reset())}>
            أعِد الكلّ
          </button>
          <div className="flex-1" />
          <button className="h-10 px-space-md rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" data-act="photo-cancel" type="button" onClick={onClose}>
            ألغِ
          </button>
          <button
            className="h-10 px-space-lg btn-act font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="photo-done"
            disabled={!p.ready || p.saving || !p.edited}
            type="button"
            onClick={async () => {
              const path = await p.save();
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
