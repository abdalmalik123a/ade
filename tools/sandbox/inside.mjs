/**
 * داخل Windows Sandbox (A22، D141): يثبّت ديوان من المثبّت صامتًا بلا شبكة، ويفحصه، ويكتب النتيجة في المجلّد المشترك — ثم يُطفئ الصندوق.
 * يشغّله `inside.cmd` أمرَ الدخول بـnode.exe المنسوخ من جهاز التطوير (`make.mjs`). والمسارات ثابتة: `C:\kit` للقراءة و`C:\out` للكتابة.
 *
 * `out/result.txt`: ✓ و✗ لكلّ فحص (يُكتب بعد كلّ سطر، فما بلغه يبقى إن سقط) · و`log.txt` مخرج كلّ شيء · وسجلّ الأخطاء إن كُتب ·
 * و`done.txt` في الآخر بعدد ✓ و✗. ووجود `C:\kit\keep-open` (`make.mjs --keep`) يُبقي الصندوق مفتوحًا للتحقيق.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { networkInterfaces, release, totalmem } from 'node:os';
import { join } from 'node:path';

// يثبّت ويُطفئ الجهاز: فخارج الصندوق (ومستخدمه `WDAGUtilityAccount` وحده) لا يفعل شيئًا — وإلا رقّى ديوان المالك وأطفأ جهازه.
if (process.env.USERNAME !== 'WDAGUtilityAccount') {
  console.error('✗ هذا يجري داخل Windows Sandbox وحده (tools/sandbox/make.mjs) — لم يُلمس شيء');
  process.exit(1);
}

const KIT = 'C:\\kit';
const OUT = 'C:\\out';
const lines = [];
const flush = () => writeFileSync(join(OUT, 'result.txt'), `${lines.join('\n')}\n`, 'utf8');
const ok = (label, value) => {
  lines.push(`${value ? '✓' : '✗'} ${label}`);
  console.log(lines.at(-1));
  flush();
};
const note = (text) => {
  lines.push(`• ${text}`);
  console.log(lines.at(-1));
  flush();
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (check, ms) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await wait(500);
  }
};
const mb = (file) => `${(statSync(file).size / 1048576).toFixed(1)} م.ب`;
const alive = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' }).stdout.includes(String(pid));
const killTree = (pid) => spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });

async function main() {
  // ── الجهاز: نظيفٌ بلا شبكة ──
  note(`ويندوز ${release()} · الذاكرة ${(totalmem() / 1073741824).toFixed(1)} غ.ب · المستخدم ${process.env.USERNAME}`);
  const nets = Object.entries(networkInterfaces()).flatMap(([name, list]) => (list ?? []).filter((n) => !n.internal).map((n) => `${name} ${n.address}`));
  ok(`لا شبكة في الصندوق${nets.length ? ` — وُجد: ${nets.join('، ')}` : ''}`, nets.length === 0);
  const sys = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  const runtime = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_atomic_wait.dll'];
  note(`VC++ في System32 الصندوق: ${runtime.map((f) => `${f} ${existsSync(join(sys, f)) ? 'موجود' : 'غائب'}`).join('، ')}`);

  // ── التثبيت الصامت ──
  const setup = readdirSync(KIT).find((f) => f.endsWith('-setup.exe'));
  ok(`المثبّت في المجلّد المشترك: ${setup ?? 'لا مثبّت'}${setup ? ` (${mb(join(KIT, setup))})` : ''}`, Boolean(setup));
  if (!setup) return;
  const t0 = Date.now();
  const inst = spawnSync(join(KIT, setup), ['/S'], { timeout: 10 * 60 * 1000 });
  ok(`التثبيت الصامت /S انتهى برمز ${inst.status} في ${((Date.now() - t0) / 1000).toFixed(0)} ث`, inst.status === 0);
  const dir = join(process.env.LOCALAPPDATA, 'Programs', 'Diwan');
  const exe = join(dir, 'Diwan.exe');
  ok(`Diwan.exe في ${dir}`, await until(() => existsSync(exe), 120_000));
  if (!existsSync(exe)) return;

  // ── ما يجب أن يكون في مكانه ──
  const psd = join(dir, 'resources', 'app.asar.unpacked', 'native', 'diwan-psd', 'diwan_psd.node');
  ok(`محرّك Rust: diwan_psd.node${existsSync(psd) ? ` (${mb(psd)})` : ' غائب'}`, existsSync(psd));
  const missing = runtime.filter((f) => !existsSync(join(dir, f)));
  ok(`ملفّات VC++ الخمسة بجانب Diwan.exe${missing.length ? ` — ينقص ${missing.join('، ')}` : ''}`, missing.length === 0);
  ok('وبرنامج الإزالة', existsSync(join(dir, 'Uninstall Diwan.exe')));
  const desktop = join(process.env.USERPROFILE, 'Desktop', 'ديوان.lnk');
  const menu = join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ديوان.lnk');
  ok('اختصار «ديوان» على سطح المكتب', existsSync(desktop));
  ok('واختصاره في قائمة ابدأ', existsSync(menu));

  // ── الإقلاع العاديّ كما يفتحه المكتب: ملفّ التعريف الأصليّ ──
  const userData = join(process.env.APPDATA, 'Diwan');
  const app = spawn(exe, [], { stdio: 'ignore' });
  const db = join(userData, 'data', 'diwan.db');
  ok('الإقلاع العاديّ يُنشئ data\\diwan.db', await until(() => existsSync(db), 90_000));
  await wait(10_000);
  ok('ويبقى حيًّا بعد عشر ثوانٍ', alive(app.pid));
  killTree(app.pid);
  await wait(2000);

  // ── «أنا هنا» ومحرّك PSD بـdrive.mjs على البرنامج المثبَّت ──
  const drive = spawnSync(join(KIT, 'node.exe'), [join(KIT, 'drive.mjs'), join(KIT, 'cleanCheck.mjs')], {
    cwd: OUT,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    env: { ...process.env, DIWAN_EXE: exe, DIWAN_EXPECT_VERSION: setup.replace(/^diwan-|-setup\.exe$/g, ''), DIWAN_EXPECT_LICENSE: 'trial' }
  });
  for (const line of `${drive.stdout ?? ''}`.split(/\r?\n/).filter(Boolean)) {
    if (/^[✓✗] /.test(line)) {
      lines.push(`  ${line}`);
      console.log(`  ${line}`);
    } else console.log(`  (drive) ${line}`);
  }
  if (drive.stderr) console.log(`  (drive stderr) ${drive.stderr}`);
  flush();
  ok(`cleanCheck بلا ✗ (رمز ${drive.status})`, drive.status === 0);

  // ── سجلّ الأخطاء في ملفّ التعريف الأصليّ ──
  const log = join(userData, 'logs', 'diwan-errors.log');
  if (existsSync(log)) {
    copyFileSync(log, join(OUT, 'diwan-errors.log'));
    note('سجلّ الأخطاء نُسخ إلى out\\diwan-errors.log');
  }
}

try {
  await main();
} catch (e) {
  ok(`سقط الفحص: ${e?.stack ?? e}`, false);
}
const bad = lines.filter((l) => /^\s*✗/.test(l)).length;
const good = lines.filter((l) => /^\s*✓/.test(l)).length;
writeFileSync(join(OUT, 'done.txt'), `✓${good} ✗${bad} — ${new Date().toISOString()}\n`, 'utf8');
if (!existsSync(join(KIT, 'keep-open'))) spawnSync('shutdown', ['/s', '/t', '5']);
