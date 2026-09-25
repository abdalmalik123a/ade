/**
 * الصور الشخصية — صورةٌ من هاتف الزبون، تُقصّ على وجهه وتُطبع نسخًا.
 *
 * تُفتح الصورة، ويُختار المقاس والورق، وتُسحب داخل إطارها وتُكبَّر حتى يقع الوجه
 * في الدليل البيضاويّ، ويُرفع سطوعها إن كانت معتمة. ثم تُراجع الورقة وتُطبع بمقاسها
 * الحقيقي. والحساب كلّه في `shared/photoSheet.ts` — المعاينة والطباعة منه معًا.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrinterInfo } from '@shared/api';
import {
  CENTER,
  PAPERS,
  PHOTO_SIZES,
  cropBox,
  photoLayout,
  photoSheetsHtml,
  type Crop,
  type Size
} from '@shared/photoSheet';
import SheetsPreview from '../designs/SheetsPreview';
import { errorText } from '../lib/errors';

const toIndic = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const FRAME_H = 440;

export default function PhotosScreen({ printer }: { printer: PrinterInfo | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [sizeKey, setSizeKey] = useState('35x45');
  const [custom, setCustom] = useState<Size>({ w: 35, h: 45 });
  const [paperKey, setPaperKey] = useState('photo');
  const [crop, setCrop] = useState<Crop>(CENTER);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [count, setCount] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  const photo = sizeKey === 'custom' ? custom : PHOTO_SIZES.find((s) => s.key === sizeKey)!.size;
  const paper = PAPERS.find((p) => p.key === paperKey)!.size;
  const layout = useMemo(() => photoLayout(paper, photo), [paper, photo]);
  const copies = Math.max(1, count ?? layout.per);

  const say = (text: string, warn = false) => {
    setToast({ text, warn });
    window.setTimeout(() => setToast(null), 3200);
  };

  async function open() {
    const path = await window.diwan.files.pickImage('photos');
    if (!path) return;
    const img = new Image();
    img.src = `diwan://store/${path}`;
    await img.decode();
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setSrc(path);
    setCrop(CENTER);
    setBrightness(1);
    setContrast(1);
  }

  // الإطار على الشاشة بالبكسل بنسبة المقاس — والحساب واحدٌ مع الطباعة بالملّم.
  const frame = { w: (FRAME_H * photo.w) / photo.h, h: FRAME_H };
  const box = natural ? cropBox(frame, natural, crop) : null;
  const filter = `brightness(${brightness}) contrast(${contrast})`;

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const d = drag.current;
      if (!d || !box) return;
      // سحب الصورة يمينًا يعني أن الإطار يرى ما على يسارها: المركز ينقص.
      setCrop({ ...d.crop, x: d.crop.x - (e.clientX - d.x) / box.width, y: d.crop.y - (e.clientY - d.y) / box.height });
    },
    [box]
  );

  // حصر المركز يثبت في الحالة لا في الرسم وحده — وإلا بقي السحب «يدفع» حافّةً لا تتحرّك.
  useEffect(() => {
    if (box && (Math.abs(box.x - crop.x) > 1e-6 || Math.abs(box.y - crop.y) > 1e-6)) setCrop((c) => ({ ...c, x: box.x, y: box.y }));
  }, [box, crop.x, crop.y]);

  const pages = useMemo(
    () =>
      review && src && natural
        ? photoSheetsHtml({ src, natural, crop, photo, paper, count: copies, brightness, contrast }, (s) => `diwan://store/${s}`)
        : [],
    [review, src, natural, crop, photo, paper, copies, brightness, contrast]
  );

  async function print() {
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: pages.join(''),
        printer: printer?.name ?? null,
        copies: 1,
        silent: false,
        page: paper
      });
      say(out.ok ? `أُرسلت ${toIndic(pages.length)} ورقة` : out.reason || 'لم تتم الطباعة', !out.ok);
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), true);
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    setBusy(true);
    try {
      const path = await window.diwan.output.savePdf({ sheetHtml: pages.join(''), suggestedName: 'صور شخصية', page: paper });
      if (path) say('حُفظ PDF بمقاس الورق');
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `h-9 px-3 rounded-full font-label-md text-label-md transition-colors ${on ? 'bg-primary-container text-on-primary font-semibold' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`;
  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, act: string) => (
    <label className="flex items-center gap-space-sm">
      <span className="w-16 font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <input className="flex-1" data-act={act} max={max} min={min} step={step} type="range" value={value} onChange={(e) => set(Number(e.target.value))} />
      <span className="w-10 font-label-sm text-label-sm text-on-surface-variant tabular">{Math.round(value * 100)}٪</span>
    </label>
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        <section className="w-[380px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md">
          <header>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">الصور الشخصية</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">تُقصّ على الوجه بمقاسها وتُطبع نسخًا</p>
          </header>

          <button
            className="w-full h-11 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5"
            data-act="open-photo"
            type="button"
            onClick={() => void open()}
          >
            <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
            {src ? 'صورةٌ أخرى' : 'افتح الصورة'}
          </button>

          <div className="space-y-space-xs">
            <span className="font-label-md text-label-md text-on-surface font-semibold">المقاس</span>
            <div className="flex flex-wrap gap-1">
              {PHOTO_SIZES.map((s) => (
                <button key={s.key} className={chip(sizeKey === s.key)} data-size-key={s.key} type="button" onClick={() => setSizeKey(s.key)}>
                  {s.label}
                </button>
              ))}
              <button className={chip(sizeKey === 'custom')} type="button" onClick={() => setSizeKey('custom')}>
                مقاسٌ آخر
              </button>
            </div>
            {sizeKey === 'custom' && (
              <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
                عرض
                <input
                  className="w-16 h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-center tabular"
                  value={custom.w}
                  onChange={(e) => setCustom({ ...custom, w: Math.max(10, Number(e.target.value) || 10) })}
                />
                ارتفاع
                <input
                  className="w-16 h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-center tabular"
                  value={custom.h}
                  onChange={(e) => setCustom({ ...custom, h: Math.max(10, Number(e.target.value) || 10) })}
                />
                ملم
              </div>
            )}
          </div>

          <div className="space-y-space-xs">
            <span className="font-label-md text-label-md text-on-surface font-semibold">الورق</span>
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
                className="w-20 h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-center tabular"
                data-photo-count=""
                inputMode="numeric"
                value={count ?? layout.per}
                onChange={(e) => setCount(Number(e.target.value.replace(/[^\d]/g, '')) || null)}
              />
              <span data-photo-layout="">
                {layout.per ? `${toIndic(layout.per)} في الورقة — ${toIndic(Math.ceil(copies / layout.per))} ورقة` : 'المقاس أكبر من الورقة'}
              </span>
            </label>
          </div>

          {src && (
            <div className="space-y-space-xs">
              <span className="font-label-md text-label-md text-on-surface font-semibold">الضبط</span>
              {slider('التكبير', crop.zoom, (v) => setCrop({ ...crop, zoom: v }), 1, 4, 0.01, 'zoom')}
              {slider('السطوع', brightness, setBrightness, 0.7, 1.5, 0.01, 'brightness')}
              {slider('التباين', contrast, setContrast, 0.7, 1.5, 0.01, 'contrast')}
              <button
                className="h-8 px-3 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant"
                type="button"
                onClick={() => {
                  setCrop(CENTER);
                  setBrightness(1);
                  setContrast(1);
                }}
              >
                أعِد كما كانت
              </button>
            </div>
          )}

          <button
            className="w-full h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            data-act="review-photos"
            disabled={!src || !layout.per}
            type="button"
            onClick={() => setReview(true)}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            راجع الورقة واطبع
          </button>
        </section>

        <section
          className="flex-1 min-w-0 flex items-center justify-center"
          onMouseLeave={() => (drag.current = null)}
          onMouseMove={onMove}
          onMouseUp={() => (drag.current = null)}
        >
          {src && box ? (
            <div className="flex flex-col items-center gap-space-sm">
              <div
                className="relative overflow-hidden bg-white shadow-2xl cursor-grab active:cursor-grabbing select-none"
                data-photo-frame=""
                style={{ width: frame.w, height: frame.h }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  drag.current = { x: e.clientX, y: e.clientY, crop };
                }}
                onWheel={(e) => setCrop((c) => ({ ...c, zoom: Math.max(1, Math.min(4, c.zoom - e.deltaY * 0.0015)) }))}
              >
                <img
                  alt=""
                  draggable={false}
                  src={`diwan://store/${src}`}
                  style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, maxWidth: 'none', filter }}
                />
                {/* دليل الوجه: الرأس في البيضاويّ، والعينان قرب خطّه الأفقي — لا يُطبع. */}
                <div
                  className="absolute pointer-events-none rounded-[50%] border-2 border-dashed border-white/90"
                  style={{ left: '20%', width: '60%', top: '12%', height: '58%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.18)' }}
                />
                <div className="absolute pointer-events-none left-0 right-0 border-t border-white/60" style={{ top: '40%' }} />
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                اسحب الصورة وكبّرها بعجلة الفأرة حتى يقع الوجه في البيضاويّ — والدليل لا يُطبع
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-space-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[56px]">portrait</span>
              <span className="font-body-md text-body-md">افتح صورة الزبون — من هاتفه أو الماسح</span>
            </div>
          )}
        </section>
      </div>

      {review && (
        <SheetsPreview
          busy={busy}
          cards={copies}
          pages={pages}
          unit="صورة"
          sheet={paper}
          onClose={() => setReview(false)}
          onPdf={() => void pdf()}
          onPrint={() => void print()}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${toast.warn ? 'bg-error text-on-error' : 'bg-secondary text-on-primary'}`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}
