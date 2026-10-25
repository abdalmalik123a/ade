/**
 * «أرسل تقرير المشكلة» (البند ٣٢): يُحفظ التقرير حيث يختار الموظف (سطح المكتب أوّلًا) ثم يُرى في مجلّده ليُرسل بواتساب.
 * ولا يُرسل البرنامج شيئًا بنفسه — بلا إنترنت.
 */
import { freemem, release, totalmem, userInfo, arch } from 'node:os';
import { existsSync, statfsSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import type { DiagnoseRow } from '@shared/api';
import { dataDir, getDb, storeDir } from '../db';
import { errorLogPath, logError } from '../errorLog';
import { buildReport, readLogTail, reportFileName } from '../services/problemReport';
import { diagnose, diagnoseLines, VC_DLLS } from '../services/diagnostics';
import { listFaces } from '../services/fonts';
import { readFontInfo, withFileReader } from '../services/fontFile';
import { listPrinters } from '../services/printers';
import { licenseStatus } from './license';
import { pickSavePath } from './files';
import { handleChecked } from './checked';

/** آخر تقريرٍ حُفظ — وحده يُرى في مجلّده (لا مسارٌ تعطيه الواجهة). */
let lastReport: string | null = null;

/**
 * يجمع «تشخيص الجهاز» (S34، D186) ويحكم عليه (`diagnostics.ts`): ملفّات VC++ بجوار مكتبة «أزل الخلفية» المفكوكة من الحزمة أو في System32،
 * وملفّات الخطوط المستوردة تُقرأ، والطابعات كما في قائمتها، والفارغ على قرص البيانات، وآخر يومٍ رآه التفعيل — ولا شيء من سجلّ المكتب.
 */
async function gatherDiagnostics(win: BrowserWindow): Promise<DiagnoseRow[]> {
  const ort = join(app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'), 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', 'win32', 'x64');
  const system = join(process.env['WINDIR'] ?? 'C:\\Windows', 'System32');
  const vcMissing = VC_DLLS.filter((dll) => !existsSync(join(ort, dll)) && !existsSync(join(system, dll)));
  const db = getDb();
  let faces: ReturnType<typeof listFaces> = [];
  try {
    faces = listFaces(db);
  } catch {
    // قاعدةٌ أقدم بلا جدول الخطوط — لا مستورد.
  }
  const broken = faces.filter((f) => {
    try {
      withFileReader(join(storeDir('fonts'), basename(f.file)), readFontInfo);
      return false;
    } catch {
      return true;
    }
  });
  let freeBytes: number | null = null;
  try {
    const s = statfsSync(dataDir());
    freeBytes = s.bavail * s.bsize;
  } catch (err) {
    logError('diagnose:disk', err);
  }
  const lastSeen = (db.prepare("SELECT value FROM settings WHERE key = 'lastSeen'").get() as { value: string } | undefined)?.value ?? null;
  return diagnose({
    vcMissing,
    fonts: { count: faces.length, broken: [...new Set(broken.map((f) => f.family))] },
    printers: await listPrinters(win.webContents),
    freeBytes,
    now: new Date(),
    lastSeen
  });
}

export function registerSupportIpc(): void {
  ipcMain.handle('app:problemReport', async (e, note: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const now = new Date();
    const name = reportFileName(now);
    const path = await pickSavePath(win, { title: 'احفظ تقرير المشكلة', defaultName: name, defaultDir: app.getPath('desktop'), filterName: 'نصّ', ext: 'txt' });
    if (!path) return null;
    let license = null;
    try {
      license = licenseStatus(true);
    } catch (err) {
      logError('problemReport:license', err);
    }
    let diagnostics: string[] = [];
    try {
      diagnostics = diagnoseLines(await gatherDiagnostics(win));
    } catch (err) {
      logError('problemReport:diagnose', err);
    }
    const log = errorLogPath();
    const text = buildReport({
      note: String(note ?? ''),
      info: {
        version: app.getVersion(),
        os: `Windows ${release()}`,
        arch: arch(),
        memoryGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
        freeMemoryGb: Math.round((freemem() / 1024 ** 3) * 10) / 10,
        license,
        diagnostics
      },
      log: readLogTail([`${log}.1`, log]),
      userName: userInfo().username,
      now
    });
    writeFileSync(path, `﻿${text}`, 'utf8');
    lastReport = path;
    return path;
  });

  ipcMain.handle('app:showProblemReport', () => {
    if (lastReport) shell.showItemInFolder(lastReport);
  });

  handleChecked('app:diagnose', {}, async (_args, e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return win ? gatherDiagnostics(win) : [];
  });
}
