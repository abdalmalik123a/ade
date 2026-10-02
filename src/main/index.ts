import { join } from 'node:path';
import { app, BrowserWindow, protocol, net, dialog, ipcMain, screen } from 'electron';
import { pathToFileURL } from 'node:url';
import { getDb, closeDb, storeDir } from './db';
import { registerIpc } from './ipc';
import { autoBackupConfigured, runConfiguredAutoBackup } from './ipc/backup';
import { prepareDocuments } from './services/documents';
import { prepareSearch } from './services/searchIndex';
import { installMainErrorHandlers, logError } from './errorLog';
import { shutdownOcr } from './services/ocr';
import { closePortrait } from './services/portrait';
import { hardenSession, hardenWindow } from './harden';

// قبل كلّ شيء: خطأٌ في الإقلاع نفسه يُسجَّل لا يُبلع.
installMainErrorHandlers();

// المِقْود وحده (tools/drive.mjs): كاميرا مصنوعةٌ يرسمها Chromium — فيُختبر
// استوديو التصوير على التطبيق الحقيقي بلا كاميرا موصولة.
if (process.env['DIWAN_TEST_FAKE_CAMERA']) app.commandLine.appendSwitch('use-fake-device-for-media-stream');

// نسخةٌ واحدة من البرنامج (خطة Production، ١٫٤): نقرتان على الأيقونة كانتا تفتحان نسختين على
// القاعدة نفسها — نافذتان، وقائمة المعاملات المعلّقة تكتبها كلٌّ فوق الأخرى، ونسختان احتياطيتان
// عند الإغلاق. فالثانية تُظهر الأولى وتخرج. والقفل في مجلّد بيانات البرنامج، فملفّا تعريفٍ
// مختلفان (المِقْود) لا يتزاحمان.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

// مخطط مخصّص لعرض ملفات المخزن (الصور والمستمسكات) دون فتح file:// على كامل القرص.
protocol.registerSchemesAsPrivileged([
  { scheme: 'diwan', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

let mainWindow: BrowserWindow | null = null;

/** النافذة إلى الأمام: عند فتحها، وحين يُشغَّل البرنامج ثانيةً وهو مفتوح. */
function bringToFront(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(false);
}

app.on('second-instance', bringToFront);

/**
 * مقاس النافذة من شاشة الجهاز (خطة Production، ٣٫١): كانت ١٦٠٠×١٠٠٠ وحدّها الأدنى ١٢٨٠×٨٠٠ — أكبر
 * من شاشة حاسوبٍ محمول بـ١٣٦٦×٧٦٨، فيقع أسفلها تحت شريط المهامّ ولا يُصغَّر. فتأخذ مساحة العمل إن
 * ضاقت، وحدّها الأدنى ١٠٢٤×٦٤٠ (أو الشاشة إن كانت أصغر).
 */
function windowSize(): { width: number; height: number; minWidth: number; minHeight: number; fill: boolean } {
  const work = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1600, work.width);
  const height = Math.min(1000, work.height);
  return {
    width,
    height,
    minWidth: Math.min(1024, work.width),
    minHeight: Math.min(640, work.height),
    fill: width < 1600 || height < 1000
  };
}

function createWindow(): void {
  const size = windowSize();
  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#f8f9ff', // لون surface من توكنات التصميم
    title: 'ديوان — منظومة الكتب والتحارير',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // الواجهة في صندوقٍ بلا Node: الجسر (preload) وحده يكلّم العملية الرئيسة (خطة Production، ٦٫٤).
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  hardenWindow(mainWindow, 'main');

  // أوّل ظهورٍ وسط الشاشة — وعلى شاشةٍ أصغر من مقاسها تملؤها. والتشغيل الثاني يُظهرها حيث تركها الموظف.
  const firstShow = (): void => {
    mainWindow?.center();
    if (size.fill) mainWindow?.maximize();
    bringToFront();
  };

  mainWindow.once('ready-to-show', firstShow);
  firstShow();

  // الإغلاق على مرحلتين: تُفرغ الواجهة ما لم يُحفظ — مسودة المحرّر (خطة Production، ١٫٥) — ثم
  // تُؤخذ النسخة التلقائية إن كانت (تعميق الموجود ٢)، وتقول الواجهةُ ذلك فلا يظنّ الموظف أنّ
  // البرنامج علق. وما تعثّر يُسجَّل ويُقال عند الفتح التالي — ولا يمنع الإغلاق، والواجهة التي
  // لا تجيب لا تحبسه: بعد مهلةٍ يمضي.
  let closing = false;
  let closed = false;
  mainWindow.on('close', (e) => {
    if (closed) return;
    e.preventDefault();
    if (closing) return;
    closing = true;
    const backup = autoBackupConfigured();
    let went = false;
    const go = (): void => {
      if (went) return;
      went = true;
      clearTimeout(timer);
      ipcMain.removeListener('app:closeReady', go);
      // مهلةٌ لتُرسم «تُؤخذ النسخة» قبل أن تشغل النسخة العملية الرئيسة.
      setTimeout(
        () => {
          if (backup) {
            try {
              runConfiguredAutoBackup();
            } catch (err) {
              logError('autoBackup', err);
            }
          }
          closed = true;
          mainWindow?.close();
        },
        backup ? 250 : 0
      );
    };
    const timer = setTimeout(go, 3000);
    ipcMain.on('app:closeReady', go);
    mainWindow?.webContents.send('app:closing', { backup });
  });

  // تسجيل أخطاء الواجهة لسرعة التشخيص
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER ${level}] ${message} (${sourceId}:${line})`);
    // أخطاء الواجهة في سجلّ الأخطاء أيضًا — فعطلٌ يصفه الموظف يُرى بسياقه.
    if (level >= 3) logError('renderer', new Error(`${message} (${sourceId}:${line})`));
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // النسخة الثانية تخرج قبل أن تفتح القاعدة أو نافذة.
  if (!primary) return;
  hardenSession();

  // diwan://store/<relative-path> → ملف داخل مخزن التطبيق فقط
  protocol.handle('diwan', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'store') return new Response('not found', { status: 404 });
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel.includes('..')) return new Response('forbidden', { status: 403 });
    // رأس CORS: الواجهة تقرأ بكسلات الشعار لتستخرج لون الجهة، ولوحةٌ رُسمت عليها
    // صورةٌ من أصلٍ آخر بلا هذا الرأس تُقفَل فلا تُقرأ. والمخزن محلّيٌّ للقراءة وحدها.
    return net.fetch(pathToFileURL(join(storeDir(), rel)).toString()).then((res) => {
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, headers });
    });
  });

  // خطأ في القاعدة أو في تسجيل القنوات كان يترك التطبيق بلا نافذة وبلا خبر.
  try {
    getDb();
    registerIpc();
    // الفهارس تُطابَق جداولها (وتُبنى أوّل مرّة على قاعدة مكتبٍ قائمة). ولا تُسقط
    // الإقلاع إن تعذّرت: البحث يعود إلى المسح (services/searchIndex.ts).
    prepareDocuments(getDb());
    prepareSearch(getDb());
  } catch (e) {
    dialog.showErrorBox(
      'تعذّر تشغيل ديوان',
      `لم تُفتح قاعدة بيانات المكتب:

${e instanceof Error ? e.message : String(e)}`
    );
    app.quit();
    return;
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
  // عمّال القارئ الضوئي ونموذج الصور يُغلَقون بإغلاق البرنامج — لا يُتركون لنهاية العملية.
  void shutdownOcr();
  void closePortrait();
});
