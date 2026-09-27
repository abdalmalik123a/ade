/** بنك الأسئلة — الجسر إلى خدمته. */
import { ipcMain } from 'electron';
import type { ListItem } from '@shared/doc';
import { getDb } from '../db';
import * as bank from '../services/questionBank';

export function registerQuestionIpc(): void {
  ipcMain.handle('bank:save', (_e, input: { item: ListItem; subject?: string | null; grade?: string | null }) =>
    bank.saveQuestion(getDb(), input)
  );
  ipcMain.handle('bank:list', (_e, filter: { query?: string; subject?: string | null; grade?: string | null }) =>
    bank.listQuestions(getDb(), filter ?? {})
  );
  ipcMain.handle('bank:facets', () => bank.bankFacets(getDb()));
  ipcMain.handle('bank:used', (_e, id: number) => bank.markQuestionUsed(getDb(), id));
  ipcMain.handle('bank:delete', (_e, id: number) => bank.deleteQuestion(getDb(), id));
}
