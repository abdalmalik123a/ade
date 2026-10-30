/**
 * قاعدة المكتب مشفّرةً بمفتاحه (D239): تُنشأ مشفّرة، والواضحة تُشفَّر في مكانها وتبقى بياناتها، والنسخة تُفكّ للاسترجاع
 * على جهازٍ آخر، والواضحة تُفتح كما هي ولو كان معنا مفتاح، وبلا مفتاحٍ أو بغيره لا تُفتح.
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptInPlace, encryptInPlace, isEncryptedDb, isPlainDb, openDb, setDbKey } from '../src/main/db/dbKey';

const KEY = randomBytes(32);
const tmp = () => mkdtempSync(join(tmpdir(), 'diwan-dbkey-'));
const header = (file: string) => readFileSync(file).subarray(0, 15).toString('latin1');

function plainOffice(file: string): void {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec("CREATE TABLE citizens (id INTEGER PRIMARY KEY, full_name TEXT); INSERT INTO citizens (full_name) VALUES ('زينب علي حسن'), ('سالم حسن');");
  db.close();
}

afterEach(() => setDbKey(null));

describe('القاعدة المشفّرة', () => {
  it('تُنشأ مشفّرةً بالمفتاح، ولا تُفتح بلا مفتاحٍ ولا بغيره', () => {
    const file = join(tmp(), 'diwan.db');
    setDbKey(KEY);
    const db = openDb(file);
    db.exec("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('سرّ')");
    db.close();
    expect(isEncryptedDb(file)).toBe(true);
    expect(header(file)).not.toBe('SQLite format 3');
    expect(openDb(file).prepare('SELECT x FROM t').pluck().get()).toBe('سرّ');
    setDbKey(null);
    expect(() => openDb(file).prepare('SELECT x FROM t').get()).toThrow(/not a database/);
    setDbKey(randomBytes(32));
    expect(() => openDb(file).prepare('SELECT x FROM t').get()).toThrow(/not a database/);
  });

  it('الواضحة (قبل ترحيلها) تُفتح كما هي ولو كان معنا مفتاح، ثم تُشفَّر في مكانها وتبقى بياناتها ووضع WAL', () => {
    const file = join(tmp(), 'diwan.db');
    plainOffice(file);
    setDbKey(KEY);
    expect(isPlainDb(file)).toBe(true);
    const before = openDb(file, { readonly: true });
    expect(before.prepare('SELECT count(*) FROM citizens').pluck().get()).toBe(2);
    before.close();
    encryptInPlace(file, KEY);
    expect(isEncryptedDb(file)).toBe(true);
    const after = openDb(file);
    expect(after.prepare('SELECT full_name FROM citizens ORDER BY id').pluck().all()).toEqual(['زينب علي حسن', 'سالم حسن']);
    expect(after.pragma('journal_mode', { simple: true })).toBe('wal');
    after.close();
  });

  it('النسخة بـVACUUM INTO مشفّرةٌ بالمفتاح نفسه، وتُفكّ في مكانها لتُسترجع على جهازٍ آخر', () => {
    const dir = tmp();
    const file = join(dir, 'diwan.db');
    plainOffice(file);
    encryptInPlace(file, KEY);
    setDbKey(KEY);
    const db = openDb(file);
    const copy = join(dir, 'copy.db');
    db.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
    db.close();
    expect(isEncryptedDb(copy)).toBe(true);
    decryptInPlace(copy, KEY);
    expect(header(copy)).toBe('SQLite format 3');
    const plain = new Database(copy, { readonly: true });
    expect(plain.prepare('SELECT count(*) FROM citizens').pluck().get()).toBe(2);
    plain.close();
  });
});
