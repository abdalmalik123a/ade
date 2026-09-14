import { ipcMain } from 'electron';
import { getDb } from '../db';
import * as svc from '../services/letterheads';
import type { LetterheadLayout } from '@shared/letterhead';

/** الطبقة رقيقة عمدًا: المنطق كله في services/letterheads.ts ليبقى قابلًا للاختبار. */
export function registerLetterheadIpc(): void {
  ipcMain.handle('letterheads:list', () => svc.listLetterheads(getDb()));
  ipcMain.handle('letterheads:get', (_e, id: number) => svc.getLetterhead(getDb(), id));
  ipcMain.handle(
    'letterheads:save',
    (
      _e,
      input: { id: number | null; name: string; authorityId: number | null; layout: LetterheadLayout }
    ) => svc.saveLetterhead(getDb(), input)
  );
  ipcMain.handle('letterheads:setDefault', (_e, id: number) => svc.setDefaultLetterhead(getDb(), id));
  ipcMain.handle('letterheads:delete', (_e, id: number) => svc.deleteLetterhead(getDb(), id));

  ipcMain.handle('seals:list', () => svc.listSeals(getDb()));
  ipcMain.handle('seals:add', (_e, input: { name: string; kind: string; imagePath: string | null }) =>
    svc.addSeal(getDb(), input)
  );
  ipcMain.handle('seals:delete', (_e, id: number) => svc.deleteSeal(getDb(), id));
}
