import ExcelJS from 'exceljs';
import { cellText as cellValueText } from './cellText';

/**
 * قراءة قائمةٍ من ملف Excel أو CSV — كما تُرسل المدرسة قائمة صفّها.
 *
 * تعود نصًّا بأعمدةٍ مفصولة بالجدولة وسطرٍ لكل صفّ: الصيغة نفسها التي يُلصق بها
 * من Excel، فيقرؤها قارئ الدفعة الواحد (`shared/batch.ts`) ولا قارئَ ثانٍ.
 * والورقة الأولى وحدها، والصفوف الفارغة تُترك.
 */
export async function sheetToText(file: string): Promise<{ text: string; rows: number }> {
  const book = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(file)) await book.csv.readFile(file);
    else await book.xlsx.readFile(file);
  } catch {
    throw new Error('تعذّر قراءة ملف Excel — قد يكون تالفًا، أو بصيغة .xls القديمة (احفظه .xlsx أو CSV)');
  }
  const sheet = book.worksheets[0];
  if (!sheet) return { text: '', rows: 0 };

  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // `values` تبدأ من الفهرس ١ في exceljs.
    for (let c = 1; c <= row.cellCount; c++) {
      const cell = row.getCell(c);
      cells.push(cellValueText(cell, { decimals: 3 }).replace(/[\t\r\n]+/g, ' ').trim());
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.some(Boolean)) lines.push(cells.join('\t'));
  });
  return { text: lines.join('\n'), rows: lines.length };
}
