/**
 * الصور الشخصية — الخطوتان ٥ و٦ (تقسيم الشاشة بعد ١٫٧٫٠): المقاس ودليل الرأس والدقّة، ثم الورق والنسخ والإخراج — منقولتان من
 * `PhotosScreen` كما هما.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { toIndic, count as countOf } from '@shared/arabic';
import { CUSTOM_ID, pct, LOW_DPI } from './photoShared';
import { autoCrop, type Landmarks } from '@shared/portraitMask';
import { PAPERS, type Size, type Crop } from '@shared/photoSheet';
import type { PhotoPreset } from '@shared/photoPresets';
import type { Outcome } from '../../components/OutputBar';
import type { PhotoLayout } from '@shared/photoSheet';
import type { ToolNav } from '../../components/ToolFrame';

export type PhotoSizeOutputProps = {
  step: (n: number, title: string, extra?: React.ReactNode, later?: boolean) => JSX.Element;
  small: 'h-8 px-3 rounded-btn hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant disabled:opacity-40';
  setPresetsOpen: Dispatch<SetStateAction<boolean>>;
  presets: PhotoPreset[];
  chip: (on: boolean) => string;
  presetId: string;
  choosePreset: (id: string) => void;
  numInput: 'input-field w-16 h-9 px-2 text-center tabular';
  custom: Size;
  setCustom: Dispatch<SetStateAction<Size>>;
  preset: PhotoPreset;
  src: string | null;
  slider: (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, act: string, shown?: string) => JSX.Element;
  crop: Crop;
  setCrop: Dispatch<SetStateAction<Crop>>;
  plausible: boolean | null;
  natural: Size | null;
  lm: Landmarks | null;
  photo: { w: number; h: number; };
  head: { ratio: number; top: number; } | null;
  headOk: boolean | null;
  effDpi: number;
  paperKey: string;
  setPaperKey: Dispatch<SetStateAction<string>>;
  copies: number;
  setCount: Dispatch<SetStateAction<number | null>>;
  layout: PhotoLayout;
  after: Outcome | null;
  setAfter: Dispatch<SetStateAction<Outcome | null>>;
  lastPrint: MutableRefObject<{ html: string; count: number; paper: Size; printer: string; system: boolean; } | null>;
  send: (job: { html: string; count: number; paper: Size; printer: string; system: boolean; }) => Promise<void>;
  busy: string | null;
  cutState: 'none' | 'running' | 'done';
  openReview: () => Promise<void>;
  saveImage: () => Promise<void>;
  nav: ToolNav;
  linkCitizen: (id: number) => Promise<void>;
  setPicking: Dispatch<SetStateAction<boolean>>;
  limit: number;
  setLimit: Dispatch<SetStateAction<number>>;
  saveUpload: () => Promise<void>;
};

export default function PhotoSizeOutput({ step, small, setPresetsOpen, presets, chip, presetId, choosePreset, numInput, custom, setCustom, preset, src, slider, crop, setCrop, plausible, natural, lm, photo, head, headOk, effDpi, paperKey, setPaperKey, copies, setCount, layout }: PhotoSizeOutputProps) {
  return (
    <>
      {step(5, 'المقاس', <button className={small} data-act="presets" type="button" onClick={() => setPresetsOpen(true)}>قوالب المكتب</button>)}
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p.id} className={chip(presetId === p.id)} data-size-key={p.id} title={p.name} type="button" onClick={() => choosePreset(p.id)}>
            {p.builtin ? `${toIndic(p.widthMm / 10)} × ${toIndic(p.heightMm / 10)} سم`.replace(/\./g, '٫') : p.name}
          </button>
        ))}
        <button className={chip(presetId === CUSTOM_ID)} data-size-key={CUSTOM_ID} type="button" onClick={() => choosePreset(CUSTOM_ID)}>
          مقاسٌ آخر
        </button>
      </div>
      {presetId === CUSTOM_ID && (
        <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
          عرض
          <input className={numInput} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Math.max(10, Number(e.target.value) || 10) })} />
          ارتفاع
          <input className={numInput} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Math.max(10, Number(e.target.value) || 10) })} />
          ملم
        </div>
      )}
      <details className="font-label-sm text-label-sm" data-photo-size-guide><summary className="cursor-pointer text-on-surface-variant">دليل الرأس والدقة ومصدر المقاس</summary>
        <p className="font-label-sm text-label-sm text-on-surface-variant" data-preset-source="">
          {preset.source ? `المصدر: ${preset.source}` : 'مقاسٌ شائع لا معيار منشورًا له — تُسأل الجهة عن اشتراطها'}
          {preset.notes && preset.notes !== 'مقاسٌ شائع — تُسأل الجهة عن اشتراطها' ? ` · ${preset.notes}` : ''}
        </p>
      {src && (
        <div className="flex items-center gap-space-xs">
          <div className="flex-1">{slider('التكبير', crop.zoom, (v) => setCrop({ ...crop, zoom: v }), 1, 6, 0.01, 'zoom')}</div>
          <button
            className={small}
            data-act="auto-crop"
            disabled={!plausible || !preset.head || !natural}
            title="يضع الرأس في دليل المقاس"
            type="button"
            onClick={() => lm && natural && preset.head && setCrop(autoCrop(lm, natural, photo, preset.head))}
          >
            على الدليل
          </button>
        </div>
      )}
      </details>
      {head && preset.head && (
        <p className={`font-label-sm text-label-sm ${headOk ? 'text-secondary' : 'text-error'}`} data-head-check={headOk ? 'ok' : 'off'}>
          {headOk ? '✓' : '⚠'} الرأس {pct(head.ratio)}٪ من الارتفاع — المطلوب {pct(preset.head.min)}–{pct(preset.head.max)}٪
        </p>
      )}
      {src && effDpi < LOW_DPI && (
        <p className="font-label-sm text-label-sm text-error" data-dpi-warn="">
          ⚠ تفاصيل الصورة تعادل {toIndic(effDpi)} نقطة في الإنش بهذا المقاس — قد تُطبع ليّنة؛ اطلب صورةً أقرب
        </p>
      )}

      {step(6, 'الإخراج')}
      <div className="flex flex-wrap gap-1">
        {PAPERS.map((p) => (
          <button key={p.key} className={chip(paperKey === p.key)} data-paper={p.key} type="button" onClick={() => setPaperKey(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
        عدد النسخ
        <input
          className="w-20 h-9 px-2 rounded-field bg-surface-container-lowest border border-outline-variant text-center tabular"
          data-photo-count=""
          inputMode="numeric"
          value={copies}
          onChange={(e) => setCount(Number(e.target.value.replace(/[^\d]/g, '')) || null)}
        />
        <span data-photo-layout="">
          {layout.per ? `${toIndic(layout.per)} في الورقة — ${countOf(Math.ceil(copies / layout.per), 'ورقة')}` : 'المقاس أكبر من الورقة'}
        </span>
      </label>

    </>
  );
}
