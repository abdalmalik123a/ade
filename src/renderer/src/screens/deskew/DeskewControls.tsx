/**
 * لوح أدوات التقويم (تقسيم النافذة بعد ١٫٧٫٠) — منقولٌ من `DeskewModal` كما هو: المعاينة المستوية، ونوع المقاس، وفلتر
 * الألوان، والتنظيف وأثره، والسطوع والتباين.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { DESKEW_ASPECTS } from '@shared/deskew';
import type { Cleaning, Finished } from '../deskewSteps';

type Props = {
  previewCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  aspectKey: string;
  setAspectKey: Dispatch<SetStateAction<string>>;
  filterMode: 'color' | 'photocopy' | 'grayscale' | 'scan';
  setFilterMode: Dispatch<SetStateAction<'color' | 'photocopy' | 'grayscale' | 'scan'>>;
  cleaning: Cleaning;
  setCleaning: Dispatch<SetStateAction<Cleaning>>;
  effect: Omit<Finished, 'px'> | null;
  brightness: number;
  setBrightness: Dispatch<SetStateAction<number>>;
  contrast: number;
  setContrast: Dispatch<SetStateAction<number>>;
};

export default function DeskewControls({ previewCanvasRef, aspectKey, setAspectKey, filterMode, setFilterMode, cleaning, setCleaning, effect, brightness, setBrightness, contrast, setContrast }: Props) {
  return (
    <div className="w-full md:w-80 border-t md:border-t-0 md:border-r border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
      {/* المعاينة الحية */}
      <div>
        <label className="block text-xs font-bold text-on-surface mb-1.5">
          المعاينة المستوية (١:١):
        </label>
        <div className="w-full aspect-[1.58/1] bg-surface rounded-card border border-outline-variant overflow-hidden flex items-center justify-center p-2 shadow-inner">
          <canvas
            ref={previewCanvasRef}
            className="max-w-full max-h-full object-contain shadow-soft rounded"
          />
        </div>
      </div>

      {/* اختيار نوع المقاس */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-on-surface">
          نوع المستمسك ومقاسه:
        </label>
        <div className="flex flex-col gap-1 text-xs">
          {DESKEW_ASPECTS.map((asp) => (
            <button
              key={asp.key}
              type="button"
              className={`px-3 py-2 rounded-btn text-right font-medium transition-all ${
                aspectKey === asp.key
                  ? 'bg-primary-fixed text-primary font-bold shadow-low'
                  : 'bg-surface hover:bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setAspectKey(asp.key)}
            >
              {asp.label}
            </button>
          ))}
        </div>
      </div>

      {/* فلتر الألوان */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-on-surface">فلتر الصورة:</label>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {[
            { key: 'color', label: 'ملون' },
            { key: 'photocopy', label: 'استنساخ' },
            { key: 'grayscale', label: 'رمادي' },
            { key: 'scan', label: 'مسح نظيف' }
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`py-1.5 rounded-btn text-center font-medium transition-all ${
                filterMode === f.key
                  ? 'bg-primary-fixed text-primary font-bold'
                  : 'bg-surface hover:bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setFilterMode(f.key as any)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* التنظيف (هـ١): الأختام بألوانها، والبقع، والتقويم من الأسطر — وأثرها يُقال */}
      <div className="space-y-1 text-xs" data-cleaning="">
        {(
          [
            { key: 'keepColor', label: 'احفظ ألوان الأختام والتواقيع', hint: 'في «مسح نظيف»' },
            { key: 'despeckle', label: 'أزل البقع المعزولة', hint: 'نقاط الحروف تبقى' },
            { key: 'straighten', label: 'قوِّم من الأسطر', hint: 'ورقةٌ مائلة على الزجاج' }
          ] as const
        ).map((o) => (
          <label key={o.key} className="flex items-center gap-1.5 cursor-pointer text-on-surface" title={o.hint}>
            <input
              checked={cleaning[o.key]}
              className="w-3.5 h-3.5 accent-secondary"
              data-clean={o.key}
              type="checkbox"
              onChange={(e) => setCleaning((c) => ({ ...c, [o.key]: e.target.checked }))}
            />
            {o.label}
          </label>
        ))}
        {effect && (
          <p className={`pt-1 ${effect.heavy ? 'text-error font-semibold' : 'text-on-surface-variant'}`} data-clean-effect="">
            {effect.angle ? `قُوّمت ${Math.abs(effect.angle).toFixed(1)}° · ` : ''}
            {effect.specks ? `مُحيت ${effect.specks} بقعة · ` : ''}
            الحبر {Math.round(effect.ink * 100)}٪ من الورقة
            {effect.heavy ? ' — ثقيل: جرّب «مسح نظيف» ليبيضّ الخلفية' : ''}
          </p>
        )}
      </div>

      {/* منزلقات السطوع والتباين */}
      <div className="space-y-2 pt-2 border-t border-outline-variant">
        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>السطوع</span>
            <span className="font-mono">{Math.round(brightness * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.5"
            step="0.05"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>التباين</span>
            <span className="font-mono">{Math.round(contrast * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.05"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
