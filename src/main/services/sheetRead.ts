import ExcelJS from 'exceljs';

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
      cells.push(cellText(cell).replace(/[\t\r\n]+/g, ' ').trim());
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.some(Boolean)) lines.push(cells.join('\t'));
  });
  return { text: lines.join('\n'), rows: lines.length };
}

/** نصّ الخليّة كما يراه المكتب: الرقم رقمًا لا «1.0»، والتاريخ يومًا لا طابعًا زمنيًّا. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}/${p(v.getMonth() + 1)}/${p(v.getDate())}`;
  }
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (typeof v === 'object') {
    // نصٌّ منسَّق، أو معادلة بنتيجتها، أو رابط.
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return v.result === undefined || v.result === null ? '' : String(v.result);
    if ('text' in v) return String(v.text);
  }
  return cell.text ?? String(v);
}
