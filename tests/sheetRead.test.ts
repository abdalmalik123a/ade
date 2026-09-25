import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { sheetToText } from '../src/main/services/sheetRead';
import { parseRows } from '../src/shared/batch';

describe('قائمةٌ من Excel', () => {
  it('تُقرأ بصيغة اللصق نفسها — فيقرؤها قارئ الدفعة الواحد', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-sheet-'));
    const file = join(dir, 'class.xlsx');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('الصف');
    sheet.addRow(['الاسم', 'الصف', 'الرقم', 'تاريخ الميلاد']);
    sheet.addRow(['زينب علي', 'الخامس', 2026001, new Date(2015, 2, 9)]);
    sheet.addRow([]);
    sheet.addRow([{ richText: [{ text: 'أحمد ' }, { text: 'كريم' }] }, 'السادس', { formula: '1+1', result: 2 }]);
    await book.xlsx.writeFile(file);

    const { text, rows } = await sheetToText(file);
    expect(rows).toBe(3);
    expect(text.split('\n')[1]).toBe('زينب علي\tالخامس\t2026001\t2015/03/09');
    const parsed = parseRows(text, ['الاسم', 'الصف', 'الرقم', 'تاريخ الميلاد']);
    expect(parsed.rows).toEqual([
      { الاسم: 'زينب علي', الصف: 'الخامس', الرقم: '2026001', 'تاريخ الميلاد': '2015/03/09' },
      { الاسم: 'أحمد كريم', الصف: 'السادس', الرقم: '2' }
    ]);
  });

  it('وCSV كذلك', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-sheet-'));
    const file = join(dir, 'class.csv');
    writeFileSync(file, 'الاسم,الصف\nزينب,الخامس\n', 'utf8');
    expect((await sheetToText(file)).text).toBe('الاسم\tالصف\nزينب\tالخامس');
  });
});
