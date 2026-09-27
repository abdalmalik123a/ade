/**
 * النسخة الاحتياطية: تُحزم، وتُشفَّر إن شاء المكتب، وتُفحص قبل أن تُسترجع (د١).
 *
 * **الحزمة** أرشيفٌ مضغوط: القاعدة (`diwan.db`، مأخوذةً بـVACUUM INTO فتخرج متّسقة
 * ولو صدر كتابٌ لحظتها) ومخزن الملفات (`store/…`: المستمسكات والصور والشعارات ونسخ PDF).
 *
 * **والتشفير اختياري**: النسخة فيها صور المستمسكات وأرقام الناس الوطنية، وتُحمل على
 * ذاكرةٍ يتداولها الناس. فبكلمة مرورٍ تُشفَّر AES-256-GCM بمفتاحٍ من scrypt — ولا
 * تُحفظ الكلمة في أي مكان: من نسيها لا تُفتح نسخته، ويُقال له ذلك قبل أن يختار.
 *
 * **والاسترجاع يُفحص قبل أن يمسّ شيئًا**: تُفكّ الحزمة، وتُفتح قاعدتها للقراءة،
 * ويُسأل `integrity_check`، وتُعدّ كتبها ومواطنوها — ويرى المكتب ذلك قبل أن يوافق.
 * وما كان على الجهاز يُنقل جانبًا لا يُحذف (ipc/backup.ts).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { unzipSync, zipSync } from 'fflate';
import type { BackupSummary } from '@shared/api';

/** بداية النسخة المشفّرة — بها تُعرف قبل أن يُسأل عن كلمة مرورها. */
const MAGIC = Buffer.from('DIWANENC', 'ascii');
const VERSION = 1;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function isEncrypted(bytes: Uint8Array): boolean {
  return bytes.length > MAGIC.length && Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC);
}

function keyOf(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize('NFC'), salt, 32, SCRYPT);
}

/** MAGIC ‖ نسخة ‖ ملح ١٦ ‖ متّجه ١٢ ‖ وسم ١٦ ‖ المشفَّر. */
export function encrypt(plain: Uint8Array, password: string): Uint8Array {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(password, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, cipher.getAuthTag(), body]);
}

export function decrypt(data: Uint8Array, password: string): Uint8Array {
  const buf = Buffer.from(data);
  let at = MAGIC.length;
  const version = buf[at++];
  if (version !== VERSION) throw new Error('نسخةٌ مشفّرة بصيغةٍ لا يعرفها هذا الإصدار');
  const salt = buf.subarray(at, (at += 16));
  const iv = buf.subarray(at, (at += 12));
  const tag = buf.subarray(at, (at += 16));
  const decipher = createDecipheriv('aes-256-gcm', keyOf(password, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(buf.subarray(at)), decipher.final()]);
  } catch {
    // الوسم يفشل للكلمة الخاطئة وللملفّ المعطوب معًا — ولا يُفرَّق بينهما.
    throw new Error('كلمة المرور خاطئة، أو الملف معطوب');
  }
}

/** الحزمة: القاعدة ومخزن الملفات — مشفّرةً إن أُعطيت كلمة. */
export function packBackup(dbBytes: Uint8Array, store: Record<string, Uint8Array>, password?: string | null): Uint8Array {
  const files: Record<string, Uint8Array> = { 'diwan.db': dbBytes };
  for (const [path, bytes] of Object.entries(store)) files[`store/${path}`] = bytes;
  // الصور والـPDF مضغوطةٌ أصلًا؛ والقاعدة تنضغط كثيرًا — فمستوىً وسط يكفي.
  const zipped = zipSync(files, { level: 6 });
  return password ? encrypt(zipped, password) : zipped;
}

export type Unpacked = { db: Uint8Array; store: Record<string, Uint8Array> };

/** يفكّ الحزمة — ويرفض ما ليس نسخةً من ديوان قبل أن يُسأل عن شيء. */
export function unpackBackup(bytes: Uint8Array, password?: string | null): Unpacked {
  let zipped = bytes;
  if (isEncrypted(bytes)) {
    if (!password) throw new Error('النسخة مشفّرة — اكتب كلمة مرورها');
    zipped = decrypt(bytes, password);
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipped);
  } catch {
    throw new Error('الملف ليس نسخةً احتياطية من ديوان');
  }
  const db = files['diwan.db'];
  if (!db) throw new Error('الملف ليس نسخةً احتياطية من ديوان — لا قاعدة فيه');
  const store: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) {
    if (!path.startsWith('store/') || path.endsWith('/')) continue;
    const rel = path.slice('store/'.length);
    // مسارٌ يخرج من المخزن (`../`) لا يُكتب — حزمةٌ مصنوعةٌ لتكتب خارج مجلّد المكتب.
    if (rel.split(/[\\/]/).some((part) => part === '..' || part === '') || /^[a-zA-Z]:/.test(rel)) continue;
    store[rel] = data;
  }
  return { db, store };
}

/**
 * ما في النسخة — يُعرض قبل الموافقة: أسليمةٌ هي، وكم فيها، وإلى متى تصل.
 * تُكتب القاعدة في ملفٍّ مؤقّت وتُفتح للقراءة وحدها، ثم يُحذف.
 */
export function inspectBackup(unpacked: Unpacked): BackupSummary {
  const file = join(tmpdir(), `diwan-inspect-${process.pid}-${Date.now()}.db`);
  writeFileSync(file, unpacked.db);
  let db: Database.Database | null = null;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const integrity = (db.pragma('integrity_check', { simple: true }) as string) ?? '';
    const has = (table: string) =>
      Boolean(db!.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
    if (!has('documents') || !has('citizens') || !has('templates')) {
      throw new Error('القاعدة في الملف ليست قاعدة ديوان');
    }
    const count = (table: string) => (db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    const last = db.prepare("SELECT MAX(datetime(issued_at, 'localtime')) AS at FROM documents").get() as { at: string | null };
    return {
      ok: integrity === 'ok',
      integrity,
      documents: count('documents'),
      citizens: count('citizens'),
      templates: count('templates'),
      files: Object.keys(unpacked.store).length,
      lastIssuedAt: last.at
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('ديوان')) throw e;
    throw new Error('القاعدة في الملف معطوبة — لا تُسترجع');
  } finally {
    db?.close();
    if (existsSync(file)) unlinkSync(file);
  }
}
