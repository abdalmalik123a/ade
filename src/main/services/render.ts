import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { BrowserWindow, app } from 'electron';

/**
 * محرّك الإخراج: الطباعة وPDF.
 *
 * المبدأ: ما يُطبع هو علامات ورقة المعاينة نفسها، بأنماط التطبيق نفسها،
 * في نافذة مخفية بمقاس A4 — فلا تنشأ فجوة بين ما يراه الموظف وما يخرج من الطابعة.
 * لا يُفتح متصفح ولا قارئ PDF: كل شيء داخل التطبيق.
 */

/** ملفات CSS المبنية — تُحقن في نافذة الإخراج ليطابق المطبوع المعاينة. */
async function stylesheetLinks(): Promise<string> {
  if (process.env['ELECTRON_RENDERER_URL']) {
    // في التطوير الأنماط تُحقن عبر Vite؛ نحمّل وحدة الأنماط نفسها.
    return `<link rel="stylesheet" href="${process.env['ELECTRON_RENDERER_URL']}/src/styles.css">`;
  }
  const assets = join(app.getAppPath(), 'out', 'renderer', 'assets');
  const files = await readdir(assets);
  return files
    .filter((f) => f.endsWith('.css'))
    .map((f) => `<link rel="stylesheet" href="file://${join(assets, f).replace(/\\/g, '/')}">`)
    .join('\n');
}

function page(sheetHtml: string, styles: string): string {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
${styles}
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  /* الورقة بمقاسها الفيزيائي الحقيقي، بلا تكبير ولا ظلّ ولا حدود. */
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
</style>
</head>
<body><div class="print-root">${sheetHtml}</div></body>
</html>`;
}

async function withRenderWindow<T>(
  sheetHtml: string,
  work: (win: BrowserWindow) => Promise<T>
): Promise<T> {
  const styles = await stylesheetLinks();
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false, sandbox: true }
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(sheetHtml, styles)));
    // مهلة قصيرة ليكتمل تحميل الخطوط قبل الرسم — وإلا خرجت الورقة بخط بديل.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
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
};

export async function printSheet(req: PrintRequest): Promise<{ ok: boolean; reason?: string }> {
  return withRenderWindow(req.sheetHtml, (win) => {
    return new Promise((resolve) => {
      win.webContents.print(
        {
          silent: req.silent ?? false,
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
    });
  });
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
