/**
 * الإخراج: أوراقٌ صدرت تُطبع بسجلٍّ يُستأنف، والورقة الجارية في المحرّر طباعةً وPDF وصورةً وWord، وورقة المعايرة،
 * و`today:*` معها لأنّها تقرأ سجلّ الطباعة — جملٌ نُقلت من `registerDocumentIpc` في `documents.ts` كما هي (D80).
 */
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { isJobId, printJournal, runJob, type PrintJob } from '../services/printJobs';
import { getDb, storeDir } from '../db';
import { storeFile } from '../services/localPaths';
import { readStoreSync } from '../services/storeCrypt';
import * as svc from '../services/documents';
import { addPrintedCopy, recordPrint } from '../services/printRecords';
import { markWeekSeen, todayAgenda } from '../services/today';
import { now } from '../clock';
import { printSheet, renderPdf, renderPng } from '../services/render';
import { calibrationSheet } from '../services/calibration';
import { docToDocx } from '../services/docDocx';
import { fillDoc } from '@shared/docFill';
import type { Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import { autoBackupState } from './backup';
import { safeName, saveAs, win } from './documents';
import { valuesOnlySheet } from '@shared/docHtml';

/** `full` الورقة كما رُئيت، و`values` القيم وحدها على استمارةٍ مطبوعةٍ مسبقًا. */
type PrintMode = 'full' | 'values';

/** مهمّةُ طباعةٍ مقاسُها من كلّ ورقةٍ لا للمهمّة كلّها. */
const PER_SHEET_PAGE = { w: 0, h: 0 };

/** والأرشيف يقيّد الورقة كاملةً أبدًا — «القيم وحدها» طريقةُ طباعةٍ لا صورةُ الكتاب. */
const forPrint = (sheetHtml: string, mode: PrintMode) => (mode === 'values' ? valuesOnlySheet(sheetHtml) : sheetHtml);

export function registerOutputIpc(): void {
  /**
   * أوراقٌ صدرت تُطبع على طابعةٍ اختارها الموظف (خطة Production، ٢٫٣): ورقةً ورقة بسجلٍّ على
   * القرص، بلا حوار — فتُعرف نتيجة كلّ ورقة، ويُستأنف ما لم يُطبع ولو انقطعت الكهرباء — وبأنماط
   * الكتب يوم صدرت. وكلّ كتابٍ تُقيَّد طبعته حين يُرسل (`docIds`): الأولى «إصدار أول»، و«أعد الطبع» إعادةٌ طبق الأصل.
   */
  ipcMain.handle(
    'documents:printIssued',
    async (e, req: { ids: number[]; printer: string | null; mode?: PrintMode; label?: string; copies?: number }) => {
      const db = getDb();
      const docs = (Array.isArray(req.ids) ? req.ids : [])
        .map((id) => svc.getDocument(db, Number(id)))
        .filter((d): d is NonNullable<typeof d> => d !== null && d.status !== 'void');
      // النسخ (د٣): مجموعاتٌ مرتّبة — المعاملة كاملةً ثم ثانيةً — ورقةً ورقة في المهمّة نفسها، فيُعدّ ما خرج
      // فعلًا ويُستأنف منه بعد انقطاع الكهرباء.
      const copies = Math.min(99, Math.max(1, Math.round(Number(req.copies) || 1)));
      if (!req.printer) return { ok: false, sent: 0, total: docs.length * copies, reason: 'لم تُختر طابعة', journaled: false };
      if (!docs.length) return { ok: true, sent: 0, total: 0, journaled: false };
      const sets = Array.from({ length: copies }, () => docs).flat();
      const job = journal().create({
        label: req.label ?? `${docs.length} ورقة — ${docs[0]!.serial}`,
        printer: req.printer,
        // ٠×٠: لكلّ ورقةٍ مقاسها (`sendSheet`) — فمعاملةٌ فيها فولسكاب وA4 لا تُطبع كلّها على مقاسٍ واحد.
        page: PER_SHEET_PAGE,
        duplex: false,
        pages: sets.map((d) => forPrint(d.bodyHtml, req.mode ?? 'full')),
        docIds: sets.map((d) => d.id),
        // أوراق المهمّة الواحدة صدرت معًا فأنماطها واحدة.
        styleHash: svc.documentStyleHash(db, docs[0]!.id)
      });
      return { ...(await runJob(journal(), job.id, 0, sendSheet(e), progress(e, job.id))), journaled: true, id: job.id };
    }
  );

  // ── إخراج الورقة الجارية في المحرر (قبل الإصدار أو بلا إصدار) ─────────
  ipcMain.handle(
    'output:print',
    async (
      e,
      payload: {
        sheetHtml: string;
        printer: string | null;
        copies: number;
        silent: boolean;
        page?: { w: number; h: number };
        duplex?: boolean;
      }
    ) =>
      printSheet({
        sheetHtml: payload.sheetHtml,
        deviceName: payload.printer ?? undefined,
        copies: Math.max(1, payload.copies),
        silent: payload.silent && Boolean(payload.printer),
        parent: win(e),
        page: payload.page,
        duplex: payload.duplex
      })
  );

  // ── الطباعة الكبيرة بسجلٍّ يُستأنف بعد انقطاع الكهرباء ─────────────
  const journal = () => printJournal(join(app.getPath('userData'), 'print-jobs'));
  const sendSheet = (e: Electron.IpcMainInvokeEvent) => async (pages: string[], job: PrintJob, sheet: number) => {
    const out = await printSheet({
      sheetHtml: pages.join(''),
      deviceName: job.printer,
      silent: true,
      parent: win(e),
      // مهمّةٌ بلا مقاسٍ صريح تقرأه من الورقة نفسها (`data-page`)، وإلا فمقاس المهمّة.
      page: job.page.w > 0 && job.page.h > 0 ? job.page : undefined,
      duplex: job.duplex,
      style: svc.styleByHash(getDb(), job.styleHash)
    });
    // أوراق «السجلّ»: تُقيَّد طبعة كلّ كتابٍ حين يُرسل — ولو بعد استئنافٍ من حيث انقطعت. وأوّل ورقةٍ للكتاب في
    // المهمّة طبعته، وما بعدها من النسخ (د٣) يزيد نسخ تلك الطبعة نفسها — لا «إعادة طباعة».
    if (out.ok && job.docIds) {
      const db = getDb();
      const operator = (db.prepare("SELECT value FROM settings WHERE key = 'operatorName'").get() as { value: string } | undefined)?.value ?? null;
      const from = sheet * job.perSheet;
      job.docIds.slice(from, from + job.perSheet).forEach((id, k) => {
        try {
          if (job.docIds!.indexOf(id) < from + k) addPrintedCopy(db, id);
          else recordPrint(db, id, { copies: 1, printer: job.printer, operator });
        } catch {
          // الورقة طُبعت؛ وتقييدها لا يوقف الدفعة.
        }
      });
    }
    return out;
  };
  const progress = (e: Electron.IpcMainInvokeEvent, id: string) => (sent: number, total: number) => {
    if (!e.sender.isDestroyed()) e.sender.send('print:progress', { id, sent, total });
  };

  /**
   * دفعةٌ كبيرة إلى طابعةٍ معروفة: ورقةً ورقة، وسجلٌّ على القرص بعد كلٍّ منها.
   * وبلا طابعةٍ مختارة لا سجلّ: حوارُ النظام يختار الطابعة، والدفعة مهمّةٌ واحدة.
   */
  ipcMain.handle(
    'output:printJob',
    async (
      e,
      payload: { label: string; pages: string[]; printer: string | null; page: { w: number; h: number }; duplex: boolean }
    ) => {
      if (!payload.printer) {
        const out = await printSheet({ sheetHtml: payload.pages.join(''), silent: false, parent: win(e), page: payload.page, duplex: payload.duplex });
        return { ...out, journaled: false, sent: out.ok ? payload.pages.length : 0, total: payload.pages.length };
      }
      const job = journal().create({ label: payload.label, printer: payload.printer, page: payload.page, duplex: payload.duplex, pages: payload.pages });
      return { ...(await runJob(journal(), job.id, 0, sendSheet(e), progress(e, job.id))), journaled: true, id: job.id };
    }
  );
  ipcMain.handle('output:pendingJobs', () => journal().pending());
  /** «التنبيهات» (د٧): من القاعدة، ومعها ما انقطع من الطباعة. */
  ipcMain.handle('today:agenda', () => todayAgenda(getDb(), journal().pending(), now(), autoBackupState()));
  ipcMain.handle('today:weekSeen', () => markWeekSeen(getDb(), now()));
  // المعرّف بنمطه، والموضع عددٌ صحيح غير سالب — وما يخالف يُرفض عند حدّ القناة بلا لمس القرص (و٤).
  ipcMain.handle('output:resumeJob', async (e, id: unknown, from: unknown) => {
    if (!isJobId(id) || typeof from !== 'number' || !Number.isInteger(from) || from < 0) throw new Error('طلب استئنافٍ غير صالح');
    return { ...(await runJob(journal(), id, from, sendSheet(e), progress(e, id))), journaled: true, id };
  });
  ipcMain.handle('output:discardJob', (_e, id: unknown) => {
    if (!isJobId(id)) throw new Error('رقم الدفعة غير صالح');
    journal().finish(id);
  });

  // ورقة المعايرة بلا إزاحة — فهي ما تُقاس به الإزاحة.
  ipcMain.handle('output:printCalibration', async (e, printer: string | null) =>
    printSheet({ sheetHtml: calibrationSheet(), deviceName: printer ?? undefined, silent: false, parent: win(e), raw: true })
  );

  ipcMain.handle(
    'output:savePdf',
    async (
      e,
      payload: { sheetHtml: string; suggestedName: string; page?: { w: number; h: number } }
    ): Promise<string | null> => {
      const w = win(e);
      if (!w) return null;
      const pdf = await renderPdf(payload.sheetHtml, payload.page);
      return saveAs(w, pdf, `${safeName(payload.suggestedName)}.pdf`, 'PDF', 'pdf');
    }
  );

  ipcMain.handle(
    'output:savePng300',
    async (
      e,
      payload: { sheetHtml: string; suggestedName: string; page?: { w: number; h: number } }
    ): Promise<string | null> => {
      const w = win(e);
      if (!w) return null;
      const png = await renderPng(payload.sheetHtml, 300, payload.page);
      return saveAs(w, png, `${safeName(payload.suggestedName)}-300dpi.png`, 'صورة PNG', 'png');
    }
  );

  /**
   * الكتاب إلى Word بتنسيقه (تعميق الموجود ٩): من وثيقته وقيمه وترويسته — لا من علامات ورقته
   * نصًّا مسطَّحًا كما كان، فتبقى الجداول والأعمدة والمحاذاة والعريض والصور.
   */
  ipcMain.handle(
    'output:saveDocx',
    async (
      e,
      payload: {
        doc: Doc;
        values: Record<string, string>;
        head: { layout: LetterheadLayout; registry?: { number: string; date: string } } | null;
        suggestedName: string;
        title: string;
      }
    ): Promise<string | null> => {
      const w = win(e);
      if (!w) return null;
      // صور الوثيقة والترويسة من المخزن — ملفٌّ موجودٌ داخله وحده (`storeFile`)، كما في بروتوكول `diwan://`.
      const image = (src: string) => {
        const file = storeFile(storeDir(), src);
        return file ? readStoreSync(file) : null;
      };
      const docx = await docToDocx(fillDoc(payload.doc, payload.values), {
        title: payload.title,
        blanks: true,
        head: payload.head ?? undefined,
        image
      });
      return saveAs(w, docx, `${safeName(payload.suggestedName)}.docx`, 'مستند Word', 'docx');
    }
  );
}
