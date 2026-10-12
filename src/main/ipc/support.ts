/**
 * «أرسل تقرير المشكلة» (البند ٣٢): يُحفظ التقرير حيث يختار الموظف (سطح المكتب أوّلًا) ثم يُرى في مجلّده ليُرسل بواتساب.
 * ولا يُرسل البرنامج شيئًا بنفسه — بلا إنترنت.
 */
import { freemem, release, totalmem, userInfo, arch } from 'node:os';
import { writeFileSync } from 'node:fs';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { errorLogPath, logError } from '../errorLog';
import { buildReport, readLogTail, reportFileName } from '../services/problemReport';
import { licenseStatus } from './license';
import { pickSavePath } from './files';

/** آخر تقريرٍ حُفظ — وحده يُرى في مجلّده (لا مسارٌ تعطيه الواجهة). */
let lastReport: string | null = null;

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
    const log = errorLogPath();
    const text = buildReport({
      note: String(note ?? ''),
      info: {
        version: app.getVersion(),
        os: `Windows ${release()}`,
        arch: arch(),
        memoryGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
        freeMemoryGb: Math.round((freemem() / 1024 ** 3) * 10) / 10,
        license
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
}
