/** خطوات التسوية في نافذة الميلان: قراءة البكسلات، وكشف الأركان، و«المسح النظيف» — نُقلت من `DeskewModal.tsx` (سقف حجمه). */
import { detectQuad, flattenLight, type PixelData, type Quad } from '@shared/deskew';
import { cleanScan, despeckle, inkCoverage, straighten } from '@shared/scanClean';

/** بكسلات الصورة كما حُمّلت — ليقرأها الكاشف. */
export function pixelsOf(img: HTMLImageElement): PixelData | null {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function detectCorners(img: HTMLImageElement): Quad | null {
  const px = pixelsOf(img);
  return px ? detectQuad(px) : null;
}

/** ما يُجرى بعد التسوية (هـ١) — ويُعرض أثره: زاوية التقويم، والبقع الممحوّة، والحبر. */
export type Cleaning = { keepColor: boolean; despeckle: boolean; straighten: boolean };
export type Finished = { px: PixelData; angle: number; specks: number; ink: number; heavy: boolean };

/**
 * «مسح نظيف»: ظلُّ اليد ووهجُ المصباح يُسوَّيان، والورق أبيض والحبر حبر — **والختم
 * الأزرق والتوقيع الأحمر بلونهما** إن طُلب. ثم التقويم من الأسطر (ورقةٌ مائلة على
 * الزجاج لا أركان لها تُكشف)، ثم محو البقع المعزولة.
 */
export function finish(px: PixelData, mode: string, cleaning: Cleaning): Finished {
  let out = px;
  let angle = 0;
  if (cleaning.straighten) ({ px: out, angle } = straighten(out));
  if (mode === 'scan') out = cleaning.keepColor ? cleanScan(out, { keepColor: true }) : flattenLight(out, { gray: true, ink: 1.3 });
  let specks = 0;
  if (cleaning.despeckle && mode !== 'color') ({ px: out, removed: specks } = despeckle(out));
  const { coverage, heavy } = inkCoverage(out);
  return { px: out, angle, specks, ink: coverage, heavy };
}
