/**
 * مفتاح بيانات المكتب في الإقلاع (D237): بعد أن يُحلّ مجلّد البيانات وقبل أن يُفتح منه شيء.
 *
 * - لا `keys.json` والبيانات غير مشفّرة: يُنشأ المفتاح ورمزه، ويُعرض الرمز في البرنامج حتى يقرّ المكتب بحفظه.
 * - حماية ويندوز تفتحه: يمضي الإقلاع بلا سؤال.
 * - لا تفتحه (ويندوز أُعيد تنصيبه أو حسابٌ آخر): نافذةٌ صغيرة تطلب رمز الاسترداد **قبل** القاعدة، ولا يُكتب شيءٌ قبله.
 * - مفقودٌ والبيانات مشفّرة: رسالةٌ صريحة وإغلاق — لا مفتاحٌ جديد يجعل القديم لا يُقرأ.
 *
 * وتحت المِقْود (`DIWAN_TEST_DPAPI_FAIL`): حماية ويندوز لا تفكّ شيئًا، كأنّ الحساب غير الحساب.
 */
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { text } from '@shared/bridgeGuards';
import { dataDir } from './db';
import { rendererDevUrl } from './devUrl';
import { logError } from './errorLog';
import { hardenWindow } from './harden';
import { handleChecked } from './ipc/checked';
import { KeyMissingError, createKey, hasKeys, rememberKey, unlockWithCode, unlockWithProtector, type Protector } from './services/dataKey';

/** حماية ويندوز (DPAPI) بـ`safeStorage`. */
export function windowsProtector(): Protector {
  const fail = __DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_DPAPI_FAIL'] : undefined;
  return {
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (data) => {
      if (fail) throw new Error('حماية ويندوز لا تفكّ (المِقْود)');
      return safeStorage.decryptString(data);
    }
  };
}

/** نافذة رمز الاسترداد: تبقى حتى يُفتح المفتاح أو يغلقها المكتب (`null`). وبعد الفتح تختفي وتُهدم حين تُنشأ نافذة البرنامج. */
function askRecoveryCode(dir: string, protector: Protector): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let unlocked: Buffer | null = null;
    const win = new BrowserWindow({
      width: 480,
      height: 460,
      resizable: false,
      autoHideMenuBar: true,
      title: 'فتح بيانات المكتب',
      backgroundColor: '#f8f9ff',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        devTools: !app.isPackaged
      }
    });
    hardenWindow(win, 'unlock');
    handleChecked('dataKey:unlock', { code: text(64) }, ({ code }) => {
      try {
        unlocked = unlockWithCode(dir, code, protector);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      ipcMain.removeHandler('dataKey:unlock');
      // تختفي ولا تُغلق: إغلاق آخر نافذةٍ يُغلق البرنامج قبل أن تُنشأ نافذته.
      win.hide();
      app.once('browser-window-created', () => setImmediate(() => !win.isDestroyed() && win.destroy()));
      resolve(unlocked);
      return { ok: true };
    });
    win.on('closed', () => {
      ipcMain.removeHandler('dataKey:unlock');
      if (!unlocked) resolve(null);
    });
    const devUrl = rendererDevUrl();
    void (devUrl ? win.loadURL(`${devUrl}/index.html?mode=unlock`) : win.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'unlock' } }));
  });
}

/** يفتح مفتاح المكتب لهذه الجلسة — و`false`: أغلق ديوان. */
export async function ensureDataKey(): Promise<boolean> {
  const dir = dataDir();
  if (!safeStorage.isEncryptionAvailable()) {
    // نادرٌ في ويندوز: يمضي بلا مفتاح، ولا يُشفَّر شيءٌ حتى تتاح (D238 يتحقّق).
    logError('dataKey', new Error('حماية ويندوز غير متاحة — لا مفتاح في هذه الجلسة'));
    rememberKey(null);
    return true;
  }
  const protector = windowsProtector();
  try {
    if (!hasKeys(dir)) {
      rememberKey(createKey(dir, protector).key);
      return true;
    }
    const key = unlockWithProtector(dir, protector);
    if (key) {
      rememberKey(key);
      return true;
    }
  } catch (e) {
    if (!(e instanceof KeyMissingError)) throw e;
    logError('dataKey', e);
    dialog.showErrorBox(
      'مفتاح بيانات المكتب مفقود',
      `${e.message}.\n\nلا تحذف شيئًا من مجلّد البيانات (${dir})، وأرسل هذه الرسالة إلى المطوّر.`
    );
    return false;
  }
  const key = await askRecoveryCode(dir, protector);
  if (!key) return false;
  rememberKey(key);
  return true;
}
