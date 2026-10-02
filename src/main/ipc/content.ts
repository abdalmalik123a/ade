/**
 * حزمة المحتوى (خطة Production، ٤٫٣) — قنوات النظام. المنطق في services/contentPack.ts.
 */
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { dataDir, getDb } from '../db';
import { exportContent, importContent } from '../services/contentPack';
import { logAudit } from '../services/documents';
import { isoDate } from '@shared/dates';
import type { ContentCounts, ContentImportResult } from '@shared/api';
import { pickOpenPath, pickSavePath } from './files';

export function registerContentIpc(): void {
  const win = (e: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender);
  const storeRoot = () => join(dataDir(), 'store');

  ipcMain.handle('content:export', async (e): Promise<(ContentCounts & { path: string }) | null> => {
    const w = win(e);
    if (!w) return null;
    const path = await pickSavePath(w, {
      title: 'حزمة المحتوى — النماذج والترويسات والكليشات',
      defaultName: `diwan-content-${isoDate(new Date())}.diwanpack`,
      filterName: 'حزمة محتوى ديوان',
      ext: 'diwanpack'
    });
    if (!path) return null;
    const counts = await exportContent(path, getDb(), storeRoot(), app.getVersion());
    logAudit(getDb(), 'content', 'export', `${counts.templates} نموذجًا، ${counts.letterheads} ترويسة، ${counts.clips} كليشة`);
    return { ...counts, path };
  });

  ipcMain.handle('content:import', async (e): Promise<ContentImportResult | null> => {
    const w = win(e);
    if (!w) return null;
    const path = await pickOpenPath(w, {
      title: 'استيراد حزمة محتوى',
      buttonLabel: 'استوردها',
      filterName: 'حزمة محتوى ديوان',
      extensions: ['diwanpack']
    });
    if (!path) return null;
    const result = await importContent(path, getDb(), storeRoot(), join(dataDir(), 'restore-work'));
    const a = result.added;
    logAudit(getDb(), 'content', 'import', `أُضيف ${a.templates} نموذجًا، ${a.letterheads} ترويسة، ${a.clips} كليشة`);
    return { ...result, path };
  });
}
