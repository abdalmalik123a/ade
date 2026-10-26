/**
 * عمليّات الصورة في «ورقة المستمسكات» (S47، D199): التحميل، والقصّ المستطيل بدقّة الأصل، والتدوير ٩٠° يمينًا — كلٌّ إلى JPEG ٠٫٩٢
 * كمقصوصات «عدّة بطاقاتٍ بمسحةٍ واحدة». والمصدر عنوانٌ يُعرض (`diwan://store/…` أو dataURL).
 */
import type { Rect } from '@shared/cropRect';

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر فتح الصورة'));
    img.src = url;
  });
}

/** بكسلات الصورة كما هي — ليقرأها كاشف البطاقات. */
export function pixelsOf(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** المستطيل (بكسلات الأصل) صورةً مستقلّة. */
export function cropTo(img: HTMLImageElement, r: Rect): string {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w));
  c.height = Math.max(1, Math.round(r.h));
  c.getContext('2d')!.drawImage(img, Math.round(r.x), Math.round(r.y), c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.92);
}

/** الصورة مدوَّرةً ربع دورةٍ مع عقارب الساعة: عرضها طولٌ وطولها عرض. */
export async function rotateRight(url: string): Promise<string> {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.naturalHeight;
  c.height = img.naturalWidth;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
}
