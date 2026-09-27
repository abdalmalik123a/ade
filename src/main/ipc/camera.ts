/**
 * استوديو التصوير — ما يلزمه من العملية الرئيسية.
 *
 * كاميرا الحاسوب والكاميرا الموصولة بـUSB تُقرأ في الواجهة نفسها (كلتاهما «جهاز
 * فيديو»)، والصورة الملتقطة تُحفظ هنا في المخزن باسم بصمتها كسائر الصور.
 *
 * والكاميرا الاحترافية (DSLR) لا تظهر جهازَ فيديو: برنامجها يحفظ كلّ لقطةٍ في
 * مجلّد. فيُراقَب المجلّد، وكلّ صورةٍ **جديدة** فيه تُرسل إلى الاستوديو فتُعطى
 * للطالب الحاضر وينتقل إلى التالي — والمصوّر يضغط زرّ كاميرته وحده.
 */
import { createHash } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { BrowserWindow, ipcMain } from 'electron';
import { storeDir } from '../db';
import { pickFolderPath } from './files';

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

let watcher: FSWatcher | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** برنامج الكاميرا يكتب الملف على دفعات: يُنتظر حتى يثبت حجمه. */
async function settled(path: string): Promise<boolean> {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    try {
      const { size } = await stat(path);
      if (size > 0 && size === last) return true;
      last = size;
    } catch {
      // لم يُكتب بعد
    }
    await sleep(250);
  }
  return false;
}

export function registerCameraIpc(): void {
  /** لقطةٌ من الكاميرا (مقصوصةً في الواجهة) تُحفظ في المخزن باسم بصمتها. */
  ipcMain.handle('camera:store', async (_e, dataUrl: string): Promise<string> => {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(String(dataUrl));
    if (!m) throw new Error('صيغة اللقطة غير صالحة');
    const bytes = Buffer.from(m[2]!, 'base64');
    const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${m[1] === 'png' ? 'png' : 'jpg'}`;
    await writeFile(join(storeDir('photos'), name), bytes);
    return `photos/${name}`;
  });

  /**
   * يراقب مجلّد الكاميرا الاحترافية: ما فيه الآن يُترك، وكلّ صورةٍ تُضاف بعده
   * تُنسخ إلى المخزن وتُرسل إلى الاستوديو بحدث `camera:shot`.
   */
  ipcMain.handle('camera:watchFolder', async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const dir = await pickFolderPath(win, { title: 'مجلّد لقطات الكاميرا', buttonLabel: 'راقب' });
    if (!dir) return null;
    watcher?.close();
    const seen = new Set(await readdir(dir));
    const sender = e.sender;
    watcher = watch(dir, (_event, file) => {
      if (!file || seen.has(file) || !IMAGE.has(extname(file).toLowerCase())) return;
      seen.add(file);
      const path = join(dir, file);
      void (async () => {
        if (!(await settled(path))) return;
        // تُرسل بياناتها لا مسارها: صورةٌ من diwan:// أصلٌ آخر، فتلوّث لوحة القصّ في
        // الواجهة ويمتنع حفظها. والمقصوصة وحدها تُحفظ في المخزن (camera:store).
        const bytes = await readFile(path);
        const mime = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';
        if (!sender.isDestroyed()) {
          sender.send('camera:shot', { dataUrl: `data:${mime};base64,${bytes.toString('base64')}`, file: basename(file) });
        }
      })();
    });
    return dir;
  });

  ipcMain.handle('camera:unwatch', () => {
    watcher?.close();
    watcher = null;
  });
}
