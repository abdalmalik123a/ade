/**
 * لوح خيارات استنساخ الهوية (تقسيم النافذة بعد ١٫٧٫٠) — منقولٌ من `IdDuplexDialog` كما هو: الوجه والظهر من ملفٍّ أو من الماسح،
 * ونمط التصفيف، والمقاس، والألوان، والسطوع والتباين، والخطّ الفاصل وعلامات القصّ، والعلامة المائية.
 */
import type { Dispatch, SetStateAction } from 'react';
import { type IdDuplexLayoutMode, STANDARD_CARD_SIZES, type IdColorFilter } from '@shared/idCardDuplex';
import type { Attachment } from '@shared/api';
import IdWatermark from './IdWatermark';

type Props = {
  swapSides: () => void;
  frontSrc: string | null;
  setDeskewTarget: Dispatch<SetStateAction<'front' | 'back' | null>>;
  resolveUrl: (src: string) => string;
  pickFromFile: (side: 'front' | 'back') => Promise<void>;
  busy: boolean;
  scanSide: (side: 'front' | 'back') => Promise<void>;
  attachments: Attachment[];
  setFrontSrc: Dispatch<SetStateAction<string | null>>;
  backSrc: string | null;
  setBackSrc: Dispatch<SetStateAction<string | null>>;
  mode: IdDuplexLayoutMode;
  setMode: Dispatch<SetStateAction<IdDuplexLayoutMode>>;
  sizeKey: string;
  setSizeKey: Dispatch<SetStateAction<string>>;
  colorFilter: IdColorFilter;
  setColorFilter: Dispatch<SetStateAction<IdColorFilter>>;
  brightness: number;
  setBrightness: Dispatch<SetStateAction<number>>;
  contrast: number;
  setContrast: Dispatch<SetStateAction<number>>;
  showDivider: boolean;
  setShowDivider: Dispatch<SetStateAction<boolean>>;
  showCutMarks: boolean;
  setShowCutMarks: Dispatch<SetStateAction<boolean>>;
  wmOn: boolean;
  setWmOn: Dispatch<SetStateAction<boolean>>;
  wmTo: string;
  setWmTo: Dispatch<SetStateAction<string>>;
  setWmText: Dispatch<SetStateAction<string>>;
  wmText: string;
  wmOpacity: number;
  setWmOpacity: Dispatch<SetStateAction<number>>;
};

export default function IdOptionsPanel({ swapSides, frontSrc, setDeskewTarget, resolveUrl, pickFromFile, busy, scanSide, attachments, setFrontSrc, backSrc, setBackSrc, mode, setMode, sizeKey, setSizeKey, colorFilter, setColorFilter, brightness, setBrightness, contrast, setContrast, showDivider, setShowDivider, showCutMarks, setShowCutMarks, wmOn, setWmOn, wmTo, setWmTo, setWmText, wmText, wmOpacity, setWmOpacity }: Props) {
  return (
    <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-l border-outline-variant bg-surface-container-low p-4 overflow-y-auto space-y-4 shrink-0">
      {/* بطاقتي الوجه والظهر */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-on-surface">صور المستمسك:</span>
          <button
            type="button"
            onClick={swapSides}
            className="flex items-center gap-1 text-xs text-secondary hover:underline px-2 py-0.5 rounded bg-primary/10"
          >
            <span className="material-symbols-outlined text-[14px]">swap_vert</span>
            تبديل الوجه والظهر
          </button>
        </div>

        {/* بطاقة الوجه */}
        <div className="p-3 rounded-card border border-outline-variant bg-surface space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              وجه الهوية
            </span>
            {frontSrc && (
              <button
                type="button"
                className="text-xs text-secondary hover:underline flex items-center gap-0.5"
                onClick={() => setDeskewTarget('front')}
              >
                <span className="material-symbols-outlined text-[14px]">crop_free</span>
                تعديل الميلان
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 h-14 rounded-card bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
              {frontSrc ? (
                <img
                  alt="Face"
                  src={resolveUrl(frontSrc)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                  image
                </span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <button
                type="button"
                className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-xs text-on-surface text-center font-medium"
                onClick={() => void pickFromFile('front')}
              >
                افتح الصورة
              </button>
              <button
                type="button"
                data-act="scan-front"
                disabled={busy}
                className="px-2 py-1 btn-soft text-xs text-center font-medium disabled:opacity-50"
                onClick={() => void scanSide('front')}
              >
                امسح بالماسح الضوئي
              </button>
              {attachments.length > 0 && (
                <select
                  className="text-xs p-1 rounded bg-surface-container-high text-on-surface border-none"
                  onChange={(e) => {
                    if (e.target.value) setFrontSrc(e.target.value);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    من مرفقات المواطن...
                  </option>
                  {attachments.map((a) => (
                    <option key={a.id} value={a.filePath ?? ''}>
                      {a.docType || 'مستمسك'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* بطاقة الظهر */}
        <div className="p-3 rounded-card border border-outline-variant bg-surface space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              ظهر الهوية
            </span>
            {backSrc && (
              <button
                type="button"
                className="text-xs text-secondary hover:underline flex items-center gap-0.5"
                onClick={() => setDeskewTarget('back')}
              >
                <span className="material-symbols-outlined text-[14px]">crop_free</span>
                تعديل الميلان
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 h-14 rounded-card bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
              {backSrc ? (
                <img
                  alt="ظهر الهوية"
                  src={resolveUrl(backSrc)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                  image
                </span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <button
                type="button"
                className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-xs text-on-surface text-center font-medium"
                onClick={() => void pickFromFile('back')}
              >
                افتح الصورة
              </button>
              <button
                type="button"
                data-act="scan-back"
                disabled={busy}
                className="px-2 py-1 btn-soft text-xs text-center font-medium disabled:opacity-50"
                onClick={() => void scanSide('back')}
              >
                امسح بالماسح الضوئي
              </button>
              {attachments.length > 0 && (
                <select
                  className="text-xs p-1 rounded bg-surface-container-high text-on-surface border-none"
                  onChange={(e) => {
                    if (e.target.value) setBackSrc(e.target.value);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    من مرفقات المواطن...
                  </option>
                  {attachments.map((a) => (
                    <option key={a.id} value={a.filePath ?? ''}>
                      {a.docType || 'مستمسك'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نمط التصفيف على ورقة A4 */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-on-surface">
          طريقة التصفيف على A4:
        </label>
        <div className="flex flex-col gap-1 text-xs">
          {[
            {
              key: 'stacked',
              label: 'صفحة واحدة (وجه وظهر في المنتصف)',
              desc: 'النمط الرسمي المعتمد في الدوائر العراقية'
            },
            {
              key: 'sideBySide',
              label: 'صفحة واحدة (جنبًا إلى جنب)',
              desc: 'مناسب لطي الورقة والتغليف السريع'
            },
            {
              key: 'duplex',
              label: 'طباعة على وجهي الورقة',
              desc: 'تطابق ١٠٠٪ بين الوجه والظهر على ورقة واحدة'
            },
            {
              key: 'repeat',
              label: 'تكرار عدة بطاقات على الورقة',
              desc: 'لطباعة ٨ أو ٩ نسخ دفعة واحدة للقص'
            }
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              className={`px-3 py-2 rounded-btn text-right transition-all flex flex-col ${
                mode === m.key
                  ? 'bg-primary-fixed text-primary font-bold shadow-low'
                  : 'bg-surface hover:bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setMode(m.key as IdDuplexLayoutMode)}
            >
              <span>{m.label}</span>
              <span className="text-[10px] opacity-80 font-normal">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* مقاس البطاقة */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-on-surface">مقاس البطاقة:</label>
        <div className="grid grid-cols-1 gap-1 text-xs">
          {STANDARD_CARD_SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`px-3 py-1.5 rounded-btn text-right font-medium transition-all ${
                sizeKey === s.key
                  ? 'bg-primary-fixed text-primary font-bold'
                  : 'bg-surface hover:bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setSizeKey(s.key)}
            >
              {s.label} ({s.w} × {s.h} ملم)
            </button>
          ))}
        </div>
      </div>

      {/* ألوان الطباعة */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-on-surface">ألوان المستمسك:</label>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {[
            { key: 'color', label: 'ملونة' },
            { key: 'photocopy', label: 'استنساخ رسمي' },
            { key: 'grayscale', label: 'رمادي' }
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={`py-1.5 rounded-btn text-center font-medium transition-all ${
                colorFilter === c.key
                  ? 'bg-grad-sel text-primary font-bold border border-cyan shadow-sel'
                  : 'bg-surface hover:bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setColorFilter(c.key as IdColorFilter)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* منزلقات السطوع والتباين */}
      <div className="space-y-2 pt-2 border-t border-outline-variant text-xs">
        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>سطوع الطباعة</span>
            <span className="font-mono">{Math.round(brightness * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.5"
            step="0.05"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>تباين المستمسك</span>
            <span className="font-mono">{Math.round(contrast * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.8"
            step="0.05"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* خيارات إضافية */}
      <div className="space-y-2 pt-2 border-t border-outline-variant text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDivider}
            onChange={(e) => setShowDivider(e.target.checked)}
            className="rounded text-secondary focus:ring-primary"
          />
          <span>إظهار خط منصف للطي والقص</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCutMarks}
            onChange={(e) => setShowCutMarks(e.target.checked)}
            className="rounded text-secondary focus:ring-primary"
          />
          <span>إطار إرشادي خفيف حول الهوية</span>
        </label>
      </div>

      {/* العلامة المائية فوق النسخة — فالنسخة المعطاة لجهةٍ لا تصلح لغيرها */}
      <IdWatermark
        wmOn={wmOn}
        setWmOn={setWmOn}
        wmTo={wmTo}
        setWmTo={setWmTo}
        setWmText={setWmText}
        wmText={wmText}
        wmOpacity={wmOpacity}
        setWmOpacity={setWmOpacity}
      />
    </div>
  );
}
