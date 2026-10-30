/**
 * سيناريو: قاعدة المكتب مشفّرةً بمفتاحه (D239، ر190 §٢، ر191).
 *
 * ١) بلا باب التشفير (كالسيناريوهات القائمة) القاعدة واضحة: يُسجَّل مواطنان وتُؤخذ نسخةٌ بكلمة.
 * ٢) مكتبٌ آخر بمفتاحٍ آخر، وقاعدته واضحةٌ من قبل (القاعدة نفسها بلا مفتاحها)، وباب التشفير مفتوح كما في الإصدار:
 *    الإقلاع يشفّرها في مكانها فلا تبدأ بـ«SQLite format 3»، والبرنامج يعمل (مواطنٌ جديد، والبحث)، والنسخة الاحتياطية
 *    من المكتب الأوّل تُسترجع وتُشفَّر بمفتاح هذا المكتب، ونسخةٌ جديدة تحمل القاعدة مفكوكةً لتُسترجع في غيره.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { unzipSync } from 'fflate';

const PASSWORD = 'كلمة مكتب النور';
let ENV = {};
let BACKUP = '';

export async function prepare() {
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  ENV = {};
  return ENV;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const header = (file) => readFileSync(file).subarray(0, 15).toString('latin1');
const names = (page, query = '') =>
  page.eval(`const r = await window.diwan.citizens.list({ query: ${JSON.stringify(query)} }); return (Array.isArray(r) ? r : (r.rows ?? [])).map((c) => c.fullName).sort().join('،');`);

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  for (const fullName of ['زينب علي حسن', 'سالم حسن']) await page.eval(`await window.diwan.citizens.save({ id: null, fullName: ${JSON.stringify(fullName)}, verified: false }); return true;`);
  ok('بلا باب التشفير القاعدة واضحة (السيناريوهات القائمة تقرؤها من القرص)', header(join(profile, 'data', 'diwan.db')) === 'SQLite format 3');
  const made = await page.eval(`return window.diwan.backup.create(${JSON.stringify(PASSWORD)});`);
  BACKUP = made?.path ?? '';
  ok('ونسخةٌ احتياطية بكلمةٍ أُخذت', Boolean(BACKUP) && existsSync(BACKUP));
  return steps.join('\n');
}

/** مكتبٌ آخر: البيانات جانبًا، وقاعدته الواضحة نفسها بلا مفتاحها ولا مخزنها؛ والتشفير مفتوحٌ كما في الإصدار. */
export async function betweenRestarts({ profile }) {
  const old = join(profile, 'data-office-one');
  renameSync(join(profile, 'data'), old);
  mkdirSync(join(profile, 'data'));
  const db = new Database(join(old, 'diwan.db'));
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  copyFileSync(join(old, 'diwan.db'), join(profile, 'data', 'diwan.db'));
  ENV.DIWAN_TEST_DB_CRYPT = '1';
  process.env.DIWAN_TEST_OPEN_FILE = BACKUP;
}

export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const dbFile = join(profile, 'data', 'diwan.db');
  ok('الإقلاع شفّر القاعدة الواضحة في مكانها: لا تبدأ بـ«SQLite format 3»', existsSync(dbFile) && header(dbFile) !== 'SQLite format 3');
  let unreadable = '';
  const probe = new Database(dbFile, { readonly: true });
  try {
    probe.prepare('SELECT count(*) FROM citizens').get();
  } catch (e) {
    unreadable = String(e.message);
  } finally {
    // مقبضٌ يبقى مفتوحًا يمسك الملفّ في ويندوز فيتعثّر الاسترجاع بعده.
    probe.close();
  }
  ok(`ولا تُقرأ بلا مفتاح المكتب («${unreadable}»)`, /not a database/.test(unreadable));
  ok('وبياناتها كما كانت', (await names(page)) === 'زينب علي حسن،سالم حسن');
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'مدرسة النور', verified: false }); return true;`);
  ok('والبرنامج يعمل: مواطنٌ جديد، والبحث يجده', (await names(page, 'النور')) === 'مدرسة النور');

  // النسخة تُختار من ديوان (بابه DIWAN_TEST_OPEN_FILE).
  const picked = await page.eval(`return window.diwan.backup.pick();`);
  await page.eval(`return window.diwan.backup.inspect(${JSON.stringify(picked?.path ?? '')}, ${JSON.stringify(PASSWORD)});`);
  await page.eval(`return window.diwan.backup.restore(${JSON.stringify(picked?.path ?? '')}, ${JSON.stringify(PASSWORD)}).then(() => true);`);
  await wait(1500);
  ok('ونسخة المكتب الأوّل تُسترجع، ومشفّرةً بمفتاح هذا المكتب', header(dbFile) !== 'SQLite format 3' && (await names(page)) === 'زينب علي حسن،سالم حسن');

  const fresh = await page.eval(`return window.diwan.backup.create(null);`);
  // بلا كلمة: الحزمة أرشيفٌ يُفكّ — والقاعدة فيه مفكوكة لتُسترجع في مكتبٍ آخر بمفتاحٍ آخر.
  const inner = fresh?.path ? unzipSync(new Uint8Array(readFileSync(fresh.path)), { filter: (e) => e.name === 'diwan.db' })['diwan.db'] : undefined;
  ok('ونسخةٌ جديدة تحمل القاعدة مفكوكة (لتُسترجع في غيره)', Boolean(inner) && Buffer.from(inner).subarray(0, 15).toString('latin1') === 'SQLite format 3');
  return steps.join('\n');
}
