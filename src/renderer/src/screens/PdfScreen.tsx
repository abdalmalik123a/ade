/**
 * «ملفات PDF» — محرّر PDF للتقديم الإلكتروني.
 *
 * ما يفعله المكتب يوميًّا بملفّات المنصّات (أور، مظلتي، الجامعات): يضيف نصًّا أو شعارًا أو
 * علامةً مائية أو رقم الصفحة، ويقصّ ويجزّئ ويدمج ويرتّب، ويمسح من الماسح — بلا إنترنت، فلا
 * تُرفع مستمسكات الناس إلى مواقع مجهولة. والصفحات تُرسم هنا (pdf.js)، والملف يُبنى في
 * العملية الرئيسة من الخطّة (`@shared/pdfEdit`)، والنصّ العربي يرسمه محرّك الطباعة موصولًا
 * ويبقى نصًّا.
 *
 * و«حدّ الحجم» لخانة الرفع: ما تجاوزه تصير صفحاته صورًا بأجود درجةٍ تبلغه — الملف والصور.
 * والحفظ ملفٌّ جديد دائمًا: الأصل يبقى كما وصل (قرار المالك).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfOpened } from '@shared/api';
import {
  fitSearch,
  imagePage,
  numberingText,
  overlaysFor,
  pageTokens,
  parseRanges,
  pdfOverhead,
  PDF_FONTS,
  RASTER_STEPS,
  shownSize,
  SIZE_LIMITS,
  sizeText,
  totalRotation,
  watermarkText,
  type FracBox,
  type ImageOverlay,
  type Overlay,
  type PageRef,
  type PdfPlan,
  type Rotation,
  type TextOverlay
} from '@shared/pdfEdit';
import { errorText } from '../lib/errors';
import { fitJpeg, reencode, rememberLimit, savedLimit, toJpeg, TOP_DPI } from '../lib/fitImage';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type Src = PdfOpened & { doc?: PDFDocumentProxy; img?: HTMLImageElement };

const toIndic = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
/** «صفحةٌ واحدة، صفحتان، ٣ صفحات، ١١ صفحة» — العدد ومعدوده كما يُقرأ. */
function pagesWord(n: number): string {
  if (n === 1) return 'صفحةٌ واحدة';
  if (n === 2) return 'صفحتان';
  return `${toIndic(n)} ${n % 100 >= 3 && n % 100 <= 10 ? 'صفحات' : 'صفحة'}`;
}
let uid = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(++uid).toString(36)}`;

async function loadSource(o: PdfOpened): Promise<Src> {
  if (o.kind === 'pdf') {
    const doc = await pdfjs.getDocument({ data: o.bytes.slice(), useSystemFonts: true }).promise;
    return { ...o, doc };
  }
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([o.bytes as BlobPart]));
  await img.decode();
  return { ...o, img };
}

function rotateCanvas(c: HTMLCanvasElement, r: number): HTMLCanvasElement {
  if (!r) return c;
  const out = document.createElement('canvas');
  const odd = r % 180 !== 0;
  out.width = odd ? c.height : c.width;
  out.height = odd ? c.width : c.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}

/** الصفحة كما تُرى — بدورانها وبلا قصّ — على لوحٍ بعرضٍ معلوم. */
async function drawShown(src: Src, index: number, rotate: Rotation, width: number): Promise<HTMLCanvasElement> {
  if (src.doc) {
    const page = await src.doc.getPage(index + 1);
    const rotation = (page.rotate + rotate) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const viewport = page.getViewport({ scale: width / base.width, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    await page.render({ canvas, viewport }).promise;
    return canvas;
  }
  // الصورة صفحةٌ A4 بيضاء والصورة في موضعها — كما تُبنى (`imagePage`).
  const { page, draw } = imagePage(src.image!);
  const k = width / (rotate % 180 ? page.height : page.width);
  const flat = document.createElement('canvas');
  flat.width = Math.round(page.width * k);
  flat.height = Math.round(page.height * k);
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(src.img!, draw.x * k, (page.height - draw.y - draw.height) * k, draw.width * k, draw.height * k);
  return rotateCanvas(flat, rotate);
}

function cropCanvas(c: HTMLCanvasElement, crop?: FracBox): HTMLCanvasElement {
  if (!crop) return c;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(c.width * crop.w));
  out.height = Math.max(1, Math.round(c.height * crop.h));
  out.getContext('2d')!.drawImage(c, c.width * crop.x, c.height * crop.y, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** مقاس الصفحة كما تُرى بالنقاط — بعد دورانها وقصّها — لتُقاس به الخطوط في المعاينة. */
function shownPt(src: Src, ref: PageRef): { w: number; h: number } {
  const info = src.pages[ref.index]!;
  const s = shownSize(info, totalRotation(info.rotation, ref.rotate));
  return ref.crop ? { w: s.w * ref.crop.w, h: s.h * ref.crop.h } : s;
}

type Drag = { id: string; mode: 'move' | 'resize'; x: number; y: number; box: FracBox; target: 'overlay' | 'crop' };

/** صفحات الملف المبني صورًا بأجود درجة — ومنها تُصغَّر الدرجات الأدنى بلا رسمٍ جديد. ومقاس كلٍّ كما تُرى بالنقاط. */
async function shootPages(bytes: Uint8Array): Promise<{ shot: Blob; w: number; h: number }[]> {
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await task.promise;
  const out: { shot: Blob; w: number; h: number }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const pt = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TOP_DPI / 72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
      out.push({ shot: await toJpeg(canvas, 0.92), w: pt.width, h: pt.height });
    }
  } finally {
    void task.destroy();
  }
  return out;
}

type Snap = { pages: PageRef[]; overlays: Overlay[] };

export default function PdfScreen() {
  const [sources, setSources] = useState<Record<string, Src>>({});
  const [pages, setPages] = useState<PageRef[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [crop, setCrop] = useState<FracBox | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [view, setView] = useState<{ url: string; w: number; h: number } | null>(null);
  const [logoPicker, setLogoPicker] = useState<string[] | null>(null);
  const [splitText, setSplitText] = useState<string | null>(null);
  const [limit, setLimitState] = useState(() => savedLimit());
  const [gray, setGray] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  function setLimit(bytes: number) {
    setLimitState(bytes);
    rememberLimit(bytes);
  }

  const plan = useMemo<PdfPlan>(() => ({ pages, overlays }), [pages, overlays]);
  const currentRef = pages.find((p) => p.id === current) ?? null;
  const currentIndex = pages.findIndex((p) => p.id === current);
  const targets = selected.length ? selected : current ? [current] : [];

  // ── التراجع والإعادة ────────────────────────────────────────────────
  // لقطةٌ للصفحات والطبقات حين يهدأ التعديل: فالسحب كلّه خطوةٌ واحدة، والكتابة كلُّ وقفةٍ خطوة.
  const latest = useRef<Snap>({ pages, overlays });
  latest.current = { pages, overlays };
  const committed = useRef<Snap>(latest.current);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const restoring = useRef(false);
  const settle = useRef<number | undefined>(undefined);
  const [, bumpHistory] = useState(0);

  function flush() {
    window.clearTimeout(settle.current);
    const now = latest.current;
    if (now.pages === committed.current.pages && now.overlays === committed.current.overlays) return;
    past.current.push(committed.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    committed.current = now;
    bumpHistory((n) => n + 1);
  }

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      committed.current = latest.current;
      return;
    }
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(flush, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, overlays]);

  function restore(s: Snap) {
    restoring.current = true;
    committed.current = s;
    setPages(s.pages);
    setOverlays(s.overlays);
    setSelected((sel) => sel.filter((id) => s.pages.some((p) => p.id === id)));
    setCurrent((c) => (s.pages.some((p) => p.id === c) ? c : s.pages[0]?.id ?? null));
    setActive((a) => (s.overlays.some((o) => o.id === a) ? a : null));
    setCrop(null);
    bumpHistory((n) => n + 1);
  }

  function undo() {
    flush();
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(committed.current);
    restore(prev);
  }

  function redo() {
    flush();
    const next = future.current.pop();
    if (!next) return;
    past.current.push(committed.current);
    restore(next);
  }

  const dirty = pages !== committed.current.pages || overlays !== committed.current.overlays;
  const canUndo = past.current.length > 0 || dirty;
  const canRedo = future.current.length > 0 && !dirty;

  // ── الفتح والدمج والمسح ─────────────────────────────────────────────
  async function add(opened: PdfOpened[]): Promise<PageRef[]> {
    const loaded = await Promise.all(opened.map(loadSource));
    setSources((s) => ({ ...s, ...Object.fromEntries(loaded.map((l) => [l.id, l])) }));
    const added: PageRef[] = loaded.flatMap((src) => src.pages.map((_, index) => ({ id: newId('p'), source: src.id, index, rotate: 0 as Rotation })));
    setPages((p) => [...p, ...added]);
    setCurrent((c) => c ?? added[0]?.id ?? null);
    if (!name && loaded[0]) setName(loaded[0].image?.dpi ? 'ملف ممسوح' : `${loaded[0].name.replace(/\.[^.]+$/, '')} — معدّل`);
    return added;
  }

  async function open() {
    setBusy('يُفتح…');
    try {
      const out = await window.diwan.pdf.open();
      if (!out) return;
      const n = (await add(out.opened)).length;
      if (out.failed.length) say(out.failed.map((f) => `«${f.name}»: ${f.error}`).join(' · '), 'warn');
      else if (n) say(`أُضيفت ${pagesWord(n)}`);
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الملف'), 'warn');
    } finally {
      setBusy(null);
    }
  }

  /** صفحةٌ من الماسح تُضاف في آخر الملف وتُعرض — والتالية بضغطةٍ أخرى. */
  async function scan() {
    setBusy('يُمسح… ضع الورقة في الماسح');
    try {
      const [page] = await add([await window.diwan.pdf.scan()]);
      if (page) setCurrent(page.id);
      say('أُضيفت الصفحة الممسوحة — ضع التالية واضغط «امسح» مرّةً أخرى');
    } catch (e) {
      say(errorText(e, 'تعذّر المسح'), 'warn');
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    void window.diwan.pdf.close(Object.keys(sources));
    const empty: Snap = { pages: [], overlays: [] };
    past.current = [];
    future.current = [];
    restoring.current = true;
    committed.current = empty;
    setSources({});
    setPages(empty.pages);
    setOverlays(empty.overlays);
    setCurrent(null);
    setSelected([]);
    setActive(null);
    setCrop(null);
    setThumbs({});
    setView(null);
    setName('');
  }

  // ── الرسم: المصغّرات، والصفحة الحالية ───────────────────────────────
  const thumbKey = (r: PageRef) => `${r.source}:${r.index}:${r.rotate}:${JSON.stringify(r.crop ?? null)}`;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const r of pages) {
        const key = thumbKey(r);
        if (cancelled || thumbs[key] || !sources[r.source]) continue;
        const c = cropCanvas(await drawShown(sources[r.source]!, r.index, r.rotate, r.crop ? 110 / r.crop.w : 110), r.crop);
        if (cancelled) return;
        setThumbs((t) => ({ ...t, [key]: c.toDataURL('image/jpeg', 0.8) }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, sources]);

  useEffect(() => {
    let cancelled = false;
    if (!currentRef || !sources[currentRef.source]) {
      setView(null);
      return;
    }
    void (async () => {
      const src = sources[currentRef.source]!;
      // في القصّ تُرى الصفحة كاملةً وعليها صندوقه؛ وبعده تُرى مقصوصة.
      const shownCrop = crop ? undefined : currentRef.crop;
      const box = stage.current?.getBoundingClientRect();
      const maxW = Math.max(320, (box?.width ?? 640) - 32);
      const maxH = Math.max(320, (box?.height ?? 800) - 32);
      const info = src.pages[currentRef.index]!;
      const s = shownSize(info, totalRotation(info.rotation, currentRef.rotate));
      const aspect = (s.h * (shownCrop?.h ?? 1)) / (s.w * (shownCrop?.w ?? 1));
      const w = Math.min(maxW, maxH / aspect);
      const dpr = window.devicePixelRatio || 1;
      const full = await drawShown(src, currentRef.index, currentRef.rotate, (w * dpr) / (shownCrop?.w ?? 1));
      if (cancelled) return;
      setView({ url: cropCanvas(full, shownCrop).toDataURL('image/png'), w, h: w * aspect });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, currentRef?.rotate, JSON.stringify(currentRef?.crop ?? null), sources, crop === null]);

  // ── عمليات الصفحات ──────────────────────────────────────────────────
  function rotate(by: 90 | 270) {
    setPages((ps) => ps.map((p) => (targets.includes(p.id) ? { ...p, rotate: totalRotation(p.rotate, by) } : p)));
  }

  function remove() {
    if (!targets.length) return;
    const left = pages.filter((p) => !targets.includes(p.id));
    setPages(left);
    setOverlays((os) => os.map((o) => (o.pages === 'all' ? o : { ...o, pages: o.pages.filter((id) => !targets.includes(id)) })).filter((o) => o.pages === 'all' || o.pages.length));
    setSelected([]);
    setCurrent(left[0]?.id ?? null);
    say(`حُذفت ${pagesWord(targets.length)} من الملف الجديد — والأصل كما هو`);
  }

  function move(delta: -1 | 1) {
    if (!targets.length) return;
    const list = [...pages];
    const order = delta < 0 ? list.map((_, i) => i) : list.map((_, i) => list.length - 1 - i);
    for (const i of order) {
      const j = i + delta;
      if (targets.includes(list[i]!.id) && j >= 0 && j < list.length && !targets.includes(list[j]!.id)) {
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
    }
    setPages(list);
  }

  const dragPage = useRef<string | null>(null);
  function dropPage(onto: string) {
    const from = dragPage.current;
    dragPage.current = null;
    if (!from || from === onto) return;
    const list = pages.filter((p) => p.id !== from);
    const at = list.findIndex((p) => p.id === onto);
    list.splice(at, 0, pages.find((p) => p.id === from)!);
    setPages(list);
  }

  /** نسخةٌ من كلّ صفحةٍ محدَّدة بعدها مباشرة — بدورانها وقصّها وما عليها من إضافات. */
  function duplicate() {
    if (!targets.length) return;
    const copies = new Map<string, string>();
    const list: PageRef[] = [];
    for (const p of pages) {
      list.push(p);
      if (targets.includes(p.id)) {
        const id = newId('p');
        copies.set(p.id, id);
        list.push({ ...p, id });
      }
    }
    setPages(list);
    setOverlays((os) => os.map((o) => (o.pages === 'all' ? o : { ...o, pages: o.pages.flatMap((id) => (copies.has(id) ? [id, copies.get(id)!] : [id])) })));
    say(`كُرّرت ${pagesWord(copies.size)}`);
  }

  // ── الإضافة: نصّ، وشعار، وعلامة مائية ──────────────────────────────
  function addText() {
    if (!current) return;
    const o: TextOverlay = {
      id: newId('t'),
      kind: 'text',
      text: 'نصٌّ جديد',
      font: 'Arial',
      size: 16,
      color: '#0b3d91',
      bold: true,
      align: 'right',
      opacity: 1,
      angle: 0,
      // أسفل الصفحة: موضع «تمّ الاستلام» والملاحظات — لا فوق الترويسة.
      box: { x: 0.35, y: 0.86, w: 0.55, h: 0.06 },
      pages: [current]
    };
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function addWatermark() {
    const settings = await window.diwan.settings.get().catch(() => null);
    const o = watermarkText(newId('w'), settings?.officeName?.trim() || 'نسخة');
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  /** رقم الصفحة أسفل كلّ صفحة — ومرّةً واحدة: الموجود يُحدَّد ليُعدَّل. */
  function addNumbers() {
    const existing = overlays.find((o) => o.kind === 'text' && /\{(رقم|n)\}/.test(o.text));
    if (existing) {
      setActive(existing.id);
      return;
    }
    const o = numberingText(newId('n'));
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function openLogos() {
    setLogoPicker(await window.diwan.pdf.logos());
  }

  function placeLogo(src: string) {
    if (!current) return;
    setLogoPicker(null);
    const o: ImageOverlay = { id: newId('i'), kind: 'image', src, opacity: 1, angle: 0, box: { x: 0.05, y: 0.04, w: 0.18, h: 0.1 }, pages: [current] };
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function logoFromDevice() {
    try {
      const src = await window.diwan.pdf.pickLogo();
      if (src) placeLogo(src);
    } catch (e) {
      say(errorText(e, 'تعذّرت إضافة الشعار'), 'warn');
    }
  }

  const activeOverlay = overlays.find((o) => o.id === active) ?? null;
  const patch = (id: string, p: Partial<TextOverlay> | Partial<ImageOverlay>) =>
    setOverlays((os) => os.map((o) => (o.id === id ? ({ ...o, ...p } as Overlay) : o)));

  // ── السحب: نقل العنصر وتكبيره، وصندوق القصّ ────────────────────────
  function startDrag(e: React.PointerEvent, target: Drag['target'], id: string, mode: Drag['mode'], box: FracBox) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id, mode, x: e.clientX, y: e.clientY, box, target };
    if (target === 'overlay') setActive(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !view) return;
    const dx = (e.clientX - d.x) / view.w;
    const dy = (e.clientY - d.y) / view.h;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    let box: FracBox;
    if (d.mode === 'move') {
      box = { ...d.box, x: clamp(d.box.x + dx, -d.box.w + 0.02, 0.98), y: clamp(d.box.y + dy, -d.box.h + 0.02, 0.98) };
    } else {
      box = { ...d.box, w: clamp(d.box.w + dx, 0.03, 1.5), h: clamp(d.box.h + dy, 0.02, 1.5) };
    }
    if (d.target === 'crop') {
      box = { x: clamp(box.x, 0, 0.95), y: clamp(box.y, 0, 0.95), w: clamp(box.w, 0.05, 1 - clamp(box.x, 0, 0.95)), h: clamp(box.h, 0.05, 1 - clamp(box.y, 0, 0.95)) };
      setCrop(box);
    } else patch(d.id, { box });
  }

  // ── القصّ ────────────────────────────────────────────────────────────
  function startCrop() {
    if (!currentRef) return;
    setActive(null);
    setCrop(currentRef.crop ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  }

  function applyCrop(scope: 'page' | 'targets' | 'clear') {
    if (!currentRef) return;
    const value = scope === 'clear' ? undefined : crop ?? undefined;
    const ids = scope === 'targets' ? targets : [currentRef.id];
    setPages((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, crop: value } : p)));
    setCrop(null);
  }

  // ── الحفظ ────────────────────────────────────────────────────────────
  async function run<T>(label: string, work: () => Promise<T>): Promise<T | null> {
    setBusy(label);
    try {
      return await work();
    } catch (e) {
      say(errorText(e, 'تعذّر إتمام العملية'), 'warn');
      return null;
    } finally {
      setBusy(null);
    }
  }

  /**
   * الملف كما يُحفظ: يُبنى، فإن تجاوز الحدّ (أو طُلب «أبيض وأسود») صارت صفحاته صورًا بأجود
   * درجةٍ تبلغه. وما لم تبلغه درجةٌ يُقال بأصغر ما بلغ — ولا يُحفظ ملفٌّ يرفضه الموقع.
   */
  async function produce(sub: PdfPlan): Promise<{ bytes: Uint8Array; raster: boolean }> {
    const bytes = await window.diwan.pdf.build(sub);
    if (!gray && (!limit || bytes.length <= limit)) return { bytes, raster: false };
    setBusy(limit ? `يُصغَّر ليبلغ ${sizeText(limit)}…` : 'يُحوَّل أبيض وأسود…');
    const shots = await shootPages(bytes);
    const fit = await fitSearch(limit, RASTER_STEPS, async (step) => {
      const jpegs: Blob[] = [];
      for (const s of shots) jpegs.push(await reencode(s.shot, step.dpi, step.quality, gray));
      const estimate = jpegs.reduce((n, b) => n + b.size, 0) + pdfOverhead(jpegs.length);
      if (limit && estimate > limit) return { size: estimate, value: null };
      const pages = await Promise.all(jpegs.map(async (b, k) => ({ jpeg: new Uint8Array(await b.arrayBuffer()), width: shots[k]!.w, height: shots[k]!.h })));
      const pdf = await window.diwan.pdf.assemble(pages);
      return { size: pdf.length, value: pdf };
    });
    if ('smallest' in fit) {
      throw new Error(`لم يبلغ الملف ${sizeText(limit)} — أصغر ما بلغه ${sizeText(fit.smallest)}. ${gray ? '' : 'جرّب «أبيض وأسود»، أو '}قسّمه أجزاءً`);
    }
    return { bytes: fit.value, raster: true };
  }

  const madeNote = (m: { bytes: Uint8Array; raster: boolean }) => `${sizeText(m.bytes.length)}${m.raster ? '، صفحاته صورٌ' : ''}`;

  async function saveAs(sub: PdfPlan, fileName: string) {
    return run('يُبنى الملف…', async () => {
      const made = await produce(sub);
      const path = await window.diwan.pdf.save(made.bytes, fileName);
      return path ? { path, made } : null;
    });
  }

  async function save() {
    const out = await saveAs(plan, name || 'ملف معدّل');
    if (out) say(`حُفظ ملفًّا جديدًا (${madeNote(out.made)}): ${out.path} — والأصل كما هو`);
  }

  /** الصفحات المحدَّدة ملفًّا جديدًا وحدها — بطبقاتها. */
  async function extract() {
    const ids = targets;
    if (!ids.length) return;
    const sub: PdfPlan = { pages: pages.filter((p) => ids.includes(p.id)), overlays };
    const out = await saveAs(sub, `${name || 'ملف'} — صفحات`);
    if (out) say(`حُفظت ${pagesWord(ids.length)} ملفًّا جديدًا (${madeNote(out.made)})`);
  }

  /** «1-3، 4-6»: كلُّ مجموعةٍ ملفّ؛ وفارغةً: كلُّ صفحةٍ ملفّ. */
  async function split(text: string) {
    const groups = text.trim()
      ? text.split(/[;؛]|\s+و\s+/).map((g) => parseRanges(g, pages.length)).filter((g) => g.length)
      : pages.map((_, i) => [i]);
    if (!groups.length) {
      say('اكتب المجموعات هكذا: 1-3؛ 4-6 — أو اتركها فارغةً لتصير كلّ صفحةٍ ملفًّا', 'warn');
      return;
    }
    setSplitText(null);
    const out = await run('يُقسَّم…', async () => {
      // كلّ جزءٍ يُبنى ويُصغَّر لحدّه وحده — فالجزء الكبير لا يُسقط الصغير.
      const items: { bytes: Uint8Array; name: string }[] = [];
      for (const [k, g] of groups.entries()) {
        const made = await produce({ pages: g.map((i) => pages[i]!), overlays });
        items.push({ bytes: made.bytes, name: `${name || 'ملف'} — جزء ${k + 1}` });
      }
      return window.diwan.pdf.saveMany(items);
    });
    if (out) say(`حُفظ ${toIndic(out.files.length)} ملفًّا في ${out.folder}`);
  }

  /**
   * الصفحات صورًا JPG — من الملف كما يُبنى، فالصورة بطبقاتها وقصّها كما في PDF. وحدّ الحجم
   * لكلّ صورةٍ وحدها: فخانة «الوجه الأول» صورةٌ بحدّها.
   */
  async function toImages() {
    // المحدَّد وحده إن حُدِّد شيء، وإلا فالملف كلّه — لا الصفحة المعروضة وحدها.
    const ids = selected.length ? selected : pages.map((p) => p.id);
    const sub: PdfPlan = { pages: pages.filter((p) => ids.includes(p.id)), overlays };
    const out = await run('تُرسم الصفحات صورًا…', async () => {
      const shots = await shootPages(await window.diwan.pdf.build(sub));
      const images: { name: string; bytes: Uint8Array }[] = [];
      for (const [k, s] of shots.entries()) {
        let blob = s.shot;
        if (gray || (limit && blob.size > limit)) {
          const fit = await fitJpeg(s.shot, limit, gray);
          if ('smallest' in fit) throw new Error(`الصفحة ${toIndic(k + 1)} لم تبلغ ${sizeText(limit)} — أصغر ما بلغته ${sizeText(fit.smallest)}`);
          blob = fit.blob;
        }
        images.push({ name: `${name || 'ملف'} — صفحة ${k + 1}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      return window.diwan.pdf.saveImages(images);
    });
    if (out) say(`حُفظت ${toIndic(out.files.length)} صورة في ${out.folder}`);
  }

  // ── لوحة المفاتيح: Delete يحذف العنصر المحدَّد، وCtrl+Z يتراجع ─────
  // (ما في الدالّتين مراجعُ وضوابطُ حالة — فلا يضرّها أن تكون من رسمٍ سابق.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        if (e.code === 'KeyY' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Delete' && active) {
        setOverlays((os) => os.filter((o) => o.id !== active));
        setActive(null);
      }
      if (e.key === 'Escape') {
        setActive(null);
        setCrop(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const btn = 'h-9 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  const hasDoc = pages.length > 0;
  const pageOverlays = currentRef ? overlaysFor(plan, currentRef.id) : [];
  const pt = currentRef && sources[currentRef.source] ? shownPt(sources[currentRef.source]!, currentRef) : null;
  const pxPerPt = view && pt ? view.w / pt.w : 1;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="pdf">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* ── الشريط ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-space-xs px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant">
          <button className={btn} data-act="pdf-open" type="button" onClick={() => void open()}>
            <span className="material-symbols-outlined text-[18px]">{hasDoc ? 'library_add' : 'folder_open'}</span>
            {hasDoc ? 'أضف ملفّات (دمج)' : 'افتح PDF أو صورًا'}
          </button>
          <button className={btn} data-act="pdf-scan" title="صفحةٌ من الماسح في آخر الملف" type="button" onClick={() => void scan()}>
            <span className="material-symbols-outlined text-[18px]">scanner</span>امسح
          </button>
          {hasDoc && (
            <>
              <button className={btn} data-act="pdf-undo" disabled={!canUndo} title="تراجع (Ctrl+Z)" type="button" onClick={undo}>
                <span className="material-symbols-outlined text-[18px]">undo</span>
              </button>
              <button className={btn} data-act="pdf-redo" disabled={!canRedo} title="أعد (Ctrl+Y)" type="button" onClick={redo}>
                <span className="material-symbols-outlined text-[18px]">redo</span>
              </button>
              <span className="w-px h-6 bg-outline-variant mx-1" />
              <button className={btn} data-act="pdf-text" disabled={!current} type="button" onClick={addText}>
                <span className="material-symbols-outlined text-[18px]">title</span>نصّ
              </button>
              <button className={btn} data-act="pdf-logo" disabled={!current} type="button" onClick={() => void openLogos()}>
                <span className="material-symbols-outlined text-[18px]">image</span>شعار أو صورة
              </button>
              <button className={btn} data-act="pdf-watermark" type="button" onClick={() => void addWatermark()}>
                <span className="material-symbols-outlined text-[18px]">branding_watermark</span>علامة مائية
              </button>
              <button className={btn} data-act="pdf-number" title="رقم الصفحة أسفل كلّ صفحة" type="button" onClick={addNumbers}>
                <span className="material-symbols-outlined text-[18px]">format_list_numbered_rtl</span>رقّم
              </button>
              <button className={btn} data-act="pdf-crop" disabled={!current} type="button" onClick={startCrop}>
                <span className="material-symbols-outlined text-[18px]">crop</span>قصّ
              </button>
              <span className="w-px h-6 bg-outline-variant mx-1" />
              <button className={btn} data-act="pdf-extract" disabled={!targets.length} type="button" onClick={() => void extract()}>
                <span className="material-symbols-outlined text-[18px]">file_export</span>استخرج المحدَّد
              </button>
              <button className={btn} data-act="pdf-split" type="button" onClick={() => setSplitText('')}>
                <span className="material-symbols-outlined text-[18px]">call_split</span>قسّم
              </button>
              <button className={btn} data-act="pdf-images" type="button" onClick={() => void toImages()}>
                <span className="material-symbols-outlined text-[18px]">photo_library</span>صفحاتٌ صورًا
              </button>
              <div className="flex-1" />
              <label className="flex items-center gap-1 font-label-md text-label-md" title="حدّ الحجم كما تطلبه خانة الرفع — للملف ولكلّ صورة">
                الحجم
                <select
                  className="h-9 min-w-[6.5rem] px-1 rounded-lg bg-surface-container-lowest border border-outline-variant"
                  data-pdf-limit=""
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {SIZE_LIMITS.map((l) => (
                    <option key={l.bytes} value={l.bytes}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 font-label-md text-label-md" title="يصغّر الملف كثيرًا، ويكفي أكثر المستمسكات">
                <input checked={gray} data-pdf-gray="" type="checkbox" onChange={(e) => setGray(e.target.checked)} />
                أبيض وأسود
              </label>
              <input
                className="h-9 w-56 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md"
                data-pdf-name=""
                title="اسم الملف الجديد"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1"
                data-act="pdf-save"
                type="button"
                onClick={() => void save()}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>احفظ ملفًّا جديدًا
              </button>
              <button className={btn} data-act="pdf-reset" title="أغلق الملف وابدأ من جديد" type="button" onClick={reset}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </>
          )}
        </div>

        {!hasDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-space-md text-center p-space-lg" data-pdf-empty="">
            <span className="material-symbols-outlined text-[64px] text-secondary">picture_as_pdf</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">ملفات PDF</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
              أضف نصًّا أو شعارًا أو علامةً مائية أو رقم الصفحة، وقصّ وقسّم وادمج ورتّب، وصغّر الملف لحدّ خانة الرفع — على
              هذا الجهاز، فلا تُرفع مستمسكات الزبائن إلى مواقع الإنترنت. والحفظ ملفٌّ جديد، والأصل يبقى كما وصل.
            </p>
            <div className="flex items-center gap-space-sm">
              <button
                className="h-11 px-space-lg rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-2"
                type="button"
                onClick={() => void open()}
              >
                <span className="material-symbols-outlined">folder_open</span>افتح PDF أو صورًا
              </button>
              <button
                className="h-11 px-space-lg rounded-xl bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold flex items-center gap-2"
                type="button"
                onClick={() => void scan()}
              >
                <span className="material-symbols-outlined">scanner</span>امسح من الماسح
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* ── الصفحات ─────────────────────────────────────────── */}
            <aside className="w-52 shrink-0 border-l border-outline-variant bg-surface-container-low flex flex-col">
              <div className="flex items-center justify-between gap-0.5 p-space-xs border-b border-outline-variant">
                <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-rotate-right" disabled={!targets.length} title="دوّر مع عقارب الساعة" type="button" onClick={() => rotate(90)}>
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-rotate-left" disabled={!targets.length} title="دوّر عكس عقارب الساعة" type="button" onClick={() => rotate(270)}>
                  <span className="material-symbols-outlined text-[18px]">rotate_left</span>
                </button>
                <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-up" disabled={!targets.length} title="قدّم" type="button" onClick={() => move(-1)}>
                  <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                </button>
                <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-down" disabled={!targets.length} title="أخّر" type="button" onClick={() => move(1)}>
                  <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                </button>
                <button className="h-8 w-8 rounded hover:bg-surface-container-high" data-act="pdf-duplicate" disabled={!targets.length} title="كرّر بعدها" type="button" onClick={duplicate}>
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
                <button className="h-8 w-8 rounded hover:bg-error-container text-error" data-act="pdf-delete" disabled={!targets.length} title="احذف من الملف الجديد" type="button" onClick={remove}>
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
              <div className="px-space-xs py-1 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span>
                  {pagesWord(pages.length)}
                  {selected.length ? ` — ${toIndic(selected.length)} محدَّدة` : ''}
                </span>
                <button
                  className="text-secondary hover:underline"
                  data-act="pdf-select-all"
                  type="button"
                  onClick={() => setSelected(selected.length === pages.length ? [] : pages.map((p) => p.id))}
                >
                  {selected.length === pages.length ? 'ألغِ التحديد' : 'حدّد الكل'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-space-xs space-y-space-xs" data-pdf-pages="">
                {pages.map((p, i) => (
                  <div
                    key={p.id}
                    className={`relative rounded-lg p-1 cursor-pointer border-2 ${p.id === current ? 'border-secondary' : 'border-transparent hover:border-outline-variant'}`}
                    data-pdf-page={i + 1}
                    draggable
                    onClick={() => {
                      setCurrent(p.id);
                      setCrop(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragStart={() => (dragPage.current = p.id)}
                    onDrop={() => dropPage(p.id)}
                  >
                    {thumbs[thumbKey(p)] ? (
                      <img alt="" className="w-full shadow border border-outline-variant bg-white" src={thumbs[thumbKey(p)]} />
                    ) : (
                      <div className="w-full aspect-[1/1.414] bg-surface-container-high animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mt-1 font-label-sm text-label-sm">
                      <span className="font-semibold">{toIndic(i + 1)}</span>
                      <input
                        checked={selected.includes(p.id)}
                        data-pdf-check={i + 1}
                        type="checkbox"
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {(p.rotate || p.crop) && (
                      <span className="absolute top-2 left-2 rounded bg-secondary text-on-secondary text-[10px] px-1">
                        {p.rotate ? `${toIndic(p.rotate)}°` : ''} {p.crop ? 'مقصوصة' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </aside>

            {/* ── الصفحة ──────────────────────────────────────────── */}
            <section
              ref={stage}
              className="flex-1 min-w-0 overflow-auto bg-surface-dim/40 flex items-start justify-center p-space-md"
              onPointerDown={() => setActive(null)}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
            >
              {view && currentRef && (
                <div className="relative shadow-lg bg-white" data-pdf-view="" style={{ width: view.w, height: view.h }}>
                  <img alt="" className="absolute inset-0 w-full h-full select-none" draggable={false} src={view.url} />
                  {!crop &&
                    pageOverlays.map((o) => (
                      <div
                        key={o.id}
                        className={`absolute cursor-move ${o.id === active ? 'outline outline-2 outline-secondary' : 'hover:outline hover:outline-1 hover:outline-secondary/60'}`}
                        data-pdf-overlay={o.kind}
                        style={{ left: `${o.box.x * 100}%`, top: `${o.box.y * 100}%`, width: `${o.box.w * 100}%`, height: `${o.box.h * 100}%` }}
                        onPointerDown={(e) => startDrag(e, 'overlay', o.id, 'move', o.box)}
                      >
                        <div
                          className="w-full h-full flex items-center"
                          dir="auto"
                          style={{
                            opacity: o.opacity,
                            transform: `rotate(${o.angle}deg)`,
                            justifyContent: o.kind === 'text' ? (o.align === 'center' ? 'center' : o.align === 'left' ? 'flex-end' : 'flex-start') : 'center'
                          }}
                        >
                          {o.kind === 'text' ? (
                            <span
                              style={{
                                width: '100%',
                                fontFamily: `'${o.font}', Arial, sans-serif`,
                                fontSize: o.size * pxPerPt,
                                fontWeight: o.bold ? 700 : 400,
                                color: o.color,
                                textAlign: o.align,
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.3
                              }}
                            >
                              {pageTokens(o.text, currentIndex + 1, pages.length)}
                            </span>
                          ) : (
                            <img alt="" className="w-full h-full object-contain pointer-events-none" src={`diwan://store/${o.src}`} />
                          )}
                        </div>
                        {o.id === active && (
                          <span
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-sm bg-secondary cursor-nwse-resize"
                            data-pdf-resize=""
                            onPointerDown={(e) => startDrag(e, 'overlay', o.id, 'resize', o.box)}
                          />
                        )}
                      </div>
                    ))}
                  {crop && (
                    <div className="absolute inset-0 bg-black/40" data-pdf-crop="">
                      <div
                        className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] cursor-move"
                        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                        onPointerDown={(e) => startDrag(e, 'crop', 'crop', 'move', crop)}
                      >
                        <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-sm bg-white cursor-nwse-resize" onPointerDown={(e) => startDrag(e, 'crop', 'crop', 'resize', crop)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── الخصائص ─────────────────────────────────────────── */}
            <aside className="w-72 shrink-0 border-r border-outline-variant bg-surface-container-lowest p-space-md overflow-y-auto space-y-space-sm" data-pdf-props="">
              {crop ? (
                <div className="space-y-space-xs">
                  <h2 className="font-label-lg text-label-lg font-bold">القصّ</h2>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">اسحب الصندوق وكبّره من زاويته: ما خارجه لا يظهر في الملف الجديد.</p>
                  <button className={`${btn} w-full justify-center`} data-act="pdf-crop-page" type="button" onClick={() => applyCrop('page')}>
                    طبّق على هذه الصفحة
                  </button>
                  {selected.length > 1 && (
                    <button className={`${btn} w-full justify-center`} data-act="pdf-crop-selected" type="button" onClick={() => applyCrop('targets')}>
                      على الصفحات المحدَّدة ({toIndic(selected.length)})
                    </button>
                  )}
                  {currentRef?.crop && (
                    <button className={`${btn} w-full justify-center`} type="button" onClick={() => applyCrop('clear')}>
                      أزل القصّ
                    </button>
                  )}
                  <button className="w-full h-8 font-label-md text-label-md text-on-surface-variant hover:underline" type="button" onClick={() => setCrop(null)}>
                    تراجع
                  </button>
                </div>
              ) : activeOverlay ? (
                <div className="space-y-space-sm">
                  <h2 className="font-label-lg text-label-lg font-bold">{activeOverlay.kind === 'text' ? 'النصّ' : 'الصورة'}</h2>
                  {activeOverlay.kind === 'text' && (
                    <>
                      <textarea
                        className="w-full h-20 p-2 rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md"
                        data-pdf-overlay-text=""
                        dir="auto"
                        value={activeOverlay.text}
                        onChange={(e) => patch(activeOverlay.id, { text: e.target.value })}
                      />
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        للترقيم اكتب <b>{'{رقم}'}</b> و<b>{'{عدد}'}</b> (أو <b dir="ltr">{'{n}'}</b> و<b dir="ltr">{'{N}'}</b> بالأرقام الإنكليزية) — فتُرى كلّ صفحةٍ برقمها.
                      </p>
                      <label className="flex items-center gap-2 font-label-md text-label-md">
                        الخطّ
                        <select className="flex-1 h-8 rounded bg-surface-container-low" value={activeOverlay.font} onChange={(e) => patch(activeOverlay.id, { font: e.target.value })}>
                          {PDF_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-2 font-label-md text-label-md">
                        <label className="flex items-center gap-1">
                          الحجم
                          <input className="w-16 h-8 px-1 rounded bg-surface-container-low" data-pdf-size="" min={6} max={200} type="number" value={activeOverlay.size} onChange={(e) => patch(activeOverlay.id, { size: Number(e.target.value) || 12 })} />
                        </label>
                        <input className="w-10 h-8" title="اللون" type="color" value={activeOverlay.color} onChange={(e) => patch(activeOverlay.id, { color: e.target.value })} />
                        <button className={`h-8 w-8 rounded ${activeOverlay.bold ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high'}`} title="عريض" type="button" onClick={() => patch(activeOverlay.id, { bold: !activeOverlay.bold })}>
                          <span className="material-symbols-outlined text-[18px]">format_bold</span>
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {(['right', 'center', 'left'] as const).map((a) => (
                          <button
                            key={a}
                            className={`flex-1 h-8 rounded ${activeOverlay.align === a ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high'}`}
                            type="button"
                            onClick={() => patch(activeOverlay.id, { align: a })}
                          >
                            <span className="material-symbols-outlined text-[18px]">{a === 'right' ? 'format_align_right' : a === 'center' ? 'format_align_center' : 'format_align_left'}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <label className="block font-label-md text-label-md">
                    الشفافية: {toIndic(Math.round(activeOverlay.opacity * 100))}٪
                    <input className="w-full" max={100} min={5} type="range" value={Math.round(activeOverlay.opacity * 100)} onChange={(e) => patch(activeOverlay.id, { opacity: Number(e.target.value) / 100 })} />
                  </label>
                  <label className="block font-label-md text-label-md">
                    الميل: <span dir="ltr">{toIndic(activeOverlay.angle)}°</span>
                    <input className="w-full" max={90} min={-90} type="range" value={activeOverlay.angle} onChange={(e) => patch(activeOverlay.id, { angle: Number(e.target.value) })} />
                  </label>
                  <div className="font-label-md text-label-md space-y-1">
                    <span className="font-semibold">يظهر في</span>
                    <label className="flex items-center gap-2">
                      <input checked={activeOverlay.pages !== 'all'} data-pdf-scope="page" name="scope" type="radio" onChange={() => current && patch(activeOverlay.id, { pages: [current] })} />
                      هذه الصفحة
                    </label>
                    {selected.length > 1 && (
                      <label className="flex items-center gap-2">
                        <input checked={false} name="scope" type="radio" onChange={() => patch(activeOverlay.id, { pages: [...selected] })} />
                        الصفحات المحدَّدة ({toIndic(selected.length)})
                      </label>
                    )}
                    <label className="flex items-center gap-2">
                      <input checked={activeOverlay.pages === 'all'} data-pdf-scope="all" name="scope" type="radio" onChange={() => patch(activeOverlay.id, { pages: 'all' })} />
                      كلّ الصفحات
                    </label>
                  </div>
                  <button
                    className="w-full h-9 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md"
                    data-act="pdf-overlay-delete"
                    type="button"
                    onClick={() => {
                      setOverlays((os) => os.filter((o) => o.id !== activeOverlay.id));
                      setActive(null);
                    }}
                  >
                    احذف (Delete)
                  </button>
                </div>
              ) : (
                <div className="font-label-md text-label-md text-on-surface-variant space-y-2">
                  <p>اختر صفحةً من اليمين، أو حدّد عدّة صفحاتٍ بمربّعاتها لتُدار أو تُحذف أو تُستخرج معًا.</p>
                  <p>«نصّ» و«شعار» يُضافان إلى الصفحة الحالية، و«علامة مائية» إلى الصفحات كلّها — واسحب أيَّ عنصرٍ إلى موضعه.</p>
                  <p>وترتيب الصفحات بالسحب، أو بالسهمين. وCtrl+Z يتراجع عن آخر تعديل.</p>
                  <p>و«الحجم» حدُّ خانة الرفع: ما تجاوزه تصير صفحاته صورًا بأجود درجةٍ تبلغه — في الحفظ والصور.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {logoPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-pdf-logos="" onClick={() => setLogoPicker(null)}>
          <div className="w-[560px] max-h-[70vh] rounded-2xl bg-surface-container-lowest p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-sm text-headline-sm">شعار أو صورة</h2>
            <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-space-xs">
              {logoPicker.map((src) => (
                <button key={src} className="aspect-square rounded-lg border border-outline-variant bg-white p-1 hover:border-secondary" data-pdf-logo={src} type="button" onClick={() => placeLogo(src)}>
                  <img alt="" className="w-full h-full object-contain" src={`diwan://store/${src}`} />
                </button>
              ))}
              {!logoPicker.length && <p className="col-span-4 font-label-md text-label-md text-on-surface-variant">لا شعارات محفوظة بعد — أضف واحدًا من الجهاز فيُحفظ للمرّات القادمة.</p>}
            </div>
            <button className={`${btn} justify-center`} data-act="pdf-logo-device" type="button" onClick={() => void logoFromDevice()}>
              <span className="material-symbols-outlined text-[18px]">upload</span>من الجهاز…
            </button>
          </div>
        </div>
      )}

      {splitText !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-pdf-split-dialog="" onClick={() => setSplitText(null)}>
          <div className="w-[480px] rounded-2xl bg-surface-container-lowest p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-sm text-headline-sm">قسّم الملف</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">
              اكتب المجموعات مفصولةً بـ«؛» — مثل <b dir="ltr">1-3؛ 4-6؛ 7</b> — فتصير كلٌّ منها ملفًّا. واتركها فارغةً لتصير كلّ صفحةٍ ملفًّا.
            </p>
            <input
              autoFocus
              className="h-10 px-2 rounded-lg bg-surface-container-low border border-outline-variant"
              data-pdf-split=""
              dir="ltr"
              value={splitText}
              onChange={(e) => setSplitText(e.target.value)}
            />
            <button className="h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold" data-act="pdf-split-go" type="button" onClick={() => void split(splitText)}>
              قسّم واحفظ في مجلّد
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/30" data-pdf-busy="">
          <div className="rounded-xl bg-surface-container-lowest px-space-lg py-space-md shadow-xl flex items-center gap-2 font-label-md text-label-md">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            {busy}
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-space-md left-1/2 -translate-x-1/2 z-[75] max-w-2xl rounded-xl px-space-md py-space-sm shadow-xl font-label-md text-label-md ${toast.tone === 'warn' ? 'bg-error-container text-on-error-container' : 'bg-inverse-surface text-inverse-on-surface'}`}
          data-pdf-toast=""
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
