import { ipcMain } from 'electron';
import { getDb } from '../db';
import * as svc from '../services/citizens';

export function registerCitizenIpc(): void {
  ipcMain.handle(
    'citizens:list',
    (_e, opts: { query?: string; category?: string | null; limit?: number }) =>
      svc.listCitizens(getDb(), opts)
  );
  ipcMain.handle('citizens:categories', () => svc.listCitizenCategories(getDb()));
  ipcMain.handle('citizens:stats', () => svc.citizenStats(getDb()));
  ipcMain.handle('citizens:get', (_e, id: number) => svc.getCitizen(getDb(), id));
}
