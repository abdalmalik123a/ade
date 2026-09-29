/**
 * محرّر PDF — القنوات.
 *
 * الملفّات تُفتح هنا وتبقى في الذاكرة بمعرّفاتها (المصادر)، والواجهة ترسم صفحاتها وتبني
 * الخطّة، ثم تُرسل الخطّة ليُبنى منها ملفٌّ جديد — يعود إليها لتقيس حجمه وتصغّره لحدّ الرفع
 * إن لزم، ثم يُحفظ. **والأصل لا يُكتب فوقه** (قرار المالك): الحفظ باسمٍ جديد، ومسارُ ملفٍّ
 * مفتوح يُرفض.
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { BrowserWindow, ipcMain, nativeImage } from 'electron';
import { storeDir } from '../db';
import { buildPdf, formFields, imagesToPdf, inspectPdf, loadPdf, shrinkPdfImages, type JpegShrink, type PdfSource } from '../services/pdfEdit';
import { renderLayerPdf } from '../services/render';
import { removeStoreFile, scanPage } from '../services/scanner';
import { imagePage, type PdfPlan } from '@shared/pdfEdit';
import { importFile, pickOpenPath, pickOpenPaths, pickSavePath, pickSaveFolder } from './files';
import type { PdfOpened } from '@shared/api';

/** دقّة المسح للتقديم: تُقرأ وتُطبع، وملفّها معقول قبل التصغير. */
const SCAN_DPI = 200;

/** صورة JPEG أصغر بمحرّك الصور في التطبيق — وما لا يُقرأ (CMYK مثلًا) يُترك. */
const nativeShrink: JpegShrink = (jpeg, scale, quality) => {
  let img = nativeImage.createFromBuffer(Buffer.from(jpeg));
  if (img.isEmpty()) return null;
  const size = img.getSize();
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  if (width !== size.width) img = img.resize({ width, height, quality: 'good' });
  return { jpeg: new Uint8Array(img.toJPEG(Math.round(quality * 100))), width, height };
};

const sources = new Map<string, PdfSource>();
/** مسارات ما فُتح — فلا يُحفظ فوق أصلٍ منها. */
const openedPaths = new Set<string>();
let seq = 0;

const PDF_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp'];

/** اسمٌ صالحٌ لملفّ ويندوز. */
const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'ملف';

const renderLayer = (html: string, mm: { w: number; h: number }) => renderLayerPdf(html, mm);

async function openOne(path: string): Promise<PdfOpened> {
  const bytes = new Uint8Array(await readFile(path));
  const name = basename(path);
  const id = `s${++seq}`;
  if (extname(path).toLowerCase() === '.pdf') {
    const pages = await inspectPdf(bytes);
    sources.set(id, { kind: 'pdf', name, bytes });
    const fields = formFields(await loadPdf(bytes));
    return { id, name, kind: 'pdf', bytes, pages, ...(fields.length ? { fields } : {}) };
  }
  // PNG وJPEG كما هما؛ وما سواهما (WebP وBMP) يُحوَّل PNG — فمكتبة PDF لا تقرأ غيرهما.
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const img = nativeImage.createFromBuffer(Buffer.from(bytes));
  if (img.isEmpty()) throw new Error('الملف ليس صورةً تُقرأ — قد يكون تالفًا أو أُعيدت تسميته');
  const size = img.getSize();
  const data = isPng || isJpg ? bytes : new Uint8Array(img.toPNG());
  sources.set(id, { kind: 'image', name, bytes: data, width: size.width, height: size.height });
  const { page } = imagePage(size);
  return { id, name, kind: 'image', bytes: data, pages: [{ width: page.width, height: page.height, rotation: 0 }], image: size };
}

/**
 * صفحةٌ من الماسح: تُقرأ JPEG (فالمسح PNG كبيرٌ بلا داعٍ) وتُحذف من المخزن — فمستمسك
 * الزبون لا يبقى نسخةً منسيّة، والمحرّر يحمله في الذاكرة.
 */
async function openScan(): Promise<PdfOpened> {
  const { relativePath, dpi } = await scanPage({ dpi: SCAN_DPI });
  try {
    const img = nativeImage.createFromPath(join(storeDir(), relativePath));
    if (img.isEmpty()) throw new Error('لم يُقرأ ما مسحه الماسح — أعد المسح');
    const size = { ...img.getSize(), dpi };
    const bytes = new Uint8Array(img.toJPEG(90));
    const id = `s${++seq}`;
    const name = 'صفحة ممسوحة';
    sources.set(id, { kind: 'image', name, bytes, ...size });
    const { page } = imagePage(size);
    return { id, name, kind: 'image', bytes, pages: [{ width: page.width, height: page.height, rotation: 0 }], image: size };
  } finally {
    await removeStoreFile(relativePath);
  }
}

async function writeUnique(folder: string, name: string, ext: string, bytes: Uint8Array): Promise<string> {
  let path = join(folder, `${name}.${ext}`);
  for (let n = 2; await stat(path).then(() => true, () => false); n++) path = join(folder, `${name} (${n}).${ext}`);
  await writeFile(path, bytes);
  return path;
}

export function registerPdfIpc(): void {
  ipcMain.handle('pdf:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const paths = await pickOpenPaths(win, {
      title: 'افتح ملفّات PDF أو صورًا',
      buttonLabel: 'افتح',
      filterName: 'PDF وصور',
      extensions: PDF_EXT
    });
    if (!paths.length) return null;
    const opened: PdfOpened[] = [];
    const failed: { name: string; error: string }[] = [];
    // ملفٌّ لا يُفتح يُقال باسمه — ولا يُسقط البقيّة.
    for (const path of paths) {
      try {
        opened.push(await openOne(path));
        openedPaths.add(resolve(path).toLowerCase());
      } catch (err) {
        failed.push({ name: basename(path), error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { opened, failed };
  });

  ipcMain.handle('pdf:scan', () => openScan());

  ipcMain.handle('pdf:build', (_e, plan: PdfPlan) => buildPdf(plan, sources, renderLayer));

  ipcMain.handle('pdf:assemble', (_e, pages: { jpeg: Uint8Array; width: number; height: number }[]) => imagesToPdf(pages));

  ipcMain.handle('pdf:shrinkImages', (_e, bytes: Uint8Array, step: { scale: number; quality: number }) => shrinkPdfImages(bytes, step, nativeShrink));

  ipcMain.handle('pdf:save', async (e, bytes: Uint8Array, name: string) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const path = await pickSavePath(win, { title: 'احفظ الملف', defaultName: `${safeName(name)}.pdf`, filterName: 'PDF', ext: 'pdf' });
    if (!path) return null;
    if (openedPaths.has(resolve(path).toLowerCase())) throw new Error('لا يُكتب فوق الملف الأصلي — احفظه باسمٍ آخر');
    await writeFile(path, bytes);
    return path;
  });

  /** أجزاءٌ كثيرة من ملف (التقسيم) — كلٌّ ملفٌّ في المجلد نفسه. */
  ipcMain.handle('pdf:saveMany', async (e, items: { bytes: Uint8Array; name: string }[]) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || !items.length) return null;
    const folder = await pickSaveFolder(win, 'اختر مجلّدًا للأجزاء');
    if (!folder) return null;
    const files: string[] = [];
    for (const it of items) files.push(await writeUnique(folder, safeName(it.name), 'pdf', it.bytes));
    return { folder, files };
  });

  /** الصفحات صورًا (للرفع إلى المنصّات) — ترسمها الواجهة، وتُكتب هنا. */
  ipcMain.handle('pdf:saveImages', async (e, images: { name: string; bytes: Uint8Array }[]) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || !images.length) return null;
    const folder = await pickSaveFolder(win, 'اختر مجلّدًا للصور');
    if (!folder) return null;
    const files: string[] = [];
    for (const img of images) files.push(await writeUnique(folder, safeName(img.name), 'jpg', img.bytes));
    return { folder, files };
  });

  /** شعارٌ من الجهاز يُحفظ في «شعارات المكتب» — فيُختار في المرّة القادمة بلا بحث. */
  ipcMain.handle('pdf:pickLogo', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const path = await pickOpenPath(win, { title: 'اختر شعارًا أو صورة', buttonLabel: 'أضف', filterName: 'صور', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] });
    return path ? importFile(path, 'logos') : null;
  });

  ipcMain.handle('pdf:logos', async () => {
    const dir = storeDir('logos');
    const names = await readdir(dir);
    const withTime = await Promise.all(names.map(async (n) => ({ n, t: (await stat(join(dir, n))).mtimeMs })));
    return withTime.sort((a, b) => b.t - a.t).map((x) => `logos/${x.n}`);
  });

  ipcMain.handle('pdf:close', (_e, ids: string[]) => {
    for (const id of ids) sources.delete(id);
  });
}
