/**
 * قاعدة المكتب مشفّرةً بمفتاحه (D239، ر190 §٢، ر191) — بلا electron، فتستعملها خدمات الإقلاع والنسخ وتُختبر وحدها.
 *
 * المحرّك better-sqlite3-multiple-ciphers باسم better-sqlite3 نفسه (npm alias)، بشفرة SQLite3MultipleCiphers الافتراضية.
 * ومفتاح الجلسة يضبطه الإقلاع (`setDbKey`) بعد أن يُفتح مفتاح المكتب (D237)؛ و`openDb` يفتح به الملفّ **المشفّر وحده**:
 * القاعدة الواضحة (قبل ترحيلها، أو نسخةٌ جاءت من جهازٍ آخر) تُفتح كما هي. مُجرَّب على المحرّك (D239):
 * - `rekey` لا يجري في وضع WAL («SQL logic error»): تُحوَّل القاعدة إلى DELETE ثم تُشفَّر ثم تعود.
 * - بلا مفتاح أو بمفتاحٍ آخر: «file is not a database».
 * - `VACUUM INTO` من اتّصالٍ مشفّر يكتب نسخةً مشفّرةً بالمفتاح نفسه؛ و`rekey` بمفتاحٍ فارغ يفكّها في مكانها.
 */
import { closeSync, existsSync, openSync, readSync, rmSync, statSync } from 'node:fs';
import Database from 'better-sqlite3';

const PLAIN_HEADER = Buffer.from('SQLite format 3\0', 'latin1');

/** `key` و`rekey` من المحرّك (index.d.ts فيه)؛ والأنواع تُحلّ من @types/better-sqlite3 الذي لا يعرفهما — فيُضيَّق هنا وحده. */
type Keyed = { key(key: Buffer): number; rekey(key: Buffer): number };
const keyed = (db: Database.Database): Keyed => db as unknown as Keyed;

let sessionKey: Buffer | null = null;

/** مفتاح القاعدة لهذه الجلسة — و`null`: لا تشفير (لا مفتاح، أو تحت المِقْود بلا بابه). */
export function setDbKey(key: Buffer | null): void {
  sessionKey = key;
}

export const dbKeyOf = (): Buffer | null => sessionKey;

/** أواضحةٌ هذه القاعدة على القرص (رأس SQLite) — والملفّ الغائب أو الفارغ ليس واضحًا ولا مشفّرًا. */
export function isPlainDb(file: string): boolean {
  if (!existsSync(file) || statSync(file).size < PLAIN_HEADER.length) return false;
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(PLAIN_HEADER.length);
    readSync(fd, head, 0, head.length, 0);
    return head.equals(PLAIN_HEADER);
  } finally {
    closeSync(fd);
  }
}

export const isEncryptedDb = (file: string): boolean => existsSync(file) && statSync(file).size >= PLAIN_HEADER.length && !isPlainDb(file);

/** يفتح ملفّ قاعدة: بالمفتاح إن كانت مشفّرة، أو تُنشأ جديدةً مشفّرةً إن كان معنا مفتاح؛ والواضحة كما هي. */
export function openDb(file: string, options?: Database.Options): Database.Database {
  const exists = existsSync(file) && statSync(file).size > 0;
  const useKey = sessionKey && (exists ? isEncryptedDb(file) : !options?.readonly);
  const db = new Database(file, options);
  if (useKey) keyed(db).key(sessionKey!);
  return db;
}

/** يشفّر قاعدةً واضحة في مكانها بالمفتاح، ثم يتحقّق منها. والمحرّك يفعلها في معاملة: انقطاعٌ في وسطها يُرجعها كما كانت. */
export function encryptInPlace(file: string, key: Buffer): void {
  const db = new Database(file);
  try {
    db.pragma('journal_mode = DELETE');
    keyed(db).rekey(key);
    db.pragma('journal_mode = WAL');
    const check = String(db.pragma('quick_check', { simple: true }));
    if (check !== 'ok') throw new Error(`القاعدة بعد تشفيرها لا تجتاز الفحص (${check})`);
  } finally {
    db.close();
  }
}

/**
 * نسخةٌ متّسقة من القاعدة الجارية (`VACUUM INTO`) — ولو صدر كتابٌ لحظتها. مشفّرةٌ بمفتاح المكتب كالأصل (ما يُنقل جانبًا
 * عند الاسترجاع)، و`plain`: مفكوكةٌ للنسخة الاحتياطية فتُسترجع على جهازٍ آخر بمفتاحٍ آخر، وكلمة النسخة تحميها.
 */
export function snapshotOffice(db: Database.Database, target: string, plain = false): void {
  if (existsSync(target)) rmSync(target);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  if (plain && sessionKey) decryptInPlace(target, sessionKey);
}

/** نسخةٌ مشفّرة (من `VACUUM INTO`) تُفكّ في مكانها — لنسخةٍ احتياطية تُسترجع على جهازٍ آخر بمفتاحٍ آخر. */
export function decryptInPlace(file: string, key: Buffer): void {
  if (!isEncryptedDb(file)) return;
  const db = new Database(file);
  try {
    keyed(db).key(key);
    db.pragma('journal_mode = DELETE');
    keyed(db).rekey(Buffer.alloc(0));
  } finally {
    db.close();
  }
}
