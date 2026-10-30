/**
 * صيغة ملفّات المخزن المشفّرة وما يُشفَّر منها (D238) — بلا electron ولا مفتاح جلسة، فتستعملها خدمات النسخ وتُختبر وحدها.
 * والكتابة والقراءة بمفتاح المكتب في `storeCrypt.ts`.
 *
 * المستمسكات (`attachments`) والصور الشخصية (`photos`) وPDF الكتب الصادرة (`documents`) والمسوح العابرة (`tmp`) هي
 * مجلّدات الناس نفسها التي لا تخرج في حزم المحتوى (`contentPack.ts` PEOPLE). والصيغة:
 * `DWNSEAL1 ‖ متّجه ١٢ ‖ وسم ١٦ ‖ المشفَّر` (AES-256-GCM، كما في النسخة التلقائية).
 */
import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seal, unseal } from './dataKey';
import { TRANSIENT_DIR } from './transient';

/** المجلّدات التي قد تحمل مستمسك مواطنٍ أو صورته أو كتابه — والحكم بدليله في قيد D238. */
export const PRIVATE_DIRS = ['attachments', 'photos', 'documents', TRANSIENT_DIR] as const;
const MAGIC = Buffer.from('DWNSEAL1', 'latin1');
/** ما يزيده التشفير على الملفّ: البادئة والمتّجه والوسم. */
export const SEAL_OVERHEAD = MAGIC.length + 12 + 16;

const top = (rel: string): string => rel.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0] ?? '';

export const isPrivate = (rel: string): boolean => (PRIVATE_DIRS as readonly string[]).includes(top(rel));

export const isSealedBytes = (data: Uint8Array): boolean => data.length >= MAGIC.length && Buffer.from(data.subarray(0, MAGIC.length)).equals(MAGIC);

/** أمشفّرٌ هذا الملفّ — من بادئته وحدها، بلا قراءته كلّه. */
export function isSealedFile(file: string): boolean {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(MAGIC.length);
    return readSync(fd, head, 0, head.length, 0) === head.length && head.equals(MAGIC);
  } finally {
    closeSync(fd);
  }
}

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

/** كم ملفًّا خاصًّا واضحًا بقي — لتقدّم الترحيل. */
export function countPlain(storeRoot: string): number {
  let n = 0;
  const walk = (at: string): void => {
    for (const e of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && !e.name.endsWith('.part') && !e.name.endsWith('.sealing') && !isSealedFile(full)) n++;
    }
  };
  for (const dir of PRIVATE_DIRS.filter((d) => d !== TRANSIENT_DIR)) {
    const root = join(storeRoot, dir);
    if (existsSync(root)) walk(root);
  }
  return n;
}

export interface SealResult {
  sealed: number;
  skipped: number;
}

/**
 * يشفّر كلّ ملفٍّ خاصٍّ واضحٍ في المخزن: نسخةٌ مشفّرة إلى `<الملفّ>.sealing` تُفكّ وتُطابق ثم تحلّ محلّه — ملفًّا ملفًّا،
 * فانقطاعٌ في الوسط لا يُفسد ملفًّا: يُعاد في المرّة التالية، وبقايا `.sealing` تُمحى (نسختنا، والأصل سليم). و`tmp` يُكنس ولا يُرحَّل.
 */
export async function sealExisting(storeRoot: string, key: Buffer, onSealed?: () => void): Promise<SealResult> {
  const result: SealResult = { sealed: 0, skipped: 0 };
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
      let data: Buffer;
      try {
        data = await readFile(full);
      } catch {
        continue; // حُذف أثناء الترحيل (الترحيل في الخلفية والبرنامج يعمل)
      }
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
  for (const dir of PRIVATE_DIRS.filter((d) => d !== TRANSIENT_DIR)) {
    const root = join(storeRoot, dir);
    if (existsSync(root)) await walk(root);
  }
  return result;
}
