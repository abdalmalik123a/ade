import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { BrowserWindow, ipcMain } from 'electron';
import { getDb, storeDir } from '../db';
import * as svc from '../services/documents';
import { issueBatch, issueDocument, issueTransaction, linkTransactionCitizen } from '../services/issue';
import { listDocuments, type ListOptions, periodStats } from '../services/documentList';
import { verifyArchive } from '../services/archiveVerify';
import { assertNotVoid, recordPrint, recordReprint } from '../services/printRecords';
import { searchOthers } from '../services/search';
import { printSheet, renderPdf } from '../services/render';
import { sheetStyle } from '../services/sheetStyle';
import { reportToExcel } from '../services/export';
import { pickSavePath } from './files';
import type {
  IssueInput,
  IssueOutcome,
  TransactionInput,
  TransactionResult
} from '@shared/api';
import { isoDate } from '@shared/dates'; // اسم الملف بيوم المكتب لا بيوم UTC

/**
 * الإصدار والإخراج.
 *
 * الطباعة والحفظ يمرّان من هنا وحدهما: الواجهة ترسل علامات الورقة، والعملية
 * الرئيسية ترسمها في نافذة بمقاس A4 الحقيقي — فما يخرج من الطابعة هو نفسه
 * ما رآه الموظف في المعاينة، لا تقريبٌ له.
 */

export function win(e: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender);
}

/** اسم ملف صالح على ويندوز: رقم الصادر يحمل شرطات مائلة. */
export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-').trim() || 'كتاب';
}

export async function saveAs(
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

/**
 * تحت المِقْود وحده (`DIWAN_TEST_SLOW_ISSUE` بالملّي ثانية): يتمهّل القيد بعد كلّ كتاب،
 * فيُقتل البرنامج والدفعة في منتصف قيدها — ويُفحص أنها لم تصدر نصفًا. ولا أثر له بدونه.
 */
const testPause = (): (() => void) | undefined => {
  const ms = Number((__DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_SLOW_ISSUE'] : undefined) ?? 0);
  if (!ms) return undefined;
  const cell = new Int32Array(new SharedArrayBuffer(4));
  return () => void Atomics.wait(cell, 0, 0, ms);
};

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
      const issued = issueDocument(db, { ...input, serialYear: thisYear(), style: sheetStyle() });

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
        // بلا طابعة مختارة — أو طلب الموظف إعدادات ويندوز — يُفتح حوار النظام.
        silent: Boolean(input.printer) && !input.printDialog,
        parent: w
      });
      // تُقيَّد الطبعة حين تتمّ — لا مع الإصدار.
      if (result.ok) recordPrint(db, issued.id, { copies: input.copies, printer: input.printer ?? null, operator: input.operator ?? null });

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

  ipcMain.handle('documents:list', (_e, opts: ListOptions) => listDocuments(getDb(), opts));

  ipcMain.handle('documents:stats', (_e, opts: ListOptions) => periodStats(getDb(), opts));

  /**
   * إعادة طباعة طبق الأصل — من المتن المحفوظ لا من إعادة تركيبه، وبأنماطه يوم صدر (٢٫٤)،
   * على الطابعة التي اختارها الموظف لدور «الكتب والمعاملات» (٢٫١). وبلا طابعةٍ حوار النظام.
   */
  ipcMain.handle(
    'documents:reprint',
    async (e, ids: number[], copies: number, printer?: string | null): Promise<{ printed: number; failed: number; voided: number }> => {
      const db = getDb();
      const target = printer ?? null;
      // بلا طابعةٍ مختارة تُفتح نافذة طباعةٍ لكلّ كتاب (البند ٦) — والشاشات تسأل عنها مرّةً للمهمّة (`choosePrinter`).
      if (!target && ids.length > 1) throw new Error('طباعة أكثر من كتابٍ تحتاج طابعةً مختارة');
      const operator = (db.prepare("SELECT value FROM settings WHERE key = 'operatorName'").get() as { value: string } | undefined)?.value;

      let printed = 0;
      let failed = 0;
      let voided = 0;
      for (const id of ids) {
        const doc = svc.getDocument(db, id);
        if (!doc) {
          failed++;
          continue;
        }
        // المُبطَل لا يُطبع — يُعدّ ولا يُرسل إلى الطابعة أصلًا.
        if (doc.status === 'void') {
          voided++;
          continue;
        }
        const result = await printSheet({
          sheetHtml: doc.bodyHtml,
          deviceName: target ?? undefined,
          copies: Math.max(1, copies),
          silent: Boolean(target),
          parent: win(e),
          style: svc.documentStyle(db, id)
        });
        if (result.ok) {
          recordReprint(db, id, {
            copies: Math.max(1, copies),
            printer: target,
            operator: operator ?? null
          });
          printed++;
        } else {
          failed++;
        }
      }
      return { printed, failed, voided };
    }
  );

  ipcMain.handle('documents:exportPdf', async (e, id: number): Promise<string | null> => {
    const w = win(e);
    const doc = svc.getDocument(getDb(), id);
    if (!w || !doc) return null;
    assertNotVoid(getDb(), id);
    // بأنماطه يوم صدر — فـPDF الكتاب القديم كورقته يومها (٢٫٤).
    const pdf = await renderPdf(doc.bodyHtml, undefined, svc.documentStyle(getDb(), id));
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
      const rows = listDocuments(db, { ...opts, limit: 100000 });
      const stats = periodStats(db, opts);
      const buffer = await reportToExcel({
        title: opts.title ?? 'تقرير سجل الصادر',
        rows,
        stats
      });
      const stamp = isoDate(new Date());
      const path = await saveAs(w, buffer, `diwan-report-${stamp}.xlsx`, 'Excel', 'xlsx');
      return path ? { path, count: rows.length } : null;
    }
  );

  /**
   * معاملة الزبون الواحد: خمس أوراق تصدر قيدًا واحدًا، ولكلٍّ رقمها وبصمتها.
   *
   * والطباعة بعد الإصدار في طلبٍ مستقلّ (`documents:printIssued`): كانت هنا ورقةً ورقة بحوار
   * النظام لكلٍّ منها، ونتيجتها تُرمى — فلا يعرف الموظف ما لم يُطبع (خطة Production، ٢٫٣).
   */
  ipcMain.handle(
    'documents:issueTransaction',
    (_e, input: TransactionInput): TransactionResult =>
      issueTransaction(getDb(), { ...input, serialYear: thisYear(), style: sheetStyle() })
  );

  /**
   * الدمج: معاملةٌ لكل اسم، والدفعة كلّها أو لا شيء. والطباعة بعد أن تُقيَّد كلّها — فورقةٌ لم
   * تُطبع تُعاد من الأرشيف، أمّا رقمٌ حُرق على كتابٍ لم يُقيَّد فلا يُستردّ.
   */
  ipcMain.handle('documents:issueBatch', (_e, inputs: TransactionInput[]): TransactionResult[] => {
    const style = sheetStyle();
    return issueBatch(getDb(), inputs.map((one) => ({ ...one, serialYear: thisYear(), style })), testPause());
  });

  ipcMain.handle('documents:repeatSource', (_e, id: number) => svc.repeatSource(getDb(), Number(id)));

  /** الإبطال بسببه (د٣)، والتحقّق من سلامة الأرشيف (د٥)، وسجلّ التدقيق (د٤). */
  ipcMain.handle('documents:void', (_e, id: number, reason: string, operator: string | null) =>
    svc.voidDocument(getDb(), Number(id), String(reason ?? ''), operator ?? null)
  );
  ipcMain.handle('documents:verify', () => verifyArchive(getDb()));
  ipcMain.handle(
    'audit:list',
    (_e, opts?: { entity?: string | null; documentId?: number | null; query?: string; limit?: number }) =>
      svc.listAudit(getDb(), opts ?? {})
  );
  ipcMain.handle('search:others', (_e, query: string) => searchOthers(getDb(), String(query ?? '')));

  ipcMain.handle('documents:linkCitizen', (_e, transactionId: number, citizenId: number) =>
    linkTransactionCitizen(getDb(), Number(transactionId), Number(citizenId))
  );
}
