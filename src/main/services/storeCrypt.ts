/**
 * تشفير ملفّات المخزن التي فيها بيانات شخصية بمفتاح المكتب (D238، ر190 §٢) — الكتابة والقراءة من هنا.
 *
 * الصيغة وما يُشفَّر والترحيل في `storeSeal.ts` (بلا electron). والقراءة: المشفَّر يُفكّ بمفتاح الجلسة (D237)،
 * والواضح القديم (قبل الترحيل أو بلا مفتاح) يُقرأ كما هو؛ وكلّ قارئٍ يأخذ بايتاتٍ لا مسارًا (nativeImage وOCR وWord
 * وPDF وجرد D238). وأوّل ملفٍّ يُشفَّر يكتب `sealed.flag` في مجلّد البيانات: بعده لا يُنشأ مفتاحٌ جديد بدل مفقود (`dataKey.ts`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dataDir, storeDir } from '../db';
import { SEALED_NAME, currentKey } from './dataKey';
import { bytesFor, countPlain, isPrivate, openBytes, sealExisting, type SealResult } from './storeSeal';

export { isPrivate };

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

let progress = { running: false, done: 0, total: 0 };

/** تقدّم الترحيل الجاري — تعرضه الواجهة شريطًا صغيرًا. */
export const sealProgress = (): typeof progress => ({ ...progress });

/**
 * ترحيل مخزن المكتب بمفتاح الجلسة (ما كُتب واضحًا قبل D238 أو أتى من استرجاع) — ولا شيء بلا مفتاح.
 * يجري في الخلفية والبرنامج يعمل: القارئ يقرأ الواضح والمشفَّر معًا، والكاتب يكتب مشفّرًا؛ ومرّةً واحدة في كلّ حين.
 */
export async function sealStore(): Promise<SealResult> {
  const key = currentKey();
  if (!key || progress.running) return { sealed: 0, skipped: 0 };
  const root = storeDir();
  const total = countPlain(root);
  if (total === 0) return { sealed: 0, skipped: 0 };
  markSealed();
  progress = { running: true, done: 0, total };
  try {
    return await sealExisting(root, key, () => progress.done++);
  } finally {
    progress = { ...progress, running: false };
  }
}
