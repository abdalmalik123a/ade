import { createHash } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { storeDir } from '../db';

/**
 * كل تعامل مع الملفات يمرّ من هنا.
 * المستخدم لا يفتح مستعرض ملفات ولا يكتب مسارًا: التطبيق يفتح الحوار،
 * وينسخ الملف إلى مخزنه، ويعيد عنوان `diwan://` يعرضه بأمان.
 */

const IMAGE_FILTERS = [{ name: 'صور', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }];

/** ينسخ ملفًا إلى المخزن باسم مشتقّ من محتواه — فلا تتكرّر نسخة ولا يتصادم اسم. */
export async function importFile(sourcePath: string, bucket: string): Promise<string> {
  const bytes = await readFile(sourcePath);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const name = `${hash}${extname(sourcePath).toLowerCase()}`;
  const target = join(storeDir(bucket), name);
  await copyFile(sourcePath, target);
  return `${bucket}/${name}`;
}

/** عنوان العرض داخل الواجهة. */
export function storeUrl(relative: string | null): string | null {
  return relative ? `diwan://store/${relative}` : null;
}

export function registerFileIpc(): void {
  ipcMain.handle('files:pickImage', async (e, bucket: string): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'اختر صورة',
      buttonLabel: 'إدراج',
      properties: ['openFile'],
      filters: IMAGE_FILTERS
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return importFile(result.filePaths[0], bucket);
  });

  /** حفظ ناتج (PDF / DOCX / XLSX) — حوار الحفظ داخل التطبيق، ثم كشف الملف للمستخدم. */
  ipcMain.handle(
    'files:saveAs',
    async (
      e,
      payload: { data: Uint8Array; suggestedName: string; filterName: string; ext: string }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const result = await dialog.showSaveDialog(win, {
        title: 'حفظ باسم',
        defaultPath: payload.suggestedName,
        filters: [{ name: payload.filterName, extensions: [payload.ext] }]
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, Buffer.from(payload.data));
      return result.filePath;
    }
  );

  /** إظهار ملف ناتج في مستعرض النظام — بعد أن ينتهي التطبيق من عمله، لا بدلًا عنه. */
  ipcMain.handle('files:reveal', (_e, path: string) => {
    shell.showItemInFolder(path);
  });
}
