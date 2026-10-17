/**
 * مشغّل الترقيات المرقّمة (A02، D49): القاعدة تحمل مستواها في `user_version`، والقائمة تجري ما فوقه مرّةً بترتيبه
 * داخل معاملة الإقلاع — فقاعدة كلّ إصدارٍ مبيع تبلغ آخر مستوًى بأعمدة القاعدة الجديدة نفسها، ولا يضيع منها صفّ،
 * وعطلُ خطوةٍ يردّ كلّ شيءٍ كما كان.
 */
import { copyFileSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, NEWER_SCHEMA, runMigrations, schemaLevel } from '../src/main/db/migrations';
import { configureConnection } from '../src/main/db/pragmas';
import { readDataVersion, runBootSequence } from '../src/main/services/dataVersion';
import { prepareSearch } from '../src/main/services/searchIndex';

const LAST = MIGRATIONS.at(-1)!.n;
const FIXTURES = join(__dirname, 'fixtures');
/** قواعد الإصدارات المبيعة وقاعدة المكتب المعمَّرة — كما كتبتها شيفرتها. */
const OLD = readdirSync(FIXTURES).filter((f) => /^(release-.+|aged-.+)\.db$/.test(f)).sort();

const opened: Database.Database[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) if (db.open) db.close();
});

/** تفتح كما يفتح `getDb`: إعدادات الاتصال، ثم المخطط وجداول البحث في معاملة. */
function openLikeApp(file: string): Database.Database {
  const db = new Database(file);
  configureConnection(db);
  const dir = join(process.cwd(), 'src', 'main', 'db');
  db.transaction(() => {
    for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(dir, f), 'utf8'));
  })();
  opened.push(db);
  return db;
}

/** معاملة الإقلاع كما في `main/index.ts` — والترقيات فيها. */
function migrate(file: string): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-migrate-'));
  const res = runBootSequence({
    dbFile: file,
    currentVersion: '9.9.9',
    snapshotDir: join(dir, 'before-update'),
    openDb: openLikeApp,
    migrations: [(db) => runMigrations(db)]
  });
  if (res.kind !== 'ready') throw new Error(res.kind);
  return res.db;
}

/** والإقلاع كلّه: ثم الفهارس خارج المعاملة (تُبنى من الجداول، فقد يمتلئ فهرسٌ كان فارغًا). */
function boot(file: string): Database.Database {
  const db = migrate(file);
  prepareSearch(db);
  return db;
}

function copyOf(name: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'diwan-migrate-')), 'diwan.db');
  copyFileSync(join(FIXTURES, name), file);
  return file;
}

const tablesOf = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name);

/** كلّ جدولٍ بأعمدته مرتّبةً — فلا يُحسب ترتيب الإضافة فرقًا. */
const columnsOf = (db: Database.Database) =>
  Object.fromEntries(
    tablesOf(db).map((t) => [t, (db.prepare('SELECT name FROM pragma_table_info(?)').all(t) as { name: string }[]).map((c) => c.name).sort()])
  );

/** صفوف كلّ جدول — إلا رقم الإصدار في `settings`: يكتبه الإقلاع بعد الترقيات (`stampDataVersion`) لا المشغّل. */
const countsOf = (db: Database.Database) =>
  Object.fromEntries(
    tablesOf(db).map((t) => [
      t,
      (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"${t === 'settings' ? " WHERE key <> 'appVersion'" : ''}`).get() as { n: number }).n
    ])
  );

const schemaText = (db: Database.Database) =>
  db.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all();

describe('قائمة الترقيات', () => {
  it('أرقامها ١…ن متتالية، وأسماؤها لا تتكرّر', () => {
    expect(MIGRATIONS.map((m) => m.n)).toEqual(MIGRATIONS.map((_, i) => i + 1));
    expect(new Set(MIGRATIONS.map((m) => m.name)).size).toBe(MIGRATIONS.length);
  });
});

describe('القاعدة الجديدة', () => {
  it('تبلغ آخر مستوًى، وجريٌ ثانٍ لا يغيّر شيئًا', () => {
    const db = boot(join(mkdtempSync(join(tmpdir(), 'diwan-migrate-')), 'diwan.db'));
    expect(schemaLevel(db)).toBe(LAST);
    const before = schemaText(db);
    expect(db.transaction(() => runMigrations(db))()).toBe(LAST);
    expect(schemaText(db)).toEqual(before);
    expect(schemaLevel(db)).toBe(LAST);
  });
});

describe.each(OLD)('قاعدة %s', (name) => {
  it('تبلغ آخر مستوًى بأعمدة القاعدة الجديدة، ولا يضيع منها صفّ', () => {
    const fresh = columnsOf(boot(join(mkdtempSync(join(tmpdir(), 'diwan-migrate-')), 'diwan.db')));
    const file = copyOf(name);
    const pre = new Database(file, { readonly: true });
    expect(pre.pragma('user_version', { simple: true })).toBe(0);
    const rows = countsOf(pre);
    pre.close();

    const db = migrate(file);
    expect(schemaLevel(db)).toBe(LAST);
    const after = countsOf(db);
    for (const [table, n] of Object.entries(rows)) expect([table, after[table]]).toEqual([table, n]);
    prepareSearch(db);
    expect(columnsOf(db)).toEqual(fresh);
  });
});

describe('العطل والقاعدة الأحدث', () => {
  it('خطوةٌ ترمي داخل الإقلاع: يُردّ كلّ شيء — لا مستوى ولا إصدار كُتب', () => {
    const file = copyOf('release-1.8.0.db');
    const broken = [...MIGRATIONS, { n: LAST + 1, name: 'عطلٌ متعمَّد', up: () => { throw new Error('عطلٌ متعمَّد'); } }];
    expect(() =>
      runBootSequence({
        dbFile: file,
        currentVersion: '9.9.9',
        snapshotDir: join(mkdtempSync(join(tmpdir(), 'diwan-migrate-')), 'before-update'),
        openDb: openLikeApp,
        migrations: [(db) => runMigrations(db, broken)]
      })
    ).toThrow('تعذّرت ترقية قاعدة البيانات');
    for (const db of opened.splice(0)) db.close();
    expect(readDataVersion(file)).toBe('1.8.0');
    const after = new Database(file, { readonly: true });
    expect(after.pragma('user_version', { simple: true })).toBe(0);
    after.close();
  });

  it('مستوًى فوق آخر خطوة: «من إصدارٍ أحدث» ولا يجري شيء', () => {
    const db = new Database(':memory:');
    opened.push(db);
    db.pragma(`user_version = ${LAST + 1}`);
    expect(() => runMigrations(db)).toThrow(NEWER_SCHEMA);
    expect(schemaLevel(db)).toBe(LAST + 1);
    expect(tablesOf(db)).toEqual([]);
  });
});
