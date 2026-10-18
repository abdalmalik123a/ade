/**
 * اسم شعار الترويسة في المخزن من بايتاته (D57) — دالّةٌ نقيّة بلا كتابة: يناديها `storeLetterheadImage` في الرئيسة قبل أن يكتب،
 * والعامل المستقلّ حين يقرأ Word فيعيد الصورة بايتاتٍ باسمها (`readTemplate`) — فالاسم واحدٌ في الطريقين.
 */
import { createHash } from 'node:crypto';

/** `letterheads/<أوّل ٣٢ من sha256><الامتداد بحروفٍ صغيرة>` — المسار النسبي في المخزن. */
export function letterheadImagePath(bytes: Uint8Array, extension: string): string {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  return `letterheads/${hash}${extension.toLowerCase()}`;
}
