/**
 * صورة المعاملة على اللوحة — ما يُرى في الإطار وما يُحفظ ويُطبع يُرسم بدالّةٍ واحدة (`drawScene`):
 * الخلفية، ثم الشخص بشفافيّته، ثم القاط بموضعه — بإطارٍ بكسلاتُه بكسلات الشاشة أو بكسلات
 * الطباعة، والقصّ نفسه (`cropBox`) في الحالتين.
 *
 * والحساب الخالص (القناع، والمعالم، والتحسين) في `shared/` مختبَرٌ بالأرقام؛ وهنا الرسم وحده.
 */
import { cropBox, type Crop, type Size } from '@shared/photoSheet';
import { setJpegDpi } from '@shared/photoPresets';
import { rowWidths, suitAnchor, suitTops, type SuitAnchor, type SuitTransform } from '@shared/portraitMask';
import { applyLook, type Look } from '@shared/suitLook';
import { toJpeg } from './fitImage';

/**
 * أطول ضلعٍ للصورة العاملة. ٣٫٥×٤٫٥ بـ٦٠٠ نقطة ٨٢٧×١٠٦٣ بكسلًا، والرأس فيه نحو ٨٠٠ —
 * فصورةٌ بهذا الحدّ تبلغه ولو كان الوجه ثلثها، ولا تُثقل النموذج ولا المنزلقات.
 */
export const WORK_EDGE = 2400;

export type Work = { width: number; height: number; pixels: Uint8ClampedArray };

/** صورةٌ بإذن الأصل — فلا تُقفَل اللوحة إن رُسمت فيها (المخزن يرسل رأس CORS). */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  return img;
}

const canvasOf = (width: number, height: number) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
};

/** بكسلات الصورة مصغّرةً إلى حدّ العمل — وما دونه بحجمه لا يُكبَّر. */
export function workPixels(img: HTMLImageElement): Work {
  const k = Math.min(1, WORK_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvasOf(width, height).getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, pixels: ctx.getImageData(0, 0, width, height).data };
}

/** القاط وما يُقرأ من شفافيّته: فتحة العنق، وعرضه صفًّا صفًّا (للمطابقة)، وأعلاه عمودًا عمودًا (لحدّ القصّ). */
export type Suit = { key: string; img: HTMLImageElement; anchor: SuitAnchor; rows: Float32Array; tops: Float32Array };

/** القاط ومكان عنقه من شفافيّته — والمستورد كالمدمج. */
export async function loadSuit(key: string, url: string): Promise<Suit> {
  const img = await loadImage(url);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ctx = canvasOf(w, h).getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;
  const anchor = suitAnchor(alpha, w, h) ?? { cx: w / 2, cy: 0, neckWidth: w * 0.2, shoulderWidth: w, top: 0 };
  return { key, img, anchor, rows: rowWidths(alpha, w, h), tops: suitTops(alpha, w, h, anchor) };
}

/** بلا معالم (لم يُعرف الرأس من الرقبة): القاط في أسفل الوسط بعرض الصورة تقريبًا — ويُضبط باليد. */
export function fallbackPlace(suit: Suit, natural: Size): SuitTransform {
  return { x: natural.w / 2, y: natural.h * 0.62, scale: (natural.w * 0.9) / suit.anchor.shoulderWidth, angle: 0 };
}

/**
 * القاط بلون الصورة المفتوحة وتشويشها («لمسة الواقعية»، D176، `@shared/suitLook`): يضعه رسم الصور (`usePhotoCanvas`) بعد أن
 * يستقرّ، لصورةٍ بعينها (`of`: مقاسها في الحالة، جديدٌ لكلّ صورة) — فيرسمه المشهد بدل صورة القاط في المعاينة والحفظ والطباعة.
 */
const looks = new WeakMap<Suit, { of: Size; img: CanvasImageSource }>();
export function setSuitLook(suit: Suit, of: Size, img: CanvasImageSource): void {
  looks.set(suit, { of, img });
}

/** صورة القاط بمقاسها وقد عُدّل لونها وتشويشها (`applyLook`) — بمقياسه في الصورة، فيبقى تشويشه بعد التصغير. */
export function suitWithLook(suit: Suit, look: Look, scale: number): HTMLCanvasElement {
  const c = canvasOf(suit.img.naturalWidth, suit.img.naturalHeight);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(suit.img, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  img.data.set(applyLook(img.data, c.width, c.height, look, scale));
  ctx.putImageData(img, 0, 0);
  return c;
}

export type Scene = {
  /** الشخص بلونه المحسّن وشفافيّته — بمقاس الصورة العاملة. */
  subject: CanvasImageSource;
  natural: Size;
  crop: Crop;
  background: string;
  suit: { suit: Suit; at: SuitTransform } | null;
};

/** يرسم المشهد في إطارٍ بمقاسه — بكسلات الشاشة للمعاينة، وبكسلات الدقّة للحفظ والطباعة. */
export function drawScene(ctx: CanvasRenderingContext2D, frame: Size, s: Scene): void {
  const box = cropBox(frame, s.natural, s.crop);
  const k = box.width / s.natural.w;
  ctx.save();
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, frame.w, frame.h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.subject, box.left, box.top, box.width, box.height);
  if (s.suit) {
    const { suit, at } = s.suit;
    const sx = (at.scaleX ?? 1) * at.scale * k;
    const sy = (at.scaleY ?? 1) * at.scale * k;
    const look = looks.get(suit);
    ctx.translate(box.left + at.x * k, box.top + at.y * k);
    ctx.rotate((at.angle * Math.PI) / 180);
    ctx.drawImage(look?.of === s.natural ? look.img : suit.img, -suit.anchor.cx * sx, -suit.anchor.cy * sy, suit.img.naturalWidth * sx, suit.img.naturalHeight * sy);
  }
  ctx.restore();
}

/**
 * القاط بموضعه في مستطيلٍ من الصورة العاملة (RGBA بمقاسه) — بتحويل `drawScene` نفسه ولونه للصورة `of` إن وُضع (D177)، لإكمال الرقبة
 * (`@shared/neckFill`): فباطن الياقة من القاط كما يُرسم.
 */
export function suitPixels(suit: Suit, at: SuitTransform, r: { x: number; y: number; w: number; h: number }, of?: Size): Uint8ClampedArray {
  const look = looks.get(suit);
  const ctx = canvasOf(r.w, r.h).getContext('2d', { willReadFrequently: true })!;
  const sx = (at.scaleX ?? 1) * at.scale;
  const sy = (at.scaleY ?? 1) * at.scale;
  ctx.translate(at.x - r.x, at.y - r.y);
  ctx.rotate((at.angle * Math.PI) / 180);
  ctx.drawImage(look && look.of === of ? look.img : suit.img, -suit.anchor.cx * sx, -suit.anchor.cy * sy, suit.img.naturalWidth * sx, suit.img.naturalHeight * sy);
  return ctx.getImageData(0, 0, r.w, r.h).data;
}

/** الصورة النهائية JPEG ببكسلات مقاسها ودقّته — والدقّة مكتوبةٌ في رأسها صادقة. */
export async function renderJpeg(scene: Scene, px: Size, dpi: number, quality = 0.95): Promise<Blob> {
  const c = canvasOf(px.w, px.h);
  drawScene(c.getContext('2d')!, px, scene);
  const blob = await toJpeg(c, quality);
  return new Blob([setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi)], { type: 'image/jpeg' });
}

export const dataUrlOf = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error ?? new Error('تعذّرت قراءة الصورة'));
    r.readAsDataURL(blob);
  });
