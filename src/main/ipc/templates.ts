import { readFile, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { getDb } from '../db';
import * as svc from '../services/templates';
import { importTemplateFile, parseTemplateXml } from '../services/import';
import { libraryToXml, splitLibraryXml, templateToDocx, templateToXml } from '../services/export';
import { getDefaultLetterhead, getLetterhead } from '../services/letterheads';
import type { TemplateInput } from '@shared/template';

/** الطبقة رقيقة عمدًا: المنطق في services ليبقى قابلًا للاختبار بلا Electron. */
export function registerTemplateIpc(): void {
  ipcMain.handle('templates:list', (_e, category: string | null) =>
    svc.listTemplates(getDb(), category)
  );
  ipcMain.handle('templates:get', (_e, id: number) => svc.getTemplate(getDb(), id));
  ipcMain.handle('templates:categories', () => svc.listCategories(getDb()));
  ipcMain.handle('templates:stats', () => svc.templateStats(getDb()));
  ipcMain.handle('templates:save', (_e, input: TemplateInput) => svc.saveTemplate(getDb(), input));
  ipcMain.handle('templates:usage', (_e, id: number) => svc.templateUsage(getDb(), id));
  ipcMain.handle('templates:delete', (_e, id: number) => svc.deleteTemplate(getDb(), id));

  /** الاستيراد يفتح الحوار من داخل التطبيق ويقرأ الملف بنفسه — لا Word يُفتح. */
  ipcMain.handle('templates:importFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'استيراد نموذج',
      buttonLabel: 'استيراد',
      properties: ['openFile'],
      filters: [{ name: 'نماذج', extensions: ['docx', 'xml'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return importTemplateFile(result.filePaths[0]);
  });

  /** تصدير نموذج واحد — الصيغة تُستنتج من الامتداد الذي يختاره المكتب في الحوار. */
  ipcMain.handle('templates:export', async (e, id: number) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const db = getDb();
    const t = svc.getTemplate(db, id);
    if (!t) return null;

    const safe = t.title.replace(/[\/:*?"<>|]/g, '-').slice(0, 60);
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير النموذج',
      defaultPath: `${safe}.xml`,
      filters: [
        { name: 'نموذج ديوان (يُستورد ثانيةً)', extensions: ['xml'] },
        { name: 'مستند Word', extensions: ['docx'] }
      ]
    });
    if (result.canceled || !result.filePath) return null;

    if (result.filePath.toLowerCase().endsWith('.docx')) {
      const letterhead = t.letterheadId
        ? getLetterhead(db, t.letterheadId)
        : getDefaultLetterhead(db);
      await writeFile(result.filePath, await templateToDocx(t, letterhead));
    } else {
      await writeFile(result.filePath, templateToXml(t), 'utf8');
    }
    return result.filePath;
  });

  /** تصدير المكتبة كاملة في ملف واحد — يُسترجع لاحقًا بزرّ الاسترجاع. */
  ipcMain.handle('templates:exportLibrary', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const db = getDb();
    const all = svc
      .listTemplates(db)
      .map((t) => svc.getTemplate(db, t.id))
      .filter((t): t is NonNullable<typeof t> => t !== null);
    if (all.length === 0) throw new Error('لا نماذج لتصديرها');

    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير المكتبة كاملة',
      defaultPath: `diwan-library-${stamp}.xml`,
      filters: [{ name: 'مكتبة ديوان', extensions: ['xml'] }]
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, libraryToXml(all), 'utf8');
    return { path: result.filePath, count: all.length };
  });

  /** استرجاع مكتبة مصدَّرة. الكود المكرَّر يُتخطّى فلا يُفسد ما هو قائم. */
  ipcMain.handle('templates:restoreLibrary', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'استرجاع مكتبة',
      buttonLabel: 'استرجاع',
      properties: ['openFile'],
      filters: [{ name: 'مكتبة ديوان', extensions: ['xml'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const xml = await readFile(result.filePaths[0], 'utf8');
    const chunks = splitLibraryXml(xml);
    if (chunks.length === 0) throw new Error('الملف لا يحتوي نماذج');

    const db = getDb();
    let added = 0;
    let skipped = 0;
    for (const chunk of chunks) {
      const parsed = parseTemplateXml(chunk);
      if (!parsed.title) continue;
      if (parsed.code && svc.isCodeTaken(db, parsed.code, null)) {
        skipped++;
        continue;
      }
      svc.saveTemplate(db, {
        id: null,
        code: parsed.code,
        title: parsed.title,
        subtitle: parsed.subtitle,
        category: parsed.category,
        subjectLine: parsed.subjectLine,
        bodyHtml: parsed.body,
        letterheadId: null,
        variables: parsed.variables
      });
      added++;
    }
    return { added, skipped };
  });

  /** نسخة احتياطية كاملة للنماذج والمسودات — ملف JSON واحد يختار المكتب مكانه. */
  ipcMain.handle('templates:backup', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const db = getDb();
    const payload = {
      exportedAt: new Date().toISOString(),
      templates: svc.listTemplates(db).map((t) => svc.getTemplate(db, t.id)),
      drafts: svc.listDrafts(db)
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(win, {
      title: 'نسخ احتياطي للنماذج والمسودات',
      defaultPath: `diwan-templates-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return result.filePath;
  });

  // ── المسودات ───────────────────────────────────────────────────────
  ipcMain.handle('drafts:list', () => svc.listDrafts(getDb()));
  ipcMain.handle(
    'drafts:save',
    (
      _e,
      input: {
        id: number | null;
        templateId: number | null;
        citizenId: number | null;
        title: string;
        values: Record<string, string>;
        bodyHtml: string;
      }
    ) => svc.saveDraft(getDb(), input)
  );
  ipcMain.handle('drafts:delete', (_e, id: number) => svc.deleteDraft(getDb(), id));
}
