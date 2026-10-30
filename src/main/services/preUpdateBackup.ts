/**
 * النسخ الاحتياطي الكامل قبل التحديث والتراجع الآمن (المرحلة A، ٤٫٣).
 *
 * - قبل تشغيل المثبّت أو بدء أي ترحيل: تُنشأ نسخة احتياطية كاملة من قاعدة البيانات ومخزن الملفات.
 * - يُفحص اكتمال النسخة وصلاحيتها (سلامة SQLite ومطابقة أحجام وبصمات الملفات).
 * - عند تعثّر النسخ أو الفحص: يُلغى التحديث ولا يُمسّ الأصل.
 * - زر «ارجع إلى بيانات ما قبل التحديث»: يُعرض في نافذة رفض البيانات الأحدث إذا توفرت نسخة صالحة،
 *   وتُنقل البيانات الحالية جانبًا قبل استرجاع النسخة القديمة حتى لا يضيع أي عمل لاحق.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import { openDb } from '../db/dbKey';
import { compareVersions } from '@shared/version';
import { walkStore } from './backup';
import { readDataVersion } from './dataVersion';
import { writeIncompleteMarker, INCOMPLETE_MARKER } from './restoreSwap';

export const PRE_UPDATE_DIR = 'pre-update-backups';
export const MANIFEST_NAME = 'backup-manifest.json';
const KEEP = 3;

export type PreUpdateManifest = {
  app: 'diwan';
  version: string;
  createdAt: string;
  dbSize: number;
  dbSha256: string;
  files: { rel: string; size: number; sha256: string }[];
};

export type PreUpdateBackupResult =
  | { kind: 'created'; backupDir: string; version: string; fileCount: number; bytes: number }
  | { kind: 'skipped'; reason: string };

export type BackupVerification = {
  ok: boolean;
  reason?: string;
  version?: string;
  createdAt?: string;
};

export function sha256File(file: string): string {
  const hash = createHash('sha256');
  const buf = readFileSync(file);
  hash.update(buf);
  return hash.digest('hex');
}

export function getAvailableSpace(dir: string): number | null {
  try {
    if (typeof statfsSync === 'function') {
      const stats = statfsSync(dir);
      return stats.bavail * stats.bsize;
    }
  } catch {
    return null;
  }
  return null;
}

const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** فحص سلامة نسخة ما قبل التحديث */
export function verifyPreUpdateBackup(backupDir: string): BackupVerification {
  const manifestFile = join(backupDir, MANIFEST_NAME);
  if (!existsSync(manifestFile)) return { ok: false, reason: 'ملف وصف النسخة مفقود' };

  let manifest: PreUpdateManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as PreUpdateManifest;
    if (manifest.app !== 'diwan' || !manifest.version || !Array.isArray(manifest.files)) {
      return { ok: false, reason: 'ملف وصف النسخة غير صالح' };
    }
  } catch {
    return { ok: false, reason: 'تعذّرت قراءة ملف وصف النسخة' };
  }

  const dbFile = join(backupDir, 'diwan.db');
  if (!existsSync(dbFile)) return { ok: false, reason: 'ملف قاعدة البيانات مفقود من النسخة' };
  try {
    const stat = statSync(dbFile);
    if (stat.size !== manifest.dbSize) return { ok: false, reason: 'حجم قاعدة البيانات غير مطابق' };
    if (sha256File(dbFile) !== manifest.dbSha256) return { ok: false, reason: 'بصمة قاعدة البيانات غير مطابقة' };
  } catch (err) {
    return { ok: false, reason: `تعذّر فحص ملف القاعدة: ${err instanceof Error ? err.message : String(err)}` };
  }

  let db: Database.Database | null = null;
  try {
    db = openDb(dbFile, { readonly: true, fileMustExist: true });
    const integrity = (db.pragma('integrity_check', { simple: true }) as string) ?? '';
    if (integrity !== 'ok') return { ok: false, reason: `فحص سلامة القاعدة فشل (${integrity})` };
    const hasTable = (name: string) => Boolean(db!.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
    if (!hasTable('documents') || !hasTable('citizens') || !hasTable('templates')) {
      return { ok: false, reason: 'القاعدة لا تحتوي على جداول ديوان الأساسية' };
    }
    const dbVersion = readDataVersion(dbFile);
    if (dbVersion && compareVersions(dbVersion, manifest.version) > 0) {
      return { ok: false, reason: `إصدار قاعدة النسخة (${dbVersion}) أحدث من الإصدار المسجّل في الوصف (${manifest.version})` };
    }
  } catch (err) {
    return { ok: false, reason: `تعذّر فتح قاعدة النسخة: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    db?.close();
  }

  const storeDir = join(backupDir, 'store');
  for (const f of manifest.files) {
    const full = join(storeDir, f.rel);
    if (!existsSync(full)) return { ok: false, reason: `الملف ${f.rel} مفقود من مخزن النسخة` };
    try {
      if (statSync(full).size !== f.size) return { ok: false, reason: `حجم الملف ${f.rel} غير مطابق` };
      if (sha256File(full) !== f.sha256) return { ok: false, reason: `بصمة الملف ${f.rel} غير مطابقة` };
    } catch (err) {
      return { ok: false, reason: `تعذّر فحص الملف ${f.rel}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return { ok: true, version: manifest.version, createdAt: manifest.createdAt };
}

function pruneOldPreUpdateBackups(rootDir: string): void {
  if (!existsSync(rootDir)) return;
  const list = readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const old of list.slice(0, Math.max(0, list.length - KEEP))) {
    rmSync(join(rootDir, old), { recursive: true, force: true });
  }
}

/**
 * إنشاء نسخة احتياطية كاملة من قاعدة البيانات والمخزن قبل التحديث
 */
export async function createPreUpdateBackup(opts: {
  dataDir: string;
  currentVersion: string;
  now?: Date;
  minFreeBytes?: number;
}): Promise<PreUpdateBackupResult> {
  const dbFile = join(opts.dataDir, 'diwan.db');
  const storeRoot = join(opts.dataDir, 'store');
  if (!existsSync(dbFile)) return { kind: 'skipped', reason: 'لا توجد قاعدة بيانات حالية' };

  const dbSize = statSync(dbFile).size;
  const storeFiles = walkStore(storeRoot);
  let storeSize = 0;
  for (const rel of storeFiles) {
    const p = join(storeRoot, rel);
    if (existsSync(p)) storeSize += statSync(p).size;
  }

  const requiredBytes = opts.minFreeBytes ?? (dbSize + storeSize + 50 * 1024 * 1024);
  const availableBytes = getAvailableSpace(opts.dataDir);
  if (availableBytes !== null && availableBytes < requiredBytes) {
    throw new Error(
      `المساحة المتوفرة على القرص لا تكفي لإنشاء النسخة الاحتياطية قبل التحديث (المطلوب: ${(requiredBytes / 1024 / 1024).toFixed(0)} م.ب، والمتاح: ${(availableBytes / 1024 / 1024).toFixed(0)} م.ب)`
    );
  }

  const rootDir = join(opts.dataDir, PRE_UPDATE_DIR);
  mkdirSync(rootDir, { recursive: true });
  const time = opts.now ?? new Date();
  const backupDir = join(rootDir, `${opts.currentVersion}-${stamp(time)}`);
  mkdirSync(backupDir, { recursive: true });

  const targetDb = join(backupDir, 'diwan.db');
  const targetStore = join(backupDir, 'store');
  mkdirSync(targetStore, { recursive: true });

  try {
    const db = openDb(dbFile, { readonly: true, fileMustExist: true });
    try {
      db.exec(`VACUUM INTO '${targetDb.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }

    const manifestFiles: { rel: string; size: number; sha256: string }[] = [];
    for (const rel of storeFiles) {
      const src = join(storeRoot, rel);
      const dst = join(targetStore, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      manifestFiles.push({
        rel,
        size: statSync(dst).size,
        sha256: sha256File(dst)
      });
    }

    const manifest: PreUpdateManifest = {
      app: 'diwan',
      version: opts.currentVersion,
      createdAt: time.toISOString(),
      dbSize: statSync(targetDb).size,
      dbSha256: sha256File(targetDb),
      files: manifestFiles
    };
    writeFileSync(join(backupDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2), 'utf8');

    const verify = verifyPreUpdateBackup(backupDir);
    if (!verify.ok) {
      rmSync(backupDir, { recursive: true, force: true });
      throw new Error(`تعذّر التحقق من سلامة النسخة الاحتياطية قبل التحديث (${verify.reason}) — أُوقف التحديث حفاظًا على بياناتك.`);
    }

    pruneOldPreUpdateBackups(rootDir);
    return {
      kind: 'created',
      backupDir,
      version: opts.currentVersion,
      fileCount: manifestFiles.length,
      bytes: manifest.dbSize + manifestFiles.reduce((acc, f) => acc + f.size, 0)
    };
  } catch (err) {
    rmSync(backupDir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * البحث عن أحدث نسخة احتياطية صالحة تسبق التحديث ومتوافقة مع الإصدار المطلوب
 */
export function findLatestPreUpdateBackup(
  dataDir: string,
  maxVersion?: string
): { dir: string; version: string; createdAt: string } | null {
  const rootDir = join(dataDir, PRE_UPDATE_DIR);
  if (!existsSync(rootDir)) return null;

  const entries = readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  for (const name of entries) {
    const dir = join(rootDir, name);
    const v = verifyPreUpdateBackup(dir);
    if (v.ok && v.version && v.createdAt) {
      const dbFile = join(dir, 'diwan.db');
      const dbVersion = existsSync(dbFile) ? readDataVersion(dbFile) : null;
      if (dbVersion && maxVersion && compareVersions(dbVersion, maxVersion) > 0) {
        continue;
      }
      if (!maxVersion || compareVersions(v.version, maxVersion) <= 0) {
        return { dir, version: dbVersion ?? v.version, createdAt: v.createdAt };
      }
    }
  }
  return null;
}

const DB_SUFFIXES = ['', '-wal', '-shm'] as const;

/**
 * التراجع إلى نسخة ما قبل التحديث مع نقل البيانات الحالية جانبًا وحمايتها من الضياع
 */
export function rollbackToPreUpdateBackup(opts: {
  dataDir: string;
  backupDir: string;
  now?: Date;
  onBeforeCopy?: () => void;
}): { asideDir: string; restoredVersion: string } {
  const verify = verifyPreUpdateBackup(opts.backupDir);
  if (!verify.ok || !verify.version) {
    throw new Error(`النسخة الاحتياطية غير صالحة للتراجع (${verify.reason ?? 'فشل التحقق'})`);
  }

  const time = opts.now ?? new Date();
  const asideDir = join(opts.dataDir, `aside-newer-${stamp(time)}`);
  mkdirSync(asideDir, { recursive: true });

  const currentDb = join(opts.dataDir, 'diwan.db');
  const currentStore = join(opts.dataDir, 'store');
  const backupDb = join(opts.backupDir, 'diwan.db');
  const backupStore = join(opts.backupDir, 'store');

  // كتابة أثر الاسترجاع قبل نقل أو تعديل الملفات لضمان التعافي عند انقطاع الكهرباء
  writeIncompleteMarker(opts.dataDir, { aside: asideDir, reason: 'تراجعٌ إلى نسخة ما قبل التحديث' });

  for (const suffix of DB_SUFFIXES) {
    const f = currentDb + suffix;
    if (existsSync(f)) renameSync(f, join(asideDir, `diwan.db${suffix}`));
  }
  if (existsSync(currentStore)) {
    renameSync(currentStore, join(asideDir, 'store'));
  }

  // نقطة حراسة لاختبار الانقطاع في منتصف التراجع
  if (opts.onBeforeCopy) {
    opts.onBeforeCopy();
  }

  try {
    copyFileSync(backupDb, currentDb);
    mkdirSync(currentStore, { recursive: true });
    if (existsSync(backupStore)) {
      const files = walkStore(backupStore);
      for (const rel of files) {
        const src = join(backupStore, rel);
        const dst = join(currentStore, rel);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
      }
    }

    const testDb = openDb(currentDb, { readonly: true, fileMustExist: true });
    try {
      const integrity = testDb.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') throw new Error(`integrity check failed: ${integrity}`);
    } finally {
      testDb.close();
    }

    // إزالة أثر الاسترجاع بعد نجاح العملية بالكامل
    rmSync(join(opts.dataDir, INCOMPLETE_MARKER), { force: true });
  } catch (err) {
    for (const suffix of DB_SUFFIXES) rmSync(currentDb + suffix, { force: true });
    rmSync(currentStore, { recursive: true, force: true });

    let restoredBack = false;
    try {
      for (const suffix of DB_SUFFIXES) {
        const src = join(asideDir, `diwan.db${suffix}`);
        if (existsSync(src)) renameSync(src, currentDb + suffix);
      }
      if (existsSync(join(asideDir, 'store'))) {
        renameSync(join(asideDir, 'store'), currentStore);
      }
      restoredBack = true;
      rmSync(join(opts.dataDir, INCOMPLETE_MARKER), { force: true });
    } catch {
      // إذا تعذّر نقل الملفات عائدةً، يبقى الأثر لتعيده recoverIncompleteRestore في الإقلاع القادم
    }
    const recoveryNote = restoredBack
      ? 'وأُعيدت بياناتك كما كانت'
      : 'وتُستعاد بياناتك تلقائيًّا عند الإقلاع القادم';
    throw new Error(`تعذّر التراجع إلى بيانات ما قبل التحديث، ${recoveryNote}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { asideDir, restoredVersion: verify.version };
}
