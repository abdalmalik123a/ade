/**
 * سيناريو: الإمساكية من جدولٍ رسميٍّ يُستورد (DESIGNS.md ٣٫٤) — من المعرض بنمط «ليالي رمضان»: ثلاثون يومًا لرمضان القادم
 * وأوقاتٌ فارغة يقولها اللوح والفحص قبل الطباعة؛ ثمّ جدولٌ يُلصق بأرقامٍ هندية و«ص» و«م» فتُراجع أعمدته ويُترك «العشاء» ويوضع؛
 * ثمّ التقويم هجريًّا والأرقام لاتينية (والأوقات باقية)، والتراجع؛ ثمّ ملفّ PDF إنكليزيّ يبدأ الثلاثاء ٩ شباط بتسعةٍ وعشرين
 * يومًا فيُعرف أوّل رمضان منه؛ ثمّ شهادةٌ تاريخها يُكتب هجريًّا في المعاينة وفي الدفعة.
 * (الأوقات مختلَقة — ليست جدول مدينة.)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const at = (h, m, day) => {
  const t = h * 60 + m + day;
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
};
const INDIC = (s) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** جدول PDF إنكليزيّ: ٢٩ يومًا من الثلاثاء ٩ شباط ٢٠٢٧. */
export async function prepare() {
  const dir = join(tmpdir(), `diwan-imsakiya-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const cols = ['Day', 'Date', 'Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  page.drawText('Ramadan 1448 - Baghdad', { x: 40, y: 800, size: 14, font });
  cols.forEach((c, i) => page.drawText(c, { x: 40 + i * 60, y: 770, size: 9, font }));
  for (let d = 0; d < 29; d++) {
    const date = new Date(2027, 1, 9 + d);
    const cells = [days[date.getDay()], `${date.getDate()}/${date.getMonth() + 1}/2027`, at(4, 54, -d), at(5, 4, -d), at(6, 29, -d), at(12, 10, 0), at(15, 21, d), at(17, 46, d), at(19, 1, d)];
    cells.forEach((c, i) => page.drawText(c, { x: 40 + i * 60, y: 750 - d * 22, size: 9, font }));
  }
  const file = join(dir, 'ramadan-baghdad.pdf');
  writeFileSync(file, await pdf.save());
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const choose = (sel, value) =>
    page.eval(`
      const s = document.querySelector(${JSON.stringify(sel)});
      if (!s) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)});
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`);
  const table = () =>
    page.eval(`
      const t = document.querySelector('[data-design] table');
      return { head: [...t.querySelectorAll('th')].map((x) => x.textContent), rows: [...t.querySelectorAll('tbody tr')].map((r) => [...r.cells].map((c) => c.textContent)) };`);
  const chip = () => page.eval(`return document.querySelector('[data-imsakiya-gaps]')?.textContent ?? '';`);
  // «اطبع» يفتح مراجعة الأوراق — وفيها الفحص قبل الطباعة.
  const issues = async () => {
    await click('[data-editor-panel="fill"] [data-close-panel]');
    await click('button[data-act="print"]');
    let out = [];
    for (let i = 0; i < 25 && !out.length; i++) {
      await wait(300);
      out = await page.eval(`return [...document.querySelectorAll('[data-sheets] [data-issue]')].map((n) => n.innerText);`);
    }
    await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await click('[data-sheets] [data-act="close"]');
    await wait(400);
    await click('[data-design-panel="fill"]');
    return out;
  };

  // ── من المعرض: ثلاثون يومًا لرمضان القادم، والأوقات فارغة ───────────
  await page.goto('designed-documents');
  await wait(900);
  await click('[data-style="ramadan"]');
  await wait(300);
  await click('button[data-kind="imsakiya"]');
  await wait(1500);
  await click('[data-design-panel="fill"]');
  let t = await table();
  const start = await page.eval(`return document.querySelector('[data-imsakiya-start]')?.value ?? '';`);
  const weekday = await page.eval(`return ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date(${JSON.stringify(start)} + 'T12:00').getDay()];`);
  ok(`من المعرض: لوح «جدول الإمساكية» وثلاثون يومًا من أوّل رمضان القادم (${start}، ${t.rows[0]?.slice(0, 3).join(' ')})`, t.rows.length === 30 && t.rows[0][0] === weekday && t.rows[0][1] === '١');
  ok(`والأوقات فارغة يقولها اللوح («${await chip()}»)`, (await chip()) === 'الأوقات فارغة' && t.rows.every((r) => r.slice(3).every((c) => c === '')));
  const before = await issues();
  ok('والفحص قبل الطباعة يقول: الإمساكية بلا أوقات', before.some((x) => x.includes('الإمساكية بلا أوقات')));

  // ── اللصق: أرقامٌ هندية و«ص» و«م»، ويُترك «العشاء» ───────────────────
  const lines = ['ت\tاليوم\tالإمساك\tالفجر\tالشروق\tالظهر\tالعصر\tالمغرب\tالعشاء'];
  for (let d = 0; d < 30; d++) {
    lines.push([d + 1, '', `${at(4, 55, -d)} ص`, `${at(5, 5, -d)} ص`, `${at(6, 30, -d)} ص`, '12:10 م', `${at(3, 20, d)} م`, `${at(5, 45, d)} م`, `${at(7, 0, d)} م`].map((c) => INDIC(String(c))).join('\t'));
  }
  await click('[data-act="imsakiya-paste"]');
  await wait(200);
  await page.type('textarea[data-imsakiya-text]', lines.join('\n'));
  await wait(200);
  await click('[data-act="imsakiya-read"]');
  await wait(400);
  const read = await page.eval(`return document.querySelector('[data-imsakiya-columns]')?.innerText ?? '';`);
  ok(`يُقرأ الملصوق ويُعرض ما فُهم من كلّ عمود (${read.split('\n')[0]})`, read.includes('٣٠') && read.includes('٧'));
  const isha = await page.eval(`
    const rows = [...document.querySelectorAll('[data-imsakiya-column]')];
    return rows.findIndex((r) => r.querySelector('select').value === 'time:العشاء');`);
  await choose(`[data-imsakiya-column="${isha}"] select`, 'skip');
  await wait(200);
  await click('[data-act="imsakiya-place"]');
  await wait(700);
  t = await table();
  ok(`يوضع: الأوقات بأرقامٍ هندية وباثنتي عشرة ساعة، و«العشاء» تُرك (${t.rows[0].join(' | ')})`, t.head.join(',') === 'اليوم,رمضان,الميلادي,الإمساك,الفجر,الشروق,الظهر,العصر,المغرب' && t.rows[0].slice(3).join(' ') === '٤:٥٥ ٥:٠٥ ٦:٣٠ ١٢:١٠ ٣:٢٠ ٥:٤٥');
  ok(`واللوح يقول: ثلاثون يومًا بأوقاتها («${await chip()}»)`, (await chip()) === '٣٠ يومًا بأوقاتها');
  ok('والفحص قبل الطباعة لا يذكر الإمساكية', !(await issues()).some((x) => x.includes('الإمساكية')));

  // ── التقويم والأرقام — والأوقات باقية، والتراجع ───────────────────────
  await choose('[data-imsakiya-calendar]', 'hijri');
  await wait(300);
  await choose('[data-imsakiya-digits]', 'latin');
  await wait(400);
  t = await table();
  const year = await page.eval(`return document.querySelector('[data-design]').innerText.includes('1448 هـ') && !document.querySelector('[data-design]').innerText.includes('2027 م');`);
  ok(`هجريًّا بأرقامٍ لاتينية: بلا عمود الميلادي والأوقات باقية، وسطر السنة «1448 هـ» (${t.rows[0].join(' | ')})`, t.head[2] === 'الإمساك' && t.rows[0][1] === '1' && t.rows[0][2] === '4:55' && year);
  await click('[data-undo]');
  await wait(400);
  t = await table();
  ok('والتراجع يعيد الأرقام الهندية', t.rows[0][2] === '٤:٥٥');

  // ── ملفّ PDF: تسعةٌ وعشرون يومًا من الثلاثاء ٩ شباط ──────────────────
  await click('[data-act="imsakiya-file"]');
  let cols = '';
  for (let i = 0; i < 30 && !cols; i++) {
    await wait(300);
    cols = await page.eval(`return document.querySelector('[data-imsakiya-columns]')?.innerText ?? '';`);
  }
  ok(`ويُقرأ جدول PDF: ٢٩ يومًا، وأوّل رمضان منه (${cols.split('\n').filter((l) => l.includes('أوّل رمضان') || l.includes('من «')).join(' — ')})`, cols.includes('ramadan-baghdad.pdf') && cols.includes('٢٩') && cols.includes('2027-02-09'));
  await click('[data-act="imsakiya-place"]');
  await wait(700);
  t = await table();
  const start2 = await page.eval(`return document.querySelector('[data-imsakiya-start]')?.value ?? '';`);
  ok(`فيوضع: ٢٩ يومًا أوّلها الثلاثاء، وأوقاتها من الملفّ بترتيب اليوم (${t.rows[0].join(' | ')})`, t.rows.length === 29 && start2 === '2027-02-09' && t.rows[0][0] === 'الثلاثاء' && t.rows[0][2] === '٤:٥٤' && t.head.at(-1) === 'العشاء');
  const fridays = await page.eval(`return [...document.querySelectorAll('[data-design] tbody tr')].filter((r) => r.cells[0].style.fontWeight === '700').map((r) => r.cells[0].textContent);`);
  ok(`والجمعة مميّزة بلونها (${fridays.length}: ${[...new Set(fridays)].join('،')})`, fridays.length === 4 && fridays.every((d) => d === 'الجمعة'));

  // ── التاريخ بتقويمه في شهادة ودفعة ─────────────────────────────────
  await click('[data-editor-panel="fill"] [data-close-panel]');
  await click('[data-act="gallery"]');
  await wait(600);
  await click('[data-style="official"]');
  await wait(300);
  await click('button[data-kind="thanks"]');
  await wait(1200);
  await click('[data-design-panel="fill"]');
  await page.type('input[data-value="التاريخ"]', '2026/10/11');
  await choose('[data-calendar-of="التاريخ"]', 'hijri');
  await wait(400);
  const printed = await page.eval(`return document.querySelector('[data-date-printed="التاريخ"]')?.textContent ?? '';`);
  const shown = await page.eval(`return document.querySelector('[data-design]').innerText;`);
  ok(`حقل التاريخ هجريًّا: يُطبع «${printed.replace('يُطبع: ', '')}» ويُرى في المعاينة`, /^يُطبع: \d+ ربيع الآخر 1448 هـ$/.test(printed) && shown.includes(printed.replace('يُطبع: ', '')));
  await page.type('textarea[data-batch-text]', ['الاسم\tالتاريخ', 'زينب علي حسن\t2026/10/12', 'سالم حسن\t2026/10/13'].join('\n'));
  await wait(800);
  await click('button[data-act="sheets"]');
  let sheets = '';
  for (let i = 0; i < 25 && !sheets.includes('هـ'); i++) {
    await wait(300);
    sheets = await page.eval(`return document.querySelector('[data-sheets]')?.innerText ?? '';`);
  }
  // الورقة المعروضة بطاقة الأولى (١٢ ت١ ٢٠٢٦) — تاريخها من القائمة هجريًّا لا كما في Excel.
  ok(`وفي الدفعة: تاريخ البطاقة من القائمة يُكتب هجريًّا${sheets.includes('1448 هـ') ? '' : ` (${sheets.replace(/\s+/g, ' ').slice(0, 400)})`}`, sheets.includes('جمادى الأولى 1448 هـ') && !sheets.includes('2026/10/12'));
  return steps.join('\n');
}
