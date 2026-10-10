/**
 * الإمساكية من جدولٍ رسميٍّ يُستورد (DESIGNS.md ٣٫٤): الجدول يُقرأ من Excel واللصق وPDF بعناوينه أو بلاها، والأيّام تُبنى من
 * أوّل رمضان بالتقويم المختار، والأوقات من الجدول وحده — لا تُحسب ولا تُخترع. والتاريخ في حقول التصاميم بتقويمه.
 * (الأوقات هنا مختلَقةٌ للاختبار — ليست جدول مدينة.)
 */
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sheetToText } from '../src/main/services/sheetRead';
import { pdfTableText, readTimetable, startOf, timesOf, weekdayClash, parseClock } from '../src/shared/design/timetable';
import { fillImsakiya, imsakiyaGaps, imsakiyaGrid, imsakiyaTable, nextRamadan, NO_TIMES, yearLine, IMSAKIYA_YEAR } from '../src/shared/design/imsakiya';
import { buildDesign, PALETTES } from '../src/shared/design/kit';
import { canvasDoc, designPackLevel, normalizeCanvas, type TableElement, type TextElement } from '../src/shared/canvas';
import { designPreflight } from '../src/shared/preflight';
import { dateValueIn, isoDate, parseDateText, valuesInCalendars } from '../src/shared/dates';

const pad = (n: number) => String(n).padStart(2, '0');
/** وقتٌ يتقدّم دقيقةً كلّ يوم — أرقامٌ مختلَقة. */
const at = (h: number, m: number, day: number) => {
  const t = h * 60 + m + day;
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
};
const DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

/** كما يقرؤه ديوان من ملف Excel: عنوانٌ فوق الرأس، والتاريخ يومًا، والوقت «1899/12/30 HH:mm»، والمساء بأربعٍ وعشرين ساعة. */
function excelSheet(days = 30): string {
  const lines = ['إمساكية شهر رمضان المبارك — بغداد', '', ['ت', 'اليوم', 'التاريخ', 'الإمساك', 'الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'].join('\t')];
  for (let i = 0; i < days; i++) {
    const d = new Date(2027, 1, 8 + i);
    const t = (h: number, m: number) => `1899/12/30 ${at(h, m, -i).padStart(5, '0')}`;
    lines.push([String(i + 1), DAYS[i % 7], `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, t(4, 55), t(5, 5), t(6, 30), t(12, 10), t(15, 20), t(17, 45), t(19, 0)].join('\t'));
  }
  lines.push('ملاحظة: الأوقات حسب التوقيت المحلّي');
  return lines.join('\n');
}

describe('قراءة الجدول الرسمي', () => {
  it('من Excel: العنوان والملاحظة يُتركان، والأعمدة تُعرف، وأوّل رمضان من التاريخ، والمساء باثنتي عشرة ساعة', () => {
    const t = readTimetable(excelSheet());
    expect(t.headed).toBe(true);
    expect(t.rows).toHaveLength(30);
    expect(t.columns.map((c) => c.role)).toEqual(['hijri', 'weekday', 'gregorian', 'time', 'time', 'time', 'time', 'time', 'time', 'time']);
    expect(isoDate(startOf(t)!)).toBe('2027-02-08');
    const times = timesOf(t);
    expect(times.map((x) => x.title)).toEqual(['الإمساك', 'الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء']);
    expect(times[0]!.values.slice(0, 2)).toEqual(['4:55', '4:54']);
    expect(times[5]!.values[0]).toBe('5:45');
    expect(times[3]!.values[0]).toBe('12:10');
  });

  it('لصقٌ بأرقامٍ هندية و«ص» و«م»، وعناوين الوقف الشيعيّ (أذان الفجر، منتصف الليل) بلا عصرٍ ولا عشاء', () => {
    const rows = ['اليوم\tأذان الفجر\tالإمساك\tالشروق\tأذان الظهر\tأذان المغرب\tمنتصف الليل', 'الإثنين\t٥:٠٥ ص\t٤:٥٥ ص\t٦:٣٠ ص\t١٢:١٠ م\t٥:٥٥ م\t١١:٤٠ م'];
    const t = readTimetable(rows.join('\n'));
    expect(timesOf(t).map((x) => [x.title, x.values[0]])).toEqual([
      ['الفجر', '5:05'],
      ['الإمساك', '4:55'],
      ['الشروق', '6:30'],
      ['الظهر', '12:10'],
      ['المغرب', '5:55'],
      ['منتصف الليل', '11:40']
    ]);
    expect(parseClock('٥:٥٥ م')).toEqual({ h: 17, m: 55 });
    expect(parseClock('12:10 م')).toEqual({ h: 12, m: 10 });
  });

  it('«اليوم» بأيّام رمضان ١–٣٠ يومُ رمضان، وبأسماء الأيّام يومُ أسبوع — القيم تغلب العنوان', () => {
    const numbers = readTimetable(['اليوم\tالإمساك\tالفجر', '1\t4:55\t5:05', '2\t4:54\t5:04'].join('\n'));
    expect(numbers.columns[0]!.role).toBe('hijri');
    const names = readTimetable(['اليوم\tالإمساك\tالفجر', 'الأحد\t4:55\t5:05', 'الإثنين\t4:54\t5:04'].join('\n'));
    expect(names.columns[0]!.role).toBe('weekday');
    expect(weekdayClash(names, new Date(2027, 1, 8))).toMatch(/الأحد.*الإثنين/);
    expect(weekdayClash(names, new Date(2027, 1, 7))).toBeNull();
  });

  it('بلا عناوين: الأوقات بترتيب اليوم ويُقال إنّها بلا عناوين — ولا جدول في نصٍّ بلا أوقات', () => {
    const t = readTimetable(['1  4:55  5:05  6:30  12:10  3:20  5:45  7:00', '2  4:54  5:04  6:29  12:10  3:21  5:46  7:01'].join('\n'));
    expect(t.headed).toBe(false);
    expect(timesOf(t).map((x) => x.title)).toEqual(['الإمساك', 'الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء']);
    expect(readTimetable('قائمة الأسماء\nزينب علي حسن\tالخامس')).toEqual({ columns: [], rows: [], headed: false });
  });

  it('PDF: القطع أسطرٌ وخانات من اليمين، و«4» و«:» و«55» خانةٌ واحدة تُقرأ 4:55، والعنوان المقلوب يُعرف', () => {
    const piece = (str: string, x: number, y: number, w: number) => ({ str, x, y, w, h: 10 });
    const head = [piece('اليوم', 500, 700, 30), piece('كاسمإلا', 420, 700, 40), piece('أذان', 360, 700, 22), piece('الفجر', 330, 700, 26)];
    const row = [piece('الإثنين', 495, 680, 35), piece('4', 420, 681, 6), piece(':', 426, 681, 3), piece('55', 429, 681, 12), piece('5:05', 335, 680, 22)];
    const text = pdfTableText([...row, ...head]);
    expect(text.split('\n')).toEqual(['اليوم\tكاسمإلا\tأذان الفجر', 'الإثنين\t4:55\t5:05']);
    expect(timesOf(readTimetable(text)).map((x) => [x.title, x.values[0]])).toEqual([
      ['الإمساك', '4:55'],
      ['الفجر', '5:05']
    ]);
    // وجدولٌ إنكليزيّ من يساره.
    const en = pdfTableText([piece('Day', 40, 700, 20), piece('Imsak', 100, 700, 30), piece('Fajr', 160, 700, 22), piece('Mon', 40, 680, 20), piece('4:55', 100, 680, 22), piece('5:05', 160, 680, 22)]);
    expect(en.split('\n')).toEqual(['Day\tImsak\tFajr', 'Mon\t4:55\t5:05']);
  });

  it('ملف Excel حقيقيّ: خلايا الوقت والتاريخ بتنسيقها كما يكتبها Excel', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('رمضان');
    sheet.addRow(['اليوم', 'التاريخ', 'الإمساك', 'الفجر', 'المغرب']);
    for (let i = 0; i < 3; i++) {
      const row = sheet.addRow([DAYS[i], new Date(Date.UTC(2027, 1, 8 + i)), new Date(Date.UTC(1899, 11, 30, 4, 55 - i)), new Date(Date.UTC(1899, 11, 30, 5, 5 - i)), new Date(Date.UTC(1899, 11, 30, 17, 45 + i))]);
      row.getCell(2).numFmt = 'yyyy/mm/dd';
      for (const c of [3, 4, 5]) row.getCell(c).numFmt = 'h:mm';
    }
    const dir = mkdtempSync(join(tmpdir(), 'diwan-imsakiya-'));
    const file = join(dir, 'ramadan.xlsx');
    await book.xlsx.writeFile(file);
    const t = readTimetable((await sheetToText(file)).text);
    expect(isoDate(startOf(t)!)).toBe('2027-02-08');
    expect(timesOf(t).map((x) => [x.title, x.values.join(' ')])).toEqual([
      ['الإمساك', '4:55 4:54 4:53'],
      ['الفجر', '5:05 5:04 5:03'],
      ['المغرب', '5:45 5:46 5:47']
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('الإمساكية تُبنى', () => {
  const s = { start: '2027-02-08', calendar: 'both' as const, digits: 'indic' as const, fridays: true };

  it('أوّل رمضان القادم بأمّ القرى وإزاحة المكتب — وفي رمضان أوّلُه', () => {
    expect(isoDate(nextRamadan(new Date(2026, 9, 11), 0))).toBe('2027-02-08');
    expect(isoDate(nextRamadan(new Date(2027, 1, 20), 0))).toBe('2027-02-08');
    expect(isoDate(nextRamadan(new Date(2027, 2, 20), 0))).toBe('2028-01-28');
    // العراق بعد أمّ القرى بيوم (إزاحة −١): أوّل رمضان الثلاثاء.
    expect(isoDate(nextRamadan(new Date(2026, 9, 11), -1))).toBe('2027-02-09');
  });

  it('الأيّام بالتقويمين بأرقامٍ هندية، والجمعة مميّزة، والعروض مئة', () => {
    const g = imsakiyaGrid(NO_TIMES, s, 30);
    expect(g.columns.map((c) => c.title)).toEqual(['اليوم', 'رمضان', 'الميلادي', 'الإمساك', 'الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء']);
    expect(g.rows[0]!.slice(0, 4).map((c) => c.text)).toEqual(['الإثنين', '١', '٨ شباط', '']);
    expect(g.rows[29]!.slice(0, 3).map((c) => c.text)).toEqual(['الثلاثاء', '٣٠', '٩ آذار']);
    expect(g.fridays).toEqual([4, 11, 18, 25]);
    expect(Math.round(g.columns.reduce((sum, c) => sum + c.widthPercent, 0))).toBe(100);
    expect(imsakiyaGrid(NO_TIMES, { ...s, calendar: 'hijri' }).columns.slice(0, 3).map((c) => c.title)).toEqual(['اليوم', 'رمضان', 'الإمساك']);
    expect(imsakiyaGrid(NO_TIMES, { ...s, calendar: 'gregorian' }).columns.slice(0, 3).map((c) => c.title)).toEqual(['اليوم', 'التاريخ', 'الإمساك']);
  });

  it('سطر السنة بتقويمها — والسنتان إن عبر رمضانُ رأسَ السنة', () => {
    expect(yearLine(s)).toBe('١٤٤٨ هـ — ٢٠٢٧ م');
    expect(yearLine({ ...s, calendar: 'hijri', digits: 'latin' })).toBe('1448 هـ');
    expect(yearLine({ ...s, start: '2030-12-26', calendar: 'gregorian' })).toBe('٢٠٣٠ – ٢٠٣١ م');
  });

  it('من المعرض بليالي رمضان: الأوقات فارغةٌ ويُنبَّه عليها، والجدول الرسميّ يملؤها (٢٩ يومًا)، والتقويم يتغيّر ولا تضيع', () => {
    const canvas = buildDesign({ kind: 'imsakiya', style: 'ramadan', palette: PALETTES[0]! });
    const table = imsakiyaTable(canvas)!;
    expect(table.imsakiya).toEqual(s);
    expect(table.rows).toHaveLength(30);
    expect(imsakiyaGaps(canvas)).toEqual({ empty: 210, total: 210 });
    // الجمعة بلون الترويسة وحبر الليل، وسائر الصفوف بحبر الليل.
    expect(table.rowStyles?.[4]).toMatchObject({ bg: table.headerBg, bold: true });
    expect(table.rowStyles?.[0]).toEqual({ color: expect.any(String) });

    const filled = fillImsakiya(canvas, timesOf(readTimetable(excelSheet(29))), s);
    const t2 = imsakiyaTable(filled)!;
    expect(t2.rows).toHaveLength(29);
    expect(t2.rows[0]!.map((c) => c.text)).toEqual(['الإثنين', '١', '٨ شباط', '٤:٥٥', '٥:٠٥', '٦:٣٠', '١٢:١٠', '٣:٢٠', '٥:٤٥', '٧:٠٠']);
    expect(imsakiyaGaps(filled)).toEqual({ empty: 0, total: 203 });
    expect(t2.rowStyles).toHaveLength(29);
    const year = filled.elements.find((e): e is TextElement => e.kind === 'text' && e.name === IMSAKIYA_YEAR)!;
    expect(year.inlines).toEqual([{ kind: 'run', text: '١٤٤٨ هـ — ٢٠٢٧ م' }]);
    // والأصل كما هو.
    expect(imsakiyaTable(canvas)!.rows).toHaveLength(30);

    const latin = fillImsakiya(filled, null, { ...s, calendar: 'gregorian', digits: 'latin', fridays: false });
    const t3 = imsakiyaTable(latin)!;
    expect(t3.rows[0]!.map((c) => c.text)).toEqual(['الإثنين', '8 شباط', '4:55', '5:05', '6:30', '12:10', '3:20', '5:45', '7:00']);
    expect(t3.rowStyles?.every((r) => !r?.bg)).toBe(true);
    expect(latin.elements.find((e): e is TextElement => e.kind === 'text' && e.name === IMSAKIYA_YEAR)!.inlines).toEqual([{ kind: 'run', text: '2027 م' }]);
  });

  it('الفحص قبل الطباعة: إمساكيةٌ بلا أوقات أو بخاناتٍ فارغة يُنبَّه عليها، والكاملة لا — وصيغة حزمتها ٣', () => {
    const canvas = buildDesign({ kind: 'imsakiya', style: 'official', palette: PALETTES[0]! });
    expect(designPreflight(canvas, [{}]).map((i) => i.text)).toContainEqual(expect.stringMatching(/الإمساكية بلا أوقات/));
    const full = fillImsakiya(canvas, timesOf(readTimetable(excelSheet())), s);
    expect(designPreflight(full, [{}]).some((i) => /الإمساكية/.test(i.text))).toBe(false);
    const table = imsakiyaTable(full)!;
    const holed = { ...full, elements: full.elements.map((e) => (e.id === table.id ? { ...table, rows: table.rows.map((r, i) => (i === 3 ? r.map((c, k) => (k > 2 ? { text: '' } : c)) : r)) } : e)) };
    expect(designPreflight(holed, [{}]).map((i) => i.text)).toContainEqual(expect.stringMatching(/٧ خانة وقتٍ فارغة من ٢١٠/));
    expect(designPackLevel(canvasDoc(canvas))).toBe(3);
    expect(designPackLevel(canvasDoc({ ...buildDesign({ kind: 'menu', style: 'official', palette: PALETTES[0]! }), calendars: { التاريخ: 'hijri' } }))).toBe(3);
  });

  it('الإعداد والتقاويم يبقيان بعد الحفظ والفتح — والفاسد يُترك', () => {
    const canvas = { ...buildDesign({ kind: 'imsakiya', style: 'official', palette: PALETTES[0]! }), calendars: { التاريخ: 'hijri' as const, x: 'moon' as never } };
    const back = normalizeCanvas(JSON.parse(JSON.stringify(canvas)));
    expect(back.calendars).toEqual({ التاريخ: 'hijri' });
    expect((back.elements.find((e) => e.kind === 'table') as TableElement).imsakiya).toEqual(s);
    const broken = normalizeCanvas({ ...canvas, elements: [{ ...imsakiyaTable(canvas)!, imsakiya: { start: 'غدًا' } }] });
    expect((broken.elements[0] as TableElement).imsakiya).toBeUndefined();
  });
});

describe('التاريخ بتقويمه في حقول التصاميم والدفعات', () => {
  it('يُقرأ التاريخ كما يُكتب في العراق وExcel', () => {
    for (const text of ['2026/10/11', '11/10/2026', '١١ / ١٠ / ٢٠٢٦', '11-10-2026', '11 تشرين الأول 2026', '١١ تشرين الأول ٢٠٢٦ م'])
      expect([text, isoDate(parseDateText(text)!)]).toEqual([text, '2026-10-11']);
    expect(isoDate(parseDateText('8 شباط', new Date(2026, 9, 11))!)).toBe('2027-02-08');
    for (const text of ['غدًا', '31/2/2026', '4:55', '30 ربيع الآخر 1448 هـ']) expect([text, parseDateText(text)]).toEqual([text, null]);
  });

  it('بالتقويم المختار، وبالأرقام التي كُتب بها — وما ليس تاريخًا كما هو', () => {
    expect(dateValueIn('2026/10/11', 'gregorian')).toBe('11 تشرين الأول 2026');
    expect(dateValueIn('١١ / ١٠ / ٢٠٢٦', 'gregorian')).toBe('١١ تشرين الأول ٢٠٢٦');
    expect(dateValueIn('11/10/2026', 'hijri')).toMatch(/^\d+ ربيع الآخر 1448 هـ$/);
    expect(dateValueIn('11/10/2026', 'both')).toMatch(/^11 تشرين الأول 2026 م الموافق \d+ ربيع الآخر 1448 هـ$/);
    expect(dateValueIn('الخميس القادم', 'hijri')).toBe('الخميس القادم');
    const card = { الاسم: 'زينب علي حسن', التاريخ: '2026/10/11', 'تاريخ النشاط': '2026/10/11' };
    expect(valuesInCalendars(card, { التاريخ: 'gregorian' })).toEqual({ ...card, التاريخ: '11 تشرين الأول 2026' });
    expect(valuesInCalendars(card, undefined)).toBe(card);
  });
});
