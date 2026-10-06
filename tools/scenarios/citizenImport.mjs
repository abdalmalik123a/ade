/**
 * سيناريو: استيراد الزبائن من Excel (الموجة ٢، «كلفة الانتقال») على التطبيق الحقيقي.
 *
 * دائرةٌ ترسل قائمة موظفيها: الاسم مفرّقٌ في أعمدة، والعنوان كذلك، وعمود تسلسلٍ وعمود «الصف». وفي السجلّ
 * زينب من قبل، بهاتفٍ كتبه المكتب وبلا عنوان. فيُستورد الملف من «الزبائن»: الأعمدة تُعرف وحدها، و«الصف»
 * يُربط بالتصنيف باليد، والخطّة تقول «جديدان، وموجودٌ يُكمل» — ثم الاستيراد: لا تتكرّر زينب، وفارغها يُكمل
 * وهاتفها ورقمها باقيان. ومرّةً ثانية يُتذكّر الربط ولا جديد يُستورد.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-citizen-import-${Date.now()}`);
const FILE = join(DIR, 'قائمة موظفي المديرية.xlsx');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('الموظفون');
  sheet.addRow(['ت', 'الاسم', 'اسم الأب', 'اسم الجد', 'اللقب', 'رقم الهوية', 'الموبايل', 'التولد', 'المحلة', 'الزقاق', 'الدار', 'الصف']);
  sheet.addRow([1, 'علي', 'حسين', 'كاظم', 'الربيعي', '199912345678', '07701234567', new Date(Date.UTC(1999, 2, 1)), 612, 14, 7, 'الثالث']);
  sheet.addRow([2, 'زينب', 'محمد', 'جاسم', '', '200011112222', '07801112222', 2000, 305, 9, 11, 'الثالث']);
  sheet.addRow([3, 'حسن', 'علي', 'عباس', 'التميمي', '199833334444', '', '', '', '', '', 'الرابع']);
  await book.xlsx.writeFile(FILE);
  // «افتح» بلا حوار: قارئ Excel يأخذ هذا الملف.
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const until = async (fn, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      const v = await fn();
      if (v) return v;
      await wait(200);
    }
    return null;
  };
  const targets = () => page.eval(`return [...document.querySelectorAll('[data-import-target]')].map((s) => s.value);`);
  const planOf = () =>
    page.eval(`
      const p = document.querySelector('[data-import-plan]');
      if (!p) return null;
      return Object.fromEntries([...p.querySelectorAll('[data-plan]')].map((r) => [r.dataset.plan, r.innerText]));`);

  // زينب في السجلّ من قبل: هاتفٌ كتبه المكتب، ولا عنوان.
  await page.eval(`
    await window.diwan.citizens.save({ id: null, fullName: 'زينب محمد جاسم', nationalId: '200011112222', phone: '07999999999', verified: false });
    return true;`);

  await page.goto('citizens-identity-records');
  await wait(800);
  ok('«استورد من Excel» في رأس الزبائن', await click('[data-act="citizens-import"]'));
  await wait(400);
  ok('ونافذته تفتح', await page.eval(`return Boolean(document.querySelector('[data-citizen-import]'));`));
  await click('[data-act="import-pick"]');
  const auto = await until(async () => {
    const t = await targets();
    return t.length ? t : null;
  });
  ok(
    `الأعمدة تُعرف وحدها: الاسم المفرّق، واللقب، والهوية، والموبايل، والتولد، والعنوان (${JSON.stringify(auto)})`,
    JSON.stringify(auto) ===
      JSON.stringify(['', 'fullName', 'fullName', 'fullName', 'surname', 'nationalId', 'phone', 'birthDate', 'address', 'address', 'address', ''])
  );
  ok('واسم الملف وعدد صفوفه ظاهران', (await page.eval(`return document.querySelector('[data-citizen-import]').innerText;`)).includes('قائمة موظفي المديرية'));

  // «الصف» يُربط بالتصنيف باليد.
  await page.eval(`
    const sel = document.querySelector('[data-import-target="11"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'category');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  const plan = await until(async () => {
    const p = await planOf();
    return p?.added && p?.completed ? p : null;
  });
  ok(`والخطّة قبل الاستيراد: جديدان، وموجودٌ يُكمل فارغه (${JSON.stringify(plan)})`, Boolean(plan?.added?.includes('٢') && plan?.completed?.includes('١')));
  if (shotsDir) await page.shot(join(shotsDir, 'citizen-import.png'));

  await click('[data-act="import-run"]');
  const toast = await until(async () => {
    const text = await page.text();
    return text.includes('أُضيف ٢') ? text : null;
  });
  ok('واستورد: «أُضيف ٢، وأُكمل ١ ملفًّا موجودًا»', Boolean(toast?.includes('وأُكمل ١')));
  ok('والنافذة أُغلقت', !(await page.eval(`return Boolean(document.querySelector('[data-citizen-import]'));`)));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const rows = db.prepare('SELECT full_name AS name, national_id AS nid, phone, address, birth_date AS born, category FROM citizens ORDER BY id').all();
  const audit = db.prepare("SELECT detail FROM audit_log WHERE entity = 'citizen' AND action = 'import'").all();
  db.close();
  const zainab = rows.find((r) => r.name === 'زينب محمد جاسم');
  const ali = rows.find((r) => r.name === 'علي حسين كاظم الربيعي');
  ok(`ثلاثة ملفّات لا أربعة — زينب لم تتكرّر (${rows.length})`, rows.length === 3);
  ok('وفارغها أُكمل وهاتفها ورقمها باقيان', zainab?.phone === '07999999999' && zainab?.nid === '200011112222' && zainab?.address === 'محلة 305 زقاق 9 دار 11');
  ok(`وعلي باسمه الرباعي وتولده يومًا وتصنيفه من «الصف» (${ali?.born})`, ali?.born === '1999/03/01' && ali?.category === 'الثالث' && ali?.address === 'محلة 612 زقاق 14 دار 7');
  ok('وقُيّد في سجلّ الأحداث', audit.length === 1 && audit[0].detail.includes('قائمة موظفي المديرية'));

  await page.eval(`
    const input = document.querySelector('input[placeholder^="ابحث بالاسم"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'الربيعي');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  ok('والبحث في الزبائن يجده', Boolean(await until(async () => (await page.text()).includes('علي حسين كاظم الربيعي'))));

  // مرّةً ثانية: الربط محفوظ (والصف تصنيف)، ولا جديد يُستورد.
  await click('[data-act="citizens-import"]');
  await wait(300);
  await click('[data-act="import-pick"]');
  const again = await until(async () => {
    const t = await targets();
    return t.length ? t : null;
  });
  ok('ومرّةً ثانية يُتذكّر الربط: «الصف» تصنيف', again?.[11] === 'category');
  const second = await until(async () => {
    const p = await planOf();
    return p?.unchanged ? p : null;
  });
  ok(
    'ولا جديد: الثلاثة موجودون، و«استورد» معطّل',
    Boolean(second?.unchanged?.includes('٣')) && (await page.eval(`return document.querySelector('[data-act="import-run"]').disabled;`))
  );
  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
