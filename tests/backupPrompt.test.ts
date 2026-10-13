/**
 * اختبارات تنبيه النسخ الاحتياطي التلقائي بعد أول كتاب رسمي (المرحلة A، ٣ والجواب ٢).
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  AUTO_BACKUP_PROMPT_KEY,
  markAutoBackupPromptShown,
  shouldPromptAutoBackupAfterFirstIssue
} from '../src/main/services/backupPrompt';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial TEXT NOT NULL
    );
  `);
  return db;
}

describe('تنبيه النسخ الاحتياطي التلقائي بعد أول كتاب رسمي (المرحلة A — ٣ والجواب ٢)', () => {
  it('لا يظهر التنبيه قبل إصدار أول كتاب رسمي', () => {
    const db = createTestDb();
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(false);
  });

  it('يظهر التنبيه بعد إصدار أول كتاب رسمي مباشرة', () => {
    const db = createTestDb();
    // إصدار أول كتاب
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/1')").run();

    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(true);
  });

  it('تسجيل حالة العرض يمنع تكرار التنبيه في الكتب التالية', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/1')").run();
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(true);

    // تسجيل العرض
    markAutoBackupPromptShown(db);

    // فحص بعد التسجيل
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(false);

    // إصدار كتاب ثانٍ وثالث
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/2')").run();
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/3')").run();

    // لا يتكرر التنبيه
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(false);
  });

  it('الحالة مسجلة في جدول settings ولا تضيع عند إعادة التشغيل', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/1')").run();
    markAutoBackupPromptShown(db);

    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(AUTO_BACKUP_PROMPT_KEY) as { value: string };
    expect(row?.value).toBe('1');
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(false);
  });

  it('يظهر التنبيه حتى لو كان النسخ الاحتياطي مضبوطًا مسبقًا (الجواب ٢)', () => {
    const db = createTestDb();
    // ضبط النسخ مسبقًا في الإعدادات
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('autoBackupDir', 'D:\\Backup', datetime('now'))").run();

    // لا يظهر قبل أول كتاب
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(false);

    // يظهر بعد أول كتاب رغم وجود الضبط المسبق
    db.prepare("INSERT INTO documents (serial) VALUES ('م/2026/1')").run();
    expect(shouldPromptAutoBackupAfterFirstIssue(db)).toBe(true);
  });
});
