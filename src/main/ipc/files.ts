import { createHash } from 'node:crypto';
import { copyFile, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { storeDir } from '../db';
import { imageMetaOf, type ImageMeta } from '../services/imageSize';
import { sheetToText } from '../services/sheetRead';
import { discardTransient } from '../services/transient';
import { isInside, pastedImagePath } from '../services/localPaths';

/** حيث يضع Word صور ما يُنسخ منه (المجلّد المؤقّت)، والمخزن. */
const pasteRoots = (): string[] => [tmpdir(), storeDir()];

/** الجذر محلولًا (الاسم الطويل لا المختصر `ADMINI~1`) — وإلا فكما هو. */
function realRoot(root: string): string {
  try {
    return realpathSync.native(root);
  } catch {
    return root;
  }
}

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
  options: { title: string; defaultName: string; filterName: string; ext: string; defaultDir?: string }
): Promise<string | null> {
  const testDir = process.env['DIWAN_TEST_SAVE_DIR'];
  if (testDir) return join(testDir, options.defaultName);

  const result = await dialog.showSaveDialog(window, {
    title: options.title,
    defaultPath: options.defaultDir ? join(options.defaultDir, options.defaultName) : options.defaultName,
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
 * ملفّاتٌ كثيرة تُفتح معًا (محرّر PDF: ملفّات تُدمج وصورٌ تصير صفحات).
 *
 * وتحت المِقْود: `DIWAN_TEST_OPEN_FILES` مساراتٌ يفصلها «|»، وإلا فـ`DIWAN_TEST_OPEN_FILE` وحده.
 */
export async function pickOpenPaths(
  window: BrowserWindow,
  options: { title: string; buttonLabel: string; filterName: string; extensions: string[] }
): Promise<string[]> {
  const many = process.env['DIWAN_TEST_OPEN_FILES'];
  if (many) return many.split('|').filter(Boolean);
  const one = process.env['DIWAN_TEST_OPEN_FILE'];
  if (one) return [one];

  const result = await dialog.showOpenDialog(window, {
    title: options.title,
    buttonLabel: options.buttonLabel,
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: options.filterName, extensions: options.extensions }]
  });
  return result.canceled ? [] : result.filePaths;
}

/** مجلّدٌ تُحفظ فيه ملفّاتٌ كثيرة (أجزاء ملفٍّ مقسوم، أو صفحاتٌ صورًا) — والاستثناء نفسه تحت المِقْود. */
export async function pickSaveFolder(window: BrowserWindow, title: string): Promise<string | null> {
  const testDir = process.env['DIWAN_TEST_SAVE_DIR'];
  if (testDir) return testDir;
  const result = await dialog.showOpenDialog(window, {
    title,
    buttonLabel: 'احفظ هنا',
    properties: ['openDirectory', 'createDirectory']
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
/**
 * مجلّد المخزن اسمٌ قصيرٌ بحروفٍ لاتينية صغيرة (`photos`، `letterheads`…) — لا مسار.
 * فالقراءة (`diwan://store/`) ترفض «..» منذ البدء، والكتابة لم تكن ترفضه: `bucket` يأتي من
 * الواجهة فيُضمّ إلى مسار المخزن كما هو (التدقيق المستقل). دفاعٌ لا ثقةٌ بالواجهة.
 */
const BUCKET = /^[a-z][a-z0-9-]{0,31}$/;

/** نوع الصورة من أوّل بايتاتها — لا من اسمٍ أو نوعٍ تقوله الواجهة. */
export function imageExt(bytes: Uint8Array): '.png' | '.jpg' | '.gif' | '.webp' | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return '.png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return '.gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return '.webp';
  return null;
}

/** أكبر صورةٍ تُلصق في ورقة — لقطةُ شاشةٍ كاملة أصغر منها بكثير. */
const PASTE_MAX = 20 * 1024 * 1024;

export async function importFile(sourcePath: string, bucket: string): Promise<string> {
  if (!BUCKET.test(bucket)) throw new Error('مجلّد تخزينٍ غير معروف');
  const bytes = await readFile(sourcePath);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const name = `${hash}${extname(sourcePath).toLowerCase()}`;
  const target = join(storeDir(bucket), name);
  await copyFile(sourcePath, target);
  return `${bucket}/${name}`;
}

export function registerFileIpc(): void {
  /**
   * صورةٌ أُلصقت في المحرّر (لقطة شاشة، أو صورةٌ نُسخت من متصفّح أو Word) تُحفظ في المخزن
   * باسمٍ من محتواها. وما ليس صورةً معروفة يُرفض بلا خطأ: يعود `null` فلا يُلصق شيء.
   */
  ipcMain.handle('files:storeImage', async (_e, raw: unknown): Promise<string | null> => {
    if (!(raw instanceof Uint8Array) || raw.length === 0 || raw.length > PASTE_MAX) return null;
    const ext = imageExt(raw);
    if (!ext) return null;
    const name = `${createHash('sha256').update(raw).digest('hex').slice(0, 32)}${ext}`;
    await writeFile(join(storeDir('images'), name), raw);
    return `images/${name}`;
  });

  /**
   * صورةٌ في نصٍّ لُصق من Word: Word يضعها ملفًّا مؤقّتًا (`file:///…/clip_image001.png`) ما دام
   * النسخ قائمًا — فتُنسخ إلى المخزن. وما ليس ملفًّا محلّيًّا ولا صورةً معروفة يعود `null`.
   */
  ipcMain.handle('files:storeImageUrl', async (_e, url: unknown): Promise<string | null> => {
    if (typeof url !== 'string') return null;
    // ملفٌّ محلّيٌّ في المجلّد المؤقّت أو المخزن وحده (و٥) — لا رابطٌ بمضيف ولا مسار شبكة: قراءته كانت ترسل
    // بصمة دخول الموظف إلى ذلك الجهاز. ويُحسم ذلك قبل أيّ لمسٍ للقرص.
    const path = pastedImagePath(url, pasteRoots());
    if (!path) return null;
    try {
      // والمحلول الحقيقي داخلها أيضًا: وصلةٌ في المجلّد المؤقّت لا تُخرج القراءة منه.
      const real = await realpath(path);
      if (!pasteRoots().some((root) => isInside(realRoot(root), real))) return null;
      const bytes = await readFile(real);
      if (bytes.length === 0 || bytes.length > PASTE_MAX) return null;
      const ext = imageExt(bytes);
      if (!ext) return null;
      const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}${ext}`;
      await writeFile(join(storeDir('images'), name), bytes);
      return `images/${name}`;
    } catch {
      return null;
    }
  });

  /** الواجهة تحذف مسوحها العابرة حين يُغلق الحوار الذي مسحها — `tmp/` وحدها، وغيرها يُتجاهل. */
  ipcMain.handle('files:discardTransient', (_e, paths: string[]) => discardTransient(storeDir(), Array.isArray(paths) ? paths : []));

  ipcMain.handle('files:pickImage', async (e, bucket: string): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    // عبر pickOpenPath: بابُ المِقْود نفسه — فشعار الجهة يُختبر على التطبيق الحقيقي.
    const source = await pickOpenPath(win, {
      title: 'اختر صورة',
      buttonLabel: 'إدراج',
      filterName: IMAGE_FILTERS[0]!.name,
      extensions: IMAGE_FILTERS[0]!.extensions
    });
    return source ? importFile(source, bucket) : null;
  });

  /**
   * قائمةٌ من ملف Excel أو CSV — تعود بصيغة اللصق نفسها (أعمدةٌ بالجدولة).
   * فالمدرسة ترسل ملفًّا، ولا يُفتح Excel ليُنسخ منه ويُلصق.
   *
   * والإمساكية (٣٫٤) جدولها الرسمي قد يكون PDF أيضًا: يعود بايتاتٍ يقرأ نصَّها pdf.js في الواجهة.
   */
  ipcMain.handle('files:readSheet', async (e, what?: 'imsakiya'): Promise<{ name: string; text: string; rows: number; pdf?: Uint8Array } | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const imsakiya = what === 'imsakiya';
    const source = await pickOpenPath(win, {
      title: imsakiya ? 'اختر جدول الإمساكية الرسمي' : 'اختر قائمة الأسماء',
      buttonLabel: 'افتح',
      filterName: imsakiya ? 'Excel أو CSV أو PDF' : 'Excel أو CSV',
      // و`.xls` القديم يُرى ليُقال له «احفظه .xlsx» (هـ١).
      extensions: imsakiya ? ['xlsx', 'xls', 'csv', 'pdf'] : ['xlsx', 'xls', 'csv']
    });
    if (!source) return null;
    if (imsakiya && /\.pdf$/i.test(source)) {
      const bytes = await readFile(source);
      if (bytes.length > 30 * 1024 * 1024) throw new Error('ملف PDF أكبر من ٣٠ ميغا — ليس جدول إمساكية');
      return { name: basename(source), text: '', rows: 0, pdf: new Uint8Array(bytes) };
    }
    return { name: basename(source), ...(await sheetToText(source)) };
  });

  /**
   * مجلد صورٍ لدفعة: صور الطلاب في مجلد الصفّ، كلٌّ باسم صاحبه أو رقمه.
   *
   * تُنسخ كلّها إلى المخزن ويعود لكلٍّ اسمُ ملفّه بلا امتداد — وعليه تُطابَق
   * بصفوف القائمة. لا تُفتح الصور واحدةً واحدة لأربعمئة هوية.
   */
  ipcMain.handle(
    'files:pickImageFolder',
    async (e, bucket: string): Promise<{ name: string; src: string }[] | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const dir = await pickFolderPath(win, { title: 'اختر مجلد الصور', buttonLabel: 'اختر' });
      if (!dir) return null;
      const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
      const names = (await readdir(dir)).filter((f) => exts.has(extname(f).toLowerCase())).slice(0, 3000);
      const out: { name: string; src: string }[] = [];
      for (const file of names) {
        out.push({ name: basename(file, extname(file)), src: await importFile(join(dir, file), bucket) });
      }
      return out;
    }
  );

  /**
   * خلفيةُ لوحة: الصورة تُنسخ إلى المخزن، **ومقاسها يُقرأ من الملف**.
   *
   * وهذا أول موضعٍ تنكسر فيه برامج التصميم: تُفتح خلفيةٌ فتُفترض ٩٦ نقطة/إنش
   * فتخرج شهادةٌ ممطوطة. وإن سكت الملف عن دقّته عاد `dpi: null` — فيُسأل المكتب
   * عن المقاس ولا يُخمَّن له.
   */
  ipcMain.handle(
    'files:pickBackground',
    async (e, bucket: string): Promise<{ src: string; meta: ImageMeta | null } | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const source = await pickOpenPath(win, {
        title: 'اختر خلفية التصميم',
        buttonLabel: 'افتح',
        filterName: 'صور',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
      });
      if (!source) return null;
      const meta = await imageMetaOf(source);
      return { src: await importFile(source, bucket), meta };
    }
  );

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
}
