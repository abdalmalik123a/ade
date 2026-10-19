import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { configureConnection } from './pragmas';

let db: Database.Database | null = null;
/**
 * سببُ قفل القاعدة: استرجاعٌ تعثّر ولم تعد قاعدة المكتب إلى مكانها (`services/restoreSwap.ts`). فكلّ فتحٍ بعده كان
 * يُنشئ `diwan.db` فارغًا — فإن تابع المكتب العمل عليه انشطرت السلسلة وتكرّر الترقيم. فيُرفض الفتح بالرسالة نفسها
 * حتى يُغلق البرنامج، ويُعيد الإقلاعُ التالي القاعدة من مجلّد الأصل (`recoverIncompleteRestore`).
 */
let locked: string | null = null;

/**
 * تلفٌ وجده `quick_check` عند فتح القاعدة (D96). لا تُفتح على حالها إلا بقول المكتب: يسأله الإقلاع (`main/index.ts`)
 * «افتح لأسترجع نسخةً احتياطية» فيُستدعى `acceptDamagedDb` — والاسترجاع يمضي على القاعدة التالفة (`restoreSwap.ts`، D100).
 */
export class DamagedDbError extends Error {
  constructor(readonly detail: string) {
    super(`قاعدة بيانات المكتب متضرّرة — لا تجتاز فحص السلامة (${detail})`);
    this.name = 'DamagedDbError';
  }
}
let acceptDamaged = false;

/** قال المكتب «افتح»: تُفتح القاعدة المتضرّرة في هذه الجلسة وحدها ليُسترجع عليها. */
export function acceptDamagedDb(): void {
  acceptDamaged = true;
}

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
  // تُقرأ من src/main/db في التطوير وبعد الحزم معًا: `files` في package.json يضمّها إلى الحزمة
  // كما هي (لا تُنسخ إلى out/main). و`__dirname` أوّلًا إن وُضعت يومًا بجانب المبنيّ.
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
  if (locked) throw new Error(locked);
  if (db) return db;

  const file = join(dataDir(), 'diwan.db');
  mkdirSync(dirname(file), { recursive: true });

  db = new Database(file);
  configureConnection(db);
  const check = db.pragma('quick_check(1)', { simple: true });
  if (check !== 'ok' && !acceptDamaged) {
    db.close();
    db = null;
    throw new DamagedDbError(String(check));
  }

  /**
   * تهيئة المخطط الأساسي وجداول البحث (DDL) داخل معاملة ذرية متكاملة عند أول اتصال.
   * الجداول تنشأ بصيغة IF NOT EXISTS وتكتمل ذريًا أو تُلغى بالكامل.
   */
  db.transaction(() => {
    db!.exec(sqlFile('schema.sql'));
    db!.exec(sqlFile('search.sql'));
  })();

  return db;
}

/** يُغلق القاعدة ويمنع فتحها ثانيةً في هذه الجلسة — والرسالة هي ما يُقال لمن يطلبها. */
export function lockDb(reason: string): void {
  closeDb();
  locked = reason;
}

export const dbLocked = (): boolean => locked !== null;

export function closeDb(): void {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    db = null;
  }
}
