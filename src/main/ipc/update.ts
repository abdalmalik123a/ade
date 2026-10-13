/**
 * «ثبّت تحديثًا» و«ما الجديد» (خطة Production، ٧٫١) — قنوات النظام. التحقّق في services/update.ts.
 *
 * يُختار ملفّ التحديث، فيُتحقّق من توقيع المالك ورقم الإصدار قبل أن يُعرض «ما الجديد»؛ وبالموافقة يُفكّ
 * المثبّت وتُطابق بصمته ثم يُشغَّل ويُغلق البرنامج. والنسخة قبل الترحيل يأخذها الإقلاع الأوّل للإصدار
 * الجديد (services/dataVersion.ts) — قبل أن يُرحَّل شيء.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { dataDir } from '../db';
import { extractInstaller, readUpdate } from '../services/update';
import type { DataGuard } from '../services/dataVersion';
import { createPreUpdateBackup, findLatestPreUpdateBackup, rollbackToPreUpdateBackup } from '../services/preUpdateBackup';
import { ownerPublicKeys } from './license';
import { pickOpenPath } from './files';

let startup: DataGuard | null = null;
/** ما وجده الإقلاع: إن رُحّلت البيانات من إصدارٍ أقدم عُرض «ما الجديد» مرّةً. */
export function rememberStartup(guard: DataGuard): void {
  startup = guard;
}

const workDir = () => join(dataDir(), 'restore-work');

export function registerUpdateIpc(): void {
  ipcMain.handle('update:pick', async (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return null;
    const path = await pickOpenPath(w, { title: 'تحديث ديوان', buttonLabel: 'افحصه', filterName: 'تحديث ديوان', extensions: ['diwanupdate'] });
    if (!path) return null;
    const { manifest } = await readUpdate(path, ownerPublicKeys('update'), app.getVersion(), workDir());
    return { path, version: manifest.version, notes: manifest.notes, size: manifest.size, issued: manifest.issued, current: app.getVersion() };
  });

  ipcMain.handle('update:install', async (_e, path: string) => {
    // النسخ الاحتياطي الكامل من قاعدة البيانات ومخزن الملفات قبل تشغيل المثبّت
    await createPreUpdateBackup({ dataDir: dataDir(), currentVersion: app.getVersion() });

    const opened = await readUpdate(String(path), ownerPublicKeys('update'), app.getVersion(), workDir());
    const dir = join(app.getPath('temp'), 'diwan-update');
    mkdirSync(dir, { recursive: true });
    const installer = await extractInstaller(String(path), opened, join(dir, `diwan-${opened.manifest.version}-setup.exe`));
    // تحت المِقْود (غير المثبّت وحده): يُفكّ ويُتحقّق ولا يُشغَّل.
    if (__DIWAN_TEST_DOORS__ && !app?.isPackaged && process.env['DIWAN_TEST_UPDATE_NO_LAUNCH']) return { installer, launched: false };
    spawn(installer, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    // المثبّت يستبدل البرنامج — فيُغلق بعد أن يصل الجواب، والإغلاق يأخذ نسخته التلقائية كعادته.
    setTimeout(() => app.quit(), 600);
    return { installer, launched: true };
  });

  ipcMain.handle('app:whatsNew', () =>
    startup?.kind === 'upgrade' && startup.from ? { from: startup.from, to: app.getVersion() } : null
  );
}

/**
 * التعامل مع رفض البيانات الأحدث وزر التراجع إلى بيانات ما قبل التحديث
 */
export async function handleNewerDataRejection(opts: {
  dataDir: string;
  currentVersion: string;
  guardFrom: string;
}): Promise<void> {
  const validBackup = findLatestPreUpdateBackup(opts.dataDir, opts.currentVersion);
  if (!validBackup) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'بيانات المكتب من إصدارٍ أحدث',
      message: `بيانات هذا الجهاز فتحها «ديوان ${opts.guardFrom}»، وهذا البرنامج ${opts.currentVersion} — أقدم منه.\n\n` +
        'لا تُفتح حتى لا يُفسدها إصدارٌ لا يعرف ما أُضيف إليها. ثبّت الإصدار الأحدث (أو الأحدث منه) ثم افتحها.',
      detail: 'لم يُعثر على نسخة احتياطية صالحة سابقة للتحديث يمكن التراجع إليها.',
      buttons: ['أغلق ديوان'],
      defaultId: 0,
      noLink: true
    });
    app.quit();
    return;
  }

  const choice = await dialog.showMessageBox({
    type: 'warning',
    title: 'بيانات المكتب من إصدارٍ أحدث',
    message: `بيانات هذا الجهاز فتحها «ديوان ${opts.guardFrom}»، وهذا البرنامج ${opts.currentVersion} — أقدم منه.\n\n` +
      'لا تُفتح حتى لا يُفسدها إصدارٌ لا يعرف ما أُضيف إليها.',
    detail:
      `تتوفر نسخة احتياطية صالحة من ديوان ${validBackup.version} مأخوذة قبل التحديث.\n` +
      'يمكنك التراجع إلى بيانات ما قبل التحديث لتشغيل هذا الإصدار على البيانات السابقة.',
    buttons: ['أغلق ديوان', 'ارجع إلى بيانات ما قبل التحديث'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });

  const wantsRollback = choice.response === 1 || (__DIWAN_TEST_DOORS__ && process.env['DIWAN_TEST_ROLLBACK_ACTION'] === 'rollback');
  if (!wantsRollback) {
    app.quit();
    return;
  }

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    title: 'تأكيد التراجع إلى بيانات ما قبل التحديث',
    message: `هل تريد بالتأكيد التراجع إلى بيانات ما قبل التحديث (ديوان ${validBackup.version})؟`,
    detail:
      `تنبيه: البيانات الحالية (من ديوان ${opts.guardFrom}) لن تُحذف؛ بل ستُنقل جانبًا وتُحفظ في مجلد مستقل حتى لا تفقد أي تعديلات تمت بعد التحديث.\n\n` +
      'هل تريد المتابعة واسترجاع بيانات ما قبل التحديث؟',
    buttons: ['إلغاء', 'نعم، انقل البيانات الحالية وتراجع'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });

  const confirmed = confirm.response === 1 || (__DIWAN_TEST_DOORS__ && process.env['DIWAN_TEST_ROLLBACK_ACTION'] === 'rollback');
  if (!confirmed) {
    app.quit();
    return;
  }

  try {
    const res = rollbackToPreUpdateBackup({
      dataDir: opts.dataDir,
      backupDir: validBackup.dir
    });
    await dialog.showMessageBox({
      type: 'info',
      title: 'تم التراجع بنجاح',
      message: `تم التراجع بنجاح إلى بيانات ما قبل التحديث (ديوان ${res.restoredVersion}).`,
      detail: `نُقلت البيانات الأحدث جانبًا إلى:\n${res.asideDir}\n\nسيُعاد تشغيل ديوان الآن.`,
      buttons: ['حسنًا'],
      defaultId: 0,
      noLink: true
    });
    app.relaunch();
    app.exit(0);
  } catch (err) {
    dialog.showErrorBox(
      'تعذّر التراجع إلى بيانات ما قبل التحديث',
      `حدث خطأ أثناء محاولة التراجع:\n\n${err instanceof Error ? err.message : String(err)}\n\n` +
        'بقيت بياناتك كما كانت. أغلق ديوان وأرسل هذه الرسالة إلى المطوّر.'
    );
    app.quit();
  }
}

