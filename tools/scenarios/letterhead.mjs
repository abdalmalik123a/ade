/**
 * سيناريو: بناء ترويسة بأقسامها من الصفر بالضغط على الأزرار، ثم التأكّد أنها
 * حُفظت في القاعدة بالبنية الصحيحة. هذا اختبار للأزرار نفسها، لا للعلامات.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** يكتب في آخر حقل محتوى سطر أُضيف. */
  const typeLastLine = async (value) => {
    await page.eval(`
      const inputs = [...document.querySelectorAll('input[placeholder="اكتب محتوى السطر"]')];
      const el = inputs[inputs.length - 1];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(150);
  };

  // إلى شاشة الترويسة (الخامسة في التنقّل)
  await page.goto(4);
  ok('فُتحت شاشة الترويسة', (await page.text()).includes('مصمّم الترويسة والأختام'));
  ok('تبدأ فارغة', (await page.text()).includes('منطقة الترويسة فارغة'));
  ok('الافتراض قسم واحد', (await page.text()).includes('قسم واحد'));

  // الحفظ بلا اسم يجب أن يُرفض
  await page.clickText('سطر نصّي');
  await page.clickText('حفظ الترويسة');
  ok('يرفض الحفظ بلا اسم', (await page.text()).includes('سمِّ الترويسة أولًا'));

  await page.type('input[placeholder^="مثال: مديرية"]', 'مديرية تربية بغداد / الرصافة الأولى');
  await typeLastLine('جمهورية العراق');

  // ثلاثة أقسام: يمين ووسط ويسار
  await page.clickText('ثلاثة أقسام');
  await wait(300);
  let body = await page.text();
  ok('انقسمت الترويسة ثلاثة أقسام', body.includes('القسم الثاني') && body.includes('القسم الثالث'));
  ok('القسم الأول احتفظ بسطره', body.includes('القسم الأول (1)'));

  // سطر ثانٍ في القسم الأول
  await page.clickText('سطر نصّي');
  await typeLastLine('وزارة التربية');

  // القسم الثاني: شعار مكان الصورة (بلا حوار نظام — يُفحص وجود الزرّ فقط)
  await page.clickText('القسم الثاني');
  await wait(200);
  await page.clickText('سطر نصّي');
  await typeLastLine('شعار الجهة');

  // القسم الثالث: حقل تلقائي — رقم الصادر
  await page.clickText('القسم الثالث');
  await wait(200);
  await page.clickText('حقل تلقائي');
  await wait(200);
  const fieldSet = await page.eval(`
    const sel = [...document.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.textContent.includes('رقم الصادر')));
    if (!sel) return false;
    const opt = [...sel.options].find(o => o.textContent.includes('رقم الصادر'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  ok('أُضيف حقل تلقائي في القسم الثالث', fieldSet);
  await wait(300);

  body = await page.text();
  ok('ظهرت أسطر القسم الأول في المعاينة', body.includes('جمهورية العراق') && body.includes('وزارة التربية'));
  ok('ظهر سطر القسم الثاني', body.includes('شعار الجهة'));
  ok('ظهر الحقل التلقائي بصيغته', body.includes('{رقم_الصادر}'));
  ok('يوسم أنها غير محفوظة', body.includes('غير محفوظة'));

  await page.clickText('حفظ الترويسة');
  await wait(800);
  ok('أكّد الحفظ', (await page.text()).includes('حُفظت الترويسة'));

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-built.png'));

  // التحقّق من القرص — لا من الشاشة
  const dbPath = join(profile, 'data', 'diwan.db');
  ok('أُنشئ ملف القاعدة', existsSync(dbPath));

  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT name, layout_json, is_default FROM letterheads').get();
  db.close();

  ok('حُفظ السجل في القاعدة', Boolean(row));
  ok('حُفظ الاسم', row?.name === 'مديرية تربية بغداد / الرصافة الأولى');
  ok('صارت الافتراضية تلقائيًا', row?.is_default === 1);

  const layout = row ? JSON.parse(row.layout_json) : {};
  ok('حُفظت الأقسام الثلاثة', layout.columns === 3 && layout.sections?.length === 3);
  ok(
    'القسم الأول بسطريه بترتيبهما',
    layout.sections?.[0]?.blocks?.map((b) => b.value).join('|') === 'جمهورية العراق|وزارة التربية'
  );
  ok('القسم الثاني بسطره', layout.sections?.[1]?.blocks?.[0]?.value === 'شعار الجهة');
  ok('القسم الثالث بحقله التلقائي', layout.sections?.[2]?.blocks?.[0]?.value === '{رقم_الصادر}');
  ok('محاذاة القسم الثالث يسارًا', layout.sections?.[2]?.blocks?.[0]?.align === 'left');

  return steps.join('\n');
}
