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
import { app, BrowserWindow, ipcMain } from 'electron';
import { dataDir } from '../db';
import { extractInstaller, readUpdate } from '../services/update';
import type { DataGuard } from '../services/dataVersion';
import { ownerPublicKey } from './license';
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
    const { manifest } = await readUpdate(path, ownerPublicKey(), app.getVersion(), workDir());
    return { path, version: manifest.version, notes: manifest.notes, size: manifest.size, issued: manifest.issued, current: app.getVersion() };
  });

  ipcMain.handle('update:install', async (_e, path: string) => {
    const opened = await readUpdate(String(path), ownerPublicKey(), app.getVersion(), workDir());
    const dir = join(app.getPath('temp'), 'diwan-update');
    mkdirSync(dir, { recursive: true });
    const installer = await extractInstaller(String(path), opened, join(dir, `diwan-${opened.manifest.version}-setup.exe`));
    // تحت المِقْود (غير المثبّت وحده): يُفكّ ويُتحقّق ولا يُشغَّل.
    if (!app.isPackaged && process.env['DIWAN_TEST_UPDATE_NO_LAUNCH']) return { installer, launched: false };
    spawn(installer, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    // المثبّت يستبدل البرنامج — فيُغلق بعد أن يصل الجواب، والإغلاق يأخذ نسخته التلقائية كعادته.
    setTimeout(() => app.quit(), 600);
    return { installer, launched: true };
  });

  ipcMain.handle('app:whatsNew', () =>
    startup?.kind === 'upgrade' && startup.from ? { from: startup.from, to: app.getVersion() } : null
  );
}
