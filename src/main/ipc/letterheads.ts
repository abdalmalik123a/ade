import { ipcMain } from 'electron';
import { getDb, storeDir } from '../db';
import { storeFile } from '../services/localPaths';
import * as svc from '../services/letterheads';
import type { LetterheadLayout } from '@shared/letterhead';

/** الطبقة رقيقة عمدًا: المنطق كله في services/letterheads.ts ليبقى قابلًا للاختبار. */
export function registerLetterheadIpc(): void {
  ipcMain.handle('letterheads:list', (_e, opts: svc.LetterheadQuery = {}) =>
    svc.listLetterheads(getDb(), opts)
  );
  ipcMain.handle('letterheads:categories', () => svc.listCategories(getDb()));
  ipcMain.handle(
    'letterheads:save',
    (
      _e,
      input: {
        id: number | null;
        name: string;
        authorityId: number | null;
        layout: LetterheadLayout;
        category?: string | null;
      }
    ) => svc.saveLetterhead(getDb(), input)
  );
  ipcMain.handle('letterheads:duplicate', (_e, id: number, name?: string) =>
    svc.duplicateLetterhead(getDb(), id, name)
  );
  ipcMain.handle('letterheads:favorite', (_e, id: number, on: boolean) =>
    svc.setFavorite(getDb(), id, on)
  );
  ipcMain.handle('letterheads:setDefault', (_e, id: number) => svc.setDefaultLetterhead(getDb(), id));
  ipcMain.handle('letterheads:delete', (_e, id: number) => svc.deleteLetterhead(getDb(), id));

  ipcMain.handle('seals:list', () => svc.listSeals(getDb()));
  ipcMain.handle('seals:add', (_e, input: { name: string; kind: string; imagePath: string | null }) => {
    // صورته ملفٌّ في المخزن أعطاه «اختر صورة» — لا مسارٌ يخرج منه (A04، D69).
    if (input.imagePath != null && !storeFile(storeDir(), input.imagePath)) throw new Error('الصورة خارج مخزن ديوان — اخترها ثانيةً');
    return svc.addSeal(getDb(), input);
  });
  ipcMain.handle('seals:delete', (_e, id: number) => svc.deleteSeal(getDb(), id));
}
