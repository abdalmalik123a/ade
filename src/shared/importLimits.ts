/**
 * سقوف الاستيراد (A07 أ، D51): ملفٌّ أكبر من حدّه يُرفض **قبل أن يُقرأ إلى الذاكرة** برسالةٍ تقول حدّه — بدل أن يجمّد
 * البرنامج أو يُسقطه، والعمل كلّه في العملية الرئيسة اليوم. والمهلة ليست هنا: قراءةٌ متزامنة لا تُقطع (A03).
 *
 * والحدود من القياس على الجهاز المرجعيّ (i5 بذاكرة ٨ غيغا، بناء التطوير، ١٨ ت١ ٢٠٢٦): يُستورد ملفٌّ عند حدّه، ويُقبل الحدّ إن
 * بقيت ذروة ذاكرة البرنامج كلّه دون ١٫٥ غيغا (QUALITY §٨)، وإلا يُنصَّف ويُعاد (قيد D51 في الدفتر):
 * - **Photoshop** باستيراد التصميم، خامًا بخمس قنوات عند الحدّين: ٥٠٠ م.ب و١٠٠ مليون نقطة ← ٢٨٥٥ م.ب · ٢٥٠ و٥٠ ← ١٧٥١ ·
 *   **١٢٥ و٢٥ ← ١١١٥** (يفكّ القنوات ثم الصورة ثم يسطّحها، فذاكرته أضعاف حجمه).
 * - **PDF** بـ«ملفات PDF» حتى تُرسم مصغّراته كلّها: ٣٠٠ م.ب ← ٢٢١٠ · **١٥٠ ← ١٣٩٥**.
 * - **الصورة** بـ«ملفات PDF»: ١٠٠ مليون نقطة ← **١٢٩٩** — فتبقى (وصورة الهاتف ٤٨–١٠٨ مليونًا تُفتح).
 * - وWord وExcel والحزمة قيمٌ أولى لم تُقَس.
 *
 * والدوالّ هنا خالصةٌ تأخذ الحجم والحدّ — فتُختبر بلا ملفٍّ كبير؛ ونداؤها قبل القراءة في `main/services/importGuard.ts`.
 */
import { toIndic } from './arabic';

export type ImportKind = 'word' | 'excel' | 'pdf' | 'psd' | 'image';

export const MB = 1024 * 1024;

/** أكبر ملفٍّ يُقرأ من كلّ نوع، بالبايت. */
export const IMPORT_LIMITS: Record<ImportKind, number> = {
  word: 100 * MB,
  excel: 50 * MB,
  pdf: 150 * MB,
  psd: 125 * MB,
  image: 100 * MB
};

/** أكبر صورةٍ وتصميم Photoshop بعدد نقاطه — A3 بـ٦٠٠ نقطة/إنش نحو ٧٠ مليونًا، وبـ٣٠٠ نحو ١٧٫٤ مليونًا. */
export const MAX_PIXELS: Record<'psd' | 'image', number> = { psd: 25_000_000, image: 100_000_000 };

/** الأرشيف (docx وxlsx والحزمة): عدد مداخله، ومجموع ما يُفكّ منها. */
export type ZipLimits = { entries: number; bytes: number };

export const ZIP_LIMITS: Record<'word' | 'excel' | 'pack', ZipLimits> = {
  word: { entries: 20_000, bytes: 500 * MB },
  excel: { entries: 20_000, bytes: 500 * MB },
  pack: { entries: 20_000, bytes: 2048 * MB }
};

const SUBJECT: Record<ImportKind, string> = {
  word: 'ملفّ Word',
  excel: 'ملفّ Excel',
  pdf: 'ملفّ PDF',
  psd: 'ملفّ Photoshop',
  image: 'الصورة'
};

/** الصورة مؤنّثة، والملفّ مذكّر. */
const feminine = (kind: ImportKind) => kind === 'image';

/** رسالة الرفض إن زاد الملفّ على حدّه — وإلا `null`. */
export function tooLarge(kind: ImportKind, bytes: number, limit = IMPORT_LIMITS[kind]): string | null {
  if (bytes <= limit) return null;
  return `${SUBJECT[kind]} أكبر من ${toIndic(Math.round(limit / MB))} ميغابايت — ${feminine(kind) ? 'لا تُفتح' : 'لا يُفتح'} هنا`;
}

/** رسالة الرفض إن زادت النقاط على حدّها — بمقاس الملفّ نفسه، فيُعرف كم يُصغَّر. */
export function tooManyPixels(kind: 'psd' | 'image', width: number, height: number, max = MAX_PIXELS[kind]): string | null {
  if (width * height <= max) return null;
  return (
    `${SUBJECT[kind]} أكبر من ${toIndic(Math.round(max / 1_000_000))} مليون نقطة (${toIndic(width)}×${toIndic(height)}) — ` +
    `${feminine(kind) ? 'صغّرها ثم استوردها' : 'صغّره ثم استورده'}`
  );
}

export const ZIP_TOO_BIG = 'في الملف أكثر ممّا يُفكّ بأمان — قد يكون تالفًا';

/** ميزانية الأرشيف: عدد المداخل ومجموع أحجامها بعد الفكّ — والرسالة إن تجاوزها. */
export function zipBudget(entries: readonly { size: number }[], limits: ZipLimits): string | null {
  if (entries.length > limits.entries) return ZIP_TOO_BIG;
  let total = 0;
  for (const e of entries) {
    total += e.size;
    if (total > limits.bytes) return ZIP_TOO_BIG;
  }
  return null;
}

/** رأس Photoshop (أوّل ٢٦ بايتًا): الإصدار ١ (PSD) أو ٢ (PSB) ومقاسه — بلا فكّ شيء. */
export function psdHeader(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  const sig = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const u16 = (at: number) => (bytes[at]! << 8) | bytes[at + 1]!;
  const u32 = (at: number) => ((bytes[at]! << 24) >>> 0) + ((bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!);
  const version = u16(4);
  if (sig !== '8BPS' || (version !== 1 && version !== 2)) return null;
  return { height: u32(14), width: u32(18) };
}
