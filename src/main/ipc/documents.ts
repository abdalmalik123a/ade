import { ipcMain } from 'electron';
import { getDb } from '../db';
import { peekSerial } from '../services/documents';

export function registerDocumentIpc(): void {
  ipcMain.handle('documents:peekSerial', (_e, prefix: string, year: number) =>
    peekSerial(getDb(), prefix, year)
  );
}
