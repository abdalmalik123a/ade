/**
 * سيناريو: «كتب من ملف Excel» — برنامج مخاطبات مدرسةٍ في Excel يصير مكتبة، بمراجعة الموظف (الموجة ٢).
 *
 * يبني ملفًّا كما تصنعه المدارس: ورقة بياناتٍ تملأ الكتب بمعادلات، وكتابان برأسٍ أعمدةٌ والشعار بينها، وفراغاتٌ
 * مسافات، وجدولٌ محدود، وورقةٌ مخفيّة — ثم يفتحه من «استورد»، ويتفقّد المراجعة، ويحفظ ويفتّش في القاعدة.
 *
 * حوار اختيار الملفّ لا يُضغط آليًّا، فله بابٌ محصور: DIWAN_TEST_OPEN_FILE.
 */
import { join } from 'node:path';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';

const FILE = join(process.env.TEMP ?? '.', `diwan-excel-${Date.now()}.xlsx`);
/** شعارٌ بنقطةٍ واحدة. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const BOX = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

function letterSheet(book, name, logo) {
  const ws = book.addWorksheet(name);
  ws.views = [{ rightToLeft: true }];
  ws.pageSetup = { printArea: 'A1:J20', paperSize: 9, orientation: 'portrait' };
  ws.columns = Array.from({ length: 12 }, () => ({ width: 10 }));
  // الرأس: الجهة يمينًا، والعدد والتاريخ يسارًا، والشعار بينهما.
  ws.mergeCells('B2:C2');
  ws.getCell('B2').value = 'إدارة';
  ws.mergeCells('B3:C3');
  ws.getCell('B3').value = { formula: "'الرئيسية'!C2", result: 'مدرسة النور' };
  ws.mergeCells('H2:J2');
  ws.getCell('H2').value = 'العدد /';
  ws.mergeCells('H3:J3');
  ws.getCell('H3').value = 'التاريخ   /   /   20';
  ws.addImage(logo, { tl: { col: 4, row: 0 }, br: { col: 6, row: 3 } });
  ws.mergeCells('A6:D6');
  ws.getCell('A6').value = 'الى / المديرية العامة لتربية';
  ws.getCell('A6').alignment = { horizontal: 'left' };
  ws.getCell('E6').value = { formula: "'الرئيسية'!E4", result: 'بغداد' };
  ws.mergeCells('F6:J6');
  ws.getCell('F6').value = '/ قسم الملاك';
  ws.getCell('F6').alignment = { horizontal: 'right' };
  ws.mergeCells('G16:J16');
  ws.getCell('G16').value = { formula: "'الرئيسية'!C6", result: 'سالم حسن' };
  ws.mergeCells('G17:J17');
  ws.getCell('G17').value = 'مدير المدرسة';
  ws.getCell('G17').alignment = { horizontal: 'left' };
  // تعليمةٌ لمستعمل الملفّ خارج حدود الطباعة.
  ws.getCell('L4').value = 'اكتب التاريخ باليد';
  return ws;
}

/** برنامج مخاطبات مدرسة: البيانات، و«تبليغ» بجدول، و«تأييد»، وورقةٌ مخفيّة. */
export async function prepare() {
  const book = new ExcelJS.Workbook();
  const data = book.addWorksheet('الرئيسية');
  data.views = [{ rightToLeft: true }];
  data.getCell('B2').value = 'اسم المدرسة';
  data.getCell('C2').value = 'مدرسة النور';
  data.mergeCells('B4:D4');
  data.getCell('B4').value = 'المديرية العامة للتربية في محافظة';
  data.getCell('E4').value = 'بغداد';
  data.getCell('B6').value = 'اسم مدير المدرسة';
  data.getCell('C6').value = 'سالم حسن';
  const logo = book.addImage({ buffer: PNG, extension: 'png' });

  const tabligh = letterSheet(book, 'تبليغ', logo);
  tabligh.mergeCells('A8:J8');
  tabligh.getCell('A8').value = 'كتابكم ذو العدد            في   /   /   نرفق لكم ورقة التبليغ الخاصة بالسيد                    مع التقدير0';
  tabligh.getCell('A8').alignment = { horizontal: 'center' };
  [
    [10, ['ت', 'المادة', 'العدد']],
    [11, ['1', 'ورقة تبليغ', '2']]
  ].forEach(([r, values]) =>
    values.forEach((v, k) => {
      const cell = tabligh.getCell(r, 2 + k);
      cell.value = v;
      cell.border = BOX;
      if (r === 10) cell.font = { bold: true };
    })
  );

  const taeed = letterSheet(book, 'تأييد', logo);
  taeed.mergeCells('A8:J8');
  taeed.getCell('A8').value = 'م/ تأييد';
  taeed.getCell('A8').alignment = { horizontal: 'center' };
  taeed.mergeCells('A10:J10');
  taeed.getCell('A10').value = 'نؤيد لكم بأن التلميذ                    من مواليد   /   /   مستمر بالدوام في مدرستنا';

  const hidden = book.addWorksheet('معلومات');
  hidden.state = 'hidden';
  hidden.getCell('A1').value = 'تعليمات الملفّ';

  writeFileSync(FILE, Buffer.from(await book.xlsx.writeBuffer()));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto('templates-library-drafts');
  await wait(700);
  ok('في قائمة «استورد» بابٌ لكتب Excel', await page.eval(`return Boolean(document.querySelector('[data-import-menu] [data-act="new-excel"]'));`));
  await page.eval(`document.querySelector('[data-act="new-excel"]')?.click(); return true;`);
  await wait(3500);

  const text = await page.text();
  ok('انفتحت مراجعة ملف Excel', text.includes('مراجعة ما وجدناه في ملف Excel'));
  ok('ورقتان ← بطاقتان — وورقة البيانات ليست كتابًا', text.includes('ورقتان') && text.includes('بطاقتان'));
  ok('والورقة المخفيّة تُركت وقيل لماذا', text.includes('ورقةً لم تُستورد') && text.includes('معلومات: ورقةٌ مخفيّة'));
  const labels = await page.eval(`return [...document.querySelectorAll('input[type="text"]')].map((i) => i.value).join(' | ');`);
  ok(`وخانات ورقة البيانات بأسماء بياناتها (${labels})`, ['اسم المدرسة', 'المحافظة', 'اسم مدير المدرسة'].every((l) => labels.includes(l)));
  ok('وفراغات المسافات خاناتٌ بأسمائها: عدد كتابهم وتاريخه غير تاريخ الكتاب', ['عدد كتابكم', 'تاريخ كتابكم', 'اسم السيد'].every((l) => labels.includes(l)));
  ok('وقالت من أين جاءت خانات البيانات', text.includes('من ورقة البيانات «الرئيسية»'));

  if (shotsDir) await page.shot(join(shotsDir, 'excel-plan.png'));

  const dbPath = join(profile, 'data', 'diwan.db');
  const read = () => {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT title, doc_json AS docJson FROM templates').all();
    db.close();
    return rows.map((r) => ({ title: r.title, doc: JSON.parse(r.docJson) }));
  };
  ok('ولا شيء في القاعدة قبل القبول', read().length === 0);

  await page.clickText('احفظ بطاقتين');
  await wait(2500);
  ok('أكّد الحفظ', (await page.text()).includes('حُفظت بطاقتان'));

  // ── التفتيش في القاعدة ─────────────────────────────────────────────
  const saved = read();
  ok('حُفظت الورقتان بأسمائهما', saved.map((t) => t.title).sort().join('،') === ['تأييد', 'تبليغ'].sort().join('،'));
  const tabligh = saved.find((t) => t.title === 'تبليغ')?.doc;
  const taeed = saved.find((t) => t.title === 'تأييد')?.doc;
  const head = tabligh?.blocks?.find((b) => b.kind === 'columns');
  ok('الرأس أعمدةٌ ثلاثة والشعار أوسطها', head?.columns?.length === 3 && head.columns[1]?.[0]?.kind === 'image');
  const src = head?.columns?.[1]?.[0]?.src ?? '';
  ok('والشعار محفوظٌ في المتجر', src.startsWith('letterheads/') && existsSync(join(profile, 'data', 'store', src)));
  const json = JSON.stringify(tabligh?.blocks ?? []);
  ok('والسطر من ثلاث خلايا جملةٌ واحدة بخانة المحافظة', /الى \/ المديرية العامة لتربية.*"ref":"المحافظة".*\/ قسم الملاك/.test(json));
  ok('والجدول بحدوده وصفّ عناوينه', Boolean(tabligh?.blocks?.some((b) => b.kind === 'table' && b.borders && b.header && b.rows.length === 2)));
  ok('و«0» صار نقطة', json.includes('مع التقدير.'));
  ok('وما خارج حدود الطباعة لم يُنقل', !json.includes('اكتب التاريخ باليد'));
  const fields = (doc) => new Map((doc?.fields ?? []).map((f) => [f.label, f]));
  ok('وخانات البيانات تُكتب، والفراغات تُملأ بالقلم', fields(tabligh).get('اسم المدرسة')?.fillMode === 'printed' && fields(tabligh).get('عدد كتابكم')?.fillMode === 'hand');
  ok('و«التلميذ» اسمُ شخصٍ يملؤه سجلّ الزبائن، و«مواليد» تاريخ الميلاد', fields(taeed).get('اسم التلميذ')?.source === 'fullName' && fields(taeed).has('تاريخ الميلاد'));
  ok('والصفحة A4 بأسطر رأسها في الورقة', taeed?.pageSetup?.size === 'A4' && taeed?.pageSetup?.letterheadMode === 'lines');

  if (shotsDir) await page.shot(join(shotsDir, 'excel-done.png'));

  rmSync(FILE, { force: true });
  return steps.join('\n');
}
