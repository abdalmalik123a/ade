import { join } from 'node:path';
import { app, BrowserWindow, protocol, net, dialog, ipcMain, screen } from 'electron';
import { pathToFileURL } from 'node:url';
import { getDb, closeDb, dataDir, storeDir } from './db';
import { sweepTransient } from './services/transient';
import { recoverIncompleteRestore } from './services/restoreSwap';
import { runBootSequence } from './services/dataVersion';
import { handleNewerDataRejection, rememberStartup } from './ipc/update';
import { createPreUpdateBackup } from './services/preUpdateBackup';
import { registerIpc } from './ipc';
import { autoBackupConfigured, runConfiguredAutoBackup } from './ipc/backup';
import { prepareDocuments } from './services/documents';
import { prepareSearch } from './services/searchIndex';
import { installMainErrorHandlers, logError } from './errorLog';
import { shutdownOcr } from './services/ocr';
import { closePortrait } from './services/portrait';
import { hardenSession, hardenWindow } from './harden';
import { rendererDevUrl } from './devUrl';
import { resolveStorePath } from './services/localPaths';
import { PALETTE } from '@shared/theme';

// قبل كلّ شيء: خطأٌ في الإقلاع نفسه يُسجَّل لا يُبلع.
installMainErrorHandlers();

// المِقْود وحده (tools/drive.mjs): كاميرا مصنوعةٌ يرسمها Chromium — فيُختبر
// استوديو التصوير على التطبيق الحقيقي بلا كاميرا موصولة.
if (__DIWAN_TEST_DOORS__ && process.env['DIWAN_TEST_FAKE_CAMERA']) app.commandLine.appendSwitch('use-fake-device-for-media-stream');

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

// `window.close()` من الواجهة يمرّ بما يمرّ به زرّ الإغلاق (preload): الحدث `close` وإغلاقه على مرحلتيه.
ipcMain.on('app:requestClose', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

/**
 * ما لم يُحفظ في الواجهة ولا تحرسه مسودّةٌ (ج١): تقول الواجهة اسم الشاشة (الترويسة، الأسئلة…)، فيسأل إغلاق النافذة
 * بنافذة ويندوز قبل أن يبدأ. وما تحرسه مسودّةٌ أو معلّقة (المحرّر، والشبّاك) لا تقوله — فلا يُسأل عنه.
 * وللمِقْود أجوبةٌ جاهزة (`DIWAN_TEST_CLOSE_ANSWER`: `stay,leave` — بالترتيب، وآخرها يتكرّر): حوار النظام لا يُضغط آليًّا.
 */
let unsavedLabel: string | null = null;
const closeAnswers = ((__DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_CLOSE_ANSWER'] : undefined) ?? '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);
ipcMain.on('app:unsaved', (e, label: unknown) => {
  if (!mainWindow || e.sender !== mainWindow.webContents) return;
  unsavedLabel = typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : null;
});

async function mayCloseWithUnsaved(label: string): Promise<boolean> {
  if (closeAnswers.length) return (closeAnswers.length > 1 ? closeAnswers.shift() : closeAnswers[0]) === 'leave';
  if (!mainWindow) return true;
  const answer = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'تعديلاتٌ لم تُحفظ',
    message: `في «${label}» تعديلاتٌ لم تُحفظ.`,
    detail: 'إن أُغلق ديوان الآن ضاعت.',
    buttons: ['ابقَ في ديوان', 'أغلق بلا حفظ'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return answer.response === 1;
}

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
    backgroundColor: PALETTE.background, // خلفية مساحة العمل — فلا يومض لونٌ آخر قبل الصفحة
    title: 'ديوان — منظومة الكتب والتحارير',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // الواجهة في صندوقٍ بلا Node: الجسر (preload) وحده يكلّم العملية الرئيسة (خطة Production، ٦٫٤).
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // أدوات المطوّر للتطوير وحده (`harden.ts`).
      devTools: !app.isPackaged
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
  /** وافق الموظف على ترك ما لم يُحفظ. */
  let leaveAgreed = false;
  mainWindow.on('close', (e) => {
    if (closed) return;
    e.preventDefault();
    if (closing) return;
    if (unsavedLabel !== null && !leaveAgreed) {
      // سؤالٌ واحد في وقته: إغلاقاتٌ أخرى أثناءه تُتجاهل، و«ابقَ» يُبقي النافذة حيث هي.
      closing = true;
      void mayCloseWithUnsaved(unsavedLabel).then((leave) => {
        closing = false;
        if (!leave) return;
        leaveAgreed = true;
        mainWindow?.close();
      });
      return;
    }
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

  // واجهةٌ أُعيد تحميلها أو سقطت عمليّتها لا تُبقي «ما لم يُحفظ» من جلستها: وإلا سأل الإغلاقُ عن شاشةٍ لم تعد.
  mainWindow.webContents.on('did-start-loading', () => {
    unsavedLabel = null;
  });
  mainWindow.webContents.on('render-process-gone', () => {
    unsavedLabel = null;
  });

  // تسجيل أخطاء الواجهة لسرعة التشخيص
  // بتوقيع Electron الجديد (البند ٢٩): التفاصيل في الحدث نفسه، والمستوى كلمةٌ لا رقم — والوسائط المنفصلة مهجورة.
  mainWindow.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    console.log(`[RENDERER ${level}] ${message} (${sourceId}:${lineNumber})`);
    // أخطاء الواجهة في سجلّ الأخطاء أيضًا — فعطلٌ يصفه الموظف يُرى بسياقه.
    if (level === 'error') logError('renderer', new Error(`${message} (${sourceId}:${lineNumber})`));
  });

  const devUrl = rendererDevUrl();
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // النسخة الثانية تخرج قبل أن تفتح القاعدة أو نافذة.
  if (!primary) return;
  hardenSession();

  // diwan://store/<relative-path> → ملف داخل مخزن التطبيق فقط
  protocol.handle('diwan', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'store') return new Response('not found', { status: 404 });
    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return new Response('forbidden', { status: 403 });
    }
    // محلولًا داخل المخزن (و٥): لا «..» ولا مسارٌ مطلق ولا مسار شبكة.
    const file = resolveStorePath(storeDir(), rel);
    if (!file) return new Response('forbidden', { status: 403 });
    // رأس CORS: الواجهة تقرأ بكسلات الشعار لتستخرج لون الجهة، ولوحةٌ رُسمت عليها
    // صورةٌ من أصلٍ آخر بلا هذا الرأس تُقفَل فلا تُقرأ. والمخزن محلّيٌّ للقراءة وحدها.
    return net.fetch(pathToFileURL(file).toString()).then((res) => {
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, headers });
    });
  });

  // خطأ في القاعدة أو في تسجيل القنوات كان يترك التطبيق بلا نافذة وبلا خبر.
  try {
    // استرجاعٌ تعثّر في الجلسة السابقة ولم تعد قاعدته إلى مكانها: تُعاد من مجلّد الأصل قبل أن يُفتح شيء —
    // فلا تُنشأ قاعدةٌ فارغة بدلها (مراجعة ٧ ت١).
    const recovery = recoverIncompleteRestore(dataDir());
    if (recovery.state === 'failed') {
      dialog.showErrorBox(
        'تعذّرت إعادة بيانات المكتب',
        `تعثّر استرجاعٌ سابق فلم تعد قاعدة بيانات المكتب إلى مكانها، وتعذّرت إعادتها الآن:\n\n${recovery.reason}\n\n` +
          `بياناتك الأصلية سليمةٌ في: ${recovery.aside ?? 'مجلّد «before-restore-…» داخل مجلّد بيانات ديوان'}\n` +
          'لم يُنشأ شيءٌ جديد حتى لا تُفتح قاعدةٌ فارغة. أغلق ديوان وأرسل هذه الرسالة إلى المطوّر.'
      );
      app.quit();
      return;
    }
    if (recovery.state === 'recovered') {
      logError('restore', new Error(`أُعيدت قاعدة المكتب من ${recovery.aside} بعد استرجاعٍ متعثّر`));
      if (!recovery.storeBack) {
        void dialog.showMessageBox({
          type: 'warning',
          title: 'عادت بيانات المكتب',
          message: 'عادت قاعدة بيانات المكتب بعد استرجاعٍ متعثّر، لكنّ مجلّد الملفّات (المستمسكات والصور) بقي جانبًا.',
          detail: `انقل المجلّد «store» من: ${recovery.aside}\nإلى مجلّد بيانات ديوان — أو أرسل هذه الرسالة إلى المطوّر.`,
          buttons: ['حسنًا'],
          noLink: true
        });
      }
    }
    // إصدارٌ أقدم لا يفتح بيانات أحدث، والترقيات تُنفّذ داخل معاملةٍ قبل تسجيل الإصدار (المرحلة A، ٤٫٤).
    const boot = runBootSequence({
      dbFile: join(dataDir(), 'diwan.db'),
      currentVersion: app.getVersion(),
      snapshotDir: join(dataDir(), 'before-update'),
      openDb: () => getDb(),
      migrations: [
        (db) => prepareDocuments(db),
        (db) => prepareSearch(db)
      ]
    });
    if (boot.kind === 'newer') {
      await handleNewerDataRejection({
        dataDir: dataDir(),
        currentVersion: app.getVersion(),
        guardFrom: boot.from
      });
      return;
    }
    if (boot.guard.kind === 'upgrade' && boot.guard.from) {
      try {
        await createPreUpdateBackup({ dataDir: dataDir(), currentVersion: boot.guard.from });
      } catch (err) {
        logError('preUpdateBackup', err);
      }
    }
    rememberStartup(boot.guard);
    // مسوح الهويّات العابرة وكتاباتٌ انقطعت: لا شيء من جلسةٍ سابقة قيد الاستعمال (مراجعة ٧ ت١).
    try {
      sweepTransient(storeDir());
    } catch {
      // الكنس لا يوقف الإقلاع.
    }
    registerIpc();
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
