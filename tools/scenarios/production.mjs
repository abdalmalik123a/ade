/**
 * سيناريو: الإنتاج — قائمةٌ من ملف Excel، وهويّةٌ بوجهٍ وظهر، ومعايرة الطابعة،
 * ونموذجا «أ» و«ب» للأسئلة.
 *
 * يُبنى ملف Excel بقائمة صفٍّ من عشرة، فيُفتح من لوح الدفعة مباشرةً. ويُحفظ ظهر
 * الهويّة تصميمًا، ويُختار ظهرًا للوجه — فتصير الأوراق وجهًا ثم ظهرًا معكوسًا.
 * ثم تُكتب قياسات ورقة المعايرة فتُحفظ إزاحةً. ثم تُشعل «نموذجان» في الأسئلة.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';

const require = createRequire(import.meta.url);

export async function prepare() {
  const ExcelJS = require('exceljs');
  const dir = join(process.env.TEMP ?? '.', `diwan-production-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'class.xlsx');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('الخامس');
  sheet.addRow(['الاسم', 'الصف', 'الرقم']);
  for (let i = 1; i <= 10; i++) sheet.addRow([`طالب ${i}`, 'الخامس', `2026-${String(i).padStart(4, '0')}`]);
  await book.xlsx.writeFile(file);
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const select = (sel, index) =>
    page.eval(`
      const s = document.querySelector(${JSON.stringify(sel)});
      if (!s || !s.options[${index}]) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[${index}].value);
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);

  // ── ظهر الهويّة يُحفظ أولًا ─────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="id-back"]');
  await wait(900);
  await click('button[data-act="save"]');
  await wait(1200);
  await click('button[data-act="gallery"]');
  await wait(500);
  await click('button[data-kind="student-id"]');
  await wait(900);
  ok('وللوجه ظهرٌ يُختار بمقاسه', await select('select[data-back-select]', 1));
  await wait(800);

  // ── القائمة من ملف Excel مباشرةً ────────────────────────────────────
  await click('button[data-act="open-sheet"]');
  await wait(1500);
  const summary = await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`);
  ok('قائمة الصفّ من ملف Excel: عشرة أسماء في ورقتين', summary.includes('١٠') && summary.includes('٢'));

  await click('button[data-act="sheets"]');
  await wait(1800);
  const sheets = await page.eval(`
    const o = document.querySelector('[data-sheets]');
    return { summary: o.querySelector('[data-sheets-summary]').innerText, footer: o.innerText };
  `);
  ok('والأوراق بوجهين: ١٠ بطاقات على ورقتين بوجهين', sheets.summary.includes('ورقة') && sheets.summary.includes('بوجهين') && sheets.summary.includes('٢ ورقة'));
  ok('والأولى وجهٌ', sheets.footer.includes('الوجه'));
  const front = await page.eval(`
    const cells = [...document.querySelectorAll('[data-sheets] .print-page > div[style*="overflow:hidden"]')];
    return cells.map((c) => parseFloat(c.style.left));
  `);
  await page.eval(`document.querySelector('[data-sheets] button[title="التالية"]').click()`);
  await wait(900);
  const back = await page.eval(`
    const o = document.querySelector('[data-sheets]');
    const cells = [...o.querySelectorAll('.print-page > div[style*="overflow:hidden"]')];
    return { left: cells.map((c) => parseFloat(c.style.left)), footer: o.innerText, text: o.querySelector('.print-page').innerText };
  `);
  ok('والثانية ظهرٌ معكوس', back.footer.includes('الظهر (معكوس)'));
  ok('وخانة الظهر الأولى في مكان خانة الوجه الأولى معكوسةً', front.length > 1 && back.left[0] === front[front.length > 2 ? 2 : 1]);
  ok('والظهر يحمل تعليماته', back.text.includes('من يجدها يُرجى تسليمها'));
  if (shotsDir) await page.shot(join(shotsDir, 'duplex-back.png'));
  await page.eval(`document.querySelector('[data-sheets] button[title="رجوع (Esc)"]').click()`);
  await wait(400);

  // ── معايرة الطابعة ─────────────────────────────────────────────────
  await page.eval(`return window.diwan.settings.set({ defaultPrinter: 'طابعة المكتب' }).then(() => true);`);
  await page.goto('header-seal-configuration');
  await wait(1000);
  ok('وللطابعة معايرةٌ في الإعدادات', await page.eval(`return Boolean(document.querySelector('[data-calibration] [data-act="print-calibration"]'));`));
  await page.type('input[data-measure-right]', '22');
  await page.type('input[data-measure-top]', '21');
  await click('[data-act="save-calibration"]');
  await wait(800);
  const conn = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const offsets = JSON.parse(conn.prepare("SELECT value FROM settings WHERE key = 'printOffsets'").get()?.value ?? '{}');
  conn.close();
  ok('وقياس ٢٢ و٢١ يُحفظ إزاحةً: يمينًا ٢ ورفعًا ١', offsets['طابعة المكتب']?.x === 2 && offsets['طابعة المكتب']?.y === -1);
  ok('وتُعرض الإزاحة', (await page.eval(`return document.querySelector('[data-calibration-offset]').innerText;`)).includes('2 يمينًا'));

  // ── نموذجا «أ» و«ب» ────────────────────────────────────────────────
  await page.goto('exam-papers');
  await wait(1000);
  await click('input[data-act="versions"]');
  await wait(500);
  const paper = () => page.eval(`return document.querySelector('[data-paper]').innerText;`);
  ok('و«نموذجان» يطبع «النموذج: أ» في الرأس', (await paper()).includes('النموذج: أ'));
  await click('button[data-version="ب"]');
  await wait(400);
  ok('وتُعاين «ب» بنقرة', (await paper()).includes('النموذج: ب'));

  return steps.join('\n');
}
