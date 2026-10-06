/**
 * كتب Excel ← نماذج (الموجة ٢): برنامج مخاطباتٍ كما تصنعه المدارس — ورقة بياناتٍ تملأ الكتب بمعادلات، ورأسٌ
 * أعمدةٌ والشعار بينها، وسطرٌ من ثلاث خلايا، وفراغٌ مسافات، و«0» بدل النقطة، وجدولٌ محدود، وتعليمةٌ خارج حدود
 * الطباعة، وورقةٌ مخفيّة. يُكتب الملفّ ويُقرأ كما يُقرأ ملفّ المكتب.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bookToDocs, excelToDocs, fieldNameOf, gapsToDots } from '../src/main/services/excelDoc';
import { planExcelImport } from '../src/main/services/importFolder';
import { docText, emptyDoc, type Block, type ColumnsBlock, type ParagraphBlock, type TableBlock } from '../src/shared/doc';

/** صورة PNG بنقطةٍ واحدة — شعارٌ للاختبار. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const BOX = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } as const;

async function schoolBook(): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  const data = book.addWorksheet('البيانات');
  data.views = [{ rightToLeft: true }];
  data.getCell('B2').value = 'اسم المدرسة';
  data.getCell('C2').value = 'مدرسة النور';
  data.mergeCells('B4:D4');
  data.getCell('B4').value = 'المديرية العامة للتربية في محافظة';
  data.getCell('E4').value = 'بغداد';
  data.getCell('B6').value = 'اسم مدير المدرسة';
  data.getCell('C6').value = 'سالم حسن';

  const ws = book.addWorksheet('تبليغ');
  ws.views = [{ rightToLeft: true }];
  ws.pageSetup = { printArea: 'A1:J16', paperSize: 9, orientation: 'portrait', margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.3, footer: 0.3 } } as ExcelJS.PageSetup;
  ws.columns = Array.from({ length: 13 }, () => ({ width: 10 }));
  // الرأس: الجهة يمينًا والعدد والتاريخ يسارًا، وبينهما فراغ.
  ws.mergeCells('B2:C2');
  ws.getCell('B2').value = 'إدارة';
  ws.mergeCells('H2:J2');
  ws.getCell('H2').value = 'العدد /';
  ws.mergeCells('B3:C3');
  ws.getCell('B3').value = { formula: "'البيانات'!C2", result: 'مدرسة النور' } as ExcelJS.CellFormulaValue;
  ws.mergeCells('H3:J3');
  ws.getCell('H3').value = 'التاريخ   /   /   20';
  ws.addImage(book.addImage({ buffer: PNG as unknown as ExcelJS.Buffer, extension: 'png' }), { tl: { col: 4, row: 0 }, br: { col: 6, row: 3 } } as unknown as ExcelJS.ImageRange);
  // سطرٌ من ثلاث خلايا متجاورة: الجهة، والمحافظة من ورقة البيانات، والقسم.
  ws.mergeCells('A6:D6');
  ws.getCell('A6').value = 'الى / المديرية العامة لتربية';
  ws.getCell('A6').alignment = { horizontal: 'left' };
  ws.getCell('E6').value = { formula: "'البيانات'!E4", result: 'بغداد' } as ExcelJS.CellFormulaValue;
  ws.mergeCells('F6:J6');
  ws.getCell('F6').value = '/ قسم الملاك';
  ws.getCell('F6').alignment = { horizontal: 'right' };
  // المتن: فراغٌ مسافات، و«0» بدل النقطة.
  ws.mergeCells('A8:J8');
  ws.getCell('A8').value = 'نرفق لكم ورقة التبليغ الخاصة بالسيد                    مع التقدير0';
  ws.getCell('A8').alignment = { horizontal: 'center' };
  // جدولٌ بحدوده.
  [
    [10, ['ت', 'المادة', 'العدد']],
    [11, ['1', 'مكتب', '2']]
  ].forEach(([r, values]) =>
    (values as string[]).forEach((v, k) => {
      const cell = ws.getCell(r as number, 2 + k);
      cell.value = v;
      cell.border = BOX;
      if (r === 10) cell.font = { bold: true };
    })
  );
  // التوقيع يسارًا: اسم المدير من ورقة البيانات.
  ws.mergeCells('G14:J14');
  ws.getCell('G14').value = { formula: "'البيانات'!C6", result: 'سالم حسن' } as ExcelJS.CellFormulaValue;
  // تعليمةٌ لمستعمل الملفّ خارج حدود الطباعة.
  ws.getCell('L5').value = 'بعنوان يعني العنوان الوظيفي';

  const hidden = book.addWorksheet('معلومات');
  hidden.state = 'hidden';
  hidden.getCell('A1').value = 'ورقةٌ مخفيّة';

  // يُكتب ويُقرأ كما يُقرأ ملفّ المكتب: حدود الطباعة والدمج والصور من الملفّ نفسه.
  const back = new ExcelJS.Workbook();
  await back.xlsx.load((await book.xlsx.writeBuffer()) as ExcelJS.Buffer);
  return back;
}

let n = 0;
const save = () => `seals/logo-${++n}.png`;
const text = (blocks: Block[]) => docText({ ...emptyDoc(), blocks });
const refs = (p: ParagraphBlock) => p.inlines.filter((i) => i.kind === 'field').map((i) => (i as { ref: string }).ref);

describe('أسماء الخانات والفراغات', () => {
  it('اسم الخانة من عنوان بيانها — والعنوان الطويل من آخره', () => {
    expect(fieldNameOf('المديرية العامة للتربية في محافظة')).toBe('المحافظة');
    expect(fieldNameOf('اسم المدرسة ')).toBe('اسم المدرسة');
    expect(fieldNameOf('اسم مدير المدرسة')).toBe('اسم مدير المدرسة');
  });

  it('المسافات الطويلة فراغٌ نقاطًا — إلا ما جاور الشرطة، وما بعد رقم البند', () => {
    expect(gapsToDots('بالسيد            بعنوان')).toMatch(/بالسيد \.{6,} بعنوان/);
    expect(gapsToDots('في      /      /      نرفق')).toBe('في   /   /   نرفق');
    expect(gapsToDots('1-     ورقة تبليغ')).toBe('1-  ورقة تبليغ');
  });

  it('وما جاور فراغًا منقوطًا، أو كان بين كلامٍ وقوسه، مسافةٌ كما رُسمت — لا فراغٌ ثانٍ', () => {
    const stamp = `اليه ${'.'.repeat(30)}${' '.repeat(12)}ختم المدرسة`;
    expect(gapsToDots(stamp)).toBe(stamp);
    expect(gapsToDots('((   واقع حال     ))')).toBe('((   واقع حال     ))');
    expect(gapsToDots('لغرض (          ) وحسب')).toMatch(/لغرض \( \.{10} \) وحسب/);
  });
});

describe('ملفّ Excel كتبًا', () => {
  it('ورقة البيانات خاناتٌ لا كتاب، والمخفيّة تُترك ويُقال لماذا', async () => {
    const book = bookToDocs(await schoolBook(), save);
    expect(book.dataSheet).toBe('البيانات');
    expect(book.dataFields.map((f) => f.key).sort()).toEqual(['اسم_المدرسة', 'اسم_مدير_المدرسة', 'المحافظة'].sort());
    expect(book.dataFields.find((f) => f.key === 'المحافظة')?.sample).toBe('بغداد');
    expect(book.sheets.map((s) => s.name)).toEqual(['تبليغ']);
    expect(book.skipped).toEqual([{ name: 'معلومات', reason: 'ورقةٌ مخفيّة' }]);
  });

  it('الرأس أعمدةٌ والشعار بينها، والسطر من ثلاث خلايا جملةٌ واحدة بخانة المحافظة', async () => {
    const { doc, notes } = bookToDocs(await schoolBook(), save).sheets[0]!;
    const head = doc.blocks.find((b) => b.kind === 'columns') as ColumnsBlock;
    expect(head.columns).toHaveLength(3);
    // في الورقة العربية العمود الأوّل يمينها: الجهة، ثم الشعار، ثم العدد والتاريخ.
    expect(text(head.columns[0]!)).toContain('إدارة');
    expect(refs(head.columns[0]![1] as ParagraphBlock)).toEqual(['اسم_المدرسة']);
    expect(head.columns[1]![0]!.kind).toBe('image');
    expect(text(head.columns[2]!)).toContain('العدد /');

    const line = doc.blocks.find((b) => b.kind === 'paragraph' && text([b]).includes('الى /')) as ParagraphBlock;
    expect(refs(line)).toEqual(['المحافظة']);
    expect(text([line])).toContain('/ قسم الملاك');
    expect(notes).toContain('«0» كُتب بدل النقطة فصُحّح «.»');
  });

  it('والفراغ نقاط، والجدول بحدوده وصفّ عناوينه، والتوقيع يسارًا — وما خارج حدود الطباعة لا يُنقل', async () => {
    const { doc } = bookToDocs(await schoolBook(), save).sheets[0]!;
    const body = doc.blocks.find((b) => b.kind === 'paragraph' && text([b]).includes('نرفق')) as ParagraphBlock;
    expect(text([body])).toMatch(/بالسيد \.{6,} مع التقدير\.$/);
    const table = doc.blocks.find((b) => b.kind === 'table') as TableBlock;
    expect(table).toMatchObject({ header: true, borders: true });
    expect(table.rows.map((r) => r.cells.length)).toEqual([3, 3]);
    expect(text([table])).toContain('مكتب');
    const sign = doc.blocks.find((b) => b.kind === 'paragraph' && refs(b).includes('اسم_مدير_المدرسة')) as ParagraphBlock;
    expect(sign.align).toBe('left');
    expect(text(doc.blocks)).not.toContain('العنوان الوظيفي');
    expect(doc.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['اسم_المدرسة', 'المحافظة', 'اسم_مدير_المدرسة']));
    expect(doc.pageSetup).toMatchObject({ size: 'A4', orientation: 'portrait', letterheadMode: 'lines' });
  });

  it('وفي المراجعة: كلّ ورقةٍ بطاقة، وخانات البيانات بسببها، والفراغ خانةٌ تُملأ بالقلم', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-excel-'));
    const file = join(dir, 'المخاطبات.xlsx');
    writeFileSync(file, Buffer.from((await (await schoolBook()).xlsx.writeBuffer()) as ArrayBuffer));
    const plan = await planExcelImport(file, { saveImage: save });
    expect(plan.source).toBe('excel');
    expect(plan.candidates.map((c) => c.title)).toEqual(['تبليغ']);
    const c = plan.candidates[0]!;
    expect(c.suggestions.find((s) => s.value.startsWith('اسم_المدرسة'))?.reason).toBe('من ورقة البيانات «البيانات»');
    expect(c.doc.fields.find((f) => f.label === 'اسم السيد')).toMatchObject({ fillMode: 'hand' });
    expect(plan.failed).toEqual([{ file: 'معلومات', error: 'ورقةٌ مخفيّة' }]);
  });

  it('و.xls القديم يُقال له ما يُفعل', async () => {
    await expect(excelToDocs('قديم.xls')).rejects.toThrow(/احفظه بها/);
  });
});
