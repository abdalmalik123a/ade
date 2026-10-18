/**
 * سيناريو: استرجاعٌ يتعثّر لا يُضيع البيانات ولا يفتح قاعدةً فارغة (مراجعة ٧ ت١).
 *
 * ١) **مخزنٌ ممسوك**: برنامجٌ آخر (عمليةٌ مجلّدها الجاري داخل المخزن — كعارض صورٍ أو مضادّ فيروسات) يمنع ويندوز
 *    من نقله. فيتعثّر الاسترجاع بعد أن نُقلت القاعدة: تعود القاعدة وتُفتح، ويُقال للمكتب بالعربية ما حدث، ويبقى
 *    البرنامج يعمل على بياناته الأصلية.
 * ٢) **قاعدةٌ لم تعد**: وإن لم تعد القاعدة إلى مكانها (حالةٌ مصنوعة بين الإقلاعين: `betweenRestarts`) فالإقلاع
 *    التالي يُعيدها من مجلّد الأصل — لا قاعدةً فارغة — ويُعيد المخزن، ويمحو الأثر ولا يمسّ ما جانبًا.
 *    وبقايا فكٍّ انقطع في `restore-work` تُمحى عند ذلك الإقلاع (A09).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const ASIDE_NAME = 'before-restore-2026-10-08-12-00-00';

export async function prepare() {
  // الحفظ يكتب النسخة هنا (حوار النظام لا يُضغط آليًّا).
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  return {};
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** عمليةٌ قتلت للتوّ ما قبلها قد تمسك ملفًّا لحظات. */
async function retry(label, fn) {
  let last;
  for (let i = 0; i < 30; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      await wait(300);
    }
  }
  throw new Error(`${label}: ${last?.message ?? last}`);
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const data = join(profile, 'data');
  const names = () => {
    const d = new Database(join(data, 'diwan.db'), { readonly: true });
    const rows = d.prepare('SELECT full_name AS n FROM citizens ORDER BY id').all().map((r) => r.n);
    d.close();
    return rows;
  };

  // بيانات المكتب: مواطن، ومستمسكٌ في المخزن، ونسخةٌ احتياطية أُخذت، ثم مواطنٌ بعدها.
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'قبل النسخة', verified: false }); return true;`);
  mkdirSync(join(data, 'store', 'attachments'), { recursive: true });
  writeFileSync(join(data, 'store', 'attachments', 'مستمسك.txt'), 'مستمسك المكتب');
  const made = await page.eval(`return await window.diwan.backup.create(null);`);
  ok('أُخذت نسخةٌ احتياطية', Boolean(made?.path) && existsSync(made.path));
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'بعد النسخة', verified: false }); return true;`);

  // ── ١) مخزنٌ ممسوكٌ ببرنامجٍ آخر ─────────────────────────────────────────
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 180000)'], {
    cwd: join(data, 'store', 'attachments'),
    stdio: 'ignore'
  });
  await wait(700);
  const failure = await page.eval(
    `try { await window.diwan.backup.restore(${JSON.stringify(made?.path ?? '')}, null); return 'نجح'; } catch (e) { return String(e.message); }`
  );
  holder.kill();
  ok(`الاسترجاع يتعثّر ويُقال بالعربية (${failure.slice(0, 70)}…)`, failure.includes('بقيت بيانات المكتب كما كانت') && failure.includes('مفتوحٌ في برنامجٍ آخر'));
  ok('وبيانات المكتب كما كانت: المواطنان حاضران', names().join('،') === 'قبل النسخة،بعد النسخة');
  ok('والمستمسك في مخزنه', existsSync(join(data, 'store', 'attachments', 'مستمسك.txt')));
  ok('ولا أثر استرجاعٍ غير مكتمل (القاعدة عادت)', !existsSync(join(data, 'restore-incomplete.json')));
  const live = await page.eval(
    `const r = await window.diwan.citizens.list({}); return (Array.isArray(r) ? r : (r.rows ?? [])).map((c) => c.fullName).join('،');`
  );
  ok(`والبرنامج يعمل على بياناته (${live})`, live.includes('قبل النسخة') && live.includes('بعد النسخة'));
  return steps.join('\n');
}

/**
 * بعد القتل وقبل الفتح الثاني: حالة استرجاعٍ لم تعد قاعدته — كما يتركها (`restoreSwap.ts`): نسخةٌ متّسقة جانبًا،
 * والقاعدة وسجلّها والمخزن منقولة، وأثرٌ في مجلّد البيانات.
 */
export async function betweenRestarts({ profile }) {
  const data = join(profile, 'data');
  const aside = join(data, ASIDE_NAME);
  mkdirSync(aside, { recursive: true });
  const snapshot = join(aside, 'diwan.db');
  await retry('نسخة القاعدة', () => {
    const d = new Database(join(data, 'diwan.db'));
    try {
      d.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    } finally {
      d.close();
    }
  });
  for (const suffix of ['', '-wal', '-shm']) {
    const from = join(data, `diwan.db${suffix}`);
    if (existsSync(from)) await retry(`نقل ${suffix}`, () => renameSync(from, join(aside, `current.db${suffix}`)));
  }
  await retry('نقل المخزن', () => renameSync(join(data, 'store'), join(aside, 'store')));
  writeFileSync(join(data, 'restore-incomplete.json'), JSON.stringify({ aside, reason: 'EBUSY: simulated', at: new Date().toISOString() }));
  // وفكٌّ انقطع: قاعدةٌ مفكوكة للفحص وحزمةٌ مفكوكة من التشفير.
  mkdirSync(join(data, 'restore-work'), { recursive: true });
  writeFileSync(join(data, 'restore-work', 'inspect-1-1.db'), 'قاعدةٌ مفكوكة');
  writeFileSync(join(data, 'restore-work', 'restore-1-1.zip'), 'حزمةٌ مفكوكة');
}

export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const data = join(profile, 'data');
  const aside = join(data, ASIDE_NAME);
  await wait(1200);
  ok('الإقلاع أعاد القاعدة إلى مكانها', existsSync(join(data, 'diwan.db')));
  ok('ومُحي الأثر', !existsSync(join(data, 'restore-incomplete.json')));
  const live = await page.eval(
    `const r = await window.diwan.citizens.list({}); return (Array.isArray(r) ? r : (r.rows ?? [])).map((c) => c.fullName).join('،');`
  );
  ok(`وبيانات المكتب كلّها حاضرة — لا قاعدةً فارغة (${live})`, live.includes('قبل النسخة') && live.includes('بعد النسخة'));
  ok('والمخزن عاد بمستمسكه', existsSync(join(data, 'store', 'attachments', 'مستمسك.txt')) && readFileSync(join(data, 'store', 'attachments', 'مستمسك.txt'), 'utf8') === 'مستمسك المكتب');
  ok('وما جانبًا باقٍ لا يُحذف', existsSync(join(aside, 'current.db')) && existsSync(join(aside, 'diwan.db')));
  const work = join(data, 'restore-work');
  const left = existsSync(work) ? readdirSync(work) : null;
  ok(
    `وبقايا الفكّ المنقطع تُمحى عند الإقلاع، وما جانبًا باقٍ (${left === null ? 'غائب' : left.join('، ') || 'فارغ'})`,
    left !== null && left.length === 0 && existsSync(join(aside, 'diwan.db'))
  );
  return steps.join('\n');
}
