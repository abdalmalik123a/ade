/**
 * اختبارات النسخ الاحتياطي قبل التحديث والتراجع الآمن (المرحلة A، ٤٫٣).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  createPreUpdateBackup,
  findLatestPreUpdateBackup,
  rollbackToPreUpdateBackup,
  verifyPreUpdateBackup,
  sha256File,
  MANIFEST_NAME,
  PRE_UPDATE_DIR
} from '../src/main/services/preUpdateBackup';
import { guardDataVersion, readDataVersion, runBootSequence } from '../src/main/services/dataVersion';

function setupOffice(version: string = '1.0.0') {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-preupdate-test-'));
  const dbFile = join(dir, 'diwan.db');
  const db = new Database(dbFile);
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
    CREATE TABLE documents (id INTEGER PRIMARY KEY, serial TEXT, issued_at TEXT);
    CREATE TABLE citizens (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE templates (id INTEGER PRIMARY KEY, title TEXT);
    INSERT INTO settings (key, value) VALUES ('appVersion', '${version}');
    INSERT INTO documents (serial, issued_at) VALUES ('م/2026/1', datetime('now'));
    INSERT INTO citizens (name) VALUES ('علي حسن');
    INSERT INTO templates (title) VALUES ('تأييد سكن');
  `);
  db.close();

  const storeDir = join(dir, 'store');
  mkdirSync(join(storeDir, 'citizens', '1'), { recursive: true });
  writeFileSync(join(storeDir, 'citizens', '1', 'id.webp'), Buffer.from('fake-id-image-data-12345'));
  writeFileSync(join(storeDir, 'logo.png'), Buffer.from('fake-logo-data'));

  return { dir, dbFile, storeDir };
}

describe('النسخ الاحتياطي قبل التحديث (٤٫٣)', () => {
  it('إنشاء نسخة احتياطية كاملة وفحص اكتمالها بنجاح مع بقاء الأصل دون تعديل', async () => {
    const { dir, dbFile, storeDir } = setupOffice('1.0.0');
    const res = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.0.0' });

    expect(res.kind).toBe('created');
    if (res.kind !== 'created') return;

    expect(existsSync(res.backupDir)).toBe(true);
    expect(existsSync(join(res.backupDir, 'diwan.db'))).toBe(true);
    expect(existsSync(join(res.backupDir, 'store', 'citizens', '1', 'id.webp'))).toBe(true);
    expect(existsSync(join(res.backupDir, 'store', 'logo.png'))).toBe(true);
    expect(existsSync(join(res.backupDir, MANIFEST_NAME))).toBe(true);

    // الأصل لم يُمسّ
    expect(existsSync(dbFile)).toBe(true);
    expect(existsSync(join(storeDir, 'logo.png'))).toBe(true);

    // التحقق من صحة الفحص
    const check = verifyPreUpdateBackup(res.backupDir);
    expect(check.ok).toBe(true);
    expect(check.version).toBe('1.0.0');
    rmSync(dir, { recursive: true, force: true });
  });

  it('فشل التحقق عند تلاعب أو عطب في قاعدة النسخة', async () => {
    const { dir } = setupOffice('1.0.0');
    const res = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.0.0' });
    if (res.kind !== 'created') throw new Error('Expected created');

    // إفساد ملف القاعدة في النسخة
    const backupDb = join(res.backupDir, 'diwan.db');
    writeFileSync(backupDb, Buffer.from('corrupted database content!'));

    const check = verifyPreUpdateBackup(res.backupDir);
    expect(check.ok).toBe(false);
    expect(check.reason).toBeDefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it('فشل التحقق عند نقص أو تلاعب في ملفات المخزن بالنسخة', async () => {
    const { dir } = setupOffice('1.0.0');
    const res = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.0.0' });
    if (res.kind !== 'created') throw new Error('Expected created');

    const targetFile = join(res.backupDir, 'store', 'logo.png');
    const origSize = readFileSync(targetFile).length;

    // تلاعب بمحتوى ملف مع الحفاظ على الحجم (فحص البصمة)
    writeFileSync(targetFile, Buffer.alloc(origSize, 0xaa));
    const checkHash = verifyPreUpdateBackup(res.backupDir);
    expect(checkHash.ok).toBe(false);
    expect(checkHash.reason).toContain('بصمة الملف');

    // تلاعب بالحجم
    writeFileSync(targetFile, Buffer.from('different-size-content'));
    const checkSize = verifyPreUpdateBackup(res.backupDir);
    expect(checkSize.ok).toBe(false);
    expect(checkSize.reason).toContain('حجم الملف');

    // حذف الملف تمامًا
    rmSync(targetFile);
    const checkMissing = verifyPreUpdateBackup(res.backupDir);
    expect(checkMissing.ok).toBe(false);
    expect(checkMissing.reason).toContain('مفقود من مخزن النسخة');

    rmSync(dir, { recursive: true, force: true });
  });

  it('رفض التحديث إذا كانت المساحة المتوفرة على القرص غير كافية', async () => {
    const { dir } = setupOffice('1.0.0');
    await expect(
      createPreUpdateBackup({
        dataDir: dir,
        currentVersion: '1.0.0',
        minFreeBytes: 100 * 1024 * 1024 * 1024 * 1024 // 100 TB (مستحيل توفرها)
      })
    ).rejects.toThrow('المساحة المتوفرة على القرص لا تكفي');
    rmSync(dir, { recursive: true, force: true });
  });

  it('البحث عن أحدث نسخة احتياطية صالحة متوافقة وتجاهل المعطوبة والأحدث', async () => {
    const { dir } = setupOffice('1.0.0');
    const res1 = await createPreUpdateBackup({
      dataDir: dir,
      currentVersion: '1.0.0',
      now: new Date('2026-10-01T10:00:00Z')
    });
    const db2 = new Database(join(dir, 'diwan.db'));
    db2.prepare("UPDATE settings SET value = '1.1.0' WHERE key = 'appVersion'").run();
    db2.close();
    const res2 = await createPreUpdateBackup({
      dataDir: dir,
      currentVersion: '1.1.0',
      now: new Date('2026-10-05T10:00:00Z')
    });

    if (res1.kind !== 'created' || res2.kind !== 'created') throw new Error('Expected created');

    // البحث عن نسخة متوافقة مع 1.0.0: يجب أن يجد 1.0.0 ويتجاهل 1.1.0 لأنها أحدث
    const found = findLatestPreUpdateBackup(dir, '1.0.0');
    expect(found).not.toBeNull();
    expect(found?.version).toBe('1.0.0');

    // البحث عن أحدث نسخة دون قيد: يجد 1.1.0
    const latest = findLatestPreUpdateBackup(dir);
    expect(latest?.version).toBe('1.1.0');

    rmSync(dir, { recursive: true, force: true });
  });

  it('التراجع إلى بيانات ما قبل التحديث مع نقل البيانات الحالية جانبًا', async () => {
    const { dir } = setupOffice('1.0.0');
    const res = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.0.0' });
    if (res.kind !== 'created') throw new Error('Expected created');

    // تم تحديث البرنامج وإضافة بيانات جديدة في 1.1.0
    const db = new Database(join(dir, 'diwan.db'));
    db.prepare("INSERT INTO documents (serial, issued_at) VALUES ('م/2026/2', datetime('now'))").run();
    db.prepare("UPDATE settings SET value = '1.1.0' WHERE key = 'appVersion'").run();
    db.close();
    writeFileSync(join(dir, 'store', 'new-after-update.txt'), 'data added after update');

    // الآن نريد التراجع إلى نسخة 1.0.0
    const rollback = rollbackToPreUpdateBackup({
      dataDir: dir,
      backupDir: res.backupDir,
      now: new Date('2026-10-10T12:00:00Z')
    });

    expect(rollback.restoredVersion).toBe('1.0.0');
    expect(existsSync(rollback.asideDir)).toBe(true);

    // التأكد من أن البيانات الأحدث تم نقلها جانبًا وحفظها
    expect(existsSync(join(rollback.asideDir, 'diwan.db'))).toBe(true);
    expect(existsSync(join(rollback.asideDir, 'store', 'new-after-update.txt'))).toBe(true);
    const asideDb = new Database(join(rollback.asideDir, 'diwan.db'), { readonly: true });
    expect(asideDb.prepare("SELECT value FROM settings WHERE key = 'appVersion'").get()).toEqual({ value: '1.1.0' });
    asideDb.close();

    // التأكد من أن البيانات المسترجعة هي بيانات ما قبل التحديث (1.0.0)
    const restoredDb = new Database(join(dir, 'diwan.db'), { readonly: true });
    expect(restoredDb.prepare("SELECT value FROM settings WHERE key = 'appVersion'").get()).toEqual({ value: '1.0.0' });
    expect(restoredDb.prepare('SELECT COUNT(*) as count FROM documents').get()).toEqual({ count: 1 });
    restoredDb.close();
    expect(existsSync(join(dir, 'store', 'new-after-update.txt'))).toBe(false);
    expect(existsSync(join(dir, 'store', 'logo.png'))).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it('الإبقاء على آخر ٣ نسخ احتياطية فقط قبل التحديث', async () => {
    const { dir } = setupOffice('1.0.0');
    for (const [i, v] of ['1.0.1', '1.0.2', '1.0.3', '1.0.4'].entries()) {
      await createPreUpdateBackup({
        dataDir: dir,
        currentVersion: v,
        now: new Date(Date.UTC(2026, 9, 1 + i))
      });
    }
    const root = join(dir, PRE_UPDATE_DIR);
    const dirs = readdirSync(root);
    expect(dirs).toHaveLength(3);
    expect(dirs.some((d) => d.startsWith('1.0.1-'))).toBe(false);
    expect(dirs.some((d) => d.startsWith('1.0.4-'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('ترقية ثم رجوع إلى الإصدار القديم: القاعدة المستعادة يفتحها الإصدار القديم دون رفض', async () => {
    const { dir, dbFile } = setupOffice('1.7.0');
    const snapshotDir = join(dir, 'before-update');

    // أخذ نسخة ما قبل التحديث قبل الترقية كما يفعل الإقلاع الجديد
    const preBackup = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.7.0' });
    expect(preBackup.kind).toBe('created');

    // ترقية القاعدة إلى 1.7.2 عبر تسلسل الإقلاع
    const bootResult = runBootSequence({
      dbFile,
      currentVersion: '1.7.2',
      snapshotDir,
      openDb: (f) => new Database(f),
      migrations: [
        (db) => {
          db.prepare("INSERT INTO documents (serial, issued_at) VALUES ('م/2026/72', datetime('now'))").run();
        }
      ]
    });
    expect(bootResult.kind).toBe('ready');
    (bootResult as { db: Database.Database }).db.close();
    expect(readDataVersion(dbFile)).toBe('1.7.2');

    // محاكاة تشغيل الإصدار القديم 1.7.0: يرفض القاعدة لأنها أحدث (1.7.2)
    const oldBoot = guardDataVersion({ file: dbFile, current: '1.7.0', snapshotDir });
    expect(oldBoot.kind).toBe('newer');
    expect((oldBoot as { from: string }).from).toBe('1.7.2');

    // الإصدار القديم 1.7.0 يبحث عن نسخة صالحة: يجد نسخة 1.7.0 ويتأكد من appVersion داخلها
    const backupCandidate = findLatestPreUpdateBackup(dir, '1.7.0');
    expect(backupCandidate).not.toBeNull();
    expect(backupCandidate?.version).toBe('1.7.0');

    // التراجع إلى النسخة المستعادة
    const rollback = rollbackToPreUpdateBackup({
      dataDir: dir,
      backupDir: backupCandidate!.dir
    });
    expect(rollback.restoredVersion).toBe('1.7.0');

    // الآن الإصدار القديم 1.7.0 يفتح القاعدة المستعادة بنجاح ودون أي رفض
    const oldBootAfterRollback = guardDataVersion({ file: dbFile, current: '1.7.0', snapshotDir });
    expect(oldBootAfterRollback.kind).toBe('same');
    expect((oldBootAfterRollback as { version: string }).version).toBe('1.7.0');
    expect(readDataVersion(dbFile)).toBe('1.7.0');

    rmSync(dir, { recursive: true, force: true });
  });

  it('تجاهل أي نسخة يدعي وصفها إصدارًا قديمًا لكن قاعدتها تحتوي بيانات أحدث', async () => {
    const { dir } = setupOffice('1.7.0');
    const res = await createPreUpdateBackup({ dataDir: dir, currentVersion: '1.7.0' });
    if (res.kind !== 'created') throw new Error('Expected created');

    // التلاعب بالقاعدة داخل مجلد النسخة لتصبح بإصدار 1.7.2
    const backupDb = join(res.backupDir, 'diwan.db');
    const db = new Database(backupDb);
    db.prepare("UPDATE settings SET value = '1.7.2' WHERE key = 'appVersion'").run();
    db.close();

    const manifestFile = join(res.backupDir, MANIFEST_NAME);
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    manifest.dbSize = statSync(backupDb).size;
    manifest.dbSha256 = sha256File(backupDb);
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

    // findLatestPreUpdateBackup لإصدار 1.7.0 يجب ألا يعرضها للتراجع إطلاقًا
    const candidate = findLatestPreUpdateBackup(dir, '1.7.0');
    expect(candidate).toBeNull();

    rmSync(dir, { recursive: true, force: true });
  });
});
