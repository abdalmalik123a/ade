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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrinterInfo } from '@shared/api';
import { SIZE_LIMITS, sizeText } from '@shared/pdfEdit';
import { CENTER, PAPERS, cropBox, photoLayout, photoSheetsHtml, sourceRect, type Crop, type Size } from '@shared/photoSheet';
import {
  BACKGROUND_COLORS,
  BUILTIN_PRESETS,
  backgroundColor,
  effectiveDpi,
  pixelSize,
  setJpegDpi,
  validatePreset,
  type PhotoBackground,
  type PhotoPreset
} from '@shared/photoPresets';
import { autoCrop, fitSuit, keepAbove, landmarks, neckLine, rowWidths, strokeAlpha, type BrushMode, type Landmarks, type SuitTransform } from '@shared/portraitMask';
import { NEUTRAL, applyEnhance, autoEnhance, type Enhance } from '@shared/portraitEnhance';
import { BUILTIN_SUITS, SUIT_CATEGORIES, type CustomSuit, type SuitCategory } from '@shared/suits';
import CitizenMultiPicker from '../components/CitizenMultiPicker';
import SheetsPreview from '../designs/SheetsPreview';
import { errorText } from '../lib/errors';
import { fitJpeg, rememberLimit, savedLimit } from '../lib/fitImage';
import { dataUrlOf, drawScene, fallbackPlace, loadImage, loadSuit, renderJpeg, workPixels, type Scene, type Suit, type Work } from '../lib/portraitCanvas';

/** القاط المدمج صورٌ مضمّنة (data:) تُحمَّل عند فتح الشاشة — فلا تُقفَل اللوحة بأصل ملفٍّ محلّي. */
const SUIT_FILES = import.meta.glob('../assets/suits/*.webp', { query: '?inline', import: 'default' }) as Record<string, () => Promise<string>>;

const toIndic = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const pct = (v: number) => toIndic(Math.round(v * 100));
const FRAME_H = 520;
const CUSTOM_ID = 'custom';
/** دون هذه الدقّة الفعلية تُطبع الصورة ليّنة — يُنبَّه الموظف ليطلب صورةً أقرب. */
const LOW_DPI = 300;

type Bg = PhotoBackground | { kind: 'original' };
type Tool = 'move' | 'suit' | BrushMode;
type Worn = { suit: Suit; at: SuitTransform; base: SuitTransform };

/** الإطار على الشاشة بنسبة المقاس — والعريض يُحدّ عرضه. */
function frameFor(photo: Size): Size {
  const w = (FRAME_H * photo.w) / photo.h;
  return w <= 600 ? { w, h: FRAME_H } : { w: 600, h: (600 * photo.h) / photo.w };
}

export default function PhotosScreen({ printer }: { printer: PrinterInfo | null }) {
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
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  const work = useRef<Work | null>(null);
  /** القناع (يُعدَّل بالفرشاة)، وقناع النموذج (لـ«أعِد القناع»)، وألوان الحافّة بلا هالة. */
  const cut = useRef<{ alpha: Uint8Array; model: Uint8Array; pixels: Uint8ClampedArray } | null>(null);
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

  useEffect(() => {
    void window.diwan.photos.modelReady().then(setModelReady);
    void window.diwan.photos.presets().then(setCustomPresets);
    void window.diwan.photos.suits().then(setCustomSuits);
    void Promise.all(BUILTIN_SUITS.map(async (s) => [s.id, await SUIT_FILES[`../assets/suits/${s.file}`]!()] as const)).then((list) =>
      setThumbs(Object.fromEntries(list))
    );
  }, []);

  // ── الرسم ─────────────────────────────────────────────────────────────

  /** الشخص بلونه المحسّن وشفافيّته في لوحة العمل — كلّها أو مستطيلٌ منها (أثر الفرشاة). */
  const rebuildSubject = useCallback((rect?: { x: number; y: number; w: number; h: number }) => {
    const w = work.current;
    const t = toned.current;
    if (!w || !t) return;
    let c = subject.current;
    if (!c) c = subject.current = document.createElement('canvas');
    if (c.width !== w.width || c.height !== w.height) {
      c.width = w.width;
      c.height = w.height;
      rect = undefined;
    }
    const x0 = rect ? Math.max(0, Math.floor(rect.x)) : 0;
    const y0 = rect ? Math.max(0, Math.floor(rect.y)) : 0;
    const x1 = rect ? Math.min(w.width, Math.ceil(rect.x + rect.w)) : w.width;
    const y1 = rect ? Math.min(w.height, Math.ceil(rect.y + rect.h)) : w.height;
    if (x1 <= x0 || y1 <= y0) return;
    const rw = x1 - x0;
    const img = new ImageData(rw, y1 - y0);
    const d = img.data;
    const a = maskOn.current && cut.current ? cut.current.alpha : null;
    const under = a ? line.current : null;
    const f = feather.current;
    for (let y = y0; y < y1; y++) {
      const plain = !under || y < under.lo - f;
      for (let x = x0; x < x1; x++) {
        const i = y * w.width + x;
        const o = ((y - y0) * rw + (x - x0)) * 4;
        d[o] = t[i * 4]!;
        d[o + 1] = t[i * 4 + 1]!;
        d[o + 2] = t[i * 4 + 2]!;
        d[o + 3] = a ? (plain ? a[i]! : a[i]! * keepAbove(under!.line, x, y, f)) : 255;
      }
    }
    c.getContext('2d')!.putImageData(img, x0, y0);
  }, []);

  const sceneRef = useRef<Omit<Scene, 'subject'> | null>(null);
  sceneRef.current = natural ? { natural, crop, background: bgColor, suit: worn && { suit: worn.suit, at: worn.at } } : null;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const draw = useCallback(() => {
    const c = view.current;
    const s = sceneRef.current;
    const sub = subject.current;
    if (!c || !s || !sub) return;
    const f = frameRef.current;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(f.w * dpr);
    const bh = Math.round(f.h * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, f, { ...s, subject: sub });
  }, []);

  useEffect(draw, [draw, natural, crop, bgColor, worn, frame.w, frame.h]);

  // التحسين يُعاد من الأصل كلّما تغيّر (بعد توقّف المنزلق قليلًا) — والأصل لا يُمسّ.
  useEffect(() => {
    const w = work.current;
    if (!w) return;
    const t = window.setTimeout(() => {
      toned.current = applyEnhance(cut.current?.pixels ?? w.pixels, w.width, w.height, enhance);
      rebuildSubject();
      draw();
    }, 80);
    return () => window.clearTimeout(t);
  }, [enhance, cutVersion, rebuildSubject, draw]);

  // الشفافية: القناع إن أُزيلت الخلفية، وقصٌّ على حدّ القاط إن لُبس — وما تغيّر من الصفوف وحده يُعاد.
  useEffect(() => {
    const w = work.current;
    if (!w) return;
    const before = line.current;
    const whole = maskOn.current !== useMask || !before || !worn;
    maskOn.current = useMask;
    feather.current = Math.max(3, Math.round(w.height / 500));
    if (useMask && worn) {
      // الرقبة بعرضها المقيس (أضيقها) — وما جاوزها ولو قليلًا ياقة الزبون ولباسه.
      const neck = lm ? { x: lm.neckCenterX, half: lm.neckWidth * 0.5 + 1, from: lm.chin } : undefined;
      const l = neckLine(worn.suit.tops, worn.suit.anchor, worn.at, w.width, feather.current + 1, neck);
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of l) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      line.current = { line: l, lo, hi };
    } else line.current = null;
    const now = line.current;
    if (whole || !now) rebuildSubject();
    else {
      const top = Math.floor(Math.min(before.lo, now.lo)) - feather.current - 2;
      const bottom = Math.ceil(Math.max(before.hi, now.hi)) + 2;
      rebuildSubject({ x: 0, y: top, w: w.width, h: bottom - top });
    }
    draw();
  }, [useMask, worn, lm, cutVersion, rebuildSubject, draw]);

  // حصر المركز يثبت في الحالة لا في الرسم وحده — وإلا بقي السحب «يدفع» حافّةً لا تتحرّك.
  useEffect(() => {
    if (box && (Math.abs(box.x - crop.x) > 1e-6 || Math.abs(box.y - crop.y) > 1e-6)) setCrop((c) => ({ ...c, x: box.x, y: box.y }));
  }, [box, crop.x, crop.y]);

  // ── الخطوات ───────────────────────────────────────────────────────────

  const presetRef = useRef(preset);
  presetRef.current = preset;

  async function removeBackground(): Promise<Landmarks | null> {
    const w = work.current;
    if (!w) return null;
    setCutState('running');
    try {
      const res = await window.diwan.photos.cutout({ pixels: new Uint8Array(w.pixels.buffer, w.pixels.byteOffset, w.pixels.byteLength), width: w.width, height: w.height });
      if (work.current !== w) return null; // فُتحت صورةٌ أخرى في أثنائه
      const alpha = Uint8Array.from(res.alpha);
      cut.current = { alpha, model: Uint8Array.from(res.alpha), pixels: new Uint8ClampedArray(res.pixels.buffer, res.pixels.byteOffset, res.pixels.byteLength) };
      const l = landmarks(alpha, w.width, w.height);
      const p = presetRef.current;
      setLm(l);
      setCutState('done');
      if (autoLight) setEnhance(autoEnhance(cut.current.pixels, alpha, w.width, w.height));
      if (l && l.shoulderY !== null && p.head) setCrop(autoCrop(l, { w: w.width, h: w.height }, { w: p.widthMm, h: p.heightMm }, p.head));
      setCutVersion((v) => v + 1);
      if (!l) say('أُزيلت الخلفية — ولم يُعرف الرأس من الكتفين: قُصّ باليد', true);
      return l;
    } catch (e) {
      if (work.current === w) setCutState('none');
      say(errorText(e, 'تعذّرت إزالة الخلفية'), true);
      return null;
    }
  }

  async function load(path: string) {
    setBusy('تُفتح الصورة…');
    try {
      const w = workPixels(await loadImage(`diwan://store/${path}`));
      work.current = w;
      cut.current = null;
      toned.current = w.pixels;
      maskOn.current = false;
      line.current = null;
      setSrc(path);
      setNatural({ w: w.width, h: w.height });
      setCrop(CENTER);
      setLm(null);
      setCutState('none');
      setWorn(null);
      setTool('move');
      setReview(null);
      setEnhance(autoLight ? autoEnhance(w.pixels, null, w.width, w.height) : NEUTRAL);
      rebuildSubject();
      setCutVersion((v) => v + 1);
      if (modelReady) void removeBackground();
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الصورة'), true);
    } finally {
      setBusy(null);
    }
  }
  const loadRef = useRef(load);
  loadRef.current = load;

  async function open() {
    const path = await window.diwan.files.pickImage('photos');
    if (path) await load(path);
  }

  async function pasteButton() {
    try {
      const path = await window.diwan.photos.clipboardImage();
      if (path) await load(path);
      else say('لا صورة في الحافظة — انسخ الصورة أوّلًا (من واتساب أو المتصفّح)', true);
    } catch (e) {
      say(errorText(e, 'تعذّر لصق الصورة'), true);
    }
  }

  // Ctrl+V في الشاشة: صورة الحافظة تُحفظ في المخزن كأيّ صورةٍ تُفتح — إلا في خانة كتابة.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void (async () => {
        let dataUrl: string;
        if (file.type === 'image/png' || file.type === 'image/jpeg') dataUrl = await dataUrlOf(file);
        else {
          const bmp = await createImageBitmap(file);
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext('2d')!.drawImage(bmp, 0, 0);
          bmp.close();
          dataUrl = c.toDataURL('image/png');
        }
        await loadRef.current(await window.diwan.camera.store(dataUrl));
      })().catch((err) => say(errorText(err, 'تعذّر لصق الصورة'), true));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function choosePreset(id: string) {
    setPresetId(id);
    setCount(null);
    setReview(null);
    const p = id === CUSTOM_ID ? null : presets.find((x) => x.id === id);
    if (p) setBg((b) => (b.kind === 'original' ? b : p.background));
    if (p?.head && lm && natural) setCrop(autoCrop(lm, natural, { w: p.widthMm, h: p.heightMm }, p.head));
  }

  async function chooseSuit(key: string | null, url?: string) {
    if (!key || !url) {
      setWorn(null);
      if (tool === 'suit') setTool('move');
      return;
    }
    const w = work.current;
    if (!w) return;
    setBusy('يُلبَس القاط…');
    try {
      let l = lm;
      if (cutState === 'none' && modelReady) l = await removeBackground();
      let s = suitCache.current.get(key);
      if (!s) {
        s = await loadSuit(key, url);
        suitCache.current.set(key, s);
      }
      const alpha = cut.current?.alpha;
      const base = l && alpha ? fitSuit(s.anchor, s.rows, rowWidths(alpha, w.width, w.height), l, s.tops) : fallbackPlace(s, { w: w.width, h: w.height });
      setWorn({ suit: s, at: base, base });
      setTool('suit');
      if (bg.kind === 'original') setBg({ kind: 'white' });
    } catch (e) {
      say(errorText(e, 'تعذّر تحميل القاط'), true);
    } finally {
      setBusy(null);
    }
  }

  async function importSuit() {
    try {
      const s = await window.diwan.photos.importSuit();
      if (!s) return;
      setCustomSuits((list) => [...list, s]);
      setSuitTab('custom');
      say(`أُضيف «${s.name}» إلى القاط`);
      await chooseSuit(s.id, `diwan://store/${s.path}`);
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد القاط'), true);
    }
  }

  async function deleteSuit(id: string) {
    setCustomSuits(await window.diwan.photos.deleteSuit(id));
    suitCache.current.delete(id);
    if (worn?.suit.key === id) setWorn(null);
  }

  // ── السحب والفرشاة ─────────────────────────────────────────────────────

  const at = (e: React.MouseEvent) => {
    const r = frameEl.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toImage = (p: { x: number; y: number }) => {
    const b = cropBox(frame, natural!, crop);
    const k = b.width / natural!.w;
    return { x: (p.x - b.left) / k, y: (p.y - b.top) / k, k };
  };

  function paint(from: { x: number; y: number }, to: { x: number; y: number }, k: number, mode: BrushMode) {
    const w = work.current;
    const c = cut.current;
    if (!w || !c) return;
    const rect = strokeAlpha(c.alpha, w.width, w.height, from, to, brush / k, mode);
    rebuildSubject(rect);
    draw();
  }

  function onDown(e: React.MouseEvent) {
    if (!natural) return;
    e.preventDefault();
    const p = at(e);
    const img = toImage(p);
    drag.current = { tool, x: e.clientX, y: e.clientY, crop, at: worn?.at ?? null, last: img };
    if ((tool === 'keep' || tool === 'remove') && cut.current) paint(img, img, img.k, tool);
  }

  function onMove(e: React.MouseEvent) {
    if (tool === 'keep' || tool === 'remove') setCursor(frameEl.current ? at(e) : null);
    const d = drag.current;
    if (!d || !box || !natural) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.tool === 'move') {
      // سحب الصورة يمينًا يعني أن الإطار يرى ما على يسارها: المركز ينقص.
      setCrop({ ...d.crop, x: d.crop.x - dx / box.width, y: d.crop.y - dy / box.height });
    } else if (d.tool === 'suit' && d.at) {
      const k = box.width / natural.w;
      const from = d.at;
      setWorn((s) => s && { ...s, at: { ...from, x: from.x + dx / k, y: from.y + dy / k } });
    } else if ((d.tool === 'keep' || d.tool === 'remove') && d.last) {
      const img = toImage(at(e));
      paint(d.last, img, img.k, d.tool);
      d.last = img;
    }
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    // بعد الفرشاة تُعاد المعالم: شعرةٌ أُبقيت أو ظلٌّ مُسح يغيّر قمّة الرأس أو الرقبة.
    if (d && (d.tool === 'keep' || d.tool === 'remove') && work.current && cut.current)
      setLm(landmarks(cut.current.alpha, work.current.width, work.current.height));
  }

  function onWheel(e: React.WheelEvent) {
    if (tool === 'move') setCrop((c) => ({ ...c, zoom: Math.max(1, Math.min(6, c.zoom - e.deltaY * 0.0015)) }));
    else if (tool === 'suit') setWorn((s) => s && { ...s, at: { ...s.at, scale: Math.max(s.base.scale * 0.4, Math.min(s.base.scale * 2.5, s.at.scale * (1 - e.deltaY * 0.001))) } });
    else setBrush((b) => Math.max(3, Math.min(80, b - e.deltaY * 0.03)));
  }

  function resetMask() {
    const w = work.current;
    const c = cut.current;
    if (!w || !c) return;
    c.alpha.set(c.model);
    setLm(landmarks(c.alpha, w.width, w.height));
    rebuildSubject();
    draw();
  }

  // ── الإخراج ───────────────────────────────────────────────────────────

  const scene = (): Scene => {
    if (!natural || !subject.current) throw new Error('افتح صورة الزبون أوّلًا');
    return { subject: subject.current, natural, crop, background: bgColor, suit: worn && { suit: worn.suit, at: worn.at } };
  };
  const finalJpeg = () => renderJpeg(scene(), px, preset.dpi);
  const fileBase = `صورة ${preset.widthMm}×${preset.heightMm}`.replace(/[\\/:*?"<>|]/g, '-');

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    try {
      await job();
    } catch (e) {
      say(errorText(e, 'تعذّر الحفظ'), true);
    } finally {
      setBusy(null);
    }
  }

  const openReview = () =>
    run('تُجهَّز الورقة…', async () => {
      const path = await window.diwan.camera.store(await dataUrlOf(await finalJpeg()));
      setReview({ path, px });
    });

  const saveImage = () =>
    run('تُحفظ الصورة…', async () => {
      const blob = await finalJpeg();
      const path = await window.diwan.files.saveAs({ data: new Uint8Array(await blob.arrayBuffer()), suggestedName: `${fileBase}.jpg`, filterName: 'صورة JPEG', ext: 'jpg' });
      if (path) say(`حُفظت: ${toIndic(px.w)}×${toIndic(px.h)} بكسل بدقّة ${toIndic(preset.dpi)} — ${sizeText(blob.size)}`);
    });

  const saveUpload = () =>
    run('تُصغَّر للرفع…', async () => {
      const blob = await finalJpeg();
      const fit = await fitJpeg(blob, limit, false);
      if ('smallest' in fit) {
        say(`أصغر ما بلغته ${sizeText(fit.smallest)} — أكبر من الحدّ`, true);
        return;
      }
      // التصغير يرسم من جديد فتضيع الدقّة المكتوبة: تُكتب بما صارت إليه، والمقاس بالملّم كما هو.
      const bmp = await createImageBitmap(fit.blob);
      const dpi = (preset.dpi * bmp.width) / px.w;
      bmp.close();
      const bytes = setJpegDpi(new Uint8Array(await fit.blob.arrayBuffer()), dpi);
      rememberLimit(limit);
      const path = await window.diwan.files.saveAs({ data: bytes, suggestedName: `${fileBase} للرفع.jpg`, filterName: 'صورة JPEG', ext: 'jpg' });
      if (path) say(`حُفظت للرفع: ${sizeText(bytes.length)}`);
    });

  const linkCitizen = (id: number) =>
    run('تُحفظ في ملف المواطن…', async () => {
      setPicking(false);
      const detail = await window.diwan.citizens.get(id);
      if (!detail) throw new Error('المواطن غير موجود في السجل');
      const dataUrl = await dataUrlOf(await finalJpeg());
      const path = await window.diwan.camera.store(dataUrl);
      const { attachments: _attachments, documents: _documents, ...input } = detail;
      await window.diwan.citizens.save({ ...input, photoPath: path });
      await window.diwan.attachments.addFromDataUrl(id, `صورة شخصية ${preset.name}`, dataUrl);
      say(`صارت صورة ${detail.fullName} في ملفّه`);
    });

  const pages = review
    ? photoSheetsHtml({ src: review.path, natural: review.px, crop: CENTER, photo, paper, count: copies }, (s) => `diwan://store/${s}`)
    : [];

  async function print() {
    setPrinting(true);
    try {
      const out = await window.diwan.output.print({ sheetHtml: pages.join(''), printer: printer?.name ?? null, copies: 1, silent: false, page: paper });
      say(out.ok ? `أُرسلت ${toIndic(pages.length)} ورقة` : out.reason || 'لم تتم الطباعة', !out.ok);
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), true);
    } finally {
      setPrinting(false);
    }
  }

  async function pdf() {
    setPrinting(true);
    try {
      const path = await window.diwan.output.savePdf({ sheetHtml: pages.join(''), suggestedName: 'صور شخصية', page: paper });
      if (path) say('حُفظ PDF بمقاس الورق');
    } finally {
      setPrinting(false);
    }
  }

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
  const step = (n: number, title: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between">
      <span className="font-label-md text-label-md text-on-surface font-semibold">
        <span className="inline-flex w-5 h-5 me-1 rounded-full bg-secondary-container text-on-secondary-container items-center justify-center text-[11px]">{toIndic(n)}</span>
        {title}
      </span>
      {extra}
    </div>
  );
  const tools: { key: Tool; label: string; icon: string; on: boolean }[] = [
    { key: 'move', label: 'الصورة', icon: 'open_with', on: true },
    { key: 'suit', label: 'القاط', icon: 'checkroom', on: Boolean(worn) },
    { key: 'keep', label: 'أبقِ', icon: 'brush', on: cutState === 'done' },
    { key: 'remove', label: 'امسح', icon: 'ink_eraser', on: cutState === 'done' }
  ];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        <section className="w-[400px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md">
          <header>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">الصور الشخصية</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">تُقصّ على الوجه بمقاسها وتُطبع نسخًا — وخلفيّتها وقاطها على الجهاز</p>
          </header>

          {step(1, 'الصورة')}
          <div className="flex gap-space-xs">
            <button
              className="flex-1 h-11 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5"
              data-act="open-photo"
              type="button"
              onClick={() => void open()}
            >
              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
              {src ? 'صورةٌ أخرى' : 'افتح الصورة'}
            </button>
            <button
              className="h-11 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md flex items-center gap-1.5 hover:bg-surface-container-high"
              data-act="paste-photo"
              title="أو Ctrl+V في الشاشة"
              type="button"
              onClick={() => void pasteButton()}
            >
              <span className="material-symbols-outlined text-[18px]">content_paste</span>
              الصق
            </button>
          </div>

          {src && (
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
                  الشعر أو الكتف ناقص؟ «أبقِ» وامسح عليه؛ وبقايا خلفية؟ «امسح» —{' '}
                  <button className="underline" data-act="reset-mask" type="button" onClick={resetMask}>
                    أعِد القناع
                  </button>
                </p>
              )}

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
          )}

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
          {presetId === CUSTOM_ID ? (
            <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
              عرض
              <input className={numInput} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Math.max(10, Number(e.target.value) || 10) })} />
              ارتفاع
              <input className={numInput} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Math.max(10, Number(e.target.value) || 10) })} />
              ملم
            </div>
          ) : (
            <p className="font-label-sm text-label-sm text-on-surface-variant" data-preset-source="">
              {preset.source ? `المصدر: ${preset.source}` : 'مقاسٌ شائع لا معيار منشورًا له — تُسأل الجهة عن اشتراطها'}
              {preset.notes && preset.notes !== 'مقاسٌ شائع — تُسأل الجهة عن اشتراطها' ? ` · ${preset.notes}` : ''}
            </p>
          )}
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
              className="w-20 h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-center tabular"
              data-photo-count=""
              inputMode="numeric"
              value={copies}
              onChange={(e) => setCount(Number(e.target.value.replace(/[^\d]/g, '')) || null)}
            />
            <span data-photo-layout="">
              {layout.per ? `${toIndic(layout.per)} في الورقة — ${toIndic(Math.ceil(copies / layout.per))} ورقة` : 'المقاس أكبر من الورقة'}
            </span>
          </label>
          <button
            className="w-full h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            data-act="review-photos"
            disabled={!src || !layout.per || Boolean(busy) || cutState === 'running'}
            type="button"
            onClick={() => void openReview()}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            راجع الورقة واطبع
          </button>
          <div className="grid grid-cols-2 gap-space-xs">
            <button className={`${small} bg-surface-container-lowest h-10`} data-act="save-photo" disabled={!src || Boolean(busy)} type="button" onClick={() => void saveImage()}>
              احفظ الصورة ({toIndic(preset.dpi)} نقطة)
            </button>
            <button className={`${small} bg-surface-container-lowest h-10`} data-act="link-citizen" disabled={!src || Boolean(busy)} type="button" onClick={() => setPicking(true)}>
              في ملف مواطن
            </button>
          </div>
          <div className="flex items-center gap-space-xs">
            <select
              className="h-10 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm"
              data-upload-limit=""
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {SIZE_LIMITS.map((l) => (
                <option key={l.bytes} value={l.bytes}>
                  {l.label}
                </option>
              ))}
            </select>
            <button className={`${small} flex-1 bg-surface-container-lowest h-10`} data-act="save-upload" disabled={!src || Boolean(busy)} type="button" onClick={() => void saveUpload()}>
              احفظها للرفع بهذا الحدّ
            </button>
          </div>
        </section>

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
      </div>

      {review && (
        <SheetsPreview
          busy={printing}
          cards={copies}
          pages={pages}
          unit="صورة"
          sheet={paper}
          onClose={() => setReview(null)}
          onPdf={() => void pdf()}
          onPrint={() => void print()}
        />
      )}

      {picking && <CitizenMultiPicker single confirmLabel="احفظها صورته" title="في ملفّ من تُحفظ الصورة؟" onClose={() => setPicking(false)} onPick={(ids) => void linkCitizen(ids[0]!)} />}

      {presetsOpen && (
        <PresetsDialog
          presets={customPresets}
          onClose={() => setPresetsOpen(false)}
          onDelete={async (id) => {
            setCustomPresets(await window.diwan.photos.deletePreset(id));
            if (presetId === id) choosePreset('35x45');
          }}
          onSave={async (p) => {
            setCustomPresets(await window.diwan.photos.savePreset(p));
            setPresetsOpen(false);
            setPresetId(p.id);
            setCount(null);
            setBg((b) => (b.kind === 'original' ? b : p.background));
          }}
        />
      )}

      {busy && <div className="fixed bottom-6 right-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg bg-surface-container-highest text-on-surface font-label-md text-label-md">{busy}</div>}
      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${toast.warn ? 'bg-error text-on-error' : 'bg-secondary text-on-primary'}`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}

/** قوالب المكتب: ما تطلبه جهاته من مقاسٍ ودقّةٍ وخلفيةٍ ودليل رأس — تُحفظ وتُحذف. */
function PresetsDialog({
  presets,
  onSave,
  onDelete,
  onClose
}: {
  presets: PhotoPreset[];
  onSave: (p: PhotoPreset) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PhotoPreset>({
    id: '',
    name: '',
    widthMm: 35,
    heightMm: 45,
    dpi: 600,
    background: { kind: 'white' },
    head: { min: 0.6, max: 0.75, top: 0.1 },
    copies: 6,
    notes: '',
    source: null,
    builtin: false
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PhotoPreset>) => setDraft((d) => ({ ...d, ...patch }));
  const num = (v: string) => Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) || 0;
  const field = 'h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md';

  async function save() {
    const p = { ...draft, id: draft.id || `preset-${Date.now().toString(36)}`, name: draft.name.trim(), source: draft.source?.trim() || null };
    const why = validatePreset(p);
    if (why) return setError(why);
    try {
      await onSave(p);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ القالب'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-presets-dialog="">
      <div className="w-full max-w-xl max-h-[85vh] overflow-auto rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg space-y-space-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">قوالب المكتب</h2>
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" type="button" onClick={onClose}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {presets.length > 0 && (
          <div className="divide-y divide-outline-variant">
            {presets.map((p) => (
              <div key={p.id} className="py-space-xs flex items-center justify-between font-label-md text-label-md">
                <span>
                  {p.name} — {toIndic(p.widthMm)}×{toIndic(p.heightMm)} ملم، {toIndic(p.dpi)} نقطة
                </span>
                <button className="h-8 px-2 rounded-lg text-error hover:bg-error-container" type="button" onClick={() => void onDelete(p.id)}>
                  احذف
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
          <label className="col-span-2 flex flex-col gap-1">
            الاسم (ما تطلبه الجهة)
            <input autoFocus className={field} data-preset-name="" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            العرض (ملم)
            <input className={field} data-preset-w="" value={draft.widthMm} onChange={(e) => set({ widthMm: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1">
            الارتفاع (ملم)
            <input className={field} data-preset-h="" value={draft.heightMm} onChange={(e) => set({ heightMm: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1">
            الدقّة (نقطة في الإنش)
            <select className={field} value={draft.dpi} onChange={(e) => set({ dpi: Number(e.target.value) })}>
              {[300, 400, 600].map((d) => (
                <option key={d} value={d}>
                  {toIndic(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            النسخ في الطلب
            <input className={field} value={draft.copies} onChange={(e) => set({ copies: num(e.target.value) })} />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            الخلفية
            <span className="flex items-center gap-space-xs">
              <select
                className={`${field} flex-1`}
                value={draft.background.kind}
                onChange={(e) =>
                  set({ background: e.target.value === 'custom' ? { kind: 'custom', color: '#e6e6e6' } : { kind: e.target.value as 'white' | 'lightBlue' } })
                }
              >
                <option value="white">أبيض</option>
                <option value="lightBlue">أزرق فاتح</option>
                <option value="custom">لونٌ آخر</option>
              </select>
              {draft.background.kind === 'custom' && (
                <input className="w-10 h-9" type="color" value={draft.background.color} onChange={(e) => set({ background: { kind: 'custom', color: e.target.value } })} />
              )}
            </span>
          </label>
          <label className="col-span-2 flex items-center gap-space-xs">
            <input checked={Boolean(draft.head)} type="checkbox" onChange={(e) => set({ head: e.target.checked ? { min: 0.6, max: 0.75, top: 0.1 } : null })} />
            دليل الرأس (من الذقن إلى قمّة الرأس، نسبةً من ارتفاع الصورة)
          </label>
          {draft.head && (
            <div className="col-span-2 flex items-center gap-space-xs">
              من
              <input className={`${field} w-16`} value={Math.round(draft.head.min * 100)} onChange={(e) => set({ head: { ...draft.head!, min: num(e.target.value) / 100 } })} />
              إلى
              <input className={`${field} w-16`} value={Math.round(draft.head.max * 100)} onChange={(e) => set({ head: { ...draft.head!, max: num(e.target.value) / 100 } })} />
              ٪، وقمّة الرأس على
              <input className={`${field} w-16`} value={Math.round(draft.head.top * 100)} onChange={(e) => set({ head: { ...draft.head!, top: num(e.target.value) / 100 } })} />
              ٪ من الأعلى
            </div>
          )}
          <label className="col-span-2 flex flex-col gap-1">
            ملاحظات
            <input className={field} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            المصدر المنشور (إن وُجد — بدونه لا يُسمّى القالب رسميًّا)
            <input className={field} value={draft.source ?? ''} onChange={(e) => set({ source: e.target.value })} />
          </label>
        </div>
        {error && <p className="font-label-md text-label-md text-error">{error}</p>}
        <div className="flex justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold" data-act="save-preset" type="button" onClick={() => void save()}>
            احفظ القالب
          </button>
        </div>
      </div>
    </div>
  );
}
