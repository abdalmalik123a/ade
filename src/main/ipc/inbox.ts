/**
 * «الملفّات» في الشبّاك (المرحلة ٢، ن٨): القائمة، وما أُفلت، وفتح كلٍّ في أداته — بالمعرّف وحده،
 * فلا يُفتح إلا ما عُرض أو أُفلت (`services/inbox.ts`).
 */
import { ipcMain } from 'electron';
import { adoptDropped, listInbox, pathOf } from '../services/inbox';
import { importTemplateFile } from '../services/import';
import { openPdfPaths } from './pdf';
import { storeLetterheadImage } from './templates';
import { importFile } from './files';

const known = (id: unknown): string => {
  const path = typeof id === 'string' ? pathOf(id) : null;
  if (!path) throw new Error('الملف لم يعد في القائمة — حدّثها وافتحه ثانيةً');
  return path;
};

export function registerInboxIpc(): void {
  ipcMain.handle('inbox:list', () => listInbox());
  ipcMain.handle('inbox:adopt', (_e, paths: unknown) =>
    adoptDropped(Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string' && p.length > 0) : [])
  );
  ipcMain.handle('inbox:openPdf', (_e, ids: unknown) => openPdfPaths((Array.isArray(ids) ? ids : []).map(known)));
  ipcMain.handle('inbox:importWord', (_e, id: unknown) => importTemplateFile(known(id), storeLetterheadImage));
  ipcMain.handle('inbox:toPhotos', (_e, id: unknown) => importFile(known(id), 'photos'));
}
