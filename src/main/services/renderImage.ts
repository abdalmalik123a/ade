/**
 * التصميم صورةً (DESIGNS.md ١٫٨): PNG أو JPG أو PNG شفّافة — للواتساب والمنشور بجانب الطباعة وPDF.
 *
 * بمحرّك الإخراج نفسه (`withRenderWindow`): الورقة بمقاسها وخطوطها المضمَّنة والمستوردة، ثم تُصوَّر بمُنقّح الصفحة بالدقّة
 * المطلوبة — فمقاسات الشاشة (المنشور والستوري) تخرج ببكسلاتها تمامًا على ٩٦ نقطة، والمطبوع بـ٣٠٠. والشفّافة طبقةٌ بلا
 * ورقٍ أبيض (`layerCss`) وخلفيةُ النافذة نفسها شفّافة.
 */
import { withRenderWindow, type PageMm } from './render';
import { withDensity, withJpegDensity } from './pngDensity';

export type ImageFormat = 'png' | 'jpg';

export async function renderImage(sheetHtml: string, o: { page: PageMm; dpi: number; format: ImageFormat; transparent?: boolean }): Promise<Buffer> {
  const width = Math.round((o.page.w / 25.4) * 96);
  const height = Math.round((o.page.h / 25.4) * 96);
  // النسبة من البكسلات المطلوبة لا من الدقّة وحدها، فيخرج المقاس مضبوطًا.
  const scale = Math.round((o.page.w / 25.4) * o.dpi) / width;
  const transparent = Boolean(o.transparent) && o.format === 'png';

  return withRenderWindow(
    sheetHtml,
    async (win) => {
      const dbg = win.webContents.debugger;
      if (!dbg.isAttached()) dbg.attach('1.3');
      try {
        if (transparent) await dbg.sendCommand('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        const result = (await dbg.sendCommand('Page.captureScreenshot', {
          format: o.format === 'jpg' ? 'jpeg' : 'png',
          ...(o.format === 'jpg' ? { quality: 92 } : {}),
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale }
        })) as { data: string };
        const bytes = Buffer.from(result.data, 'base64');
        return o.format === 'png' ? withDensity(bytes, o.dpi) : withJpegDensity(bytes, o.dpi);
      } finally {
        dbg.detach();
      }
    },
    { width, height, page: o.page, layer: transparent }
  );
}
