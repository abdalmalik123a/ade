/**
 * تنبيه إعداد النسخ الاحتياطي التلقائي بعد أول كتاب رسمي (المرحلة A، ٣ والجواب ٢).
 * يُعرض مرة واحدة فقط بعد إصدار أول كتاب رسمي، حتى لو كان النسخ مضبوطًا مسبقًا،
 * ويُسجل في قاعدة البيانات حتى لا يتكرر بعد إعادة التشغيل.
 */
import type { Database } from 'better-sqlite3';

export const AUTO_BACKUP_PROMPT_KEY = 'autoBackupPromptShown';

export function shouldPromptAutoBackupAfterFirstIssue(db: Database): boolean {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(AUTO_BACKUP_PROMPT_KEY) as
    | { value: string }
    | undefined;
  if (row?.value === '1') return false;

  const countRow = db.prepare('SELECT COUNT(*) AS c FROM documents').get() as
    | { c: number }
    | undefined;
  return (countRow?.c ?? 0) >= 1;
}

export function markAutoBackupPromptShown(db: Database): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, '1', datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
  ).run(AUTO_BACKUP_PROMPT_KEY);
}
