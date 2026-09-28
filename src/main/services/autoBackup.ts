/**
 * النسخة التلقائية (تعميق الموجود ٢) — مجلّدٌ مرآةٌ لا حزمة.
 *
 * النسخة اليدوية تحزم المخزن كلّه في الذاكرة ثم تضغطه: والمستمسك الممسوح بـ٣٠٠ نقطة
 * نحو ١١ ميغا، فمكتبٌ بألف مستمسكٍ غيغاتٌ لا تُحزم كلّ إغلاق. فالتلقائية مرآة:
 * - **القاعدة** نسخةٌ متّسقة (VACUUM INTO) تُكتب إن تغيّرت منذ آخر نسخة — وتُبقى آخرها
 *   (عشرٌ افتراضًا)، فخطأٌ اكتُشف بعد أيّامٍ يُسترجع ما قبله.
 * - **المخزن** يُنسخ منه الجديد وحده (بالاسم والحجم) — ملفّه الواحد في الذاكرة لا كلّه.
 * - **والتشفير لكلّ ملف** (AES-256-GCM بمفتاحٍ من scrypt وملحٍ في `manifest.json`) إن
 *   اختاره المكتب: فالفلاشة المفقودة لا تكشف مستمسكات الناس.
 *
 * والمجلّد يُسترجع منه كما تُسترجع الحزمة: تُفحص قاعدته ويراها المكتب، ثم تحلّ محلّ
 * البيانات (ipc/backup.ts).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** اسم المجلّد داخل ما يختاره المكتب — لاتينيٌّ فلا يتعثّر في فلاشةٍ بنظام ملفّاتٍ قديم. */
export const MIRROR = 'Diwan-Backup';
const MANIFEST = 'manifest.json';
const ENC = '.enc';
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const CHECK = 'diwan-auto-backup';

type Manifest = {
  app: 'diwan';
  version: 1;
  encrypted: boolean;
  /** ملح المفتاح، ونصٌّ معروفٌ مشفَّر يُعرف به أنّ الكلمة تفتح هذا المجلّد. */
  salt?: string;
  check?: string;
  lastAt?: string;
  lastDbHash?: string;
};

const keyOf = (password: string, salt: Buffer) => scryptSync(password.normalize('NFC'), salt, 32, SCRYPT);

/** متّجه ١٢ ‖ وسم ١٦ ‖ المشفَّر. */
function seal(plain: Uint8Array, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function unseal(data: Uint8Array, key: Buffer): Buffer {
  const buf = Buffer.from(data);
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  try {
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  } catch {
    throw new Error('كلمة النسخة التلقائية خاطئة، أو الملف معطوب');
  }
}

/** كتابةٌ لا تترك ملفًّا نصفَ مكتوب إن انقطعت: إلى اسمٍ مؤقّت ثم نقلٌ واحد. */
function writeAtomic(file: string, bytes: Uint8Array | string): void {
  mkdirSync(dirname(file), { recursive: true });
  const part = `${file}.part`;
  writeFileSync(part, bytes);
  renameSync(part, file);
}

/** المجلّد المرآة: ما اختاره المكتب، أو هو نفسه إن اختير «Diwan-Backup» مباشرة. */
export function mirrorRoot(dir: string): string {
  return existsSync(join(dir, MANIFEST)) ? dir : join(dir, MIRROR);
}

function readManifest(root: string): Manifest | null {
  const file = join(root, MANIFEST);
  if (!existsSync(file)) return null;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
    return m.app === 'diwan' ? m : null;
  } catch {
    return null;
  }
}

/** المفتاح من الكلمة — ويُتحقَّق أنّها تفتح هذا المجلّد قبل أن يُكتب فيه أو يُقرأ منه شيء. */
function keyFor(m: Manifest, password: string | null): Buffer | null {
  if (!m.encrypted) return null;
  if (!password) throw new Error('النسخة التلقائية مشفّرة — اكتب كلمتها');
  const key = keyOf(password, Buffer.from(m.salt ?? '', 'base64'));
  if (unseal(Buffer.from(m.check ?? '', 'base64'), key).toString() !== CHECK) throw new Error('كلمة النسخة التلقائية خاطئة');
  return key;
}

/** ملفّات مجلّدٍ نسبيّةً إليه — بلا ما يُكتب مؤقّتًا. */
function walk(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const visit = (dir: string, prefix: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) visit(join(dir, e.name), `${prefix}${e.name}/`);
      else if (!e.name.endsWith('.part')) out.push(`${prefix}${e.name}`);
    }
  };
  visit(root, '');
  return out;
}

const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, '-');

export type AutoBackupResult = {
  root: string;
  /** كُتبت نسخةٌ جديدة من القاعدة — أم لم تتغيّر منذ آخر مرّة. */
  dbChanged: boolean;
  filesCopied: number;
  bytesCopied: number;
  snapshots: number;
};

/**
 * يأخذ النسخة إلى المرآة. و`snapshotDb` يكتب نسخةً متّسقة من القاعدة في مسارٍ يُعطاه
 * (VACUUM INTO) — فالخدمة تُختبر بلا Electron.
 */
export function runAutoBackup(opts: {
  target: string;
  storeRoot: string;
  snapshotDb: (file: string) => void;
  password: string | null;
  keep: number;
  now?: Date;
}): AutoBackupResult {
  if (!existsSync(opts.target)) {
    throw new Error(`مجلّد النسخة التلقائية غير موجود: ${opts.target} — أهي فلاشةٌ غير موصولة؟`);
  }
  const root = mirrorRoot(opts.target);
  mkdirSync(root, { recursive: true });
  let manifest = readManifest(root);
  if (!manifest) {
    manifest = { app: 'diwan', version: 1, encrypted: Boolean(opts.password) };
    if (opts.password) {
      const salt = randomBytes(16);
      manifest.salt = salt.toString('base64');
      manifest.check = seal(Buffer.from(CHECK), keyOf(opts.password, salt)).toString('base64');
    }
  } else if (manifest.encrypted !== Boolean(opts.password)) {
    // مجلّدٌ واحدٌ لا يخلط المشفّر بغيره: فالاسترجاع منه يعرف ما فيه.
    throw new Error(manifest.encrypted ? 'في المجلّد نسخةٌ مشفّرة — والتلقائية بلا كلمة' : 'في المجلّد نسخةٌ غير مشفّرة — اختر مجلّدًا آخر للنسخة المشفّرة');
  }
  const key = keyFor(manifest, opts.password);
  const now = opts.now ?? new Date();

  // ── القاعدة: تُكتب إن تغيّرت، وتُبقى آخرها ──────────────────────────
  const temp = join(tmpdir(), `diwan-auto-${process.pid}-${Date.now()}.db`);
  let dbChanged = false;
  let bytesCopied = 0;
  try {
    opts.snapshotDb(temp);
    const db = readFileSync(temp);
    const hash = createHash('sha256').update(db).digest('hex');
    if (hash !== manifest.lastDbHash) {
      const out = key ? seal(db, key) : db;
      writeAtomic(join(root, 'db', `diwan-${stamp(now)}.db${key ? ENC : ''}`), out);
      bytesCopied += out.length;
      manifest.lastDbHash = hash;
      dbChanged = true;
    }
  } finally {
    if (existsSync(temp)) rmSync(temp);
  }
  const snapshots = readdirSync(join(root, 'db'))
    .filter((f) => /^diwan-.*\.db(\.enc)?$/.test(f))
    .sort();
  for (const old of snapshots.slice(0, Math.max(0, snapshots.length - Math.max(1, opts.keep)))) rmSync(join(root, 'db', old));

  // ── المخزن: الجديد وحده، بالاسم والحجم ─────────────────────────────
  let filesCopied = 0;
  for (const rel of walk(opts.storeRoot)) {
    const src = join(opts.storeRoot, rel);
    const dest = join(root, 'store', key ? `${rel}${ENC}` : rel);
    const size = statSync(src).size;
    if (existsSync(dest) && statSync(dest).size === size + (key ? 28 : 0)) continue;
    const bytes = readFileSync(src);
    const out = key ? seal(bytes, key) : bytes;
    writeAtomic(dest, out);
    filesCopied++;
    bytesCopied += out.length;
  }

  manifest.lastAt = now.toISOString();
  writeAtomic(join(root, MANIFEST), JSON.stringify(manifest, null, 2));
  return { root, dbChanged, filesCopied, bytesCopied, snapshots: Math.min(snapshots.length, Math.max(1, opts.keep)) };
}

/** أمشفّرٌ هذا المجلّد — ليُسأل عن كلمته قبل الفحص. ويُرفض ما ليس نسخةً من ديوان. */
export function mirrorInfo(dir: string): { root: string; encrypted: boolean; lastAt: string | null } {
  const root = mirrorRoot(dir);
  const m = readManifest(root);
  if (!m) throw new Error('المجلّد ليس نسخةً تلقائية من ديوان');
  return { root, encrypted: m.encrypted, lastAt: m.lastAt ?? null };
}

/**
 * آخر نسخةٍ من القاعدة في المرآة (مفكوكةً)، وما يكتب مخزنها إلى مجلّد — ملفًّا ملفًّا،
 * فلا يُحمل المخزن كلّه في الذاكرة.
 */
export function readMirror(dir: string, password: string | null): { db: Uint8Array; snapshot: string; files: number; writeStore: (to: string) => void } {
  const root = mirrorRoot(dir);
  const m = readManifest(root);
  if (!m) throw new Error('المجلّد ليس نسخةً تلقائية من ديوان');
  const key = keyFor(m, password);
  const dbDir = join(root, 'db');
  const latest = (existsSync(dbDir) ? readdirSync(dbDir) : []).filter((f) => /^diwan-.*\.db(\.enc)?$/.test(f)).sort().at(-1);
  if (!latest) throw new Error('لا قاعدة في مجلّد النسخة التلقائية');
  const raw = readFileSync(join(dbDir, latest));
  const store = walk(join(root, 'store'));
  return {
    db: key ? unseal(raw, key) : raw,
    snapshot: latest,
    files: store.length,
    writeStore: (to) => {
      for (const rel of store) {
        const plain = key && rel.endsWith(ENC) ? rel.slice(0, -ENC.length) : rel;
        const bytes = readFileSync(join(root, 'store', rel));
        const file = join(to, plain);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, key ? unseal(bytes, key) : bytes);
      }
    }
  };
}
