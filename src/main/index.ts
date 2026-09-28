import { join } from 'node:path';
import { app, BrowserWindow, shell, protocol, net, dialog } from 'electron';
import { pathToFileURL } from 'node:url';
import { getDb, closeDb, storeDir } from './db';
import { registerIpc } from './ipc';
import { autoBackupConfigured, runConfiguredAutoBackup } from './ipc/backup';
import { prepareDocuments } from './services/documents';
import { prepareSearch } from './services/searchIndex';
import { installMainErrorHandlers, logError } from './errorLog';

// قبل كلّ شيء: خطأٌ في الإقلاع نفسه يُسجَّل لا يُبلع.
installMainErrorHandlers();

// المِقْود وحده (tools/drive.mjs): كاميرا مصنوعةٌ يرسمها Chromium — فيُختبر
// استوديو التصوير على التطبيق الحقيقي بلا كاميرا موصولة.
if (process.env['DIWAN_TEST_FAKE_CAMERA']) app.commandLine.appendSwitch('use-fake-device-for-media-stream');

// مخطط مخصّص لعرض ملفات المخزن (الصور والمستمسكات) دون فتح file:// على كامل القرص.
protocol.registerSchemesAsPrivileged([
  { scheme: 'diwan', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#f8f9ff', // لون surface من توكنات التصميم
    title: 'ديوان — منظومة الكتب والتحارير',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  const bringToFront = (): void => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.center();
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
  };

  mainWindow.once('ready-to-show', bringToFront);
  bringToFront();

  // النسخة التلقائية عند الإغلاق (تعميق الموجود ٢): تُؤخذ قبل أن تُغلق النافذة، وتقول
  // الواجهةُ ذلك فلا يظنّ الموظف أنّ البرنامج علق. وما تعثّر يُسجَّل ويُقال عند الفتح التالي
  // — ولا يمنع الإغلاق.
  let backingUp = false;
  let backedUp = false;
  mainWindow.on('close', (e) => {
    if (backedUp || !autoBackupConfigured()) return;
    e.preventDefault();
    if (backingUp) return;
    backingUp = true;
    mainWindow?.webContents.send('app:closing');
    // مهلةٌ لتصل الرسالة وتُرسم قبل أن تشغل النسخة العملية الرئيسة.
    setTimeout(() => {
      try {
        runConfiguredAutoBackup();
      } catch (err) {
        logError('autoBackup', err);
      }
      backedUp = true;
      mainWindow?.close();
    }, 250);
  });

  // تسجيل أخطاء الواجهة لسرعة التشخيص
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER ${level}] ${message} (${sourceId}:${line})`);
    // أخطاء الواجهة في سجلّ الأخطاء أيضًا — فعطلٌ يصفه الموظف يُرى بسياقه.
    if (level >= 3) logError('renderer', new Error(`${message} (${sourceId}:${line})`));
  });

  // أي رابط خارجي يُفتح في المتصفح، لا داخل نافذة التطبيق.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
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

app.on('before-quit', closeDb);
