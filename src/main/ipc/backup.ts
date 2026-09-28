/**
 * النسخ الاحتياطي واسترجاعه (د١) — قنوات النظام.
 *
 * الحزم والتشفير والفحص في services/backup.ts؛ وهنا ما يمسّ الجهاز: أين يُكتب الملف،
 * وكيف تُستبدل بيانات المكتب بالنسخة **بلا أن يضيع ما كان**:
 *
 * ١. تُفكّ النسخة وتُفحص قاعدتها قبل أن يُمسّ شيء (ويراها المكتب ويوافق).
 * ٢. يُنقل ما على الجهاز جانبًا — القاعدة نسخةً متّسقة، والمخزن نقلًا — إلى
 *    `data/before-restore-…`. لا يُحذف.
 * ٣. تُكتب النسخة، وتُفتح القاعدة من جديد وتُرحَّل إلى صيغة هذا الإصدار.
 * ٤. إن تعثّر شيءٌ في ٣ عاد ما نُقل جانبًا إلى مكانه.
 * ثم تُعاد الواجهة فتقرأ البيانات الجديدة من أوّلها.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { BrowserWindow, ipcMain, safeStorage } from 'electron';
import { closeDb, dataDir, getDb } from '../db';
import { inspectBackup, isEncrypted, packBackup, unpackBackup } from '../services/backup';
import { mirrorInfo, readMirror, runAutoBackup, type AutoBackupResult } from '../services/autoBackup';
import { logAudit, prepareDocuments } from '../services/documents';
import { ensureSearchColumn } from '../services/citizens';
import { prepareLetterheads } from '../services/letterheads';
import { prepareTemplates } from '../services/templates';
import { prepareSearch } from '../services/searchIndex';
import type { AutoBackupStatus, BackupSummary } from '@shared/api';
import { pickFolderPath, pickOpenPath, pickSavePath } from './files';

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** ملفّات المخزن نسبيّةً إليه — لتُحزم. */
async function readStore(root: string): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  if (!existsSync(root)) return files;
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, `${prefix}${entry.name}/`);
      else files[`${prefix}${entry.name}`] = new Uint8Array(await readFile(full));
    }
  };
  await walk(root, '');
  return files;
}

/** نسخةٌ متّسقة من القاعدة الجارية — ولو صدر كتابٌ لحظتها. */
function snapshotDb(target: string): void {
  if (existsSync(target)) rmSync(target);
  getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

function setting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value);
}

/** القاعدة بعد فتحها من جديد: تُرحَّل أعمدتها وتُطابَق فهارسها — كما عند الإقلاع. */
function reopen(): void {
  const db = getDb();
  ensureSearchColumn(db);
  prepareDocuments(db);
  prepareLetterheads(db);
  prepareTemplates(db);
  prepareSearch(db);
}

export async function createBackup(
  window: BrowserWindow,
  password: string | null
): Promise<{ path: string; bytes: number; encrypted: boolean } | null> {
  const encrypted = Boolean(password);
  const target = await pickSavePath(window, {
    title: encrypted ? 'نسخة احتياطية مشفّرة' : 'نسخة احتياطية كاملة',
    defaultName: `diwan-backup-${stamp()}.${encrypted ? 'diwan' : 'zip'}`,
    filterName: encrypted ? 'نسخة ديوان مشفّرة' : 'أرشيف مضغوط',
    ext: encrypted ? 'diwan' : 'zip'
  });
  if (!target) return null;

  const snapshot = join(dataDir(), `backup-${stamp()}.db`);
  snapshotDb(snapshot);
  try {
    const bytes = packBackup(new Uint8Array(await readFile(snapshot)), await readStore(join(dataDir(), 'store')), password);
    await writeFile(target, bytes);
  } finally {
    if (existsSync(snapshot)) rmSync(snapshot);
  }
  const size = statSync(target).size;
  // «آخر نسخة منذ…» — يُذكَّر بها المكتب إن طالت (شاشة اليوم والإعدادات).
  setting('lastBackupAt', new Date().toISOString());
  logAudit(getDb(), 'backup', 'create', `${encrypted ? 'مشفّرة — ' : ''}${(size / 1024 / 1024).toFixed(1)} م.ب`);
  return { path: target, bytes: size, encrypted };
}

/**
 * يستبدل بيانات المكتب بالنسخة — وما كان يُنقل جانبًا لا يُحذف.
 * يعيد مجلّد ما نُقل جانبًا، ليُقال للمكتب أين هو.
 *
 * و`writeStore` يكتب مخزن النسخة في مجلّده: من الحزمة المفكوكة في الذاكرة، أو من مجلّد
 * النسخة التلقائية ملفًّا ملفًّا.
 */
function applyRestore(dbBytes: Uint8Array, writeStore: (store: string) => void): string {
  const dir = dataDir();
  const aside = join(dir, `before-restore-${stamp()}`);
  mkdirSync(aside, { recursive: true });

  // ما على الجهاز جانبًا: القاعدة نسخةً متّسقة، ثم تُغلق وتُرفع ملفّاتها، والمخزن نقلًا.
  snapshotDb(join(aside, 'diwan.db'));
  closeDb();
  const dbFile = join(dir, 'diwan.db');
  const store = join(dir, 'store');
  const moved: [string, string][] = [];
  const move = (from: string, to: string) => {
    if (!existsSync(from)) return;
    renameSync(from, to);
    moved.push([from, to]);
  };
  for (const suffix of ['', '-wal', '-shm']) move(dbFile + suffix, join(aside, `current.db${suffix}`));
  move(store, join(aside, 'store'));

  try {
    writeFileSync(dbFile, dbBytes);
    mkdirSync(store, { recursive: true });
    writeStore(store);
    reopen();
  } catch (e) {
    // تعثّر: يُمحى ما كُتب، ويعود ما نُقل جانبًا إلى مكانه — فالجهاز كما كان.
    closeDb();
    for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) if (existsSync(f)) rmSync(f);
    if (existsSync(store)) rmSync(store, { recursive: true, force: true });
    for (const [from, to] of moved.reverse()) renameSync(to, from);
    reopen();
    throw e;
  }
  return aside;
}

// ── النسخة التلقائية عند الإغلاق (تعميق الموجود ٢) ───────────────────────
//
// إعدادها في القاعدة (المجلّد، وكم يُبقى، والكلمة مشفّرةً بحساب ويندوز)؛ وحالها (متى
// أُخذت آخر مرّة، ولماذا لم تُؤخذ) في ملفٍّ بجانبها لا فيها: فلو كُتب في القاعدة لتغيّرت
// كلّ مرّة، فصارت كلّ نسخةٍ «جديدة» ولو لم يُعمل شيء.

type AutoState = { lastAt: string | null; lastError: string | null };
const stateFile = () => join(dataDir(), 'auto-backup.json');

export function autoBackupState(): AutoState {
  try {
    const s = JSON.parse(readFileSync(stateFile(), 'utf8')) as Partial<AutoState>;
    return { lastAt: s.lastAt ?? null, lastError: s.lastError ?? null };
  } catch {
    return { lastAt: null, lastError: null };
  }
}

function saveAutoState(s: AutoState): void {
  writeFileSync(stateFile(), JSON.stringify(s));
}

function readSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function unsetSetting(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

function autoStatus(): AutoBackupStatus {
  return {
    dir: readSetting('autoBackupDir'),
    keep: Number(readSetting('autoBackupKeep')) || 10,
    encrypted: Boolean(readSetting('autoBackupSecret')),
    canEncrypt: safeStorage.isEncryptionAvailable(),
    ...autoBackupState()
  };
}

/** كلمة النسخة التلقائية: محفوظةٌ مشفّرةً بحساب ويندوز (DPAPI)، فلا تُقرأ من القاعدة وحدها. */
function autoPassword(): string | null {
  const secret = readSetting('autoBackupSecret');
  return secret ? safeStorage.decryptString(Buffer.from(secret, 'base64')) : null;
}

export const autoBackupConfigured = () => Boolean(readSetting('autoBackupDir'));

/** تُؤخذ النسخة إلى مجلّدها — ويُحفظ حالها نجحت أو لم تنجح. */
export function runConfiguredAutoBackup(): AutoBackupResult | null {
  const status = autoStatus();
  if (!status.dir) return null;
  try {
    const r = runAutoBackup({ target: status.dir, storeRoot: join(dataDir(), 'store'), snapshotDb, password: autoPassword(), keep: status.keep });
    saveAutoState({ lastAt: new Date().toISOString(), lastError: null });
    return r;
  } catch (e) {
    saveAutoState({ lastAt: status.lastAt, lastError: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** آخر نسخةٍ أيًّا كانت — يدويّةً (في القاعدة) أو تلقائيّة (بجانبها). */
export function lastAnyBackup(manual: string | null): string | null {
  const auto = autoBackupState().lastAt;
  if (!auto) return manual;
  return !manual || auto > manual ? auto : manual;
}

export function registerBackupIpc(): void {
  const win = (e: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender);

  ipcMain.handle('backup:autoGet', () => autoStatus());

  ipcMain.handle('backup:autoPickDir', async (e) => {
    const w = win(e);
    return w ? pickFolderPath(w, { title: 'مجلّد النسخة التلقائية — فلاشةٌ أو قرصٌ آخر', buttonLabel: 'اختره' }) : null;
  });

  ipcMain.handle('backup:autoSet', (_e, config: { dir: string | null; keep?: number; password?: string | null }) => {
    if (!config.dir) {
      for (const k of ['autoBackupDir', 'autoBackupSecret', 'autoBackupKeep']) unsetSetting(k);
      return autoStatus();
    }
    if (!existsSync(config.dir)) throw new Error('المجلّد غير موجود — أهي فلاشةٌ غير موصولة؟');
    setting('autoBackupDir', config.dir);
    if (config.keep) setting('autoBackupKeep', String(Math.max(1, Math.min(60, Math.round(config.keep)))));
    if (config.password === null) unsetSetting('autoBackupSecret');
    else if (typeof config.password === 'string') {
      if (config.password.length < 4) throw new Error('كلمة النسخة التلقائية أربعة أحرفٍ أقلّها');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('حفظ الكلمة مشفّرةً غير متاحٍ على هذا الجهاز');
      setting('autoBackupSecret', safeStorage.encryptString(config.password).toString('base64'));
    }
    return autoStatus();
  });

  ipcMain.handle('backup:autoRun', () => runConfiguredAutoBackup());

  ipcMain.handle('backup:mirrorPick', async (e) => {
    const w = win(e);
    if (!w) return null;
    const path = await pickFolderPath(w, { title: 'مجلّد النسخة التلقائية', buttonLabel: 'افحصه' });
    if (!path) return null;
    const info = mirrorInfo(path);
    return { path, encrypted: info.encrypted, lastAt: info.lastAt };
  });

  ipcMain.handle('backup:mirrorInspect', (_e, path: string, password?: string | null): BackupSummary => {
    const mirror = readMirror(path, password ?? null);
    return { ...inspectBackup({ db: mirror.db, store: {} }), files: mirror.files };
  });

  ipcMain.handle('backup:mirrorRestore', (_e, path: string, password?: string | null): { summary: BackupSummary; aside: string } => {
    const mirror = readMirror(path, password ?? null);
    const summary = { ...inspectBackup({ db: mirror.db, store: {} }), files: mirror.files };
    if (!summary.ok) throw new Error(`القاعدة في النسخة لا تجتاز الفحص (${summary.integrity}) — لا تُسترجع`);
    const aside = applyRestore(mirror.db, mirror.writeStore);
    logAudit(getDb(), 'backup', 'restore', `من النسخة التلقائية (${mirror.snapshot}): ${summary.documents} كتابًا — وما كان قبلها في ${aside}`);
    setTimeout(() => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.reload();
    }, 400);
    return { summary, aside };
  });

  ipcMain.handle('backup:create', async (e, password?: string | null) => {
    const w = win(e);
    return w ? createBackup(w, password?.trim() ? password : null) : null;
  });

  /** يُختار الملف — ويُقال أمشفّرٌ هو، فيُسأل عن كلمته قبل الفحص. */
  ipcMain.handle('backup:pick', async (e): Promise<{ path: string; encrypted: boolean } | null> => {
    const w = win(e);
    if (!w) return null;
    const path = await pickOpenPath(w, {
      title: 'استرجاع نسخة احتياطية',
      buttonLabel: 'افحصها',
      filterName: 'نسخة ديوان',
      extensions: ['zip', 'diwan']
    });
    if (!path) return null;
    const head = new Uint8Array(await readFile(path)).subarray(0, 16);
    return { path, encrypted: isEncrypted(head) };
  });

  ipcMain.handle('backup:inspect', async (_e, path: string, password?: string | null): Promise<BackupSummary> =>
    inspectBackup(unpackBackup(new Uint8Array(await readFile(path)), password ?? null))
  );

  ipcMain.handle(
    'backup:restore',
    async (_e, path: string, password?: string | null): Promise<{ summary: BackupSummary; aside: string }> => {
      const unpacked = unpackBackup(new Uint8Array(await readFile(path)), password ?? null);
      const summary = inspectBackup(unpacked);
      if (!summary.ok) throw new Error(`القاعدة في النسخة لا تجتاز الفحص (${summary.integrity}) — لا تُسترجع`);
      const aside = applyRestore(unpacked.db, (store) => {
        for (const [rel, bytes] of Object.entries(unpacked.store)) {
          const file = join(store, rel);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, bytes);
        }
      });
      logAudit(getDb(), 'backup', 'restore', `${summary.documents} كتابًا — وما كان قبلها في ${aside}`);
      // الواجهة تُعاد لتقرأ البيانات الجديدة من أوّلها — بعد أن يصلها الجواب.
      setTimeout(() => {
        for (const w of BrowserWindow.getAllWindows()) w.webContents.reload();
      }, 400);
      return { summary, aside };
    }
  );
}
