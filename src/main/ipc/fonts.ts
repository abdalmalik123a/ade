/**
 * «خطوط ديوان» (DESIGNS.md ٠٫٧): القائمة، والاستيراد من ملفٍّ ومن خطوط Windows، والحذف — والعمل في `services/fonts.ts`.
 */
import { BrowserWindow, ipcMain } from 'electron';
import type { FontImport, ImportedFace, WindowsFont } from '@shared/fonts';
import { getDb } from '../db';
import { importFaces, importWindowsFamily, listFaces, removeFamily, windowsFamilies } from '../services/fonts';
import { pickOpenPaths } from './files';

export function registerFontIpc(): void {
  ipcMain.handle('fonts:list', (): ImportedFace[] => listFaces(getDb()));

  ipcMain.handle('fonts:importFiles', async (e): Promise<FontImport> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return { added: [], errors: [] };
    const paths = await pickOpenPaths(win, { title: 'استورد خطًّا إلى خطوط ديوان', buttonLabel: 'استورد', filterName: 'خطوط (TTF · OTF · WOFF)', extensions: ['ttf', 'otf', 'woff'] });
    return importFaces(getDb(), paths, 'file');
  });

  ipcMain.handle('fonts:windows', (): WindowsFont[] => {
    const have = new Set(listFaces(getDb()).map((f) => f.family.toLowerCase()));
    return windowsFamilies().map((f) => ({ family: f.family, faces: f.faces.length, arabic: f.arabic, imported: have.has(f.family.toLowerCase()) }));
  });

  ipcMain.handle('fonts:importWindows', (_e, family: unknown): FontImport => importWindowsFamily(getDb(), String(family ?? '')));

  ipcMain.handle('fonts:remove', (_e, family: unknown): void => removeFamily(getDb(), String(family ?? '')));
}
