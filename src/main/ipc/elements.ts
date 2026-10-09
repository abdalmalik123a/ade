/**
 * مكتبة العناصر (DESIGNS.md ٠٫٨): القائمة، والاستيراد (SVG يُعقَّم، وPNG يُفحص)، والحذف — والعمل في `services/elements.ts`.
 */
import { BrowserWindow, ipcMain } from 'electron';
import type { ElementImport, LibraryElement } from '@shared/design/elements';
import { getDb } from '../db';
import { importElements, listElements, removeElement } from '../services/elements';
import { pickOpenPaths } from './files';

export function registerElementIpc(): void {
  ipcMain.handle('elements:list', (): LibraryElement[] => listElements(getDb()));

  ipcMain.handle('elements:importFiles', async (e, category: unknown): Promise<ElementImport> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return { added: [], errors: [] };
    const paths = await pickOpenPaths(win, { title: 'استورد عناصر إلى مكتبة ديوان', buttonLabel: 'استورد', filterName: 'عناصر (SVG · PNG)', extensions: ['svg', 'png'] });
    return importElements(getDb(), paths, category);
  });

  ipcMain.handle('elements:remove', (_e, id: unknown): void => removeElement(getDb(), Number(id)));
}
