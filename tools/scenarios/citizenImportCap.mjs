/**
 * سيناريو: سقف استيراد الزبائن من Excel على التطبيق الحقيقي (G31، D45).
 *
 * دائرةٌ ترسل قائمةً أطول من الحدّ بصفٍّ واحد (`IMPORT_MAX_ROWS` + ١). فيُقرأ الملف كلّه، ويرى المكتب في النافذة
 * «في الملف أكثر من … صفّ — قسّمه ملفّين»، و«استورد» معطّلًا ونقره لا يفعل شيئًا — ولا يُضاف أحد، ولا قيد استيرادٍ
 * في سجلّ الأحداث. والحدّ يُقرأ من مصدره، فلو تغيّر تبعه السيناريو.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-citizen-import-cap-${Date.now()}`);
const FILE = join(DIR, 'قائمة كبيرة.xlsx');
const SOURCE = readFileSync(new URL('../../src/shared/citizenImport.ts', import.meta.url), 'utf8');
const MAX = Number(/export const IMPORT_MAX_ROWS = (\d+);/.exec(SOURCE)?.[1] ?? NaN);

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('الزبائن');
  sheet.addRow(['الاسم', 'الموبايل']);
  // أسماءٌ مختلَقة، وهواتف متتابعة لا تخصّ أحدًا.
  for (let i = 1; i <= MAX + 1; i++) sheet.addRow([`زبون ${i}`, `0770${String(i).padStart(7, '0')}`]);
  await book.xlsx.writeFile(FILE);
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const until = async (fn, tries = 50) => {
    for (let i = 0; i < tries; i++) {
      const v = await fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  };
  const dialogText = () => page.eval(`return document.querySelector('[data-citizen-import]')?.innerText ?? '';`);
  const message = `في الملف أكثر من ${MAX.toLocaleString('ar-IQ')} صفّ — قسّمه ملفّين`;

  ok(`الحدّ مقروءٌ من مصدره (${MAX})`, Number.isInteger(MAX) && MAX > 0);

  await page.goto('citizens-identity-records');
  ok('«استورد من Excel» في رأس الزبائن', Boolean(await until(() => click('[data-act="citizens-import"]'))));
  ok('ونافذته تفتح', Boolean(await until(() => page.eval(`return Boolean(document.querySelector('[data-act="import-pick"]'));`))));
  await click('[data-act="import-pick"]');

  // الملف كبير: يُنتظر ظهور الرسالة بالشرط حتى دقيقة، لا بمهلةٍ ثابتة.
  const shown = await until(async () => ((await dialogText()).includes('قسّمه ملفّين') ? dialogText() : null), 300);
  ok('الملف قُرئ كلّه: اسمه وعدد صفوفه في النافذة', Boolean(shown?.includes('قائمة كبيرة') && shown?.includes(`الصفوف: ${String(MAX + 1).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])}`)));
  ok(`والرسالة ظاهرةٌ بنصّها كلّه وأرقامها هندية: «${message}»`, Boolean(shown?.includes(message)) && !/[0-9]/.test(message));
  ok('ولا خطّة تُعرض', !(await page.eval(`return Boolean(document.querySelector('[data-import-plan]'));`)));
  ok('و«استورد» معطّل', await page.eval(`return document.querySelector('[data-act="import-run"]')?.disabled === true;`));
  if (shotsDir) await page.shot(join(shotsDir, 'citizen-import-cap.png'));

  ok('ونقره لا يفعل شيئًا', await click('[data-act="import-run"]'));
  // جولةٌ في الجسر بعد النقر: لو بدأ استيرادٌ لسبقها، فما تقرؤه القاعدة بعدها نهائيّ.
  await page.eval(`await window.diwan.citizens.stats(); return true;`);
  const after = await dialogText();
  ok('والنافذة باقيةٌ برسالتها، ولا «يُستورد…» ولا «أُضيف»', after.includes(message) && !after.includes('يُستورد') && !(await page.text()).includes('أُضيف'));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const citizens = db.prepare('SELECT COUNT(*) AS n FROM citizens').get().n;
  const audit = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'citizen' AND action = 'import'").get().n;
  db.close();
  ok(`ولا زبون في السجلّ (${citizens})`, citizens === 0);
  ok(`ولا قيد استيرادٍ في سجلّ الأحداث (${audit})`, audit === 0);

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
