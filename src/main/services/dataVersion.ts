/**
 * إصدار البيانات (خطة Production، ٧٫٢): القاعدة تحمل رقم آخر إصدارٍ فتحها.
 *
 * - **إصدارٌ أقدم لا يفتح بيانات أحدث**: قاعدةٌ رحّلها ١٫٢ قد تحمل أعمدةً وقيمًا لا يعرفها ١٫١ فيُفسدها
 *   بكتابته. فيُقال ذلك ويُغلق البرنامج قبل أن يمسّها — والمكتب يثبّت الإصدار الأحدث.
 * - **والتحديث يأخذ نسخةً قبل الترحيل**: أوّل فتحٍ بإصدارٍ أحدث يكتب القاعدة كما هي في
 *   `before-update/` (VACUUM INTO) قبل أن يُرحَّل منها شيء — تُبقى آخر ثلاث.
 *
 * والحساب هنا على ملف القاعدة يُختبر بلا Electron؛ ويُنادى من الإقلاع (main/index.ts).
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { compareVersions } from '@shared/version';

export type DataGuard =
  | { kind: 'fresh' }
  | { kind: 'same'; version: string }
  | { kind: 'upgrade'; from: string | null; snapshot: string }
  | { kind: 'newer'; from: string };

/** رقم الإصدار المكتوب في القاعدة — و`null` لقاعدةٍ قبل أن يُكتب (قبل ١٫٠). */
export function readDataVersion(file: string): string | null {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get();
    if (!has) return null;
    return (db.prepare("SELECT value FROM settings WHERE key = 'appVersion'").get() as { value: string } | undefined)?.value ?? null;
  } finally {
    db.close();
  }
}

const KEEP = 3;
const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** قبل أن تُفتح القاعدة للكتابة: أجديدةٌ هي، أم بإصدارها، أم أقدم فتُنسخ، أم أحدث فلا تُمسّ. */
export function guardDataVersion(opts: { file: string; current: string; snapshotDir: string; now?: Date }): DataGuard {
  if (!existsSync(opts.file)) return { kind: 'fresh' };
  const from = readDataVersion(opts.file);
  if (from && compareVersions(from, opts.current) > 0) return { kind: 'newer', from };
  if (from && compareVersions(from, opts.current) === 0) return { kind: 'same', version: from };
  mkdirSync(opts.snapshotDir, { recursive: true });
  const snapshot = join(opts.snapshotDir, `${from ?? 'قبل-1.0'}-الى-${opts.current}-${stamp(opts.now ?? new Date())}.db`);
  const db = new Database(opts.file, { readonly: true, fileMustExist: true });
  try {
    db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  const all = readdirSync(opts.snapshotDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f, at: f.slice(-23, -3) }))
    .sort((a, b) => a.at.localeCompare(b.at));
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) rmSync(join(opts.snapshotDir, old.f), { force: true });
  return { kind: 'upgrade', from, snapshot };
}

/** بعد أن تُرحَّل القاعدة بنجاح: يُكتب فيها رقم هذا الإصدار. */
export function stampDataVersion(db: Database.Database, current: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('appVersion', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(current);
}
