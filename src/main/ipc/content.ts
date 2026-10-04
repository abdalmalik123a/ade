/**
 * حزمة المحتوى (خطة Production، ٤٫٣) — قنوات النظام. المنطق في services/contentPack.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { dataDir, getDb } from '../db';
import { exportContent, importContent } from '../services/contentPack';
import { logAudit } from '../services/documents';
import { isoDate } from '@shared/dates';
import type { BundledPackInfo, ContentCounts, ContentImportResult } from '@shared/api';
import { pickOpenPath, pickSavePath } from './files';

export function packsDir(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'packs'),
    join(app.getAppPath(), 'resources', 'packs'),
    join(app.getAppPath(), '..', 'resources', 'packs')
  ];
  return candidates.find((p) => existsSync(join(p, 'index.json'))) ?? candidates[1]!;
}

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

  ipcMain.handle('content:bundled', async (): Promise<BundledPackInfo[]> => {
    const dir = packsDir();
    const indexPath = join(dir, 'index.json');
    if (!existsSync(indexPath)) return [];
    let list: (Omit<BundledPackInfo, 'imported'> & { sampleUuid?: string })[] = [];
    try {
      list = JSON.parse(readFileSync(indexPath, 'utf8')) as typeof list;
    } catch {
      return [];
    }
    const db = getDb();
    const isImportedStmt = db.prepare(
      'SELECT 1 FROM templates WHERE uuid = ? UNION ALL SELECT 1 FROM clips WHERE uuid = ?'
    );
    return list.map(({ sampleUuid, ...p }) => {
      let imported = false;
      if (sampleUuid) {
        imported = Boolean(isImportedStmt.get(sampleUuid, sampleUuid));
      }
      return { ...p, imported };
    });
  });

  ipcMain.handle('content:importBundled', async (_e, id: string): Promise<ContentImportResult | null> => {
    if (typeof id !== 'string' || !/^[a-z0-9_-]+$/i.test(id)) throw new Error('معرف الحزمة غير صالح');
    const path = join(packsDir(), `${id}.diwanpack`);
    if (!existsSync(path)) throw new Error(`حزمة المحتوى «${id}» غير موجودة في مجلد الحزم`);
    const result = await importContent(path, getDb(), storeRoot(), join(dataDir(), 'restore-work'));
    const a = result.added;
    logAudit(getDb(), 'content', 'import', `أُضيف ${a.templates} نموذجًا، ${a.letterheads} ترويسة، ${a.clips} كليشة`);
    return { ...result, path };
  });
}
