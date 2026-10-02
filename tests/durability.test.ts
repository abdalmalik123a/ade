import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { configureConnection } from '../src/main/db/pragmas';
import { printJournal } from '../src/main/services/printJobs';

/**
 * الديمومة (خطة Production، ١٫٢): القيد الذي طُبعت ورقته لا يُلغيه انقطاع الكهرباء.
 *
 * والانقطاع الحقيقي لا يُصنع في اختبار — قتل العملية يُبقي ذاكرة القرص المؤقّتة معه — فيُثبَت
 * هنا ما يمنعه: الإعداد على الاتصال نفسه، وسجلّ الطباعة يُكتب كاملًا أو لا يُكتب.
 */

const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'diwan-durable-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('ديمومة القيد', () => {
  it('اتصال القاعدة: WAL مع synchronous = FULL، والمفاتيح الأجنبية مفعّلة', () => {
    const db = new Database(join(temp(), 'diwan.db'));
    configureConnection(db);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(2); // 2 = FULL، و1 = NORMAL
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('سجلّ الطباعة يُكتب كاملًا: لا ملفّ جانبيّ يبقى، والحال تُقرأ بعد كلّ ورقة', () => {
    const dir = temp();
    const journal = printJournal(dir);
    const job = journal.create({ label: 'هويات', printer: 'Canon', page: { w: 210, h: 297 }, duplex: false, pages: ['<p>١</p>', '<p>٢</p>'] });
    journal.markSent(job.id, 1);
    expect(readdirSync(dir).filter((f) => f.endsWith('.part'))).toEqual([]);
    expect(journal.get(job.id)?.sent).toBe(1);
  });

  it('ملفٌّ جانبيٌّ بقي من كتابةٍ انقطعت لا يُفسد الاستئناف', () => {
    const dir = temp();
    const journal = printJournal(dir);
    const job = journal.create({ label: 'شهادات', printer: 'Canon', page: { w: 297, h: 210 }, duplex: false, pages: ['<p>١</p>', '<p>٢</p>', '<p>٣</p>'] });
    journal.markSent(job.id, 2);
    // انقطعت الكهرباء والكتابة التالية في ملفّها الجانبيّ: الحال المحفوظة هي آخر ما تمّ.
    writeFileSync(join(dir, `${job.id}.json.part`), '{"sent": 3, "to');
    const pending = printJournal(dir).pending();
    expect(pending.map((j) => [j.id, j.sent])).toEqual([[job.id, 2]]);
  });
});
