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

/**
 * أين يُحفظ الناتج: حوار النظام دائمًا في التشغيل الطبيعي.
 *
 * الاستثناء الوحيد متغيّر البيئة DIWAN_TEST_SAVE_DIR، ولا يوجد إلا حين يقود
 * مِقْودُ الفحص (tools/drive.mjs) التطبيقَ الحقيقي: حوار النظام لا يُضغط آليًا،
 * فبغيره تبقى أدوات التصدير الخمس بلا فحص. ولا سبيل إلى ضبطه في تثبيت عادي.
 */
export async function pickSavePath(
  window: BrowserWindow,
  options: { title: string; defaultName: string; filterName: string; ext: string }
): Promise<string | null> {
  const testDir = process.env['DIWAN_TEST_SAVE_DIR'];
  if (testDir) return join(testDir, options.defaultName);

  const result = await dialog.showSaveDialog(window, {
    title: options.title,
    defaultPath: options.defaultName,
    filters: [{ name: options.filterName, extensions: [options.ext] }]
  });
  return result.canceled || !result.filePath ? null : result.filePath;
}

/**
 * أي ملف يُفتح: حوار النظام دائمًا في التشغيل الطبيعي.
 *
 * والاستثناء نفسه المذكور في pickSavePath: حوار النظام لا يُضغط آليًا، فبغير
 * هذا الباب يبقى الاستيراد كلّه بلا فحص على التطبيق الحقيقي.
 */
export async function pickOpenPath(
  window: BrowserWindow,
  options: { title: string; buttonLabel: string; filterName: string; extensions: string[] }
): Promise<string | null> {
  const testFile = process.env['DIWAN_TEST_OPEN_FILE'];
  if (testFile) return testFile;

  const result = await dialog.showOpenDialog(window, {
    title: options.title,
    buttonLabel: options.buttonLabel,
    properties: ['openFile'],
    filters: [{ name: options.filterName, extensions: options.extensions }]
  });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

/**
 * أي مجلد يُفتح: حوار النظام دائمًا، والاستثناء نفسه تحت المِقْود.
 *
 * DIWAN_TEST_OPEN_DIR لا يوجد إلا حين يقود tools/drive.mjs التطبيقَ الحقيقي —
 * وبغيره يبقى «استورد مجلدي» بلا فحص على التطبيق المبنيّ.
 */
export async function pickFolderPath(
  window: BrowserWindow,
  options: { title: string; buttonLabel: string }
): Promise<string | null> {
  const testDir = process.env['DIWAN_TEST_OPEN_DIR'];
  if (testDir) return testDir;

  const result = await dialog.showOpenDialog(window, {
    title: options.title,
    buttonLabel: options.buttonLabel,
    properties: ['openDirectory']
  });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

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
      const path = await pickSavePath(win, {
        title: 'حفظ باسم',
        defaultName: payload.suggestedName,
        filterName: payload.filterName,
        ext: payload.ext
      });
      if (!path) return null;
      await writeFile(path, Buffer.from(payload.data));
      return path;
    }
  );

  /** إظهار ملف ناتج في مستعرض النظام — بعد أن ينتهي التطبيق من عمله، لا بدلًا عنه. */
  ipcMain.handle('files:reveal', (_e, path: string) => {
    shell.showItemInFolder(path);
  });
}
