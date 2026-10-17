/**
 * عملية Electron لـ`tools/pdfImage.mjs` (G30): ترسم صفحات PDF صورًا رمادية في نافذةٍ خفيّة وتقارنها بالمرجع.
 *
 * لا canvas في Node، فيشغّلها `pdfImage.mjs` بـ`electron.exe` ويعطيها ملفّ مهمّة في `DIWAN_PDF_JOB`:
 *   { pdf, refs: [مسارٌ أو null لكلّ صفحة], dpi, threshold, probe }
 * فتقرأ هي الملفّات وتعطي الصفحةَ بايتاتها — الصفحة معزولة (`sandbox`) لا تفتح مسارًا — وتكتب النتيجة JSON سطرًا
 * واحدًا على stdout ثم تخرج. وتخرج بـ١ ورسالةٍ على stderr إن تعذّر الرسم.
 */
import { app, BrowserWindow } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** مهلةٌ قصوى للمهمّة كلّها — ملفٌّ يعلّق الرسم لا يعلّق الفحص معه. */
const TIMEOUT_MS = 180_000;

const fail = (message) => {
  process.stderr.write(`✗ pdfImage: ${message}\n`);
  app.exit(1);
};

// الرسم بالمعالج لا بكرت الشاشة: تنعيم الحروف واحدٌ في كلّ تشغيل، فلا يتقلّب الفرق بين جهازٍ وآخر.
app.disableHardwareAcceleration();
// ملفّ تعريفٍ مؤقّت يمحوه `pdfImage.mjs` بعد الخروج — لا يُكتب في ملفّ «Electron» العامّ.
if (process.env.DIWAN_PDF_PROFILE) app.setPath('userData', process.env.DIWAN_PDF_PROFILE);

async function run() {
  const job = JSON.parse(readFileSync(process.env.DIWAN_PDF_JOB ?? '', 'utf8'));
  const input = {
    pdf: readFileSync(job.pdf).toString('base64'),
    refs: (job.refs ?? []).map((p) => (p && existsSync(p) ? readFileSync(p).toString('base64') : null)),
    dpi: job.dpi,
    threshold: job.threshold,
    probe: job.probe ?? []
  };

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  try {
    await win.loadURL(pathToFileURL(join(HERE, 'page.html')).href);
    const result = await win.webContents.executeJavaScript(`window.pdfImageReady.then((m) => m.run(${JSON.stringify(input)}))`);
    if (result?.error) throw new Error(result.error);
    process.stdout.write(`${JSON.stringify(result)}\n`, () => app.exit(0));
  } finally {
    win.destroy();
  }
}

// إغلاق النافذة لا يُنهي العملية قبل أن تُكتب النتيجة كلّها — الخروج بـ`app.exit` وحده.
app.on('window-all-closed', () => undefined);
app.whenReady().then(() => {
  setTimeout(() => fail(`لم ينتهِ الرسم في ${TIMEOUT_MS / 1000} ث`), TIMEOUT_MS).unref();
  run().catch((e) => fail(e?.message ?? String(e)));
});
