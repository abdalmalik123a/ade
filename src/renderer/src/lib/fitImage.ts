/**
 * صورةٌ بحدّ خانة الرفع — لمحرّر PDF («صفحاتٌ صورًا» والتصغير) ولمستمسكات المواطن.
 *
 * الصورة تُعطى بأجود ما تكون (صفحةٌ رُسمت بـ١٥٠ نقطة، أو مستمسكٌ بحجمه)، فتُجرَّب درجات
 * `RASTER_STEPS` منها: الأولى بحجمها، ثم تصغر وتقلّ جودتها حتى تبلغ الحدّ. وما لم يبلغه
 * يُقال بأصغر ما بلغ.
 */
import { fitSearch, RASTER_STEPS, SIZE_LIMITS } from '@shared/pdfEdit';

export const toJpeg = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('تعذّر رسم الصورة'))), 'image/jpeg', quality));

/** أجود درجات التصغير — والصورة المعطاة تُعدّ بها، فالدرجات الأدنى نسبٌ منها. */
export const TOP_DPI = RASTER_STEPS[0]!.dpi;

/** الصورة بدرجةٍ أصغر: تُصغَّر من صورتها الجيّدة، وتُرمَّد إن طُلب «أبيض وأسود». */
export async function reencode(shot: Blob, dpi: number, quality: number, gray: boolean): Promise<Blob> {
  const bmp = await createImageBitmap(shot);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((bmp.width * dpi) / TOP_DPI));
  c.height = Math.max(1, Math.round((bmp.height * dpi) / TOP_DPI));
  const ctx = c.getContext('2d')!;
  // خلفيةٌ بيضاء: PNG الشفّاف يصير JPEG أسود الخلفية بغيرها.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  if (gray) ctx.filter = 'grayscale(1)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return toJpeg(c, quality);
}

/**
 * الصورة JPEG بحدّها — و`limit` صفرٌ بلا حدّ (فالأولى تكفي). ويعود بالصورة، أو بأصغر ما
 * بلغ إن لم تبلغه درجة.
 */
export async function fitJpeg(shot: Blob, limit: number, gray: boolean): Promise<{ blob: Blob } | { smallest: number }> {
  const fit = await fitSearch(limit, RASTER_STEPS, async (step) => {
    const b = await reencode(shot, step.dpi, step.quality, gray);
    return { size: b.size, value: b };
  });
  return 'smallest' in fit ? fit : { blob: fit.value };
}

/** حدّ الحجم يُتذكَّر بين المرّات وبين الشاشتين — المكتب يرفع إلى المنصّات نفسها غالبًا. */
export const LIMIT_KEY = 'diwan.pdf.limit';

export function savedLimit(fallback = 0): number {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    const v = Number(raw);
    return raw !== null && SIZE_LIMITS.some((l) => l.bytes === v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function rememberLimit(bytes: number): void {
  try {
    localStorage.setItem(LIMIT_KEY, String(bytes));
  } catch {
    // التذكّر راحةٌ لا شرط — والحدّ يعمل في هذه المرّة.
  }
}
