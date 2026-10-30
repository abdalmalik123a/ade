/**
 * تشفير ملفّات المخزن التي فيها بيانات شخصية (D238، ر190 §٢).
 *
 * المستمسكات (`attachments`) والصور الشخصية (`photos`) وPDF الكتب الصادرة (`documents`) والمسوح العابرة (`tmp`)
 * تُكتب مشفّرةً بمفتاح المكتب (D237): `DWNSEAL1 ‖ متّجه ١٢ ‖ وسم ١٦ ‖ المشفَّر` (AES-256-GCM، كما في النسخة التلقائية).
 * وما سواها — الخطوط والتصاميم والترويسات والشعارات وصور القاط و`images` — أصول تصميمٍ تبقى كما هي وتنتقل في حزم المحتوى.
 *
 * القراءة كلّها من هنا: الملفّ المشفَّر يُفكّ، والواضح القديم (قبل الترحيل أو بلا مفتاح) يُقرأ كما هو. وما يحتاج مسارًا
 * لا بايتات (مكتبةٌ تفتح الملفّ بنفسها) يأخذ نسخةً مفكوكة في `store/tmp` يكنسها الإقلاع (`transient.ts`).
 * وأوّل ملفٍّ يُشفَّر يكتب `sealed.flag` في مجلّد البيانات: بعده لا يُنشأ مفتاحٌ جديد بدل مفقود (`dataKey.ts`).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { dataDir, storeDir } from '../db';
import { SEALED_NAME, currentKey, seal, unseal } from './dataKey';
import { TRANSIENT_DIR } from './transient';

/** المجلّدات التي قد تحمل مستمسك مواطنٍ أو صورته أو كتابه — والحكم بدليله في قيد D238. */
export const PRIVATE_DIRS = ['attachments', 'photos', 'documents', TRANSIENT_DIR] as const;
const MAGIC = Buffer.from('DWNSEAL1', 'latin1');

const top = (rel: string): string => rel.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0] ?? '';

export const isPrivate = (rel: string): boolean => (PRIVATE_DIRS as readonly string[]).includes(top(rel));

export const isSealedBytes = (data: Uint8Array): boolean => data.length >= MAGIC.length && Buffer.from(data.subarray(0, MAGIC.length)).equals(MAGIC);

export function sealBytes(plain: Uint8Array, key: Buffer): Buffer {
  return Buffer.concat([MAGIC, seal(plain, key)]);
}

/** المشفَّر يُفكّ بالمفتاح، والواضح يعود كما هو. ووسمٌ لا يطابق (ملفٌّ معطوب أو مفتاحٌ آخر) يرمي ولا يعيد شيئًا. */
export function openBytes(data: Uint8Array, key: Buffer | null): Buffer {
  if (!isSealedBytes(data)) return Buffer.from(data);
  if (!key) throw new Error('الملفّ مشفّرٌ بمفتاح المكتب، ولا مفتاح في هذه الجلسة');
  try {
    return unseal(data.subarray(MAGIC.length), key);
  } catch {
    throw new Error('تعذّر فكّ ملفٍّ في المخزن — معطوبٌ أو بمفتاحٍ آخر');
  }
}

/** ما يُكتب في `rel` (نسبةً إلى المخزن): مشفّرًا إن كان خاصًّا ومعنا مفتاح، وإلا كما هو. */
export function bytesFor(rel: string, bytes: Uint8Array, key: Buffer | null): Uint8Array {
  return isPrivate(rel) && key ? sealBytes(bytes, key) : bytes;
}

// ── بمفتاح الجلسة ومخزن المكتب ─────────────────────────────────────────────

function markSealed(): void {
  const flag = join(dataDir(), SEALED_NAME);
  if (!existsSync(flag)) writeFileSync(flag, `${new Date().toISOString()}\n`);
}

/** يكتب ملفًّا في المخزن بمساره النسبيّ (`photos/x.png`)، مشفّرًا إن كان خاصًّا. ويعيد المسار النسبيّ نفسه. */
export async function writeStore(rel: string, bytes: Uint8Array): Promise<string> {
  const key = currentKey();
  const file = join(storeDir(), rel);
  await mkdir(dirname(file), { recursive: true });
  if (isPrivate(rel) && key) markSealed();
  await writeFile(file, bytesFor(rel, bytes, key));
  return rel.replace(/\\/g, '/');
}

/** يقرأ ملفًّا في المخزن بمساره الكامل — مفكوكًا إن كان مشفّرًا. */
export async function readStore(file: string): Promise<Buffer> {
  return openBytes(await readFile(file), currentKey());
}

export function readStoreSync(file: string): Buffer {
  return openBytes(readFileSync(file), currentKey());
}

/** لقارئٍ يحتاج مسارًا: الملفّ نفسه إن كان واضحًا، وإلا نسخةٌ مفكوكة في `store/tmp` (يكنسها الإقلاع). */
export async function plainPath(file: string): Promise<string> {
  const data = await readFile(file);
  if (!isSealedBytes(data)) return file;
  const out = join(storeDir(TRANSIENT_DIR), `plain-${randomBytes(8).toString('hex')}${extname(file)}`);
  await writeFile(out, openBytes(data, currentKey()));
  return out;
}

// ── الترحيل: ما كُتب واضحًا قبل D238 يُشفَّر ───────────────────────────────

export interface SealResult {
  sealed: number;
  skipped: number;
}

/**
 * يشفّر كلّ ملفٍّ خاصٍّ واضحٍ في المخزن: نسخةٌ مشفّرة إلى `<الملفّ>.sealing` ثم تُفكّ وتُطابق ثم تحلّ محلّه — ملفًّا ملفًّا،
 * فانقطاعٌ في الوسط لا يُفسد ملفًّا: يُعاد في الإقلاع التالي، وبقايا `.sealing` تُمحى (نسختنا، والأصل سليم). و`tmp` يُكنس ولا يُرحَّل.
 */
export async function sealExisting(storeRoot: string, key: Buffer, onSealed?: () => void): Promise<SealResult> {
  const result: SealResult = { sealed: 0, skipped: 0 };
  for (const dir of PRIVATE_DIRS.filter((d) => d !== TRANSIENT_DIR)) {
    const root = join(storeRoot, dir);
    if (!existsSync(root)) continue;
    const walk = async (at: string): Promise<void> => {
      for (const e of readdirSync(at, { withFileTypes: true })) {
        const full = join(at, e.name);
        if (e.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!e.isFile() || e.name.endsWith('.part')) continue;
        if (e.name.endsWith('.sealing')) {
          await rm(full, { force: true });
          continue;
        }
        const data = await readFile(full);
        if (isSealedBytes(data)) {
          result.skipped++;
          continue;
        }
        const sealed = sealBytes(data, key);
        if (!openBytes(sealed, key).equals(data)) throw new Error(`تعذّر التحقّق من تشفير ${full}`);
        await writeFile(`${full}.sealing`, sealed);
        await rename(`${full}.sealing`, full);
        result.sealed++;
        onSealed?.();
      }
    };
    await walk(root);
  }
  return result;
}

/** ترحيل مخزن المكتب بمفتاح الجلسة — ولا شيء بلا مفتاح. يكتب `sealed.flag` قبل أوّل ملفّ. */
export async function sealStore(): Promise<SealResult> {
  const key = currentKey();
  if (!key) return { sealed: 0, skipped: 0 };
  const root = storeDir();
  const hasPlain = PRIVATE_DIRS.some((d) => d !== TRANSIENT_DIR && existsSync(join(root, d)));
  if (hasPlain) markSealed();
  return sealExisting(root, key);
}

/** نسخةٌ مفكوكة لملفٍّ في المخزن بمساره النسبيّ — لمن يكتب حزمةً أو نسخةً تُفتح على جهازٍ آخر. */
export function plainBytesOf(storeRoot: string, rel: string): Buffer {
  return openBytes(readFileSync(join(storeRoot, rel)), currentKey());
}
