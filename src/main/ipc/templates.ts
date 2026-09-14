import { ipcMain } from 'electron';
import { getDb } from '../db';
import * as svc from '../services/templates';

export function registerTemplateIpc(): void {
  ipcMain.handle('templates:list', (_e, category: string | null) =>
    svc.listTemplates(getDb(), category)
  );
  ipcMain.handle('templates:categories', () => svc.listCategories(getDb()));
  ipcMain.handle('templates:stats', () => svc.templateStats(getDb()));
  ipcMain.handle('templates:delete', (_e, id: number) => svc.deleteTemplate(getDb(), id));
}
