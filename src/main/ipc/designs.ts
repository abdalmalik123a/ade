/**
 * استيراد التصاميم — الباب الذي تدخل منه ملفات المكتب.
 *
 * كلُّ مسارٍ يعطي شيئين: **مقاسًا بالملّم** من الملف نفسه، **وخلفيةً** تُرسم
 * تحت الحقول. والصورة تعطيهما معًا؛ وWord يعطي المقاس ومواضعَ مربّعاته؛
 * وPhotoshop وPDF يعطيان المقاس، وتُسطَّح صفحتهما صورةً هنا.
 *
 * ولا شيء يُخمَّن: ما سكت ملفُّه عن مقاسه يعود بـ`size: null`، فتفتح الشاشة
 * خانة المقاس وتقول لماذا.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { PRINT_DPI, type Canvas, type CanvasSize } from '@shared/canvas';
import { canvasFromImport, layerSuggestions, readDesign, type DesignImport } from '../services/designImport';
import type { FieldSuggestion } from '@shared/api';
import { assertPixels, assertSize, designKind } from '../services/importGuard';
import { flattenPsd } from '../services/design/flatten';
import { workerHost } from '../services/workerHost';
import { getDb, storeDir } from '../db';
import { libraryFonts } from '@shared/fonts';
import { listFaces } from '../services/fonts';
import { pickOpenPath } from './files';
import { renderImage, type ImageFormat } from '../services/renderImage';
import { safeName, saveAs } from './documents';

const DESIGN_FILTERS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'docx', 'psd', 'pdf'];

/** دونها لا تصلح خلفيةٌ للطباعة، فيُقال ذلك صراحةً. */
const SHARP_ENOUGH = 200;

async function store(bytes: Uint8Array, name: string): Promise<string> {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const file = `${hash}${extname(name).toLowerCase() || '.png'}`;
  await writeFile(join(storeDir('designs'), file), bytes);
  return `designs/${file}`;
}

/**
 * يرسم صفحة PDF الأولى صورةً — بالدقّة التي تُتاح فعلًا، ويقولها.
 *
 * وعارضُ Chromium مبنيٌّ في Electron فلا تلزم مكتبة، لكنّه يرسم في نافذة،
 * **والنافذة محدودةٌ بالشاشة**. فطلبُ A4 عند ٣٠٠ نقطة/إنش (٢٤٨٠×٣٥٠٨) يُقصّ
 * على شاشةٍ أصغر، فتخرج صفحةٌ ناقصة الأسفل — وهو ما وقع أول مرّة.
 *
 * فالنافذة تُقاس على مساحة العمل مع حفظ النسبة، **وتُحسب الدقّة الناتجة من
 * البكسلات المُلتقَطة لا من أمنيتنا**، وتُعاد مع الصورة. فإن قصُرت عن الطباعة
 * عرف المكتب ولم يُفاجأ بخلفيةٍ ضبابية على ثلاثين ورقة.
 */
async function rasterPdf(
  path: string,
  size: CanvasSize
): Promise<{ png: Uint8Array; dpi: number } | null> {
  const work = screen.getPrimaryDisplay().workAreaSize;
  // أكبرُ نافذةٍ تسع الشاشة بنسبة الصفحة، وسقفُها ٣٠٠ نقطة/إنش فلا فائدة فوقها.
  const scale = Math.min(
    (work.width - 40) / ((size.w / 25.4) * PRINT_DPI),
    (work.height - 80) / ((size.h / 25.4) * PRINT_DPI),
    1
  );
  const width = Math.max(320, Math.round((size.w / 25.4) * PRINT_DPI * scale));
  const height = Math.max(320, Math.round((size.h / 25.4) * PRINT_DPI * scale));

  const win = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: { plugins: true, sandbox: true, contextIsolation: true, nodeIntegration: false }
  });

  try {
    await win.loadURL(`file://${path.replace(/\\/g, '/')}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`);
    // العارض يرسم بعد التحميل بقليل؛ ومهلةٌ قصوى كي لا يتعلّق الاستيراد.
    await new Promise((r) => setTimeout(r, 1500));
    const image = await win.webContents.capturePage();
    const { width: gotW } = image.getSize();
    const png = image.toPNG();
    if (png.length <= 1024 || gotW <= 0) return null;
    // الدقّة من البكسلات التي خرجت فعلًا — لا من التي طُلبت.
    return { png, dpi: Math.round((gotW / size.w) * 25.4) };
  } catch {
    return null;
  } finally {
    win.destroy();
  }
}

export type DesignImportResult = {
  name: string;
  source: DesignImport['source'];
  size: CanvasSize | null;
  dpi: number | null;
  warnings: string[];
  /** لوحةٌ جاهزة — أو `null` حين يسكت الملف عن مقاسه فيُسأل المكتب. */
  canvas: Canvas | null;
  /** ما خُزّن من صور، بترتيب `images` — لبناء اللوحة بعد اختيار المقاس. */
  stored: string[];
  fieldSuggestions: FieldSuggestion[];
};

export function registerDesignIpc(): void {
  ipcMain.handle(
    'designs:import',
    async (e, fallback: CanvasSize | null): Promise<DesignImportResult | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;

      const path = await pickOpenPath(win, {
        title: 'استورد تصميمًا',
        buttonLabel: 'افتح',
        filterName: 'تصاميم (صورة · Word · Photoshop · PDF)',
        extensions: DESIGN_FILTERS
      });
      if (!path) return null;

      // أكبر من حدّه يُرفض قبل أن يُقرأ، وأكثر من حدّه نقاطًا قبل أن يُفكّ (D51).
      const kind = designKind(path);
      await assertSize(path, kind);
      // «خطوط ديوان» كلّها — فخطٌّ أضافه المكتب يُطابَق في Photoshop (DESIGNS.md ١٫٥).
      const fonts = libraryFonts(listFaces(getDb())).map((f) => f.family);
      // القراءة والتسطيح في العامل المستقلّ (A03، D56) فلا تتجمّد الرئيسة — والطريق القديم هنا بديلٌ بعد سقوطين (ر141).
      const read = await workerHost().runOr('readDesign', { path, name: basename(path), fonts }, async () => {
        const bytes = await readFile(path);
        assertPixels(bytes, kind);
        const imported = readDesign(bytes, basename(path), fonts);
        return { imported, flat: imported.source === 'psd' && !imported.images.length ? flattenPsd(bytes) : null };
      });
      // ونوع ما قرأه العامل هو `DesignImport` (العقد في المشترك لا يرى الرئيسة — `@shared/worker`).
      const imported = read.imported as DesignImport;
      const warnings = [...imported.warnings];

      // Photoshop يأتي بخلفيته ممحوّةً منها العناصر؛ وإن تعذّرت سُطّح هنا كما هو.
      // وPDF لا صورة فيه، فتُرسم صفحته.
      if (imported.source === 'psd' && !imported.images.length && read.flat) {
        const flat = read.flat;
        warnings.push(...flat.warnings);
        if (flat.png) imported.images.unshift({ name: `${basename(path, '.psd')}.png`, bytes: flat.png });
        else warnings.push('تعذّر تسطيح الملف — أُخذ مقاسه بلا خلفية');
      } else if (imported.source === 'pdf' && imported.size) {
        const flat = await rasterPdf(path, imported.size);
        if (flat) {
          imported.images.unshift({ name: `${basename(path, '.pdf')}.png`, bytes: flat.png });
          imported.dpi = flat.dpi;
          if (flat.dpi < SHARP_ENOUGH) {
            warnings.push(
              `رُسمت الصفحة بدقّة ${flat.dpi} نقطة/إنش — للطباعة الحادّة صدّرها صورةً ٣٠٠ من برنامجك`
            );
          }
        } else {
          warnings.push('تعذّر رسم صفحة الملف — أُخذ مقاسه بلا خلفية');
        }
      }

      const stored: string[] = [];
      for (const image of imported.images) stored.push(await store(image.bytes, image.name));

      const canvas = canvasFromImport({ ...imported, warnings }, stored, fallback ?? undefined);
      return {
        name: imported.name,
        source: imported.source,
        size: imported.size,
        dpi: imported.dpi,
        warnings,
        stored,
        canvas,
        fieldSuggestions: layerSuggestions(imported, canvas)
      };
    }
  );

  /** التصميم صورةً (DESIGNS.md ١٫٨): PNG أو JPG أو PNG شفّافة — بمقاسه وبالدقّة التي يطلبها (٩٦ للشاشة، ٣٠٠ للطباعة). */
  ipcMain.handle(
    'output:saveImage',
    async (e, p: { sheetHtml: string; suggestedName: string; page: { w: number; h: number }; dpi: number; format: ImageFormat; transparent?: boolean }): Promise<string | null> => {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (!w) return null;
      const format: ImageFormat = p.format === 'jpg' ? 'jpg' : 'png';
      const dpi = Math.min(600, Math.max(72, Number(p.dpi) || 300));
      const bytes = await renderImage(p.sheetHtml, { page: p.page, dpi, format, transparent: p.transparent === true });
      return saveAs(w, bytes, `${safeName(p.suggestedName)}.${format}`, format === 'jpg' ? 'صورة JPG' : 'صورة PNG', format);
    }
  );
}
