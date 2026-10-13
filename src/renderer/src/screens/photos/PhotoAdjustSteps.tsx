/**
 * الصور الشخصية — الخطوات ٢ إلى ٤ بعد فتح الصورة (تقسيم الشاشة بعد ١٫٧٫٠): الخلفية، والإضاءة واللون، والقاط — منقولةٌ من
 * `PhotosScreen` كما هي. عرضٌ وحده: الحال والدوالّ تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { BACKGROUND_COLORS } from '@shared/photoPresets';
import { autoEnhance, NEUTRAL, type Enhance } from '@shared/portraitEnhance';
import { SUIT_CATEGORIES, BUILTIN_SUITS, type SuitCategory, type CustomSuit } from '@shared/suits';
import { toIndic } from '@shared/arabic';
import type { Landmarks } from '@shared/portraitMask';
import type { Bg, Cut, Tool, Worn } from './photoShared';
import type { Work } from '../../lib/portraitCanvas';
import { ColorEraseHint } from '../../components/ColorEraseBar';
import type { ColorErase } from '../../lib/useColorErase';

type Props = {
  step: (n: number, title: string, extra?: React.ReactNode, later?: boolean) => JSX.Element;
  cutState: 'none' | 'running' | 'done';
  small: 'h-8 px-3 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant disabled:opacity-40';
  modelReady: boolean;
  removeBackground: () => Promise<Landmarks | null>;
  customColor: string;
  chip: (on: boolean) => string;
  bg: Bg;
  setBg: Dispatch<SetStateAction<Bg>>;
  setCustomColor: Dispatch<SetStateAction<string>>;
  resetMask: () => void;
  work: MutableRefObject<Work | null>;
  setAutoLight: Dispatch<SetStateAction<boolean>>;
  setEnhance: Dispatch<SetStateAction<Enhance>>;
  cut: MutableRefObject<Cut | null>;
  autoLight: boolean;
  slider: (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, act: string, shown?: string) => JSX.Element;
  enhance: Enhance;
  light: (patch: Partial<Enhance>) => void;
  importSuit: () => Promise<void>;
  suitTab: SuitCategory;
  setSuitTab: Dispatch<SetStateAction<SuitCategory>>;
  customSuits: CustomSuit[];
  worn: Worn | null;
  chooseSuit: (key: string | null, url?: string) => Promise<void>;
  thumbs: Record<string, string>;
  deleteSuit: (id: string) => Promise<void>;
  setWorn: Dispatch<SetStateAction<Worn | null>>;
  erase: ColorErase;
  setTool: Dispatch<SetStateAction<Tool>>;
};

export default function PhotoAdjustSteps({ step, cutState, small, modelReady, removeBackground, customColor, chip, bg, setBg, setCustomColor, resetMask, work, setAutoLight, setEnhance, cut, autoLight, slider, enhance, light, importSuit, suitTab, setSuitTab, customSuits, worn, chooseSuit, thumbs, deleteSuit, setWorn, erase, setTool }: Props) {
  return (
    <>
      {step(
        2,
        'الخلفية',
        cutState !== 'done' && (
          <button className={small} data-act="remove-bg" disabled={!modelReady || cutState === 'running'} type="button" onClick={() => void removeBackground()}>
            {cutState === 'running' ? 'تُزال…' : 'أزل الخلفية'}
          </button>
        )
      )}
      {!modelReady && <p className="font-label-sm text-label-sm text-error">نموذج إزالة الخلفية غير مثبّت مع البرنامج — تُقصّ الصورة بخلفيّتها</p>}
      <div className="flex flex-wrap gap-1">
        {(
          [
            { kind: 'white', label: 'أبيض', color: BACKGROUND_COLORS.white },
            { kind: 'lightBlue', label: 'أزرق فاتح', color: BACKGROUND_COLORS.lightBlue },
            { kind: 'custom', label: 'لونٌ آخر', color: customColor },
            { kind: 'original', label: 'الأصلية', color: null }
          ] as const
        ).map((b) => (
          <button
            key={b.kind}
            className={`${chip(bg.kind === b.kind)} flex items-center gap-1`}
            data-bg={b.kind}
            disabled={b.kind !== 'original' && cutState !== 'done'}
            type="button"
            onClick={() => setBg(b.kind === 'custom' ? { kind: 'custom', color: customColor } : { kind: b.kind })}
          >
            {b.color && <span className="w-3.5 h-3.5 rounded-full border border-outline-variant" style={{ background: b.color }} />}
            {b.label}
          </button>
        ))}
        {bg.kind === 'custom' && (
          <input
            className="w-9 h-9 rounded-lg border border-outline-variant bg-transparent"
            data-bg-color=""
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              setBg({ kind: 'custom', color: e.target.value });
            }}
          />
        )}
      </div>
      {cutState === 'done' && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          الشعر أو الكتف ناقص؟ «أبقِ» وامسح عليه؛ وبقايا خلفية؟ «امسح»، أو «امسح لونًا» واضغط عليها —{' '}
          <button className="underline" data-act="reset-mask" type="button" onClick={resetMask}>
            أعِد القناع
          </button>
        </p>
      )}
      {cutState === 'done' && <ColorEraseHint erase={erase} onAccept={() => setTool('color')} />}

      {step(
        3,
        'الإضاءة واللون',
        <span className="flex gap-1">
          <button
            className={small}
            data-act="auto-enhance"
            type="button"
            onClick={() => {
              const w = work.current;
              if (!w) return;
              setAutoLight(true);
              setEnhance(autoEnhance(cut.current?.pixels ?? w.pixels, cut.current?.alpha ?? null, w.width, w.height));
            }}
          >
            تلقائي{autoLight ? ' ✓' : ''}
          </button>
          <button
            className={small}
            data-act="reset-enhance"
            type="button"
            onClick={() => {
              setAutoLight(false);
              setEnhance(NEUTRAL);
            }}
          >
            الأصل
          </button>
        </span>
      )}
      {slider('الإضاءة', enhance.exposure, (v) => light({ exposure: v }), -1, 1, 0.01, 'exposure')}
      {slider('التباين', enhance.contrast, (v) => light({ contrast: v }), -1, 1, 0.01, 'contrast')}
      {slider('الظلال', enhance.shadows, (v) => light({ shadows: v }), 0, 1, 0.01, 'shadows')}
      {slider('الدفء', enhance.warmth, (v) => light({ warmth: v }), -1, 1, 0.01, 'warmth')}
      {slider('الضجيج', enhance.denoise, (v) => light({ denoise: v }), 0, 1, 0.01, 'denoise')}

      {step(
        4,
        'القاط',
        <button className={small} data-act="import-suit" type="button" onClick={() => void importSuit()}>
          استيراد بدلة خاصة
        </button>
      )}
      <div className="flex flex-wrap gap-1" data-suit-tabs="">
        {SUIT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`h-7 px-2.5 rounded-full font-label-sm text-label-sm ${suitTab === c.key ? 'bg-secondary-container text-on-secondary-container font-semibold' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}`}
            data-suit-tab={c.key}
            type="button"
            onClick={() => setSuitTab(c.key)}
          >
            {c.label} {toIndic(c.key === 'custom' ? customSuits.length : BUILTIN_SUITS.filter((b) => b.category === c.key).length)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        <button
          className={`aspect-square rounded-lg border-2 flex items-center justify-center font-label-sm text-label-sm ${!worn ? 'border-secondary' : 'border-transparent bg-surface-container-lowest'}`}
          data-suit="none"
          type="button"
          onClick={() => void chooseSuit(null)}
        >
          بلا قاط
        </button>
        {(suitTab === 'custom'
          ? customSuits.map((s) => ({ id: s.id, name: s.name, url: `diwan://store/${s.path}` as string | undefined, custom: true }))
          : BUILTIN_SUITS.filter((s) => s.category === suitTab).map((s) => ({ id: s.id, name: s.name, url: thumbs[s.id], custom: false }))
        ).map((s) => (
          <div key={s.id} className="relative group">
            <button
              className={`w-full aspect-square rounded-lg border-2 bg-white overflow-hidden ${worn?.suit.key === s.id ? 'border-secondary' : 'border-transparent'}`}
              data-suit={s.id}
              disabled={!s.url}
              title={s.name}
              type="button"
              onClick={() => void chooseSuit(s.id, s.url)}
            >
              {s.url && <img alt={s.name} className="w-full h-full object-contain" src={s.url} />}
            </button>
            {s.custom && (
              <button
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface/90 text-on-surface-variant hidden group-hover:flex items-center justify-center"
                title="احذف من القاط"
                type="button"
                onClick={() => void deleteSuit(s.id)}
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        ))}
      </div>
      {suitTab === 'custom' && !customSuits.length && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">لا قاط للمكتب بعد — «استيراد بدلة خاصة» يضيف صورة PNG شفّافة الخلفية والعنق</p>
      )}
      {suitTab !== 'custom' && !BUILTIN_SUITS.filter((s) => s.category === suitTab).length && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">لا توجد بدلات مدمجة حاليًا — يرجى استخدام «استيراد بدلة خاصة» لإضافة قاط للمكتب</p>
      )}
      {worn && (
        <div className="space-y-space-xs">
          {slider('الحجم', worn.at.scale / worn.base.scale, (v) => setWorn({ ...worn, at: { ...worn.at, scale: worn.base.scale * v } }), 0.5, 2, 0.01, 'suit-scale')}
          {slider('الميل', worn.at.angle, (v) => setWorn({ ...worn, at: { ...worn.at, angle: v } }), -20, 20, 0.5, 'suit-angle', `${toIndic(Math.round(worn.at.angle))}°`)}
          <button className={small} data-act="suit-reset" type="button" onClick={() => setWorn({ ...worn, at: worn.base })}>
            أعِد موضعه
          </button>
        </div>
      )}
    </>
  );
}
