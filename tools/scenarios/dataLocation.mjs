/**
 * سيناريو: مجلّد بيانات المكتب يختاره المكتب خارج AppData (D236، ر190 §١).
 *
 * ١) بلا جواب المِقْود يبقى `userData/data` بلا سؤال (فلا تتغيّر السيناريوهات القائمة)؛ ويُسجَّل فيه مواطنٌ ومستمسك.
 * ٢) أوّل تشغيلٍ بجوابٍ (المجلّد المختار، على قرصٍ آخر إن وُجد D:): تُنقل البيانات إليه نسخًا وتحقّقًا، فيُرى المواطن
 *    والمستمسك منه، ويبقى القديم جانبًا تعرضه الإعدادات ويُحذف بيد المكتب بتأكيد. ثم يُطلب من الإعدادات نقلٌ إلى مكانٍ آخر.
 * ٣) التشغيل التالي ينقلها والقاعدة مغلقة، والمؤشّر يتبعها.
 * ٤) المجلّد يغيب (أُعيدت تسميته): يُغلق ديوان بجواب «أغلق» ولا يُنشئ سجلًّا فارغًا في أيّ مكان.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

// خارج AppData — فمجلّد التشغيل المؤقّت تحت AppData\Local\Temp يرفضه الفحص كما ينبغي — وفي `reports/` المستثنى من git،
// لا في جذر قرص؛ ويُمحى في آخره. والنسخ بين قرصين وما يبقى جانبًا تحرسهما `tests/dataLocation.test.ts`،
// وعرضُ ما بقي جانبًا وحذفُه هنا بمجلّدٍ يُصنع ويُذكر في المؤشّر.
const ROOT = resolve('reports', '.scenario-tmp', `dataloc-${Date.now()}`);
const A = join(ROOT, 'DiwanData');
const B = join(ROOT, 'moved', 'DiwanData');
const ELECTRON = resolve('node_modules/electron/dist/electron.exe');
const SCAN = 'scan-dataloc.png';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4096, 3)]);

let ENV = {};
let firstProfile = '';
const firstSteps = [];

export async function prepare() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  ENV = {};
  return ENV;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (dir) => {
  const db = new Database(join(dir, 'diwan.db'), { readonly: true });
  try {
    return db.prepare('SELECT full_name AS n FROM citizens ORDER BY id').all().map((r) => r.n);
  } finally {
    db.close();
  }
};
const pointerOf = (profile) => {
  try {
    return JSON.parse(readFileSync(join(profile, 'data-location.json'), 'utf8'));
  } catch {
    return null;
  }
};

export default async function scenario(page, { profile }) {
  const ok = (label, value) => firstSteps.push(`${value ? '✓' : '✗'} ${label}`);
  firstProfile = profile;
  const info = await page.eval(`return window.diwan.dataLocation.get();`);
  ok('بلا جواب المِقْود يبقى المكان القديم userData/data بلا سؤال ولا مؤشّر', info.path === join(profile, 'data') && !existsSync(join(profile, 'data-location.json')));
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', verified: false }); return true;`);
  mkdirSync(join(profile, 'data', 'store', 'attachments'), { recursive: true });
  writeFileSync(join(profile, 'data', 'store', 'attachments', SCAN), PNG);
  ok('وفيه مواطنٌ ومستمسك', names(join(profile, 'data')).includes('زينب علي حسن'));
  return firstSteps.join('\n');
}

export async function betweenRestarts() {
  ENV.DIWAN_TEST_DATA_CHOICE = A;
  ENV.DIWAN_TEST_OPEN_DIR = B;
}

/** يشغّل البرنامج بلا مِقْود البروتوكول — لما يجري في الإقلاع وحده. */
function launch(profile, env) {
  return spawn(ELECTRON, ['.', `--user-data-dir=${profile}`], {
    stdio: 'ignore',
    env: { ...process.env, DIWAN_TEST_SCAN_FILE: 'none', ...env }
  });
}
const killTree = (child) => spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
const exited = (child, ms) =>
  new Promise((done) => {
    if (child.exitCode !== null) return done(true);
    const timer = setTimeout(() => done(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      done(true);
    });
  });

export async function afterRestart(page, { profile, kill }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  try {
    // ── ٢) أوّل تشغيلٍ بالجواب: النقل ─────────────────────────────────────
    const info = await page.eval(`return window.diwan.dataLocation.get();`);
    ok('اختير المجلّد ونُقلت إليه البيانات', info.path === A && existsSync(join(A, 'diwan.db')));
    ok('والمواطن يُقرأ منه', names(A).includes('زينب علي حسن'));
    const served = await page.eval(`return fetch('diwan://store/attachments/${SCAN}').then(async (r) => r.status + ':' + (await r.arrayBuffer()).byteLength);`);
    ok(`والمستمسك يُعرض منه (${served})`, served === `200:${PNG.length}`);
    ok('والمكان القديم لم يبقَ يُفتح منه شيء', !existsSync(join(profile, 'data')));
    const ptr = pointerOf(profile);
    ok('والمؤشّر يدلّ على المختار', ptr?.path === A);

    // ما يبقى جانبًا بعد نقلٍ إلى قرصٍ آخر: مجلّدٌ في المكان القديم يذكره المؤشّر.
    const aside = join(ROOT, 'data-before-move-2026-10-30T10-00-00');
    mkdirSync(aside, { recursive: true });
    writeFileSync(join(aside, 'diwan.db'), 'x');
    writeFileSync(join(profile, 'data-location.json'), JSON.stringify({ path: A, asides: [aside] }));
    await page.goto('office-settings');
    await wait(900);
    const text = await page.text();
    ok('الإعدادات تعرض مكان البيانات', text.includes('مكان بيانات المكتب') && text.includes(A));
    {
      ok('وما بقي جانبًا بعد نقلٍ يُعرض بحجمه', await page.eval(`return Boolean(document.querySelector('[data-data-aside]'));`));
      await page.eval(`document.querySelector('[data-act="data-delete-aside"]').click(); return true;`);
      await wait(400);
      await page.eval(`document.querySelector('[data-confirm] [data-choice="keep"]').click(); return true;`);
      await wait(400);
      ok('و«ابقِ عليها» لا يحذف', existsSync(aside));
      await page.eval(`document.querySelector('[data-act="data-delete-aside"]').click(); return true;`);
      await wait(400);
      await page.eval(`document.querySelector('[data-confirm] [data-choice="delete"]').click(); return true;`);
      await wait(1200);
      ok('و«احذف» يحذفه بيد المكتب ويخرج من المؤشّر', !existsSync(aside) && (pointerOf(profile)?.asides ?? []).length === 0);
    }

    // ── طلب النقل من الإعدادات ─────────────────────────────────────────
    await page.eval(`document.querySelector('[data-act="data-pick"]').click(); return true;`);
    await wait(700);
    ok('المكان الجديد يُفحص ولا خطأ', (await page.eval(`return document.querySelector('[data-data-choice]')?.innerText ?? '';`)).includes(B) && !(await page.eval(`return Boolean(document.querySelector('[data-data-choice-error]'));`)));
    await page.eval(`document.querySelector('[data-act="data-move"]').click(); return true;`);
    await wait(700);
    await page.eval(`document.querySelector('[data-confirm] [data-choice="later"]').click(); return true;`);
    await wait(700);
    ok('والنقل مكتوبٌ للتشغيل القادم ولم يُنقل شيءٌ بعد', existsSync(join(profile, 'pending-move.json')) && existsSync(join(A, 'diwan.db')) && (await page.text()).includes('يُنقل عند التشغيل القادم'));
    kill();
    await wait(2000);

    // ── ٣) التشغيل التالي ينقلها ───────────────────────────────────────
    const second = launch(profile, { DIWAN_TEST_DATA_CHOICE: A });
    let moved = false;
    for (let i = 0; i < 60 && !moved; i++) {
      await wait(500);
      moved = pointerOf(profile)?.path === B;
    }
    await wait(1500);
    killTree(second);
    await wait(1500);
    ok('في التشغيل التالي نُقلت والقاعدة مغلقة، والمؤشّر تبعها', moved && existsSync(join(B, 'diwan.db')) && !existsSync(join(profile, 'pending-move.json')));
    ok('والبيانات نفسها في المكان الجديد', names(B).includes('زينب علي حسن') && existsSync(join(B, 'store', 'attachments', SCAN)));

    // ── ٤) المجلّد يغيب ────────────────────────────────────────────────
    renameSync(B, `${B}-gone`);
    const third = launch(profile, { DIWAN_TEST_DATA_CHOICE: 'quit' });
    const closed = await exited(third, 30000);
    if (!closed) killTree(third);
    ok('مجلّدٌ غائب: يُغلق ديوان ولا يُنشئ سجلًّا فارغًا في أيّ مكان', closed && !existsSync(B) && !existsSync(join(profile, 'data')) && !existsSync(join(A, 'diwan.db')));
    ok('والمؤشّر باقٍ على مكانه ينتظر القرص', pointerOf(profile)?.path === B);
  } finally {
    rmSync(ROOT, { recursive: true, force: true });
    if (firstProfile && firstProfile !== profile) rmSync(firstProfile, { recursive: true, force: true });
  }
  return steps.join('\n');
}
