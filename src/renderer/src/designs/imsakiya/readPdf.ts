/**
 * جدول الإمساكية من PDF (٣٫٤): نصّ صفحاته بقطعه ومواضعها — بـpdf.js الذي يفتح به ديوان ملفّات PDF أصلًا (يُحمَّل حين يُطلب)
 * — ثمّ تصير أسطرًا بخاناتٍ (`pdfTableText`) يقرؤها قارئ الجدول نفسه. وPDF صورةٌ ممسوحة لا نصّ فيه: يعود فارغًا فيُقال ذلك.
 */
import { pdfTableText, type PdfPiece } from '@shared/design/timetable';

export async function pdfTable(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    // الجدول صفحةٌ أو صفحتان — والثالثة حدٌّ لملفٍّ طويلٍ اختير خطأً.
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const pieces: PdfPiece[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [, , c, d, x, y] = item.transform as number[];
        pieces.push({ str: item.str, x: x!, y: y!, w: item.width, h: item.height || Math.hypot(c!, d!) });
      }
      pages.push(pdfTableText(pieces));
    }
    return pages.join('\n');
  } finally {
    void task.destroy();
  }
}
