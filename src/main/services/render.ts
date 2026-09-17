import { join } from 'node:path';
import { BrowserWindow } from 'electron';

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

/** أنماط الورقة وقت الإخراج: مقاسها الفيزيائي بلا تكبير ولا ظلّ ولا حدود. */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body > :not(.print-root) { display: none !important; }
  .print-root {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    background: #fff;
    transform: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .print-root * { transform: none !important; box-shadow: none !important; }
`;

async function withRenderWindow<T>(
  sheetHtml: string,
  work: (win: BrowserWindow) => Promise<T>,
  opts: {
    width?: number;
    height?: number;
    /** الرسم خارج الشاشة أسرع، لكن حوار الطباعة يحتاج نافذة نظام حقيقية. */
    offscreen?: boolean;
    parent?: BrowserWindow | null;
  } = {}
): Promise<T> {
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
        style.textContent = ${JSON.stringify(PRINT_CSS)};
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.className = 'print-root';
        root.innerHTML = ${JSON.stringify(sheetHtml)};
        document.body.appendChild(root);
        // انتظار الخطوط قبل الرسم — وإلا خرجت الورقة بخطّ بديل. وبمهلة قصوى
        // كي لا يتعلّق الإصدار كلّه على خطّ لم يُحمَّل.
        return Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 3000))
        ]).then(() => true);
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
};

export async function printSheet(req: PrintRequest): Promise<{ ok: boolean; reason?: string }> {
  const silent = req.silent ?? false;
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
            pageSize: 'A4',
            margins: { marginType: 'none' },
            landscape: false,
            scaleFactor: 100
          },
          (ok, reason) => resolve({ ok, reason })
        );
      }),
    // حوار النظام لا يظهر فوق نافذة مرسومة خارج الشاشة، فالطباعة غير الصامتة
    // تحتاج نافذة حقيقية مخفية معلَّقة على نافذة التطبيق.
    { offscreen: silent, parent: silent ? null : req.parent }
  );
}

/** PDF بمقاس A4 الحقيقي وبالخلفيات (الأختام والعلامة المائية). */
export async function renderPdf(sheetHtml: string): Promise<Buffer> {
  return withRenderWindow(sheetHtml, (win) =>
    win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      landscape: false,
      preferCSSPageSize: true
    })
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
export async function renderPng(sheetHtml: string, dpi = 300): Promise<Buffer> {
  const width = Math.round((210 / 25.4) * 96); // 794 — الورقة بمقاسها على الشاشة
  const height = Math.round((297 / 25.4) * 96); // 1123
  // النسبة تُشتقّ من البكسلات المطلوبة لا من الدقّة وحدها، فيخرج المقاس مضبوطًا.
  const scale = Math.round((210 / 25.4) * dpi) / width;

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
    { width, height }
  );
}
