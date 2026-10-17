/**
 * حارس الاستيراد (A07 أ، D51): يسأل عن حجم الملفّ بـ`stat` قبل أن يُقرأ، وعن رأس الصورة وPhotoshop قبل أن يُفكّا، وعن
 * ميزانية الأرشيف قبل أن يُفكّ منه ما بعدها — والحدود ورسائلها في `shared/importLimits.ts`.
 *
 * ولا يمرّ به ما هو من المكتب نفسه: النسخة الاحتياطية واسترجاعها والتحديث لها حدودها (`backup.ts` و`update.ts`).
 */
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { unzipSync, type UnzipFileInfo } from 'fflate';
import ExcelJS from 'exceljs';
import { psdHeader, tooLarge, tooManyPixels, zipBudget, ZIP_LIMITS, ZIP_TOO_BIG, type ImportKind, type ZipLimits } from '@shared/importLimits';
import { imageMeta } from './imageSize';
import { readZipIndex } from './zip';

/** رفضٌ بحدّ — تمرّره `catch` التي تقول «تالف» كما هو، فيُقال الحدّ لا التلف. */
export class ImportLimitError extends Error {}

function fail(message: string | null): void {
  if (message) throw new ImportLimitError(message);
}

/** حجم الملفّ من القرص — قبل `readFile` أو قراءة exceljs. */
export async function assertSize(path: string, kind: ImportKind): Promise<void> {
  fail(tooLarge(kind, (await stat(path)).size));
}

/** نوع التصميم من امتداده، كما يقرؤه `readDesign`. */
export function designKind(name: string): ImportKind {
  const ext = extname(name).toLowerCase();
  return ext === '.docx' ? 'word' : ext === '.psd' ? 'psd' : ext === '.pdf' ? 'pdf' : 'image';
}

/** أبعاد Photoshop من رأسه، والصورة من رأسها (PNG وJPEG) — قبل أن يُفكّ منهما شيء. */
export function assertPixels(bytes: Uint8Array, kind: ImportKind): void {
  if (kind === 'psd') {
    const head = psdHeader(bytes);
    if (head) fail(tooManyPixels('psd', head.width, head.height));
  } else if (kind === 'image') {
    const meta = imageMeta(bytes);
    if (meta) fail(tooManyPixels('image', meta.width, meta.height));
  }
}

/** مرشّح `unzipSync`: يعدّ المداخل وما يُفكّ منها، ويرمي حين تتجاوز الميزانية — قبل أن يُفكّ ما بعدها. */
export function zipFilter(limits: ZipLimits): (file: UnzipFileInfo) => boolean {
  let entries = 0;
  let total = 0;
  return (file) => {
    entries += 1;
    total += file.originalSize;
    if (entries > limits.entries || total > limits.bytes) fail(ZIP_TOO_BIG);
    return true;
  };
}

/** فهرس الأرشيف على القرص (xlsx) — قبل أن تقرأه exceljs. وما ليس أرشيفًا يقول قارئه ما هو. */
export async function assertZipIndex(path: string, limits: ZipLimits): Promise<void> {
  let entries;
  try {
    entries = await readZipIndex(path);
  } catch {
    return;
  }
  fail(zipBudget(entries, limits));
}

/** Word يُفكّ بميزانيته — وما سوى الحدّ من أعطاله يُقال برسالة قارئه (`failure`) كما كان. */
export function unzipWord(bytes: Uint8Array, failure: string): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes, { filter: zipFilter(ZIP_LIMITS.word) });
  } catch (e) {
    if (e instanceof ImportLimitError) throw e;
    throw new Error(failure);
  }
}

/** Excel (xlsx أو CSV) يُقرأ بعد حجمه وفهرسه — وما سوى الحدّ من أعطاله يُقال برسالة قارئه (`failure`) كما كان. */
export async function readWorkbook(path: string, failure: string): Promise<ExcelJS.Workbook> {
  const csv = /\.csv$/i.test(path);
  await assertSize(path, 'excel');
  if (!csv) await assertZipIndex(path, ZIP_LIMITS.excel);
  const book = new ExcelJS.Workbook();
  try {
    if (csv) await book.csv.readFile(path);
    else await book.xlsx.readFile(path);
  } catch {
    throw new Error(failure);
  }
  return book;
}
