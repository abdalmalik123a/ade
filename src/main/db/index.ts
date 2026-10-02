import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { configureConnection } from './pragmas';

let db: Database.Database | null = null;

/** مجلد بيانات المكتب. كل شيء يبقى على الجهاز — التطبيق «محلي». */
export function dataDir(): string {
  const dir = join(app.getPath('userData'), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** مخزن الملفات: المستمسكات الممسوحة، الصور، الأختام، نسخ PDF المؤرشفة. */
export function storeDir(...parts: string[]): string {
  const dir = join(dataDir(), 'store', ...parts);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function sqlFile(name: string): string {
  // في التطوير الملفات بجانب المصدر؛ بعد الحزم تُنسخ إلى out/main.
  const candidates = [
    join(__dirname, name),
    join(app.getAppPath(), 'src', 'main', 'db', name)
  ];
  for (const c of candidates) {
    if (existsSync(c)) return readFileSync(c, 'utf8');
  }
  throw new Error(`ملف المخطط غير موجود: ${name}`);
}

export function getDb(): Database.Database {
  if (db) return db;

  const file = join(dataDir(), 'diwan.db');
  mkdirSync(dirname(file), { recursive: true });

  db = new Database(file);
  configureConnection(db);

  db.exec(sqlFile('schema.sql'));
  db.exec(sqlFile('search.sql'));

  return db;
}

export function closeDb(): void {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    db = null;
  }
}
