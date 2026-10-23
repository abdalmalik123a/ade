/** بنك الأسئلة ومسودّة ورقة الأسئلة — الجسر إلى خدمتهما. */
import { ipcMain } from 'electron';
import type { ListItem } from '@shared/doc';
import type { PaperDraft } from '@shared/api';
import type { Guard } from '@shared/bridgeGuards';
import { getDb } from '../db';
import * as bank from '../services/questionBank';
import { handleChecked } from './checked';

/** مسودّةٌ أكبر من هذا ليست ورقة أسئلة — وصور الأسئلة مساراتٌ في المخزن لا بياناتها. */
const DRAFT_MAX = 2_000_000;

/** المسودّة كائنٌ برأسٍ وأسئلة، وورقتها المحفوظة رقمٌ أو لا شيء — و`null` يمحوها. */
const draftOrNull: Guard<PaperDraft | null> = (value, name) => {
  if (value === null || value === undefined) return null;
  const d = value as Partial<PaperDraft>;
  const shaped =
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray(d.items) &&
    typeof d.head === 'object' &&
    d.head !== null &&
    (d.paperId === null || (Number.isSafeInteger(d.paperId) && Number(d.paperId) > 0));
  if (!shaped || JSON.stringify(value).length > DRAFT_MAX) throw new Error(`المعامل «${name}» مسودّة ورقة أسئلة أو لا شيء`);
  return value as PaperDraft;
};

export function registerQuestionIpc(): void {
  ipcMain.handle('bank:save', (_e, input: { item: ListItem; subject?: string | null; grade?: string | null }) =>
    bank.saveQuestion(getDb(), input)
  );
  ipcMain.handle('bank:list', (_e, filter: { query?: string; subject?: string | null; grade?: string | null }) =>
    bank.listQuestions(getDb(), filter ?? {})
  );
  ipcMain.handle('bank:used', (_e, id: number) => bank.markQuestionUsed(getDb(), id));
  ipcMain.handle('bank:delete', (_e, id: number) => bank.deleteQuestion(getDb(), id));

  // مسودّة ورقة الأسئلة (D134) في الإعدادات بنمط المعاملات المعلّقة: تبقى بعد انقطاع الكهرباء، ولا تُكتب فوق ورقةٍ محفوظة.
  // وما فسد منها لا شيء.
  handleChecked('papers:draft', {}, (): PaperDraft | null => {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'paperDraft'").get() as { value: string } | undefined;
    try {
      const draft = JSON.parse(row?.value ?? 'null') as Partial<PaperDraft> | null;
      return draft && typeof draft === 'object' && Array.isArray(draft.items) ? (draft as PaperDraft) : null;
    } catch {
      return null;
    }
  });
  handleChecked('papers:setDraft', { draft: draftOrNull }, ({ draft }) => {
    if (!draft) {
      getDb().prepare("DELETE FROM settings WHERE key = 'paperDraft'").run();
      return;
    }
    getDb()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('paperDraft', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(JSON.stringify(draft));
  });
}
