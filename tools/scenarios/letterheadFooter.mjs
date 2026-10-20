/**
 * سيناريو: تفعيل تذييل الورقة (عنوان وهاتف المكتب) في مصمّم الترويسات وظهوره على الورقة وفي القاعدة.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // فتح شاشة الترويسات
  await page.goto('header-seal-configuration');
  await wait(500);
  ok('فُتحت شاشة مصمّم الترويسات', (await page.text()).includes('مصمّم الترويسات'));

  // كتابة اسم الترويسة ومحتواها
  await page.type('input[placeholder^="مثال: مديرية"]', 'ترويسة مكتب الفجر الرسمية');
  await wait(200);

  const typedHeader = await page.eval(`
    const el = document.querySelector('textarea[placeholder^="جمهورية العراق"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'جمهورية العراق\\nمحكمة بداءة الرصافة');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('كُتب نص الترويسة في القسم الأول', typedHeader);
  await wait(200);

  // التحقق من وجود قسم خيارات التذييل
  const hasFooterOpt = await page.eval(`return Boolean(document.querySelector('[data-footer-options]'));`);
  ok('عنصر خيارات تذييل الورقة ظاهر في المصمّم', hasFooterOpt);

  // تفعيل التذييل
  const toggleFooter = await page.eval(`
    const box = document.querySelector('input[data-act="footer-toggle"]');
    if (!box) return false;
    box.click();
    return true;
  `);
  ok('أُشعل خيار تذييل الورقة', toggleFooter);
  await wait(300);

  // إدخال نص التذييل
  const footerText = 'بغداد — شارع الرشيد | هاتف: 07701234567 | info@alfajr.iq';
  const typedFooter = await page.eval(`
    const el = document.querySelector('input[data-act="footer-text"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(footerText)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('أُدخل نص تذييل الورقة', typedFooter);
  await wait(300);

  // فحص ظهور التذييل في المعاينة الحيّة
  const previewFooterText = await page.eval(`
    const el = document.querySelector('[data-letterhead-footer]');
    return el ? el.textContent.trim() : '';
  `);
  ok('ظهر التذييل في معاينة الورقة أسفل الصفحة', previewFooterText.includes('بغداد — شارع الرشيد'));

  // حفظ الترويسة
  await page.clickText('حفظ الترويسة');
  await wait(500);
  ok('حُفظت الترويسة بنجاح', (await page.text()).includes('حُفظت الترويسة'));

  // التحقق من الحفظ في قاعدة البيانات
  const dbPath = join(profile, 'data', 'diwan.db');
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT * FROM letterheads WHERE name = ?').get('ترويسة مكتب الفجر الرسمية');
  db.close();

  ok('سُجّلت الترويسة في قاعدة البيانات', Boolean(row));
  const savedLayout = row ? JSON.parse(row.layout_json) : null;
  ok('بيانات التذييل محفوظة في layout_json', savedLayout?.footer?.show === true && savedLayout?.footer?.text.includes('07701234567'));

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-footer.png'));

  return steps.join('\n');
}
