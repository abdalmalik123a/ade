/**
 * صورة المعاملة — صورةٌ من هاتف الزبون تصير صورةً رسميّة بخطواتٍ قليلة: تُفتح أو تُلصق، فتُزال
 * خلفيّتها على الجهاز، وتُصحَّح إضاءتها ولونها، ويُلبَس قاطًا إن طُلب، وتُقصّ على دليل رأس
 * المقاس — ثم تُطبع نسخًا، أو تُحفظ صورةً أو للرفع بحدّ حجم، أو في ملف صاحبها.
 *
 * **كلّه على الجهاز**: النموذج في العملية الرئيسة (`photos:cutout`)، ولا تخرج صورةٌ من الحاسوب.
 * **والهوية لا تُمسّ**: لونٌ وإضاءةٌ لكلّ بكسلٍ في مكانه، وقصٌّ بنسبةٍ واحدة — لا تنعيم ولا
 * تنحيف ولا تغيير ملامح. والمعاينة والحفظ والطباعة من رسمٍ واحد (`lib/portraitCanvas.ts`)
 * ببكسلات الدقّة الحقيقية (`pixelSize`).
 */
import { useEffect, useRef, useState } from 'react';
import { CENTER, PAPERS, cropBox, photoLayout, sourceRect, type Crop, type Size } from '@shared/photoSheet';
import {
  BUILTIN_PRESETS,
  backgroundColor,
  effectiveDpi,
  pixelSize,
  type PhotoPreset
} from '@shared/photoPresets';
import { type Landmarks, type SuitTransform } from '@shared/portraitMask';
import { NEUTRAL, type Enhance } from '@shared/portraitEnhance';
import { BUILTIN_SUITS, type CustomSuit, type SuitCategory } from '@shared/suits';
import CitizenMultiPicker from '../components/CitizenMultiPicker';
import { type Outcome } from '../components/OutputBar';
import { ToolHeader, useToolNav } from '../components/ToolFrame';
import SheetsPreview from '../designs/SheetsPreview';
import { savedLimit } from '../lib/fitImage';
import { type Suit, type Work } from '../lib/portraitCanvas';
import { toIndic } from '@shared/arabic';
import PresetsDialog from './PhotoPresetsDialog';
import { CUSTOM_ID, frameFor, pct, type Bg, type Cut, type PhotoIncoming, type Tool, type Worn } from './photos/photoShared';
import PhotoAdjustSteps from './photos/PhotoAdjustSteps';
import PhotoSizeOutput from './photos/PhotoSizeOutput';
import PhotoFrame from './photos/PhotoFrame';
import { usePhotoCanvas } from './photos/usePhotoCanvas';
import { usePhotoSteps } from './photos/usePhotoSteps';
import { usePhotoBrush } from './photos/usePhotoBrush';
import { usePhotoOutput } from './photos/usePhotoOutput';

/** القاط المدمج صورٌ مضمّنة (data:) تُحمَّل عند فتح الشاشة — فلا تُقفَل اللوحة بأصل ملفٍّ محلّي. */
const SUIT_FILES = import.meta.glob('../assets/suits/*.webp', { query: '?inline', import: 'default' }) as Record<string, () => Promise<string>>;

/** صورةٌ فتحها الشبّاك من «الملفّات» — نوعها في `photos/photoShared.ts`. */
export type { PhotoIncoming } from './photos/photoShared';

export default function PhotosScreen({ incoming = null }: { incoming?: PhotoIncoming | null } = {}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [cutState, setCutState] = useState<'none' | 'running' | 'done'>('none');
  const [cutVersion, setCutVersion] = useState(0);
  const [lm, setLm] = useState<Landmarks | null>(null);
  const [enhance, setEnhance] = useState<Enhance>(NEUTRAL);
  const [autoLight, setAutoLight] = useState(true);
  const [bg, setBg] = useState<Bg>({ kind: 'white' });
  const [customColor, setCustomColor] = useState('#e6e6e6');
  const [customPresets, setCustomPresets] = useState<PhotoPreset[]>([]);
  const [presetId, setPresetId] = useState('35x45');
  const [custom, setCustom] = useState<Size>({ w: 35, h: 45 });
  const [paperKey, setPaperKey] = useState('photo');
  const [crop, setCrop] = useState<Crop>(CENTER);
  const [count, setCount] = useState<number | null>(null);
  const [customSuits, setCustomSuits] = useState<CustomSuit[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [worn, setWorn] = useState<Worn | null>(null);
  const [suitTab, setSuitTab] = useState<SuitCategory>('suit');
  const [tool, setTool] = useState<Tool>('move');
  const [brush, setBrush] = useState(16);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [review, setReview] = useState<{ path: string; px: Size } | null>(null);
  const [limit, setLimit] = useState(() => savedLimit(0));
  const [picking, setPicking] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const nav = useToolNav();
  /** ما خرج آخر مرّة — يُقال في شريط الإخراج، ومنه «أعد الطبع» بالورقة نفسها. */
  const [after, setAfter] = useState<Outcome | null>(null);
  const lastPrint = useRef<{ html: string; count: number; paper: Size; printer: string; system: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  const work = useRef<Work | null>(null);
  /** القناع (يُعدَّل بالفرشاة)، وقناع النموذج (لـ«أعِد القناع»)، وألوان الحافّة بلا هالة. */
  const cut = useRef<Cut | null>(null);
  const toned = useRef<Uint8ClampedArray | null>(null);
  const subject = useRef<HTMLCanvasElement | null>(null);
  /** حدّ الشخص تحت القاط لكلّ عمود (`neckLine`) — ومداه الرأسيّ، فيُعاد ما تغيّر من الصفوف وحده. */
  const line = useRef<{ line: Float32Array; lo: number; hi: number } | null>(null);
  const feather = useRef(4);
  const maskOn = useRef(false);
  const view = useRef<HTMLCanvasElement>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const suitCache = useRef(new Map<string, Suit>());
  const drag = useRef<{ tool: Tool; x: number; y: number; crop: Crop; at: SuitTransform | null; last: { x: number; y: number } | null } | null>(null);

  const presets = [...BUILTIN_PRESETS, ...customPresets];
  const preset: PhotoPreset =
    presetId === CUSTOM_ID
      ? { id: CUSTOM_ID, name: 'مقاسٌ آخر', widthMm: custom.w, heightMm: custom.h, dpi: 600, background: { kind: 'white' }, head: null, copies: 6, notes: '', source: null, builtin: true }
      : (presets.find((p) => p.id === presetId) ?? BUILTIN_PRESETS[0]!);
  const photo = { w: preset.widthMm, h: preset.heightMm };
  const px = pixelSize(preset);
  const paper = PAPERS.find((p) => p.key === paperKey)!.size;
  const layout = photoLayout(paper, photo);
  const copies = Math.max(1, count ?? preset.copies);
  const frame = frameFor(photo);
  const box = natural ? cropBox(frame, natural, crop) : null;
  const useMask = cutState === 'done' && bg.kind !== 'original';
  const bgColor = bg.kind === 'original' ? '#ffffff' : backgroundColor(bg);

  // مؤقّتٌ واحد: رسالةٌ جديدة لا يمحوها مؤقّت ما قبلها.
  const toastTimer = useRef(0);
  const say = (text: string, warn = false) => {
    setToast({ text, warn });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const [expired, setExpired] = useState(false);

  useEffect(() => {
    void window.diwan.license.status().then((s) => setExpired(s.status === 'expired'));
    void window.diwan.photos.modelReady().then(setModelReady);
    void window.diwan.photos.presets().then(setCustomPresets);
    void window.diwan.photos.suits().then(setCustomSuits);
    void Promise.all(BUILTIN_SUITS.map(async (s) => [s.id, await SUIT_FILES[`../assets/suits/${s.file}`]!()] as const)).then((list) =>
      setThumbs(Object.fromEntries(list))
    );
  }, []);

  // ── الرسم ─────────────────────────────────────────────────────────────

  // ── الرسم: الشخص ولوحة العمل والإطار — `photos/usePhotoCanvas.ts` ──
  const { rebuildSubject, draw } = usePhotoCanvas({
    work, toned, subject, maskOn, cut, line, feather, natural, crop, bgColor, worn, frame, view, enhance, cutVersion, useMask, lm,
    box, setCrop
  });

  // ── الخطوات ───────────────────────────────────────────────────────────

  // ── الخطوات: الفتح واللصق، وإزالة الخلفية، والمقاس، والقاط — `photos/usePhotoSteps.ts` ──
  const { open, pasteButton, removeBackground, importSuit, chooseSuit, deleteSuit, choosePreset } = usePhotoSteps({
    preset, work, setCutState, cut, setLm, autoLight, setEnhance, setCrop, setCutVersion, say, setBusy, toned, maskOn, line,
    setSrc, setNatural, setWorn, setTool, setReview, rebuildSubject, modelReady, incoming, setPresetId, setCount, presets, setBg,
    lm, natural, tool, cutState, suitCache, bg, setCustomSuits, setSuitTab, worn
  });

  // ── السحب والفرشاة، و«امسح لونًا» — `photos/usePhotoBrush.ts` ──
  const { resetMask, onUp, onMove, onDown, onWheel, erase, repair } = usePhotoBrush({
    frameEl, frame, natural, crop, work, cut, brush, rebuildSubject, draw, drag, tool, worn, setCursor, box, setCrop, setWorn,
    setLm, setBrush, setCutVersion, cutState, say, lm
  });

  // ── الإخراج: الطباعة والمراجعة وPDF والصورة وللرفع وفي ملفّ الزبون — `photos/usePhotoOutput.ts` ──
  const { send, openReview, saveImage, linkCitizen, saveUpload, pages, pdf, print } = usePhotoOutput({
    natural, subject, crop, bgColor, worn, px, preset, setBusy, say, setReview, limit, setPicking, review, photo, paper, copies,
    setPrinting, lastPrint, setAfter
  });

  // ── فحوصٌ تُرى ────────────────────────────────────────────────────────

  // المعالم تُصدَّق إن ظهر الكتفان وكان الرأس بنسبةٍ بشرية — وإلا فالدليل بالعين ولا يُدّعى فحص.
  const plausible = lm && lm.shoulderY !== null && (lm.chin - lm.top) / lm.headWidth > 0.9 && (lm.chin - lm.top) / lm.headWidth < 2;
  const head =
    plausible && box && natural && cutState === 'done'
      ? (() => {
          const k = box.width / natural.w;
          return { ratio: ((lm.chin - lm.top) * k) / frame.h, top: (box.top + lm.top * k) / frame.h };
        })()
      : null;
  const headOk = head && preset.head ? head.ratio >= preset.head.min - 0.01 && head.ratio <= preset.head.max + 0.01 : null;
  const effDpi = natural ? effectiveDpi(sourceRect(photo, natural, crop).w, photo.w) : 0;

  // ── الواجهة ───────────────────────────────────────────────────────────

  const chip = (on: boolean) =>
    `h-9 px-3 rounded-full font-label-md text-label-md transition-colors ${on ? 'bg-primary-container text-on-primary font-semibold' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`;
  const small = 'h-8 px-3 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant disabled:opacity-40';
  const numInput = 'w-16 h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-center tabular';
  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, act: string, shown = pct(value)) => (
    <label className="flex items-center gap-space-sm">
      <span className="w-20 font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <input className="flex-1" data-act={act} max={max} min={min} step={step} type="range" value={value} onChange={(e) => set(Number(e.target.value))} />
      <span className="w-10 font-label-sm text-label-sm text-on-surface-variant tabular">{shown}</span>
    </label>
  );
  const light = (patch: Partial<Enhance>) => {
    setAutoLight(false);
    setEnhance((e) => ({ ...e, ...patch }));
  };
  /** خطوةٌ برقمها — و`later` ما لا يُعمل قبل فتح الصورة: باهتةٌ في مكانها، فالأرقام ثابتة (البند ١٨: كانت ١ ثم ٥ ثم ٦). */
  const step = (n: number, title: string, extra?: React.ReactNode, later = false) => (
    <div className={`flex items-center justify-between ${later ? 'opacity-50' : ''}`} data-step={n} data-step-later={later ? '' : undefined}>
      <span className={`font-label-md text-label-md font-semibold ${later ? 'text-on-surface-variant' : 'text-on-surface'}`}>
        <span
          className={`inline-flex w-5 h-5 me-1 rounded-full items-center justify-center text-[11px] ${
            later ? 'bg-surface-container-high text-on-surface-variant' : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          {toIndic(n)}
        </span>
        {title}
      </span>
      {extra}
    </div>
  );
  const tools: { key: Tool; label: string; icon: string; on: boolean }[] = [
    { key: 'move', label: 'الصورة', icon: 'open_with', on: true },
    { key: 'suit', label: 'القاط', icon: 'checkroom', on: Boolean(worn) },
    { key: 'keep', label: 'أبقِ', icon: 'brush', on: cutState === 'done' },
    { key: 'remove', label: 'امسح', icon: 'ink_eraser', on: cutState === 'done' },
    { key: 'color', label: 'امسح لونًا', icon: 'format_color_reset', on: cutState === 'done' },
    { key: 'repair', label: 'رمّم', icon: 'healing', on: cutState === 'done' && Boolean(lm) }
  ];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        <section className="w-[400px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md flex flex-col">
          <ToolHeader hint="تُقصّ على الوجه بمقاسها وتُطبع نسخًا — وخلفيّتها وقاطها على الجهاز" icon="portrait" title="الصور الشخصية" />

          {expired && (
            <div className="rounded-lg bg-rose-50 border border-rose-300 p-space-sm text-rose-900 font-label-md text-label-md space-y-1" data-license-expired-banner="">
              <div className="font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">lock</span>
                انتهت المدّة التجريبية
              </div>
              <p className="text-label-sm leading-relaxed">
                ميزة الصور الشخصية محجوبة بالكامل بعد انتهاء التجربة. فعّل البرنامج من «الإعدادات ← التفعيل».
              </p>
            </div>
          )}

          {step(1, 'الصورة')}
          <div className="flex gap-space-xs">
            <button
              className="flex-1 h-11 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              data-act="open-photo"
              disabled={expired}
              type="button"
              onClick={() => void open()}
            >
              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
              {src ? 'صورةٌ أخرى' : 'افتح الصورة'}
            </button>
            <button
              className="h-11 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md flex items-center gap-1.5 hover:bg-surface-container-high disabled:opacity-40"
              data-act="paste-photo"
              disabled={expired}
              title="أو Ctrl+V في الشاشة"
              type="button"
              onClick={() => void pasteButton()}
            >
              <span className="material-symbols-outlined text-[18px]">content_paste</span>
              الصق
            </button>
          </div>

          {/* الخطوات بين الصورة والمقاس تُرى قبل فتحها — باهتةً بعناوينها — فلا يقفز الترقيم من ١ إلى ٥. */}
          {!src && (
            <div className="space-y-space-xs" data-steps-later="">
              {step(2, 'الخلفية', undefined, true)}
              {step(3, 'الإضاءة واللون', undefined, true)}
              {step(4, 'القاط', undefined, true)}
              <p className="font-label-sm text-label-sm text-on-surface-variant">تظهر أدواتها بعد فتح الصورة.</p>
            </div>
          )}

          {src && (
            <PhotoAdjustSteps
              step={step}
              cutState={cutState}
              small={small}
              modelReady={modelReady}
              removeBackground={removeBackground}
              customColor={customColor}
              chip={chip}
              bg={bg}
              setBg={setBg}
              setCustomColor={setCustomColor}
              resetMask={resetMask}
              work={work}
              setAutoLight={setAutoLight}
              setEnhance={setEnhance}
              cut={cut}
              autoLight={autoLight}
              slider={slider}
              enhance={enhance}
              light={light}
              importSuit={importSuit}
              suitTab={suitTab}
              setSuitTab={setSuitTab}
              customSuits={customSuits}
              worn={worn}
              chooseSuit={chooseSuit}
              thumbs={thumbs}
              deleteSuit={deleteSuit}
              setWorn={setWorn}
              erase={erase}
              setTool={setTool}
            />
          )}

          <PhotoSizeOutput
            step={step}
            small={small}
            setPresetsOpen={setPresetsOpen}
            presets={presets}
            chip={chip}
            presetId={presetId}
            choosePreset={choosePreset}
            numInput={numInput}
            custom={custom}
            setCustom={setCustom}
            preset={preset}
            src={src}
            slider={slider}
            crop={crop}
            setCrop={setCrop}
            plausible={plausible}
            natural={natural}
            lm={lm}
            photo={photo}
            head={head}
            headOk={headOk}
            effDpi={effDpi}
            paperKey={paperKey}
            setPaperKey={setPaperKey}
            copies={copies}
            setCount={setCount}
            layout={layout}
            after={after}
            setAfter={setAfter}
            lastPrint={lastPrint}
            send={send}
            busy={busy}
            cutState={cutState}
            openReview={openReview}
            saveImage={saveImage}
            nav={nav}
            linkCitizen={linkCitizen}
            setPicking={setPicking}
            limit={limit}
            setLimit={setLimit}
            saveUpload={saveUpload}
          />
        </section>

        <PhotoFrame
          onUp={onUp} setCursor={setCursor} onMove={onMove} src={src} box={box} tools={tools}
          chip={chip} tool={tool} setTool={setTool} brush={brush} setBrush={setBrush} frameEl={frameEl}
          cutState={cutState} frame={frame} onDown={onDown} onWheel={onWheel} view={view}
          preset={preset} cursor={cursor} erase={erase} repair={repair}
        />
      </div>

      {review && (
        <SheetsPreview
          busy={printing} cards={copies} pages={pages} unit="صورة" sheet={paper}
          onClose={() => setReview(null)} onPdf={() => void pdf()} onPrint={() => void print()}
        />
      )}

      {picking && <CitizenMultiPicker single confirmLabel="احفظها صورته" title="في ملفّ من تُحفظ الصورة؟" onClose={() => setPicking(false)} onPick={(ids) => void linkCitizen(ids[0]!)} />}

      {presetsOpen && (
        <PresetsDialog
          presets={customPresets} onClose={() => setPresetsOpen(false)}
          onDelete={async (id) => { setCustomPresets(await window.diwan.photos.deletePreset(id)); if (presetId === id) choosePreset('35x45'); }}
          onSave={async (p) => { setCustomPresets(await window.diwan.photos.savePreset(p)); setPresetsOpen(false); setPresetId(p.id); setCount(null); setBg((b) => (b.kind === 'original' ? b : p.background)); }}
        />
      )}

      {busy && <div className="fixed bottom-6 right-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg bg-surface-container-highest text-on-surface font-label-md text-label-md">{busy}</div>}
      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${toast.warn ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary'}`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}
