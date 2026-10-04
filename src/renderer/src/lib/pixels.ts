/**
 * الصورة بكسلاتٍ وبالعكس — لما يُقرأ على هذا الجهاز (صورة الورقة، والاستمارة المصوّرة).
 */
import type { PixelData } from '@shared/deskew';

/**
 * بكسلات صورةٍ من رابطها. وما صغُر عن `minSide` يُكبَّر إليه: صورة استمارةٍ من واتساب بعرض
 * ٤٦٤ بكسلًا لا يقرأ القارئ حروفها ولا تُرى حدود صناديقها.
 */
export async function pixelsOf(dataUrl: string, maxSide = 3600, minSide = 0): Promise<PixelData> {
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    // رسالة المتصفّح إنكليزية («The source image cannot be decoded») — والسبب يُقال بالعربية.
    throw new Error('الملف ليس صورةً تُقرأ — قد يكون تالفًا أو أُعيدت تسميته');
  }
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const k = long > maxSide ? maxSide / long : long < minSide ? minSide / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function canvasOf(px: PixelData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return c;
}

export async function pngOf(px: PixelData, type: 'image/png' | 'image/jpeg' = 'image/png', quality = 0.92): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => canvasOf(px).toBlob(r, type, quality));
  if (!blob) throw new Error('تعذّر تجهيز الصورة');
  return new Uint8Array(await blob.arrayBuffer());
}
