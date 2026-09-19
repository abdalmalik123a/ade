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
import type { Canvas, CanvasSize } from '@shared/canvas';
import { canvasFromImport, readDesign, type DesignImport } from '../services/designImport';
import { readPsd } from '../services/psd';
import { writePng } from '../services/png';
import { storeDir } from '../db';
import { pickOpenPath } from './files';

const DESIGN_FILTERS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'docx', 'psd', 'pdf'];

/** ما تطلبه المطابع — وما دونه يُطبع ضبابيًّا، فيُنبَّه عليه. */
const PRINT_DPI = 300;
/** دونها لا تصلح خلفيةٌ للطباعة، فيُقال ذلك صراحةً. */
const SHARP_ENOUGH = 200;

async function store(bytes: Uint8Array, name: string): Promise<string> {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const file = `${hash}${extname(name).toLowerCase() || '.png'}`;
  await writeFile(join(storeDir('designs'), file), bytes);
  return `designs/${file}`;
}

/**
 * يأخذ صورة Photoshop المسطَّحة كما هي في الملف.
 *
 * ولا تُعاد الطبقات تركيبًا: PSD يحمل الصورة المسطَّحة في آخره، وهي بالضبط ما
 * نريد. وجُرِّبت `@webtoon/psd` فأعادت رماديًّا من ملفٍ بلا طبقات — كرّرت القناة
 * الأولى في الثلاث — فأُسقطت وقُرئ الملف عندنا (§`services/psd.ts`).
 */
function flattenPsd(bytes: Uint8Array): { png: Uint8Array | null; warnings: string[] } {
  const read = readPsd(bytes);
  if (!read?.rgba) return { png: null, warnings: read?.warnings ?? ['تعذّرت قراءة الملف'] };
  return {
    png: writePng(read.rgba, read.width, read.height, read.dpi ?? PRINT_DPI),
    warnings: read.warnings
  };
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

      const bytes = await readFile(path);
      const imported = readDesign(bytes, basename(path));
      const warnings = [...imported.warnings];

      // Photoshop وPDF: لا صورة في المستورَد، فتُسطَّح هنا.
      if (imported.source === 'psd') {
        const flat = flattenPsd(bytes);
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

      return {
        name: imported.name,
        source: imported.source,
        size: imported.size,
        dpi: imported.dpi,
        warnings,
        stored,
        canvas: canvasFromImport({ ...imported, warnings }, stored, fallback ?? undefined)
      };
    }
  );
}
