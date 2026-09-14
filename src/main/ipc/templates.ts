import { writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { getDb } from '../db';
import * as svc from '../services/templates';
import { importTemplateFile } from '../services/import';
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
