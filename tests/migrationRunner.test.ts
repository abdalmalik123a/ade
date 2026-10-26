/**
 * مشغّل الترقيات المرقّمة (A02، D49): القاعدة تحمل مستواها في `user_version`، والقائمة تجري ما فوقه مرّةً بترتيبه
 * داخل معاملة الإقلاع — فقاعدة كلّ إصدارٍ مبيع تبلغ آخر مستوًى بأعمدة القاعدة الجديدة نفسها، ولا يضيع منها صفّ،
 * وعطلُ خطوةٍ يردّ كلّ شيءٍ كما كان.
 * و(A17، D148) **المشغّل وحده يرقّي:** لا نداء لخطوةٍ من `MIGRATIONS` في `src/main` خارج تعريفها، ولا `prepareIdentity` إلا في جسم ترقيات قِطَعها.
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
import { compareVersions } from '../src/shared/version';

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
    // ما قبل المشغّل (حتى ١٫٨٫٠ والمعمَّرة) بمستوى صفر، وما كتبه إصدارٌ بالمشغّل (١٫٩٫٠ فما بعد) بمستواه يومها — لا صفر ولا فوق آخر خطوة (D195).
    const level = pre.pragma('user_version', { simple: true }) as number;
    const sold = /^release-(.+)\.db$/.exec(name)?.[1];
    if (sold && compareVersions(sold, '1.9.0') >= 0) expect([name, level > 0 && level <= LAST]).toEqual([name, true]);
    else expect([name, level]).toEqual([name, 0]);
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

describe('الترقية في المشغّل وحده (A17، D148)', () => {
  const MAIN = join(process.cwd(), 'src', 'main');
  const sources = (readdirSync(MAIN, { recursive: true }) as string[])
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => p.endsWith('.ts') && p !== 'db/migrations.ts')
    .map((p) => ({ path: p, text: readFileSync(join(MAIN, p), 'utf8') }));
  /** نداءات الاسم في النصّ — لا تعريفه (`function name(`). */
  const calls = (text: string, name: string) => [...text.matchAll(new RegExp(String.raw`(?<!function )\b${name}\(`, 'g'))].length;
  /** جسم ترقيات القوالب والترويسات والكليشات (الخطوات ٥ و٦ و٧) ينادي `prepareIdentity` مرّةً. */
  const IDENTITY = ['services/clips.ts', 'services/letterheads.ts', 'services/templates.ts'];

  it('لا نداء لخطوةٍ من MIGRATIONS خارج تعريفها، ولا prepareIdentity إلا في جسم ترقيات قِطَعها', () => {
    expect(sources.length).toBeGreaterThan(100);
    const names = MIGRATIONS.map((m) => m.up.name);
    expect(names).toContain('prepareDocuments');
    const found: string[] = [];
    for (const { path, text } of sources) {
      for (const name of names) if (calls(text, name)) found.push(`${path}: ${name}`);
      const identity = calls(text, 'prepareIdentity');
      if (identity !== (IDENTITY.includes(path) ? 1 : 0)) found.push(`${path}: prepareIdentity ×${identity}`);
    }
    expect(found, 'الترقية في MIGRATIONS وحدها (A17)').toEqual([]);
  });
});
