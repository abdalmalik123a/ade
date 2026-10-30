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
 * ٤. إن تعثّر شيءٌ في ٢ أو ٣ عاد ما نُقل جانبًا إلى مكانه (`services/restoreSwap.ts`).
 * ثم تُعاد الواجهة فتقرأ البيانات الجديدة من أوّلها.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { markAutoBackupPromptShown, shouldPromptAutoBackupAfterFirstIssue } from '../services/backupPrompt';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { closeDb, dataDir, dbLocked, getDb, lockDb } from '../db';
import { assertRestorable, inspectDbBytes, inspectDbFile, isEncrypted, openBackup, writeBackup, type OpenedBackup } from '../services/backup';
import { ForeignMirrorError, mirrorInfo, mirrorSnapshots, readMirror, runAutoBackup, type AutoBackupResult } from '../services/autoBackup';
import { stampDataVersion } from '../services/dataVersion';
import { logAudit } from '../services/documents';
import { currentKey } from '../services/dataKey';
import { snapshotOffice } from '../db/dbKey';
import { sealStore } from '../services/storeCrypt';
import { runMigrations } from '../db/migrations';
import { prepareSearch } from '../services/searchIndex';
import { deleteBeforeRestore, listBeforeRestore, swapInBackup, writeIncompleteMarker } from '../services/restoreSwap';
import { atomicWriteJson, readWithBackup } from '../services/stateFile';
import type { AutoBackupStatus, BackupSummary } from '@shared/api';
import { backupPasswordProblem } from '@shared/backupPassword';
import { pickFolderPath, pickOpenPath, pickSavePath } from './files';
import { handOut, pickAgain, wasHandedOut } from './handedPaths';
import { handleChecked } from './checked';
import { text } from '@shared/bridgeGuards';

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** ما يُفكّ مؤقّتًا للفحص والاسترجاع — في مجلّد بيانات المكتب: على قرصه، فيُنقل منه بلا نسخ. */
const workDir = () => join(dataDir(), 'restore-work');

/** النسخة مفتوحةً وقاعدتها مفكوكةً في ملفٍّ مؤقّت ومفحوصة — و`done` يمحو ما فُكّ. */
async function openAndInspect(path: string, password: string | null): Promise<{ opened: OpenedBackup; dbFile: string; summary: BackupSummary; done: () => void }> {
  const opened = await openBackup(path, password, workDir());
  const dbFile = join(workDir(), `inspect-${process.pid}-${Date.now()}.db`);
  const done = () => {
    rmSync(dbFile, { force: true });
    opened.dispose();
  };
  try {
    await opened.extractDb(dbFile);
    const summary = inspectDbFile(dbFile, opened.files.length, opened.meta, app.getVersion());
    return { opened, dbFile, summary, done };
  } catch (e) {
    done();
    throw e;
  }
}

function setting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value);
}

/** القاعدة بعد فتحها من جديد: تُرحَّل بالترقيات المرقّمة في معاملةٍ وتُطابَق فهارسها — كما عند الإقلاع. */
function reopen(): void {
  const db = getDb();
  db.transaction(() => runMigrations(db))();
  prepareSearch(db);
  // رُحّلت بإصدار هذا البرنامج — فلا يحسبها الإقلاع التالي «أقدم» فيعيد نسخها ويعرض «ما الجديد».
  stampDataVersion(db, app.getVersion());
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
  snapshotOffice(getDb(), snapshot, true);
  let size: number;
  try {
    // ملفًّا ملفًّا من القرص — لا المخزن كلّه في الذاكرة (خطة Production، ٤٫١).
    size = (await writeBackup({ target, dbFile: snapshot, storeRoot: join(dataDir(), 'store'), password, appVersion: app.getVersion(), officeKey: currentKey() })).bytes;
  } finally {
    if (existsSync(snapshot)) rmSync(snapshot);
  }
  // «آخر نسخة منذ…» — يُذكَّر بها المكتب إن طالت (شاشة اليوم والإعدادات).
  setting('lastBackupAt', new Date().toISOString());
  logAudit(getDb(), 'backup', 'create', `${encrypted ? 'مشفّرة — ' : ''}${(size / 1024 / 1024).toFixed(1)} م.ب`);
  return { path: handOut(target), bytes: size, encrypted };
}

/**
 * يستبدل بيانات المكتب بالنسخة — وما كان يُنقل جانبًا لا يُحذف.
 * يعيد مجلّد ما نُقل جانبًا، ليُقال للمكتب أين هو.
 *
 * و`placeDb` يضع قاعدة النسخة في مكانها (نقلًا من ملفّها المفكوك، أو كتابةً من نسخة المرآة)،
 * و`writeStore` يكتب مخزنها في مجلّده — ملفًّا ملفًّا في الحالين.
 */
async function applyRestore(placeDb: (dbFile: string) => void, writeStore: (store: string) => void | Promise<void>): Promise<string> {
  const dir = dataDir();
  const aside = join(dir, `before-restore-${stamp()}`);
  mkdirSync(aside, { recursive: true });
  // ما على الجهاز جانبًا (القاعدة نسخةً متّسقة ثم ملفّاتها، والمخزن نقلًا)، ثم النسخة — وكلّه تحت الحماية.
  try {
    await swapInBackup({
      dir,
      aside,
      snapshot: (file) => snapshotOffice(getDb(), file),
      close: closeDb,
      reopen,
      placeDb,
      writeStore,
      // لم تعد القاعدة إلى مكانها: تُقفل فلا تُفتح فارغة، ويبقى أثرٌ يعيدها الإقلاعُ التالي (مراجعة ٧ ت١).
      lock: lockDb,
      markIncomplete: (info) => writeIncompleteMarker(dir, info)
    });
  } catch (e) {
    if (dbLocked()) relaunchAfterStuckRestore();
    throw e;
  }
  await sealStore().catch(() => undefined); // ما جاء واضحًا يُشفَّر بمفتاح هذا المكتب (D238)، وتعثُّره يُعاد في الإقلاع
  return aside;
}

/**
 * القاعدة مقفلةٌ ولا عمل يمضي بلا قاعدة: يُقال للمكتب ثم يُعاد فتح البرنامج، فيُعيد الإقلاعُ بياناتِه الأصلية بنفسه.
 * (والجواب إلى الواجهة يصلها قبلُ، برسالة التعثّر.) وإن تعذّرت الإعادة في الإقلاع أُغلق البرنامج برسالتها — لا حلقة.
 */
function relaunchAfterStuckRestore(): void {
  void dialog
    .showMessageBox({
      type: 'warning',
      title: 'تعثّر الاسترجاع',
      message: 'تعثّر الاسترجاع ولم تعد بيانات المكتب إلى مكانها بعد.',
      detail: 'بياناتك الأصلية سليمةٌ ومحفوظة. سيُعاد فتح ديوان الآن فيُعيدها بنفسه — فإن ظهرت رسالةٌ أخرى فأرسلها إلى المطوّر.',
      buttons: ['حسنًا'],
      noLink: true
    })
    .then(() => {
      // القفل الواحد يُرفع، وإلا رُفضت النسخة الجديدة بحجّة أنّ البرنامج مفتوح.
      app.releaseSingleInstanceLock();
      app.relaunch();
      app.exit(0);
    });
}

// ── النسخة التلقائية عند الإغلاق (تعميق الموجود ٢) ───────────────────────
//
// إعدادها في القاعدة (المجلّد، وكم يُبقى، والكلمة مشفّرةً بحساب ويندوز)؛ وحالها (متى
// أُخذت آخر مرّة، ولماذا لم تُؤخذ) في ملفٍّ بجانبها لا فيها: فلو كُتب في القاعدة لتغيّرت
// كلّ مرّة، فصارت كلّ نسخةٍ «جديدة» ولو لم يُعمل شيء.

type AutoState = {
  lastAt: string | null;
  lastError: string | null;
  foreign: boolean;
  /**
   * هويّة المرآة التي كتبنا عليها آخر مرّة، والمجلّد الذي كانت فيه (مراجعة ٧ ت١). في هذا الملف لا في القاعدة:
   * فلو كُتبت في القاعدة لتغيّرت بعد أوّل نسخةٍ فأُخذت نسخةٌ ثانيةٌ بلا عملٍ جديد؛ ولا ينقلب الاسترجاعُ بنسخةٍ قديمة
   * إلى فقدها. وهي صالحةٌ لمجلّدها وحده — فمجلّدٌ آخر يختاره المكتب اعتمادٌ جديد.
   */
  mirrorId: string | null;
  mirrorDir: string | null;
};
const stateFile = () => join(dataDir(), 'auto-backup.json');

export function autoBackupState(): AutoState {
  return readWithBackup(
    stateFile(),
    (raw) => {
      const s = JSON.parse(raw) as Partial<AutoState>;
      return { lastAt: s.lastAt ?? null, lastError: s.lastError ?? null, foreign: s.foreign === true, mirrorId: s.mirrorId ?? null, mirrorDir: s.mirrorDir ?? null };
    },
    { lastAt: null, lastError: null, foreign: false, mirrorId: null, mirrorDir: null }
  );
}

/** يدمج ما تغيّر في حال النسخة التلقائية — فلا تضيع هويّة المرآة بكتابة الباقي. */
function saveAutoState(patch: Partial<AutoState>): void {
  atomicWriteJson(stateFile(), { ...autoBackupState(), ...patch });
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
    lastAt: autoBackupState().lastAt,
    lastError: autoBackupState().lastError,
    foreign: autoBackupState().foreign
  };
}

/** كلمة النسخة التلقائية: محفوظةٌ مشفّرةً بحساب ويندوز (DPAPI)، فلا تُقرأ من القاعدة وحدها. */
function autoPassword(): string | null {
  const secret = readSetting('autoBackupSecret');
  return secret ? safeStorage.decryptString(Buffer.from(secret, 'base64')) : null;
}

/** يُسأل عنه في بدء الإغلاق: وقاعدةٌ مقفلة (استرجاعٌ متعثّر) لا تحبس النافذة فلا تُغلق. */
export const autoBackupConfigured = (): boolean => {
  try {
    return Boolean(readSetting('autoBackupDir'));
  } catch {
    return false;
  }
};

/** تُؤخذ النسخة إلى مجلّدها — ويُحفظ حالها نجحت أو لم تنجح. */
export function runConfiguredAutoBackup(): AutoBackupResult | null {
  const status = autoStatus();
  if (!status.dir) return null;
  const state = autoBackupState();
  try {
    const r = runAutoBackup({
      target: status.dir,
      storeRoot: join(dataDir(), 'store'),
      // نسخة القاعدة المؤقّتة بجانب القاعدة لا في `%TEMP%` (A08).
      tempDir: dataDir(),
      snapshotDb: (file) => snapshotOffice(getDb(), file, true),
      password: autoPassword(),
      keep: status.keep,
      appVersion: app.getVersion(),
      officeKey: currentKey(),
      // قرصٌ غير الذي اعتُمد لا يُكتب عليه (مراجعة ٧ ت١)؛ ويُعتمد قرصٌ جديد بـ«اعتمد هذه الفلاشة».
      expectId: state.mirrorDir === status.dir ? state.mirrorId : null
    });
    saveAutoState({ lastAt: new Date().toISOString(), lastError: null, foreign: false, mirrorId: r.id, mirrorDir: status.dir });
    return r;
  } catch (e) {
    saveAutoState({ lastAt: status.lastAt, lastError: e instanceof Error ? e.message : String(e), foreign: e instanceof ForeignMirrorError });
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
  const reloadAll = () => setTimeout(() => BrowserWindow.getAllWindows().forEach((w) => w.webContents.reload()), 400);

  ipcMain.handle('backup:autoGet', () => autoStatus());
  ipcMain.handle('backup:autoPickDir', async (e) => {
    const w = win(e);
    return w ? handOut(await pickFolderPath(w, { title: 'مجلّد النسخة التلقائية — فلاشةٌ أو قرصٌ آخر', buttonLabel: 'اختره' })) : null;
  });

  ipcMain.handle('backup:autoSet', (_e, config: { dir: string | null; keep?: number; password?: string | null }) => {
    if (!config.dir) {
      for (const k of ['autoBackupDir', 'autoBackupSecret', 'autoBackupKeep']) unsetSetting(k);
      saveAutoState({ mirrorId: null, mirrorDir: null, lastError: null, foreign: false });
      return autoStatus();
    }
    // المجلّد أعطاه «اختره» أو هو المحفوظ نفسه — وما سواهما يُرفض قبل أن يُلمس (A04، D69).
    if (!wasHandedOut(config.dir) && config.dir !== readSetting('autoBackupDir')) throw pickAgain('المجلّد');
    if (!existsSync(config.dir)) throw new Error('المجلّد غير موجود — أهي فلاشةٌ غير موصولة؟');
    // مجلّدٌ جديدٌ يختاره المكتب بنفسه اعتمادٌ له: تُنسى هويّة السابق، فتُكتب هويّةٌ للجديد عند أوّل نسخة.
    if (readSetting('autoBackupDir') !== config.dir) saveAutoState({ mirrorId: null, mirrorDir: null, lastError: null, foreign: false });
    setting('autoBackupDir', config.dir);
    if (config.keep) setting('autoBackupKeep', String(Math.max(1, Math.min(60, Math.round(config.keep)))));
    if (config.password === null) unsetSetting('autoBackupSecret');
    else if (typeof config.password === 'string') {
      // الحدّ في العملية الرئيسية لا في الواجهة وحدها (و٦).
      const problem = backupPasswordProblem(config.password);
      if (problem) throw new Error(problem);
      if (!safeStorage.isEncryptionAvailable()) throw new Error('حفظ الكلمة مشفّرةً غير متاحٍ على هذا الجهاز');
      setting('autoBackupSecret', safeStorage.encryptString(config.password).toString('base64'));
    }
    return autoStatus();
  });

  ipcMain.handle('backup:autoRun', () => runConfiguredAutoBackup());

  /** «اعتمد هذه الفلاشة»: يرضى المكتب بالقرص الموصول الآن — تُنسى الهويّة القديمة فتُكتب هويّةُ الجديد عند أوّل نسخة. */
  ipcMain.handle('backup:autoAdopt', () => (saveAutoState({ mirrorId: null, mirrorDir: null, lastError: null, foreign: false }), autoStatus()));

  ipcMain.handle('backup:mirrorPick', async (e) => {
    const w = win(e);
    if (!w) return null;
    const path = await pickFolderPath(w, { title: 'مجلّد النسخة التلقائية', buttonLabel: 'افحصه' });
    if (!path) return null;
    const info = mirrorInfo(path);
    return { path: handOut(path), encrypted: info.encrypted, lastAt: info.lastAt, snapshots: mirrorSnapshots(path) };
  });

  const mirrorSummary = (mirror: ReturnType<typeof readMirror>): BackupSummary =>
    inspectDbBytes(mirror.db, mirror.files, mirror.appVersion ? { appVersion: mirror.appVersion, createdAt: null } : null, app.getVersion());

  ipcMain.handle('backup:mirrorInspect', (_e, path: string, password?: string | null, snapshot?: string | null): BackupSummary => {
    if (!wasHandedOut(path)) throw pickAgain('المجلّد');
    return mirrorSummary(readMirror(path, password ?? null, snapshot ?? null));
  });

  ipcMain.handle('backup:mirrorRestore', async (_e, path: string, password?: string | null, snapshot?: string | null): Promise<{ summary: BackupSummary; aside: string }> => {
    if (!wasHandedOut(path)) throw pickAgain('المجلّد');
    const mirror = readMirror(path, password ?? null, snapshot ?? null);
    const summary = mirrorSummary(mirror);
    assertRestorable(summary, app.getVersion());
    const aside = await applyRestore((dbFile) => writeFileSync(dbFile, mirror.db), mirror.writeStore);
    logAudit(getDb(), 'backup', 'restore', `من النسخة التلقائية (${mirror.snapshot}): ${summary.documents} كتابًا — وما كان قبلها في ${aside}`);
    reloadAll();
    return { summary, aside };
  });

  ipcMain.handle('backup:create', async (e, password?: string | null) => {
    const w = win(e);
    if (!w) return null;
    // بلا كلمة: نسخةٌ غير مشفّرة. وبكلمةٍ: ثمانية أحرفٍ أقلّها (و٦) — وكانت كلمةٌ من فراغاتٍ تُعدّ «بلا كلمة» فتخرج
    // النسخة غير مشفّرةٍ والموظف يظنّها مشفّرة.
    if (password == null || password === '') return createBackup(w, null);
    const problem = backupPasswordProblem(String(password));
    if (problem) throw new Error(problem);
    return createBackup(w, String(password));
  });

  /** يُختار الملف — ويُقال أمشفّرٌ هو، فيُسأل عن كلمته قبل الفحص. */
  ipcMain.handle('backup:pick', async (e): Promise<{ path: string; encrypted: boolean } | null> => {
    const w = win(e);
    if (!w) return null;
    const path = await pickOpenPath(w, { title: 'استرجاع نسخة احتياطية', buttonLabel: 'افحصها', filterName: 'نسخة ديوان', extensions: ['zip', 'diwan'] });
    if (!path) return null;
    // أوّل الملف وحده — كان يُقرأ كلّه ليُعرف أمشفّرٌ هو.
    const head = Buffer.alloc(16);
    const h = await open(path, 'r');
    try {
      await h.read(head, 0, 16, 0);
    } finally {
      await h.close();
    }
    return { path: handOut(path), encrypted: isEncrypted(head) };
  });

  ipcMain.handle('backup:inspect', async (_e, path: string, password?: string | null): Promise<BackupSummary> => {
    if (!wasHandedOut(path)) throw pickAgain('الملفّ');
    const { summary, done } = await openAndInspect(path, password ?? null);
    done();
    return summary;
  });

  ipcMain.handle('backup:restore', async (_e, path: string, password?: string | null): Promise<{ summary: BackupSummary; aside: string }> => {
    if (!wasHandedOut(path)) throw pickAgain('الملفّ');
    const { opened, dbFile, summary, done } = await openAndInspect(path, password ?? null);
    let aside: string;
    try {
      assertRestorable(summary, app.getVersion());
      // القاعدة المفكوكة تُنقل إلى مكانها (على القرص نفسه)، والمخزن يُفكّ ملفًّا ملفًّا.
      aside = await applyRestore((target) => renameSync(dbFile, target), (store) => opened.extractStore(store));
    } finally {
      done();
    }
    logAudit(getDb(), 'backup', 'restore', `${summary.documents} كتابًا — وما كان قبلها في ${aside}`);
    reloadAll();
    return { summary, aside };
  });

  handleChecked('backup:listAsides', {}, () => listBeforeRestore(dataDir()));
  handleChecked('backup:deleteAside', { name: text(120) }, ({ name }) => {
    const ok = deleteBeforeRestore(dataDir(), name);
    if (ok) logAudit(getDb(), 'backup', 'deleteAside', `حُذف المجلّد ${name}`);
    return ok;
  });

  ipcMain.handle('backup:shouldPromptAfterFirstIssue', () => shouldPromptAutoBackupAfterFirstIssue(getDb()));
  ipcMain.handle('backup:markFirstIssuePromptShown', () => (markAutoBackupPromptShown(getDb()), true));
}
