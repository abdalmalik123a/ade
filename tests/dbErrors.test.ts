/**
 * أخطاء قاعدة البيانات تصل الواجهة بالعربية (مراجعة ٧ ت١): كانت «SqliteError: FOREIGN KEY constraint failed»
 * خامًا في واجهةٍ عربية — لمعاملةٍ معلّقة لزبونٍ حُذف، أو قرصٍ ممتلئ.
 *
 * والأخطاء هنا حقيقيةٌ من better-sqlite3 لا مُصطنعة، فيثبت أنّ الرموز التي نطابقها هي التي يرميها فعلًا.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { arabicDbMessage, translateDbError } from '../src/main/services/dbErrors';

/** الخطأ الذي ترميه العبارة، كما هو. */
function thrown(db: Database.Database, sql: string): unknown {
  try {
    db.exec(sql);
  } catch (e) {
    return e;
  }
  throw new Error(`لم تُرمَ استثناء: ${sql}`);
}

function sample(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE child (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER REFERENCES parent(id),
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      age INTEGER CHECK (age >= 0)
    );
    INSERT INTO parent (id) VALUES (1);
    INSERT INTO child (id, parent_id, code, name, age) VALUES (1, 1, 'a', 'x', 5);
  `);
  return db;
}

describe('أخطاء القاعدة بالعربية', () => {
  it('زبونٌ محذوف: القيد الأجنبي يُقال بالعربية — لا «FOREIGN KEY constraint failed»', () => {
    const e = thrown(sample(), "INSERT INTO child (parent_id, code, name) VALUES (99, 'b', 'y')");
    const message = arabicDbMessage(e)!;
    expect(message).toContain('لم يعد موجودًا');
    expect(message).toContain('SQLITE_CONSTRAINT_FOREIGNKEY');
    expect(message).not.toMatch(/FOREIGN KEY constraint failed/);
  });

  it('تكرار قيمة فريدة، وحقل لازم، وقيدٌ على المدى', () => {
    const db = sample();
    expect(arabicDbMessage(thrown(db, "INSERT INTO child (code, name) VALUES ('a', 'z')"))).toContain('موجودٌ من قبل');
    expect(arabicDbMessage(thrown(db, "INSERT INTO child (id, code, name) VALUES (1, 'c', 'z')"))).toContain('موجودٌ من قبل');
    expect(arabicDbMessage(thrown(db, "INSERT INTO child (code, name) VALUES ('d', NULL)"))).toContain('غير صالحة');
    expect(arabicDbMessage(thrown(db, "INSERT INTO child (code, name, age) VALUES ('e', 'z', -1)"))).toContain('غير صالحة');
  });

  it('ما لا نعرفه من أخطاء SQLite يُقال بالعربية وأصله فيه — لا يُترك إنكليزيًّا وحده', () => {
    const e = thrown(sample(), 'SELECT * FROM جدول_غائب');
    const message = arabicDbMessage(e)!;
    expect(message).toMatch(/^خطأ في قاعدة البيانات \(/);
    expect(message).toContain('فأرسل هذه الرسالة إلى المطوّر');
  });

  it('وقرصٌ ممتلئ وقاعدةٌ مشغولة ومقفلة للكتابة وتالفة وفلاشةٌ نُزعت — بحسب رمز SQLite', () => {
    const withCode = (code: string, message: string) => Object.assign(new Error(message), { name: 'SqliteError', code });
    expect(arabicDbMessage(withCode('SQLITE_FULL', 'database or disk is full'))).toContain('القرص ممتلئ');
    expect(arabicDbMessage(withCode('SQLITE_BUSY', 'database is locked'))).toContain('مشغولةٌ');
    expect(arabicDbMessage(withCode('SQLITE_READONLY', 'attempt to write a readonly database'))).toContain('للقراءة فقط');
    expect(arabicDbMessage(withCode('SQLITE_READONLY_DBMOVED', 'x'))).toContain('للقراءة فقط');
    expect(arabicDbMessage(withCode('SQLITE_CORRUPT', 'database disk image is malformed'))).toContain('تالفة');
    expect(arabicDbMessage(withCode('SQLITE_NOTADB', 'file is not a database'))).toContain('تالفة');
    expect(arabicDbMessage(withCode('SQLITE_IOERR_WRITE', 'disk I/O error'))).toContain('فلاشةٌ منزوعة');
    expect(arabicDbMessage(withCode('SQLITE_CANTOPEN', 'unable to open database file'))).toContain('فلاشةٌ منزوعة');
  });

  it('وما رماه البرنامج بالعربية، وما ليس خطأً، يمرّ كما هو', () => {
    const mine = new Error('تعذّر الاسترجاع فبقيت بيانات المكتب كما كانت');
    expect(arabicDbMessage(mine)).toBeNull();
    expect(translateDbError(mine)).toBe(mine);
    expect(translateDbError('نصٌّ مرمي')).toBe('نصٌّ مرمي');
    expect(translateDbError(null)).toBeNull();
    // ومنقولٌ من غير SQLite برمزٍ شبيه لا يُترجَم.
    expect(arabicDbMessage(Object.assign(new Error('EBUSY'), { code: 'EBUSY' }))).toBeNull();
  });

  it('والمترجَم خطأٌ جديدٌ يحمل الأصل سببًا لمن يريد تتبّعه', () => {
    const original = thrown(sample(), "INSERT INTO child (parent_id, code, name) VALUES (99, 'b', 'y')");
    const out = translateDbError(original) as Error;
    expect(out).toBeInstanceOf(Error);
    expect(out).not.toBe(original);
    expect(out.cause).toBe(original);
  });
});
