import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { fitCanvasText } from '@shared/canvasFit';

/**
 * محرّك الإخراج: الطباعة وPDF والصورة عالية الدقّة.
 *
 * المبدأ: ما يُطبع هو علامات ورقة المعاينة نفسها، بأنماط التطبيق نفسها وخطوطه،
 * في نافذة بمقاس A4 — فلا تنشأ فجوة بين ما يراه الموظف وما يخرج من الطابعة.
 *
 * ولذلك تُحمَّل صفحة التطبيق ذاتها (بعلامة mode=print فلا تُركَّب الواجهة)، ثم
 * تُحقن الورقة في جسمها. الطريق الأول — صفحة data: تربط ملف الأنماط — كان
 * يسقط صامتًا: المتصفّح يمنع مورد file:// داخل مستند data:، فكانت الورقة تخرج
 * بخطّ بديل بلا أنماط. أما هنا فالأصل واحد، فتعمل الأنماط والخطوط بلا حيلة.
 *
 * لا يُفتح متصفح ولا قارئ PDF: كل شيء داخل التطبيق.
 */

/** مقاس الورقة بالملّم — A4 عموديًّا ما لم يُذكر غيره. */
export type PageMm = { w: number; h: number };
const A4: PageMm = { w: 210, h: 297 };

/**
 * أنماط الورقة وقت الإخراج: مقاسها الفيزيائي بلا تكبير ولا ظلّ ولا حدود.
 *
 * والمقاس وسيط: الشهادة A4 أفقي، ولوحة الشرف A3. وكان مثبّتًا A4 عموديًّا،
 * فتخرج الشهادة الأفقية مقصوصةً نصفها خارج الورقة.
 */
function printCss(page: PageMm): string {
  return `
  @page { size: ${page.w}mm ${page.h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body > :not(.print-root) { display: none !important; }
  .print-root {
    width: ${page.w}mm;
    min-height: ${page.h}mm;
    margin: 0;
    background: #fff;
    transform: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .print-root * { box-shadow: none !important; }
  /* تكبير المعاينة يُنزع — إلا دوران عناصر اللوحة، فهو من التصميم لا من الشاشة. */
  .print-root *:not([data-canvas] *) { transform: none !important; }
`;
}

/** مقاس الطابعة: ما كان A4 باسمه، وغيره بالميكرون كما تطلبه Chromium. */
function pageSizeOf(page: PageMm): { landscape: boolean; pageSize: 'A4' | { width: number; height: number } } {
  const landscape = page.w > page.h;
  const long = Math.max(page.w, page.h);
  const short = Math.min(page.w, page.h);
  if (Math.abs(long - 297) < 1 && Math.abs(short - 210) < 1) return { landscape, pageSize: 'A4' };
  return { landscape, pageSize: { width: Math.round(short * 1000), height: Math.round(long * 1000) } };
}

async function withRenderWindow<T>(
  sheetHtml: string,
  work: (win: BrowserWindow) => Promise<T>,
  opts: {
    width?: number;
    height?: number;
    /** الرسم خارج الشاشة أسرع، لكن حوار الطباعة يحتاج نافذة نظام حقيقية. */
    offscreen?: boolean;
    parent?: BrowserWindow | null;
    page?: PageMm;
  } = {}
): Promise<T> {
  const page = opts.page ?? A4;
  const win = new BrowserWindow({
    show: false,
    width: opts.width,
    height: opts.height,
    useContentSize: true,
    parent: opts.parent ?? undefined,
    webPreferences: {
      offscreen: opts.offscreen ?? true,
      // لا preload ولا Node: الصفحة هنا ورقة تُرسم، لا واجهة تعمل.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    // صفحة التطبيق نفسها، بعلامة تمنع تركيب الواجهة — فتبقى الأنماط والخطوط.
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) await win.loadURL(`${devUrl}/index.html?mode=print`);
    else
      await win.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'print' } });

    await win.webContents.executeJavaScript(`
      (() => {
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(printCss(page))};
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.className = 'print-root';
        root.innerHTML = ${JSON.stringify(sheetHtml)};
        document.body.appendChild(root);
        // انتظار الخطوط قبل الرسم — وإلا خرجت الورقة بخطّ بديل. وبمهلة قصوى
        // كي لا يتعلّق الإصدار كلّه على خطّ لم يُحمَّل. ثم تُقاس الأسماء بخطّها
        // الحقيقي فتصغر ما يلزم لتسع — كما قيست في المعاينة.
        return Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 3000))
        ]).then(() => (${fitCanvasText.toString()})(root) >= 0);
      })()
    `);

    return await work(win);
  } finally {
    win.destroy();
  }
}

export type PrintRequest = {
  sheetHtml: string;
  deviceName?: string;
  copies?: number;
  silent?: boolean;
  /** النافذة التي يُعلَّق عليها حوار الطباعة. */
  parent?: BrowserWindow | null;
  /** مقاس الورقة بالملّم — A4 عموديًّا ما لم يُذكر. */
  page?: PageMm;
};

export async function printSheet(req: PrintRequest): Promise<{ ok: boolean; reason?: string }> {
  const silent = req.silent ?? false;
  const page = req.page ?? A4;
  const { landscape, pageSize } = pageSizeOf(page);
  return withRenderWindow(
    req.sheetHtml,
    (win) =>
      new Promise((resolve) => {
        win.webContents.print(
          {
            silent,
            printBackground: true,
            copies: req.copies ?? 1,
            deviceName: req.deviceName,
            pageSize,
            margins: { marginType: 'none' },
            landscape,
            scaleFactor: 100
          },
          (ok, reason) => resolve({ ok, reason })
        );
      }),
    // حوار النظام لا يظهر فوق نافذة مرسومة خارج الشاشة، فالطباعة غير الصامتة
    // تحتاج نافذة حقيقية مخفية معلَّقة على نافذة التطبيق.
    { offscreen: silent, parent: silent ? null : req.parent, page }
  );
}

/** PDF بمقاس الورقة الحقيقي وبالخلفيات (الشعار والعلامة المائية). */
export async function renderPdf(sheetHtml: string, page: PageMm = A4): Promise<Buffer> {
  const { landscape, pageSize } = pageSizeOf(page);
  return withRenderWindow(
    sheetHtml,
    (win) =>
      win.webContents.printToPDF({
        pageSize,
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        landscape,
        preferCSSPageSize: true
      }),
    { page }
  );
}

/** جدول CRC لترميز مقاطع PNG. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/**
 * يكتب الدقّة داخل الصورة نفسها (مقطع pHYs).
 *
 * صورة بمقاس 2480×3508 بلا هذا المقطع تُفتح في برامج الطباعة على أنها 96
 * نقطة/إنش فتُطبع بحجم أكبر من A4. الدقّة تُقاس بالمتر في المواصفة:
 * 300 نقطة/إنش = 11811 نقطة/متر.
 */
function withDensity(png: Buffer, dpi: number): Buffer {
  const perMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(perMetre, 0);
  data.writeUInt32BE(perMetre, 4);
  data[8] = 1; // الوحدة: المتر

  const type = Buffer.from('pHYs', 'ascii');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  const chunk = Buffer.alloc(21);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 17);

  // بعد IHDR مباشرةً: ثمانية بايتات توقيع + 25 بايت مقطع IHDR.
  const head = 8 + 25;
  if (png.indexOf('pHYs', head, 'ascii') > 0) return png; // لا يُكرَّر مقطع موجود
  return Buffer.concat([png.subarray(0, head), chunk, png.subarray(head)]);
}

/**
 * صورة الورقة بدقّة الطباعة الاحترافية — A4 عند 300 نقطة/إنش = 2480×3508.
 *
 * capturePage تصوّر ما تراه النافذة بمقاسها، فلا تتجاوز حدود الشاشة ولا تكبّر.
 * ولذلك يجري التصوير عبر مُنقِّح الصفحة: قصاصة بمقاس الورقة مضروبة في نسبة
 * الدقّتين، وcaptureBeyondViewport ليخرج ما تحت حافة النافذة أيضًا — فتُرسم
 * الصفحة من جديد بالمقاس الكبير، وتبقى الحروف حادّة لا ممطوطة.
 */
export async function renderPng(sheetHtml: string, dpi = 300, page: PageMm = A4): Promise<Buffer> {
  const width = Math.round((page.w / 25.4) * 96); // 794 لـA4 — الورقة بمقاسها على الشاشة
  const height = Math.round((page.h / 25.4) * 96); // 1123
  // النسبة تُشتقّ من البكسلات المطلوبة لا من الدقّة وحدها، فيخرج المقاس مضبوطًا.
  const scale = Math.round((page.w / 25.4) * dpi) / width;

  return withRenderWindow(
    sheetHtml,
    async (win) => {
      const dbg = win.webContents.debugger;
      if (!dbg.isAttached()) dbg.attach('1.3');
      try {
        const result = (await dbg.sendCommand('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale }
        })) as { data: string };
        return withDensity(Buffer.from(result.data, 'base64'), dpi);
      } finally {
        dbg.detach();
      }
    },
    { width, height, page }
  );
}
