import { join } from 'node:path';
import { writeFile, readFile, unlink, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { app, BrowserWindow, ipcMain } from 'electron';
import { printJournal, runJob, type PrintJob } from '../services/printJobs';
import { zip } from 'fflate';
import { getDb, dataDir, storeDir } from '../db';
import * as svc from '../services/documents';
import { printSheet, calibrationSheet, renderPdf, renderPng } from '../services/render';
import { reportToExcel, sheetToDocx } from '../services/export';
import { pickSavePath } from './files';
import { valuesOnlySheet } from '@shared/docHtml';

/** `full` الورقة كما رُئيت، و`values` القيم وحدها على استمارةٍ مطبوعةٍ مسبقًا. */
type PrintMode = 'full' | 'values';

/** والأرشيف يقيّد الورقة كاملةً أبدًا — «القيم وحدها» طريقةُ طباعةٍ لا صورةُ الكتاب. */
const forPrint = (sheetHtml: string, mode: PrintMode) => (mode === 'values' ? valuesOnlySheet(sheetHtml) : sheetHtml);
import type {
  IssueInput,
  IssueOutcome,
  TransactionInput,
  TransactionResult
} from '@shared/api';

/**
 * الإصدار والإخراج.
 *
 * الطباعة والحفظ يمرّان من هنا وحدهما: الواجهة ترسل علامات الورقة، والعملية
 * الرئيسية ترسمها في نافذة بمقاس A4 الحقيقي — فما يخرج من الطابعة هو نفسه
 * ما رآه الموظف في المعاينة، لا تقريبٌ له.
 */

function win(e: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender);
}

/** اسم ملف صالح على ويندوز: رقم الصادر يحمل شرطات مائلة. */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-').trim() || 'كتاب';
}

async function saveAs(
  window: BrowserWindow,
  data: Buffer,
  suggestedName: string,
  filterName: string,
  ext: string
): Promise<string | null> {
  const path = await pickSavePath(window, {
    title: 'حفظ باسم',
    defaultName: suggestedName,
    filterName,
    ext
  });
  if (!path) return null;
  await writeFile(path, data);
  return path;
}

/**
 * سنة القيد سنةُ يوم الإصدار — تُقرأ هنا لحظة الإصدار، لا من الواجهة ولا من الإعدادات.
 *
 * كانت «سنة السجل» خانةً تُحفظ مع إعدادات المكتب، فتثبت على سنتها: يُفتح البرنامج
 * في ٢ كانون الثاني فيُكمل ترقيم السنة الماضية. وكذا برنامجٌ بقي مفتوحًا ليلة رأس
 * السنة يحمل إعداداتٍ قرأها أمس.
 */
const thisYear = () => new Date().getFullYear();

export function registerDocumentIpc(): void {
  svc.prepareDocuments(getDb());

  /**
   * الإصدار كاملًا في نداء واحد: قيد في السجل ببصمته ورقمه ورمزه، ثم نسخة PDF
   * مؤرشفة داخل مخزن التطبيق، ثم الطباعة. لو فشلت الطباعة بقي الكتاب مسجّلًا —
   * فالرقم استُهلك فعلًا، وإخفاء ذلك يُفسد تسلسل الصادر.
   */
  ipcMain.handle(
    'documents:issue',
    async (e, input: IssueInput, print: boolean): Promise<IssueOutcome> => {
      const db = getDb();
      const issued = svc.issueDocument(db, { ...input, serialYear: thisYear() });

      let archivedPath: string | null = null;
      let archiveError: string | undefined;
      try {
        const pdf = await renderPdf(issued.sheetHtml);
        const rel = join('documents', `${safeName(issued.serial)}.pdf`);
        await writeFile(join(storeDir('documents'), `${safeName(issued.serial)}.pdf`), pdf);
        db.prepare('UPDATE documents SET rendered_path = ? WHERE id = ?').run(rel, issued.id);
        archivedPath = rel;
      } catch (e) {
        // الأرشفة تكميلية: الكتاب مقيَّد في القاعدة بمتنه كاملًا حتى لو تعذّر PDF.
        // لكنها لا تسقط صامتة — الواجهة تُبلِّغ، فيعرف المكتب أن نسخته لم تُحفظ.
        archiveError = e instanceof Error ? e.message : String(e);
      }

      if (!print) {
        return {
          id: issued.id,
          serial: issued.serial,
          sha256: issued.sha256,
          printed: 'skipped',
          archivedPath,
          archiveError
        };
      }

      const w = win(e);
      const result = await printSheet({
        sheetHtml: issued.sheetHtml,
        deviceName: input.printer ?? undefined,
        copies: Math.max(1, input.copies),
        // بلا طابعة مختارة يُفتح حوار النظام بدل أن تُبتلع الورقة صامتةً.
        silent: Boolean(input.printer),
        parent: w
      });

      return {
        id: issued.id,
        serial: issued.serial,
        sha256: issued.sha256,
        printed: result.ok ? 'ok' : 'failed',
        printError: result.ok ? undefined : result.reason,
        archivedPath,
        archiveError
      };
    }
  );

  ipcMain.handle('documents:get', (_e, id: number) => svc.getDocument(getDb(), id));

  ipcMain.handle('documents:list', (_e, opts: svc.ListOptions) => svc.listDocuments(getDb(), opts));

  ipcMain.handle('documents:stats', (_e, opts: svc.ListOptions) => svc.periodStats(getDb(), opts));

  /** إعادة طباعة طبق الأصل — من المتن المحفوظ لا من إعادة تركيبه. */
  ipcMain.handle(
    'documents:reprint',
    async (e, ids: number[], copies: number): Promise<{ printed: number; failed: number }> => {
      const db = getDb();
      const settings = db.prepare("SELECT value FROM settings WHERE key = 'defaultPrinter'").get() as
        | { value: string }
        | undefined;
      const operator = (
        db.prepare("SELECT value FROM settings WHERE key = 'operatorName'").get() as
          | { value: string }
          | undefined
      )?.value;

      let printed = 0;
      let failed = 0;
      for (const id of ids) {
        const doc = svc.getDocument(db, id);
        if (!doc) {
          failed++;
          continue;
        }
        const result = await printSheet({
          sheetHtml: doc.bodyHtml,
          deviceName: settings?.value,
          copies: Math.max(1, copies),
          silent: Boolean(settings?.value),
          parent: win(e)
        });
        if (result.ok) {
          svc.recordReprint(db, id, {
            copies: Math.max(1, copies),
            printer: settings?.value ?? null,
            operator: operator ?? null
          });
          printed++;
        } else {
          failed++;
        }
      }
      return { printed, failed };
    }
  );

  ipcMain.handle('documents:exportPdf', async (e, id: number): Promise<string | null> => {
    const w = win(e);
    const doc = svc.getDocument(getDb(), id);
    if (!w || !doc) return null;
    const pdf = await renderPdf(doc.bodyHtml);
    return saveAs(w, pdf, `${safeName(doc.serial)}.pdf`, 'PDF', 'pdf');
  });

  ipcMain.handle(
    'documents:exportReport',
    async (
      e,
      opts: { from?: string | null; to?: string | null; query?: string; title?: string }
    ): Promise<{ path: string; count: number } | null> => {
      const w = win(e);
      if (!w) return null;
      const db = getDb();
      const rows = svc.listDocuments(db, { ...opts, limit: 100000 });
      const stats = svc.periodStats(db, opts);
      const buffer = await reportToExcel({
        title: opts.title ?? 'تقرير سجل الصادر',
        rows,
        stats
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const path = await saveAs(w, buffer, `diwan-report-${stamp}.xlsx`, 'Excel', 'xlsx');
      return path ? { path, count: rows.length } : null;
    }
  );

  /**
   * معاملة الزبون الواحد: خمس أوراق تصدر قيدًا واحدًا، ولكلٍّ رقمها وبصمتها.
   *
   * الطباعة بعد الإصدار لا قبله — والرسم من الطريق نفسه الذي تسلكه الورقة
   * المفردة، فلا يختلف ما يخرج من الطابعة عمّا رآه الموظف.
   */
  ipcMain.handle(
    'documents:issueTransaction',
    async (e, input: TransactionInput, print: boolean, mode: PrintMode = 'full'): Promise<TransactionResult> => {
      const out = svc.issueTransaction(getDb(), { ...input, serialYear: thisYear() });
      if (print) {
        const win = BrowserWindow.fromWebContents(e.sender);
        for (const doc of out.documents) {
          try {
            await printSheet({
              sheetHtml: forPrint(doc.sheetHtml, mode),
              deviceName: input.printer ?? undefined,
              parent: win ?? null
            });
          } catch {
            // ورقةٌ لم تُطبع لا تُلغي المعاملة — الكتب مقيَّدة وتُعاد طباعتها.
          }
        }
      }
      return out;
    }
  );

  /**
   * الدمج: معاملةٌ لكل اسم، والدفعة كلّها أو لا شيء.
   *
   * والطباعة بعد أن تُقيَّد الدفعة كلّها — فورقةٌ لم تُطبع تُعاد طباعتها من
   * الأرشيف، أما رقمٌ حُرق على كتاب لم يُقيَّد فلا يُستردّ.
   */
  ipcMain.handle(
    'documents:issueBatch',
    async (e, inputs: TransactionInput[], print: boolean, mode: PrintMode = 'full'): Promise<TransactionResult[]> => {
      const all = svc.issueBatch(getDb(), inputs.map((one) => ({ ...one, serialYear: thisYear() })));
      if (print) {
        const win = BrowserWindow.fromWebContents(e.sender);
        for (const out of all) {
          for (const doc of out.documents) {
            try {
              await printSheet({
                sheetHtml: forPrint(doc.sheetHtml, mode),
                deviceName: inputs[0]?.printer ?? undefined,
                parent: win ?? null
              });
            } catch {
              // ورقةٌ لم تُطبع لا تُلغي الدفعة — الكتب مقيَّدة وتُعاد طباعتها.
            }
          }
        }
      }
      return all;
    }
  );

  ipcMain.handle('documents:repeatSource', (_e, id: number) => svc.repeatSource(getDb(), Number(id)));

  ipcMain.handle('documents:linkCitizen', (_e, transactionId: number, citizenId: number) =>
    svc.linkTransactionCitizen(getDb(), Number(transactionId), Number(citizenId))
  );

  /**
   * نسخة احتياطية فورية: قاعدة البيانات ومخزن الملفات في أرشيف واحد.
   * القاعدة تُنسخ بـVACUUM INTO فتخرج نسخة متّسقة ولو كان هناك كتاب يُصدَّر الآن.
   */
  ipcMain.handle('documents:backup', async (e): Promise<{ path: string; bytes: number } | null> => {
    const w = win(e);
    if (!w) return null;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const target = await pickSavePath(w, {
      title: 'نسخة احتياطية كاملة',
      defaultName: `diwan-backup-${stamp}.zip`,
      filterName: 'أرشيف مضغوط',
      ext: 'zip'
    });
    if (!target) return null;

    const snapshot = join(dataDir(), `backup-${stamp}.db`);
    if (existsSync(snapshot)) await unlink(snapshot);
    getDb().exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);

    const files: Record<string, Uint8Array> = {
      'diwan.db': new Uint8Array(await readFile(snapshot))
    };

    const root = storeDir();
    const walk = async (dir: string, prefix: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full, `${prefix}${entry.name}/`);
        else files[`store/${prefix}${entry.name}`] = new Uint8Array(await readFile(full));
      }
    };
    await walk(root, '');

    const archive = await new Promise<Uint8Array>((resolve, reject) => {
      zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
    });
    await writeFile(target, archive);
    await unlink(snapshot);

    const info = await stat(target);
    return { path: target, bytes: info.size };
  });

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
  const sendSheet = (e: Electron.IpcMainInvokeEvent) => (pages: string[], job: PrintJob) =>
    printSheet({
      sheetHtml: pages.join(''),
      deviceName: job.printer,
      silent: true,
      parent: win(e),
      page: job.page,
      duplex: job.duplex
    });
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
  ipcMain.handle('output:resumeJob', async (e, id: string, from: number) => ({
    ...(await runJob(journal(), id, Math.max(0, from), sendSheet(e), progress(e, id))),
    journaled: true,
    id
  }));
  ipcMain.handle('output:discardJob', (_e, id: string) => journal().finish(id));

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

  ipcMain.handle(
    'output:saveDocx',
    async (
      e,
      payload: { sheetHtml: string; suggestedName: string; title: string }
    ): Promise<string | null> => {
      const w = win(e);
      if (!w) return null;
      const docx = await sheetToDocx(payload.sheetHtml, payload.title);
      return saveAs(w, docx, `${safeName(payload.suggestedName)}.docx`, 'مستند Word', 'docx');
    }
  );
}
