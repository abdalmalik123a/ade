import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/** قاعدة نظيفة في الذاكرة بنفس مخطط الإنتاج — بلا Electron. */
export function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const dir = join(process.cwd(), 'src', 'main', 'db');
  for (const file of ['schema.sql', 'search.sql']) {
    db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  return db;
}
