/**
 * النسخة الاحتياطية: تُحزم، وتُشفَّر إن شاء المكتب، وتُفحص قبل أن تُسترجع (د١).
 *
 * **الحزمة** أرشيفٌ مضغوط: القاعدة (`diwan.db`، مأخوذةً بـVACUUM INTO فتخرج متّسقة
 * ولو صدر كتابٌ لحظتها) ومخزن الملفات (`store/…`: المستمسكات والصور والشعارات ونسخ PDF)، ومعهما
 * `diwan-backup.json`: رقم الإصدار الذي أخذها ووقتها (خطة Production، ٤٫٢). وتُكتب ملفًّا ملفًّا
 * (`zip.ts`) — كانت تُحمل كلّها في الذاكرة فتسقط على أرشيفٍ كبير (٤٫١).
 *
 * **والتشفير اختياري**: النسخة فيها صور المستمسكات وأرقام الناس الوطنية، وتُحمل على
 * ذاكرةٍ يتداولها الناس. فبكلمة مرورٍ تُشفَّر AES-256-GCM بمفتاحٍ من scrypt — ولا
 * تُحفظ الكلمة في أي مكان: من نسيها لا تُفتح نسخته، ويُقال له ذلك قبل أن يختار.
 * **وصيغتها كما كانت** (MAGIC ‖ ١ ‖ ملح ‖ متّجه ‖ وسم ‖ المشفَّر): تُكتب مارّةً والوسم يُكتب في
 * موضعه بعد أن يُعرف — فما أُخذ قبل هذا الإصدار يُفتح بهذا، وما يُؤخذ به يُفتح بما قبله.
 *
 * **والاسترجاع يُفحص قبل أن يمسّ شيئًا**: تُفكّ الحزمة إلى ملفٍّ مؤقّت، وتُفتح قاعدتها للقراءة،
 * ويُسأل `integrity_check`، وتُعدّ كتبها ومواطنوها — ويرى المكتب ذلك قبل أن يوافق.
 * وما كان على الجهاز يُنقل جانبًا لا يُحذف (ipc/backup.ts).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import Database from 'better-sqlite3';
import type { BackupSummary } from '@shared/api';
import { compareVersions } from '@shared/version';
import { ZipWriter, extractEntry, fileSink, readZipIndex, safeInnerPath, type Sink, type ZipEntry } from './zip';

/** بداية النسخة المشفّرة — بها تُعرف قبل أن يُسأل عن كلمة مرورها. */
const MAGIC = Buffer.from('DIWANENC', 'ascii');
const VERSION = 1;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
/** MAGIC ‖ نسخة ‖ ملح ١٦ ‖ متّجه ١٢ — ثم الوسم ١٦ ثم المشفَّر. */
const TAG_AT = MAGIC.length + 1 + 16 + 12;
const BODY_AT = TAG_AT + 16;
const META = 'diwan-backup.json';

export type BackupMeta = { app: 'diwan'; appVersion: string; createdAt: string; files: number };

export function isEncrypted(bytes: Uint8Array): boolean {
  return bytes.length > MAGIC.length && Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC);
}

function keyOf(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize('NFC'), salt, 32, SCRYPT);
}

/** وجهةٌ تشفّر ما يمرّ بها، وتكتب الوسم في موضعه من الترويسة حين تُغلق. */
async function encryptingSink(path: string, password: string): Promise<Sink & { close(): Promise<void> }> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const out = await fileSink(path);
  await out.write(Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, Buffer.alloc(16)]));
  const cipher = createCipheriv('aes-256-gcm', keyOf(password, salt), iv);
  let position = 0;
  return {
    get position() {
      return position;
    },
    async write(chunk) {
      position += chunk.byteLength;
      const enc = cipher.update(chunk);
      if (enc.length) await out.write(enc);
    },
    async close() {
      const rest = cipher.final();
      if (rest.length) await out.write(rest);
      await out.close();
      const h = await open(path, 'r+');
      try {
        await h.write(cipher.getAuthTag(), 0, 16, TAG_AT);
        await h.sync();
      } finally {
        await h.close();
      }
    }
  };
}

/** ملفّات المخزن نسبيّةً إليه. */
function walkStore(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const visit = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(dir, entry.name), `${prefix}${entry.name}/`);
      else out.push(`${prefix}${entry.name}`);
    }
  };
  visit(root, '');
  return out;
}

/**
 * تُكتب النسخة إلى `target` ملفًّا ملفًّا — إلى اسمٍ جانبيّ ثم تُنقل: فنسخةٌ انقطعت كتابتها لا تبقى
 * باسم نسخةٍ سليمة. وتعيد حجمها.
 */
export async function writeBackup(opts: {
  target: string;
  dbFile: string;
  storeRoot: string;
  password: string | null;
  appVersion: string;
  now?: Date;
}): Promise<{ bytes: number; files: number }> {
  const part = `${opts.target}.part`;
  const sink = opts.password ? await encryptingSink(part, opts.password) : await fileSink(part);
  const files = walkStore(opts.storeRoot);
  try {
    const zip = new ZipWriter(sink);
    const meta: BackupMeta = { app: 'diwan', appVersion: opts.appVersion, createdAt: (opts.now ?? new Date()).toISOString(), files: files.length };
    await zip.addBuffer(META, Buffer.from(JSON.stringify(meta, null, 2)));
    // القاعدة تنضغط كثيرًا؛ والصور وPDF مضغوطةٌ أصلًا فتُخزَّن كما هي — أسرع ولا تكبر.
    await zip.addFile('diwan.db', opts.dbFile, true);
    for (const rel of files) await zip.addFile(`store/${rel}`, join(opts.storeRoot, rel), false);
    await zip.finish();
    await sink.close();
  } catch (e) {
    await sink.close().catch(() => undefined);
    rmSync(part, { force: true });
    throw e;
  }
  if (existsSync(opts.target)) rmSync(opts.target);
  renameSync(part, opts.target);
  return { bytes: statSync(opts.target).size, files: files.length };
}

/** نسخةٌ مفتوحة: فهرسها، وما يُفكّ منها إلى القرص — و`dispose` يمحو ما فُكّ مؤقّتًا. */
export type OpenedBackup = {
  meta: BackupMeta | null;
  /** ملفّات المخزن فيها — بلا ما يخرج من المخزن (`../`). */
  files: ZipEntry[];
  extractDb(to: string): Promise<void>;
  extractStore(storeRoot: string): Promise<void>;
  dispose(): void;
};

/**
 * يفتح النسخة — ويرفض ما ليس نسخةً من ديوان قبل أن يُسأل عن شيء. والمشفّرة تُفكّ إلى ملفٍّ مؤقّت
 * في `workDir` مارّةً، ويُتحقّق من وسمها في آخرها: كلمةٌ خاطئة أو ملفٌّ معطوب لا يُعطي شيئًا.
 */
export async function openBackup(path: string, password: string | null, workDir: string): Promise<OpenedBackup> {
  const head = Buffer.alloc(BODY_AT);
  const h = await open(path, 'r');
  try {
    await h.read(head, 0, BODY_AT, 0);
  } finally {
    await h.close();
  }
  let zipPath = path;
  let temp: string | null = null;
  if (isEncrypted(head)) {
    if (!password) throw new Error('النسخة مشفّرة — اكتب كلمة مرورها');
    if (head[MAGIC.length] !== VERSION) throw new Error('نسخةٌ مشفّرة بصيغةٍ لا يعرفها هذا الإصدار');
    mkdirSync(workDir, { recursive: true });
    temp = join(workDir, `restore-${process.pid}-${Date.now()}.zip`);
    const decipher = createDecipheriv('aes-256-gcm', keyOf(password, head.subarray(MAGIC.length + 1, MAGIC.length + 17)), head.subarray(MAGIC.length + 17, TAG_AT));
    decipher.setAuthTag(head.subarray(TAG_AT, BODY_AT));
    try {
      await pipeline(createReadStream(path, { start: BODY_AT, highWaterMark: 1 << 20 }), decipher, createWriteStream(temp));
    } catch {
      rmSync(temp, { force: true });
      // الوسم يفشل للكلمة الخاطئة وللملفّ المعطوب معًا — ولا يُفرَّق بينهما.
      throw new Error('كلمة المرور خاطئة، أو الملف معطوب');
    }
    zipPath = temp;
  }
  const dispose = () => {
    if (temp) rmSync(temp, { force: true });
  };
  try {
    let entries: ZipEntry[];
    try {
      entries = await readZipIndex(zipPath);
    } catch {
      throw new Error('الملف ليس نسخةً احتياطية من ديوان');
    }
    const db = entries.find((e) => e.name === 'diwan.db');
    if (!db) throw new Error('الملف ليس نسخةً احتياطية من ديوان — لا قاعدة فيه');
    let meta: BackupMeta | null = null;
    const metaEntry = entries.find((e) => e.name === META);
    if (metaEntry && metaEntry.size < 64 * 1024) {
      const file = join(workDir, `meta-${process.pid}-${Date.now()}.json`);
      mkdirSync(workDir, { recursive: true });
      try {
        await extractEntry(zipPath, metaEntry, file);
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<BackupMeta>;
        if (parsed.app === 'diwan' && typeof parsed.appVersion === 'string') meta = parsed as BackupMeta;
      } catch {
        // وصفٌ فاسد لا يمنع الاسترجاع: النسخة تُعرف بقاعدتها.
      } finally {
        rmSync(file, { force: true });
      }
    }
    const files = entries.filter((e) => e.name.startsWith('store/') && !e.name.endsWith('/') && safeInnerPath(e.name.slice(6)));
    return {
      meta,
      files,
      extractDb: (to) => extractEntry(zipPath, db, to),
      async extractStore(storeRoot) {
        for (const e of files) {
          const file = join(storeRoot, e.name.slice(6));
          mkdirSync(dirname(file), { recursive: true });
          await extractEntry(zipPath, e, file);
        }
      },
      dispose
    };
  } catch (e) {
    dispose();
    throw e;
  }
}

/**
 * ما في النسخة — يُعرض قبل الموافقة: أسليمةٌ هي، وكم فيها، وإلى متى تصل، ومن أيّ إصدار.
 * تُفتح القاعدة للقراءة وحدها.
 */
export function inspectDbFile(file: string, files: number, meta: { appVersion: string; createdAt: string | null } | null, currentVersion: string): BackupSummary {
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
      files,
      lastIssuedAt: last.at,
      appVersion: meta?.appVersion ?? null,
      createdAt: meta?.createdAt ?? null,
      fromNewer: Boolean(meta?.appVersion && compareVersions(meta.appVersion, currentVersion) > 0)
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('ديوان')) throw e;
    throw new Error('القاعدة في الملف معطوبة — لا تُسترجع');
  } finally {
    db?.close();
  }
}

/** والقاعدة بايتاتٍ (نسخة المرآة): تُكتب في ملفٍّ مؤقّت وتُفحص ثم يُمحى. */
export function inspectDbBytes(bytes: Uint8Array, files: number, meta: { appVersion: string; createdAt: string | null } | null, currentVersion: string): BackupSummary {
  const file = join(tmpdir(), `diwan-inspect-${process.pid}-${Date.now()}.db`);
  writeFileSync(file, bytes);
  try {
    return inspectDbFile(file, files, meta, currentVersion);
  } finally {
    rmSync(file, { force: true });
  }
}

/** نسخةٌ من إصدارٍ أحدث لا تُسترجع: قاعدتها قد تحمل ما لا يعرفه هذا الإصدار فيُفسده. */
export function assertRestorable(summary: BackupSummary, currentVersion: string): void {
  if (!summary.ok) throw new Error(`القاعدة في النسخة لا تجتاز الفحص (${summary.integrity}) — لا تُسترجع`);
  if (summary.fromNewer) {
    throw new Error(`النسخة من إصدارٍ أحدث (${summary.appVersion}) من هذا البرنامج (${currentVersion}) — ثبّت الإصدار الأحدث ثم استرجعها`);
  }
}
