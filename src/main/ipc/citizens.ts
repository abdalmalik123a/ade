import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { BrowserWindow, ClipboardItem, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import { zipSync } from 'fflate';
import ExcelJS from 'exceljs';
import { getDb, storeDir } from '../db';
import * as svc from '../services/citizens';
import { listScanners, removeStoreFile, scanPage } from '../services/scanner';
import { ocrAvailable, recognize, recognizeLines } from '../services/ocr';
import { readCardBack } from '../services/mrzRead';
import { grayOf } from '@shared/mrzImage';
import { importFile } from './files';
import type { CitizenInput } from '@shared/api';
import { ADDED_COLUMNS, CITIZEN_FIELDS } from '@shared/citizenSchema';

/** خانات الاستمارات الحكومية — تُصدَّر إن مُلئت، والأصلية ولو فارغة. */
const ADDED_LABELS = new Set(CITIZEN_FIELDS.filter((f) => (ADDED_COLUMNS as readonly string[]).includes(f.column)).map((f) => f.label));

const IMAGE_FILTERS = [
  { name: 'مستمسكات', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'pdf', 'tif', 'tiff'] }
];

function absolute(relative: string): string {
  return join(storeDir(), relative);
}

export function registerCitizenIpc(): void {
  svc.ensureSearchColumn(getDb());

  ipcMain.handle(
    'citizens:list',
    (_e, opts: { query?: string; category?: string | null; limit?: number }) =>
      svc.listCitizens(getDb(), opts)
  );
  ipcMain.handle('citizens:categories', () => svc.listCategories(getDb()));
  ipcMain.handle('citizens:stats', () => svc.citizenStats(getDb()));
  ipcMain.handle('citizens:get', (_e, id: number) => svc.getCitizen(getDb(), id));
  ipcMain.handle('citizens:records', (_e, ids: number[]) => svc.getCitizenRecords(getDb(), Array.isArray(ids) ? ids.slice(0, 2000) : []));
  ipcMain.handle('citizens:save', (_e, input: CitizenInput) => svc.saveCitizen(getDb(), input));
  ipcMain.handle('citizens:usage', (_e, id: number) => svc.citizenUsage(getDb(), id));

  ipcMain.handle('citizens:delete', async (_e, id: number) => {
    const orphans = svc.deleteCitizen(getDb(), id);
    // الملفات تُحذف بعد نجاح حذف السجلّ، فلا تضيع صور لسجلّ باقٍ.
    await Promise.all(orphans.map(removeStoreFile));
  });

  /** سجل المواطن وكتبه الصادرة في ملف Excel — يُولَّد برمجيًا بلا فتح Excel. */
  ipcMain.handle('citizens:exportExcel', async (e, id: number) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const c = svc.getCitizen(getDb(), id);
    if (!c) return null;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ديوان';
    wb.created = new Date();

    const info = wb.addWorksheet('بيانات المواطن', { views: [{ rightToLeft: true }] });
    info.columns = [
      { header: 'الحقل', key: 'k', width: 28 },
      { header: 'القيمة', key: 'v', width: 46 }
    ];
    const rows: [string, string | null][] = [
      // الخانات كلّها بأبوابها — والفارغة من خانات الاستمارات الحكومية تُترك.
      ...CITIZEN_FIELDS.map((f) => [f.label, (c[f.key] as string | null | undefined) ?? null] as [string, string | null]).filter(
        ([label, v]) => v || !ADDED_LABELS.has(label)
      ),
      ['التصنيف', c.category],
      ['موثّق رسميًا', c.verified ? 'نعم' : 'لا']
    ];
    for (const [k, v] of rows) info.addRow({ k, v: v ?? '—' });
    info.getRow(1).font = { bold: true };

    const docs = wb.addWorksheet('الكتب الصادرة', { views: [{ rightToLeft: true }] });
    docs.columns = [
      { header: 'رقم الصادر', key: 'serial', width: 18 },
      { header: 'نوع الكتاب', key: 'docType', width: 28 },
      { header: 'الجهة الموجه إليها', key: 'destination', width: 34 },
      { header: 'الغرض', key: 'purpose', width: 28 },
      { header: 'التاريخ', key: 'issuedDate', width: 14 },
      { header: 'النسخ', key: 'copies', width: 8 }
    ];
    for (const d of c.documents) docs.addRow(d);
    docs.getRow(1).font = { bold: true };

    const files = wb.addWorksheet('المستمسكات', { views: [{ rightToLeft: true }] });
    files.columns = [
      { header: 'نوع المستمسك', key: 'docType', width: 30 },
      { header: 'الصيغة', key: 'fileFormat', width: 12 },
      { header: 'الدقة', key: 'dpi', width: 10 },
      { header: 'دقة الاستخراج', key: 'acc', width: 16 },
      { header: 'تاريخ المسح', key: 'scannedAt', width: 22 }
    ];
    for (const a of c.attachments) {
      files.addRow({
        docType: a.docType,
        fileFormat: a.fileFormat ?? '—',
        dpi: a.dpi ?? '—',
        acc: a.ocrAccuracy === null ? '—' : `${Math.round(a.ocrAccuracy * 100)}%`,
        scannedAt: a.scannedAt ?? '—'
      });
    }
    files.getRow(1).font = { bold: true };

    const safe = c.fullName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير سجل المواطن',
      defaultPath: `${safe}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return null;
    await wb.xlsx.writeFile(result.filePath);
    return result.filePath;
  });

  // ── المستمسكات ─────────────────────────────────────────────────────
  ipcMain.handle(
    'attachments:importFile',
    async (e, citizenId: number, docType: string) => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const picked = await dialog.showOpenDialog(win, {
        title: 'استعراض من الحاسوب',
        buttonLabel: 'إدراج',
        properties: ['openFile'],
        filters: IMAGE_FILTERS
      });
      if (picked.canceled || !picked.filePaths[0]) return null;

      const source = picked.filePaths[0];
      const relative = await importFile(source, 'attachments');
      const bytes = await readFile(source);
      return svc.addAttachment(getDb(), {
        citizenId,
        docType: docType || basename(source, extname(source)),
        filePath: relative,
        fileFormat: extname(source).slice(1).toUpperCase() || null,
        dpi: null,
        sha256: createHash('sha256').update(bytes).digest('hex')
      });
    }
  );

  ipcMain.handle(
    'attachments:scan',
    async (_e, citizenId: number, docType: string, dpi: number) => {
      const scan = await scanPage({ dpi });
      const bytes = await readFile(absolute(scan.relativePath));
      return svc.addAttachment(getDb(), {
        citizenId,
        docType: docType || 'مستمسك ممسوح',
        filePath: scan.relativePath,
        fileFormat: scan.format,
        dpi: scan.dpi,
        sha256: createHash('sha256').update(bytes).digest('hex')
      });
    }
  );

  ipcMain.handle(
    'attachments:addFromDataUrl',
    async (_e, citizenId: number, docType: string, dataUrl: string) => {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || !matches[2]) throw new Error('صيغة الصورة غير صالحة');
      const buffer = Buffer.from(matches[2], 'base64');
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
      const isPng = matches[1]?.includes('png');
      const ext = isPng ? '.png' : '.jpg';
      const name = `${hash}${ext}`;
      const target = join(storeDir('attachments'), name);
      await writeFile(target, buffer);
      const relative = `attachments/${name}`;
      return svc.addAttachment(getDb(), {
        citizenId,
        docType: docType || 'مستمسك معدل',
        filePath: relative,
        fileFormat: ext.slice(1).toUpperCase(),
        dpi: null,
        sha256: createHash('sha256').update(buffer).digest('hex')
      });
    }
  );

  ipcMain.handle('attachments:rename', (_e, id: number, docType: string) =>
    svc.renameAttachment(getDb(), id, docType)
  );

  ipcMain.handle('attachments:ocr', async (_e, id: number) => {
    const db = getDb();
    const row = db.prepare('SELECT file_path AS p FROM attachments WHERE id = ?').get(id) as
      | { p: string }
      | undefined;
    if (!row) throw new Error('المستمسك غير موجود');
    const result = await recognize(absolute(row.p));
    svc.setAttachmentOcr(db, id, result.text, result.confidence);
    return result;
  });

  /** ظهر البطاقة بقارئه الخاصّ (تعميق الموجود ٨): السطور الثلاثة وحقولها بتحقّقها. */
  ipcMain.handle('attachments:readMrz', async (_e, id: number) => {
    const row = getDb().prepare('SELECT file_path AS p FROM attachments WHERE id = ?').get(id) as { p: string } | undefined;
    if (!row) throw new Error('المستمسك غير موجود');
    const img = nativeImage.createFromPath(absolute(row.p));
    if (img.isEmpty()) throw new Error('المستمسك ليس صورةً تُقرأ');
    const { width, height } = img.getSize();
    return readCardBack({ gray: grayOf(new Uint8Array(img.toBitmap()), width, height, 'bgra'), width, height }, recognizeLines);
  });

  /** الطباعة من داخل التطبيق: نافذة إخراج مخفية تحمل الصورة بمقاس الورقة. */
  ipcMain.handle('attachments:print', async (_e, id: number) => {
    const row = getDb()
      .prepare('SELECT file_path AS p FROM attachments WHERE id = ?')
      .get(id) as { p: string } | undefined;
    if (!row) throw new Error('المستمسك غير موجود');

    const image = nativeImage.createFromPath(absolute(row.p));
    const dataUrl = image.toDataURL();
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
    try {
      await win.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            `<!doctype html><html><head><meta charset="utf-8"><style>
               @page { size: A4 portrait; margin: 10mm; }
               html,body{margin:0;padding:0;}
               img{max-width:100%;max-height:277mm;object-fit:contain;display:block;margin:auto;}
             </style></head><body><img src="${dataUrl}"></body></html>`
          )
      );
      return await new Promise<boolean>((resolve) => {
        win.webContents.print(
          { silent: false, printBackground: true, pageSize: 'A4', color: true },
          (ok) => resolve(ok)
        );
      });
    } finally {
      win.destroy();
    }
  });

  /** حافظة Electron 44 بنمط W3C: عناصر بأنواع MIME، لا writeImage. */
  ipcMain.handle('attachments:copy', async (_e, id: number) => {
    const row = getDb()
      .prepare('SELECT file_path AS p FROM attachments WHERE id = ?')
      .get(id) as { p: string } | undefined;
    if (!row) return false;
    const image = nativeImage.createFromPath(absolute(row.p));
    if (image.isEmpty()) return false;
    const blob = new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  });

  /** تصدير كل مستمسكات المواطن في حزمة واحدة. */
  ipcMain.handle('attachments:exportZip', async (e, citizenId: number) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const db = getDb();
    const citizen = svc.getCitizen(db, citizenId);
    if (!citizen) return null;
    if (citizen.attachments.length === 0) throw new Error('لا مستمسكات لتصديرها');

    const entries: Record<string, Uint8Array> = {};
    for (const [i, a] of citizen.attachments.entries()) {
      try {
        const bytes = await readFile(absolute(a.filePath));
        const ext = extname(a.filePath) || '.png';
        const safe = a.docType.replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
        entries[`${String(i + 1).padStart(2, '0')}-${safe}${ext}`] = new Uint8Array(bytes);
      } catch {
        // ملف مفقود من المخزن — يُتخطّى ولا يُفشل الحزمة كلها
      }
    }
    if (Object.keys(entries).length === 0) throw new Error('ملفات المستمسكات مفقودة من المخزن');

    const safeName = citizen.fullName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير المستمسكات',
      defaultPath: `${safeName}-مستمسكات.zip`,
      filters: [{ name: 'حزمة ZIP', extensions: ['zip'] }]
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, Buffer.from(zipSync(entries, { level: 6 })));
    return { path: result.filePath, count: Object.keys(entries).length };
  });

  ipcMain.handle('attachments:delete', async (_e, id: number) => {
    const path = svc.deleteAttachment(getDb(), id);
    if (path) await removeStoreFile(path);
  });

  // ── الماسح والتعرّف ────────────────────────────────────────────────
  ipcMain.handle('scanner:list', () => listScanners());
  // مسحٌ لا يُقيَّد مستمسكًا لأحد: وجهُ هويةٍ وظهرُها يُستنسخان والزبون واقف.
  ipcMain.handle('scanner:scanImage', async (_e, dpi: number) => (await scanPage({ dpi: dpi || 300 })).relativePath);
  ipcMain.handle('scanner:ocrAvailable', () => ocrAvailable());
}
