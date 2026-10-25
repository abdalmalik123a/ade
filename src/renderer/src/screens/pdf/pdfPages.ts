/**
 * رسم صفحات PDF والصور في محرّرها، ومعرّفاتها وأنواعها (تقسيم شاشة PDF بعد ١٫٧٫٠) — منقولةٌ من `PdfScreen` كما هي، وتأخذها
 * الشاشة وأجزاؤها. ومحرّك pdf.js يُضبط عامله هنا مرّةً حين يُستورد.
 */
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfOpened } from '@shared/api';
import { imagePage, shownSize, totalRotation, type FracBox, type Overlay, type PageRef, type Rotation } from '@shared/pdfEdit';
import { toJpeg, TOP_DPI } from '../../lib/fitImage';
import { count } from '@shared/arabic';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Src = PdfOpened & { doc?: PDFDocumentProxy; img?: HTMLImageElement };

/** «صفحة واحدة، صفحتان، ٣ صفحات، ١١ صفحة» — بأداة العدّ الواحدة. */
export const pagesWord = (n: number): string => count(n, 'صفحة');
/** «حقل واحد، حقلان، ٣ حقول، ١١ حقلًا». */
export const fieldsWord = (n: number): string => count(n, 'حقل');
let uid = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(++uid).toString(36)}`;

export async function loadSource(o: PdfOpened): Promise<Src> {
  if (o.kind === 'pdf') {
    const doc = await pdfjs.getDocument({ data: o.bytes.slice(), useSystemFonts: true }).promise;
    return { ...o, doc };
  }
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([o.bytes as BlobPart]));
  await img.decode();
  return { ...o, img };
}

export function rotateCanvas(c: HTMLCanvasElement, r: number): HTMLCanvasElement {
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
export async function drawShown(src: Src, index: number, rotate: Rotation, width: number): Promise<HTMLCanvasElement> {
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

export function cropCanvas(c: HTMLCanvasElement, crop?: FracBox): HTMLCanvasElement {
  if (!crop) return c;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(c.width * crop.w));
  out.height = Math.max(1, Math.round(c.height * crop.h));
  out.getContext('2d')!.drawImage(c, c.width * crop.x, c.height * crop.y, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** الصفحة الفارغة (S28، D178) كما تُرى: لوحٌ أبيض بنسبتها بعرضٍ معلوم. */
export function blankCanvas(ref: PageRef, width: number): HTMLCanvasElement {
  const s = shownSize({ width: ref.blank!.w, height: ref.blank!.h }, ref.rotate);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round((width * s.h) / s.w));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** مقاس الصفحة كما تُرى بالنقاط لأيّ صفحة — والفارغة بمقاسها — أو `null` لمصدرٍ لم يُحمَّل. */
export function refShownPt(sources: Record<string, Src>, ref: PageRef): { w: number; h: number } | null {
  if (ref.blank) {
    const s = shownSize({ width: ref.blank.w, height: ref.blank.h }, ref.rotate);
    return ref.crop ? { w: s.w * ref.crop.w, h: s.h * ref.crop.h } : s;
  }
  const src = sources[ref.source];
  return src ? shownPt(src, ref) : null;
}

/** مقاس الصفحة كما تُرى بالنقاط — بعد دورانها وقصّها — لتُقاس به الخطوط في المعاينة. */
export function shownPt(src: Src, ref: PageRef): { w: number; h: number } {
  const info = src.pages[ref.index]!;
  const s = shownSize(info, totalRotation(info.rotation, ref.rotate));
  return ref.crop ? { w: s.w * ref.crop.w, h: s.h * ref.crop.h } : s;
}

/** الملفّ كما يُحفظ: صفحاته صورٌ أم صُغّرت صوره — والدقّة التي بلغها إن صار صورًا (هـ٢). */
export type Made = { bytes: Uint8Array; raster: boolean; shrunk?: boolean; dpi?: number; gray?: boolean };

export type Drag = { id: string; mode: 'move' | 'resize'; x: number; y: number; box: FracBox; target: 'overlay' | 'crop' };

/** صفحات الملف المبني صورًا بأجود درجة — ومنها تُصغَّر الدرجات الأدنى بلا رسمٍ جديد. ومقاس كلٍّ كما تُرى بالنقاط. */
export async function shootPages(bytes: Uint8Array): Promise<{ shot: Blob; w: number; h: number }[]> {
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

export type Snap = { pages: PageRef[]; overlays: Overlay[] };

/** ملفّاتٌ فتحها الشبّاك من «الملفّات» — تُضاف مرّةً بمفتاحها. */
export type PdfIncoming = { key: number; opened: PdfOpened[]; failed: { name: string; error: string }[] };
