/**
 * أخطاء قاعدة البيانات تصل الواجهةَ عربيّة (مراجعة ٧ ت١) — في موضعٍ واحد لكلّ القنوات.
 *
 * يُلفّ `ipcMain.handle` قبل تسجيل أيّ قناة (كما تفعل بوّابة الإنتاج `gate.ts`): ما رماه معالجٌ من SQLite يُترجَم
 * (`services/dbErrors.ts`) ويُكتب أصله في سجلّ الأخطاء؛ وما رماه البرنامج نفسه يمرّ كما هو.
 */
import { ipcMain } from 'electron';
import { logError } from '../errorLog';
import { arabicDbMessage, translateDbError } from '../services/dbErrors';

let installed = false;

/** يُستدعى قبل تسجيل القنوات. */
export function installErrorTranslation(): void {
  if (installed) return;
  installed = true;
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: Parameters<typeof ipcMain.handle>[1]) =>
    handle(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args);
      } catch (e) {
        if (arabicDbMessage(e) !== null) logError(`ipc:${channel}`, e);
        throw translateDbError(e);
      }
    })) as typeof ipcMain.handle;
}
