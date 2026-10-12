/**
 * «أداة مفاتيح ديوان» — للمالك وحده (قرار المالك ٣ تشرين الأول ٢٠٢٦): تُفتح بكلمة السرّ، ثم خاناتٌ و«ولّد» —
 * بلا سطر أوامر. ملفٌّ واحد يوضع في مجلّد «لا يجب فقدانها» بجانب المفتاح والسجلّ، ويعمل من الفلاشة على أيّ جهاز.
 *
 * والمفتاح الخاص يُفكّ في هذه العملية وحدها ويبقى في ذاكرتها — لا يصل إلى الواجهة — ويُنسى بعد عشر دقائق بلا
 * عمل أو بـ«قفل». وخمس كلماتٍ خاطئة متتالية تُبطئ المحاولة التالية.
 */
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from './core.mjs';
import { APP_PUBLIC_KEY, APP_UPDATE_KEY } from './appKey.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// عشر دقائق — والاختبار يقصّرها ولا يطيلها.
const IDLE_MS = Math.min(10 * 60_000, Number(process.env.DIWAN_KEYTOOL_IDLE_MS) || Infinity);

/**
 * مجلّد المالك: ما عُيّن في DIWAN_OWNER_DIR وحده (الاختبار — فلا يقع على المجلّد الحقيقي أبدًا)، وإلا مجلّد الأداة
 * نفسها إن كان فيه المفتاح (الفلاشة)، وإلا «لا يجب فقدانها» على سطح المكتب.
 */
function ownerDir() {
  if (process.env.DIWAN_OWNER_DIR) return process.env.DIWAN_OWNER_DIR;
  const candidates = [process.env.PORTABLE_EXECUTABLE_DIR, join(homedir(), 'Desktop', 'لا يجب فقدانها')].filter(Boolean);
  const hasKey = (d) => existsSync(d) && (existsSync(join(d, core.KEY_FILE)) || existsSync(join(d, core.PLAIN_KEY_FILE)));
  return candidates.find(hasKey) ?? candidates.at(-1);
}

const dir = ownerDir();
let key = null;
/** مفتاح التحديث (البند ٣٣) — يُفكّ مع مفتاح التراخيص بالكلمة نفسها إن صُنع. */
let updateKey = null;
let idle = null;
let failures = 0;
let blockedUntil = 0;

const lock = () => {
  key = null;
  updateKey = null;
  if (idle) clearTimeout(idle);
  idle = null;
};
const touch = () => {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => {
    lock();
    win?.webContents.send('locked');
  }, IDLE_MS);
};
const needKey = () => {
  if (!key) throw new core.KeyToolError('الأداة مقفلة — اكتب كلمة السرّ');
  touch();
  return key;
};

/** كلّ قناةٍ تُجيب {ok, value} أو {ok:false, error}: الخطأ يُقال في النافذة بنصّه. */
const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e instanceof core.KeyToolError ? e.message : String(e?.message ?? e) };
    }
  });

function summary() {
  const rows = core.readLedger(dir);
  const count = (plan) => rows.filter((r) => r.plan === plan).length;
  return { lifetime: core.countLifetime(dir), demo: rows.filter((r) => r.kind === core.DEMO_KIND).length, monthly: count('شهري'), yearly: count('سنوي'), total: rows.length, early: core.EARLY_LIFETIME };
}

/** مفتاح التحديث: أصُنع؟ وعامُّه، وأيعرفه البرنامج المبنيّة منه هذه الأداة؟ */
function updateInfo() {
  if (!updateKey) return { exists: false };
  const publicKey = core.publicKeyPem(updateKey);
  return { exists: true, publicKey, matches: Boolean(APP_UPDATE_KEY) && publicKey === APP_UPDATE_KEY.trim() };
}

/** بعد فتح القفل: المفتاحان بالكلمة نفسها. */
function openKeys(password) {
  key = core.loadPrivateKey(dir, password);
  updateKey = core.keyState(dir).update ? core.loadUpdateKey(dir, password) : null;
  touch();
  return { matches: core.publicKeyPem(key) === APP_PUBLIC_KEY.trim(), update: updateInfo(), summary: summary() };
}

handle('state', () => ({ dir, ...core.keyState(dir), unlocked: Boolean(key) }));

handle('create-password', (password, confirm) => {
  if (password !== confirm) throw new core.KeyToolError('الكلمتان لا تتطابقان');
  core.encryptExistingKey(dir, password);
  return openKeys(password);
});

handle('unlock', async (password) => {
  const wait = blockedUntil - Date.now();
  if (wait > 0) throw new core.KeyToolError(`محاولاتٌ خاطئة كثيرة — انتظر ${Math.ceil(wait / 1000)} ثانية`);
  let opened;
  try {
    opened = openKeys(password);
  } catch (e) {
    lock();
    failures++;
    if (failures >= 5) blockedUntil = Date.now() + 30_000;
    throw e;
  }
  failures = 0;
  return opened;
});

handle('create-update-key', (password) => {
  needKey();
  core.createUpdateKey(dir, password);
  updateKey = core.loadUpdateKey(dir, password);
  return updateInfo();
});

handle('lock', () => lock());

handle('preview-until', (plan, start) => core.subscriptionUntil(plan, start || core.today()));

handle('normalize-device', (code) => core.normalizeDevice(code));

handle('issue', (input) => {
  const out = core.issue(dir, needKey(), input);
  return { key: out.key, buyer: out.buyer, message: out.message, payload: out.payload, warnings: out.warnings, demo: input?.plan === 'demo', summary: summary() };
});

handle('ledger', () => {
  needKey();
  return { rows: core.readLedger(dir).reverse(), summary: summary() };
});

handle('copy', (text) => {
  clipboard.writeText(String(text ?? ''));
});

handle('pick-installer', async () => {
  needKey();
  const r = await dialog.showOpenDialog(win, { title: 'مثبّت الإصدار الجديد', filters: [{ name: 'مثبّت ديوان', extensions: ['exe'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const exe = r.filePaths[0];
  const version = /(\d+\.\d+\.\d+)/.exec(basename(exe))?.[1] ?? '';
  // «ما الجديد» من CHANGELOG.md إن كان المثبّت في مجلّد release من المشروع.
  const notes = version ? core.changelogSection(join(dirname(exe), '..', 'CHANGELOG.md'), version) : '';
  return { exe, version, notes };
});

handle('make-update', async ({ exe, version, notes }) => {
  const out = join(dirname(exe), `diwan-${version}.diwanupdate`);
  // بمفتاح التراخيص (تقرؤه الإصدارات حتى 1.7.1) وبمفتاح التحديث إن صُنع (يقرؤه ما بعدها) — ملفٌّ واحد للكلّ.
  const r = await core.writeUpdateFile({ exe, version, notes, privateKey: needKey(), updateKeys: updateKey ? [updateKey] : [], out });
  return { out: r.out, size: r.manifest.size, sha256: r.manifest.sha256, withUpdateKey: Boolean(updateKey) };
});

handle('show-file', (path) => shell.showItemInFolder(path));

handle('change-password', (oldPassword, newPassword, confirm) => {
  if (newPassword !== confirm) throw new core.KeyToolError('الكلمتان الجديدتان لا تتطابقان');
  core.changePassword(dir, oldPassword, newPassword);
  openKeys(newPassword);
});

handle('open-folder', () => shell.openPath(dir));

handle('folder-files', () => (existsSync(dir) ? readdirSync(dir) : []));

let win = null;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    title: 'أداة مفاتيح ديوان',
    autoHideMenuBar: true,
    backgroundColor: '#eef0ec',
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  void win.loadFile(join(HERE, 'index.html'));
});
app.on('window-all-closed', () => {
  lock();
  app.quit();
});
