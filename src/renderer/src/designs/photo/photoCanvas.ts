/**
 * «حسّن الصورة» على اللوحة (DESIGNS.md ٢٫٢): الهندسة رسمٌ واحد — ربع الدورة ثم القلب في إطارها ثم الاستقامة حول الوسط
 * مكبَّرةً بقدر ما يُخفي زواياها الفارغة (`straightenScale`) ثم القصّ — والضوء واللون بعدها على البكسلات (`applyColor`).
 * المعاينة بالرسم نفسه مصغَّرًا، فما يُرى هو ما يُحفظ.
 */
import { applyColor, FULL, straightenScale, turned, type CropRect, type PhotoEdit } from '@shared/photoEdit';

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** مقاس الإطار المستقيم (قبل القصّ) لصورةٍ `sw × sh`. */
export function straightFrame(sw: number, sh: number, edit: Pick<PhotoEdit, 'quarter' | 'straighten'>): { w: number; h: number } {
  const t = turned(sw, sh, edit.quarter);
  const k = straightenScale(t.w, t.h, edit.straighten);
  return { w: t.w * k, h: t.h * k };
}

/**
 * الهندسة: الإطار المقصوص (`crop`، أو الإطار كلّه للمعاينة) بمقياس `scale` من بكسلات الأصل — ثم الضوء واللون.
 * والأصل صورةٌ أو لوحة؛ والناتج لوحةٌ جديدة.
 */
export function renderEdit(src: CanvasImageSource, sw: number, sh: number, edit: PhotoEdit, crop: CropRect = edit.crop, scale = 1): HTMLCanvasElement {
  const frame = straightFrame(sw, sh, edit);
  const out = canvasOf(frame.w * crop.w * scale, frame.h * crop.h * scale);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(out.width / (frame.w * crop.w), out.height / (frame.h * crop.h));
  ctx.translate(-crop.x * frame.w, -crop.y * frame.h);
  ctx.translate(frame.w / 2, frame.h / 2);
  ctx.rotate((edit.straighten * Math.PI) / 180);
  if (edit.flip) ctx.scale(-1, 1);
  ctx.rotate((edit.quarter * Math.PI) / 2);
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, out.width, out.height);
  const colored = applyColor(data.data, out.width, out.height, edit);
  if (colored !== data.data) data.data.set(colored);
  ctx.putImageData(data, 0, 0);
  return out;
}

/** المعاينة: الإطار كلّه (والقصّ يُرسم فوقه) بحدٍّ أقصى للضلع — فالمنزلقات سريعة. */
export function renderPreview(src: CanvasImageSource, sw: number, sh: number, edit: PhotoEdit, maxEdge = 720): HTMLCanvasElement {
  const frame = straightFrame(sw, sh, edit);
  return renderEdit(src, sw, sh, edit, FULL, Math.min(1, maxEdge / Math.max(frame.w, frame.h)));
}

/** الصورة المحفوظة: PNG إن كان فيها شفافية (شعارٌ، منتجٌ مقصوص)، وإلا JPG بجودة ٩٢. */
export async function encodeEdit(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) {
      transparent = true;
      break;
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, transparent ? 'image/png' : 'image/jpeg', 0.92));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}
