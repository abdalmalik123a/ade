/**
 * خيارات «ورقة المستمسكات» (S47) حين لا مستمسك محدَّد: الألوان والسطوع والتباين، وحدود القصّ، واسم المستمسك تحته، وخطّ الطيّ،
 * والحوافّ المدوّرة والظلّ (مطفآن)، و«على وجهي الورقة» (كان «طباعة على وجهي الورقة» في استنساخ الهوية)، والعلامة المائية.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { IdColorFilter } from '@shared/idCardDuplex';
import { toIndic } from '@shared/arabic';
import IdWatermark from '../idDuplex/IdWatermark';

export type SheetLookState = {
  colorFilter: IdColorFilter;
  brightness: number;
  contrast: number;
  cutMarks: boolean;
  labels: boolean;
  fold: boolean;
  rounded: boolean;
  shadow: boolean;
  duplex: boolean;
};

export type WatermarkState = { on: boolean; to: string; text: string; opacity: number };

type Props = {
  look: SheetLookState;
  setLook: (patch: Partial<SheetLookState>) => void;
  wm: WatermarkState;
  setWm: (patch: Partial<WatermarkState>) => void;
};

const FILTERS: { key: IdColorFilter; label: string }[] = [
  { key: 'color', label: 'ملوّنة' },
  { key: 'photocopy', label: 'نسخة تصوير' },
  { key: 'grayscale', label: 'رمادية' }
];

const CHECKS: { key: 'cutMarks' | 'labels' | 'fold' | 'rounded' | 'shadow' | 'duplex'; label: string }[] = [
  { key: 'cutMarks', label: 'حدودٌ رقيقة للقصّ' },
  { key: 'labels', label: 'اسم المستمسك تحته' },
  { key: 'fold', label: 'خطّ الطيّ في «نصفا الورقة»' },
  { key: 'rounded', label: 'حوافّ مدوّرة' },
  { key: 'shadow', label: 'ظلٌّ خفيف' },
  { key: 'duplex', label: 'على وجهي الورقة: الظهور خلف وجوهها' }
];

/** محوّلٌ لـ`IdWatermark` (يأخذ أزواج الحال كما كان في استنساخ الهوية). */
const pair = <K extends keyof WatermarkState>(wm: WatermarkState, setWm: Props['setWm'], key: K): Dispatch<SetStateAction<WatermarkState[K]>> =>
  (v) => setWm({ [key]: typeof v === 'function' ? (v as (p: WatermarkState[K]) => WatermarkState[K])(wm[key]) : v } as Partial<WatermarkState>);

export default function SheetOptions({ look, setLook, wm, setWm }: Props) {
  return (
    <div className="w-[24rem] shrink-0 overflow-y-auto p-space-md flex flex-col gap-space-sm bg-surface-container-low border-l border-outline-variant/40" data-sheet-options="">
      <h3 className="font-title-md text-title-md text-on-surface">خيارات الورقة</h3>
      <p className="font-label-sm text-label-sm text-on-surface-variant">انقر مستمسكًا في الورقة لأدواته، أو خانةً فارغة لتملأها.</p>
      <div className="flex p-0.5 rounded-card bg-surface-container-high">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`flex-1 h-8 rounded-md font-label-sm text-label-sm ${look.colorFilter === f.key ? 'bg-primary-fixed text-primary font-semibold' : 'text-on-surface-variant'}`}
            data-filter={f.key}
            type="button"
            onClick={() => setLook({ colorFilter: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>
      {(
        [
          ['brightness', 'السطوع', 0.7, 1.5],
          ['contrast', 'التباين', 0.8, 1.8]
        ] as const
      ).map(([key, label, min, max]) => (
        <label key={key} className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <span className="flex justify-between">
            {label}
            <span>{toIndic(Math.round(look[key] * 100))}٪</span>
          </span>
          <input className="w-full accent-primary" max={max} min={min} step={0.05} type="range" value={look[key]} onChange={(e) => setLook({ [key]: Number(e.target.value) })} />
        </label>
      ))}
      <div className="flex flex-col gap-space-xs pt-space-xs border-t border-outline-variant font-label-sm text-label-sm text-on-surface">
        {CHECKS.map((c) => (
          <label key={c.key} className="flex items-center gap-space-xs">
            <input checked={look[c.key]} data-look={c.key} type="checkbox" onChange={(e) => setLook({ [c.key]: e.target.checked })} />
            {c.label}
          </label>
        ))}
      </div>
      <IdWatermark
        setWmOn={pair(wm, setWm, 'on')}
        setWmOpacity={pair(wm, setWm, 'opacity')}
        setWmText={pair(wm, setWm, 'text')}
        setWmTo={pair(wm, setWm, 'to')}
        wmOn={wm.on}
        wmOpacity={wm.opacity}
        wmText={wm.text}
        wmTo={wm.to}
      />
    </div>
  );
}
