/**
 * سيناريو: مكتبة الترويسات من الصفر بالضغط على الأزرار، ثم التأكّد من القاعدة.
 *
 * يبني ترويسة بأقسامها الثلاثة من **صندوق النصّ** — وهو الطريق الأصل — ويشعل
 * البسملة ويختار الخط والتصنيف، ثم يبحث ويفضّل ويكرّر. والتحقّق على القرص لا
 * في الشاشة.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** يكتب أسطر القسم الجاري في صندوق النصّ — سطرٌ لكل سطر. */
  const typeLines = async (value) => {
    const done = await page.eval(`
      const el = document.querySelector('textarea[placeholder^="جمهورية العراق"]');
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return done;
  };

  /** يضغط زرًّا بعنوانه (title) — للأزرار الأيقونية في المكتبة. */
  const clickTitle = async (title) => {
    const done = await page.eval(`
      const el = [...document.querySelectorAll('button[title]')]
        .find((b) => b.title.includes(${JSON.stringify(title)}));
      if (!el) return false;
      el.click();
      return true;
    `);
    await wait(400);
    return done;
  };

  // إلى شاشة الترويسة (الخامسة في التنقّل)
  await page.goto('header-seal-configuration');
  ok('فُتحت شاشة الترويسة', (await page.text()).includes('مصمّم الترويسة والأختام'));
  ok('تبدأ فارغة', (await page.text()).includes('منطقة الترويسة فارغة'));
  ok('الافتراض قسم واحد', (await page.text()).includes('قسم واحد'));
  ok('الافتراض صندوق النصّ', (await page.text()).includes('سطرٌ لكل سطر'));
  ok('المكتبة فارغة', (await page.text()).includes('المكتبة فارغة'));

  ok('كُتبت أسطر القسم الأول دفعةً واحدة', await typeLines('جمهورية العراق\nوزارة التربية'));

  // الحفظ بلا اسم يجب أن يُرفض — والزرّ لا يعمل إلا بعد تغيير، فالكتابة أوّلًا
  await page.clickText('حفظ الترويسة');
  ok('يرفض الحفظ بلا اسم', (await page.text()).includes('سمِّ الترويسة أولًا'));

  await page.type('input[placeholder^="مثال: مديرية"]', 'مديرية تربية بغداد / الرصافة الأولى');

  // ثلاثة أقسام: يمين ووسط ويسار
  await page.clickText('ثلاثة أقسام');
  await wait(300);
  let body = await page.text();
  ok('انقسمت الترويسة ثلاثة أقسام', body.includes('القسم الثاني') && body.includes('القسم الثالث'));
  ok('القسم الأول احتفظ بسطريه', body.includes('القسم الأول (2)'));

  // القسم الثاني
  await page.clickText('القسم الثاني');
  await wait(200);
  await typeLines('شعار الجهة');

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

  // البسملة والخط والتصنيف
  const basmalaOn = await page.eval(`
    const label = [...document.querySelectorAll('label')]
      .find((l) => (l.textContent || '').includes('البسملة فوق الترويسة'));
    const box = label && label.querySelector('input[type="checkbox"]');
    if (!box) return false;
    box.click();
    return true;
  `);
  ok('أُشعلت البسملة', basmalaOn);
  await wait(300);
  ok('ظهرت البسملة في المعاينة', (await page.text()).includes('بسم الله الرحمن الرحيم'));

  const fontSet = await page.eval(`
    const sel = [...document.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.textContent.includes('أميري')));
    if (!sel) return false;
    const opt = [...sel.options].find(o => o.textContent.includes('أميري'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  ok('اختير خطّ الترويسة', fontSet);
  await page.type('input[placeholder="مدارس"]', 'تربية');

  body = await page.text();
  ok('ظهرت أسطر القسم الأول في المعاينة', body.includes('جمهورية العراق') && body.includes('وزارة التربية'));
  ok('ظهر سطر القسم الثاني', body.includes('شعار الجهة'));
  ok('ظهر الحقل التلقائي بصيغته', body.includes('{رقم_الصادر}'));
  ok('يوسم أنها غير محفوظة', body.includes('غير محفوظة'));

  await page.clickText('حفظ الترويسة');
  await wait(800);
  ok('أكّد الحفظ', (await page.text()).includes('حُفظت الترويسة'));

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-built.png'));

  // ── التحقّق من القرص — لا من الشاشة ────────────────────────────────
  const dbPath = join(profile, 'data', 'diwan.db');
  ok('أُنشئ ملف القاعدة', existsSync(dbPath));

  const read = () => {
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare(
        'SELECT id, name, layout_json, is_default, category, is_favorite, search_fold FROM letterheads ORDER BY id'
      )
      .all();
    db.close();
    return rows;
  };

  let rows = read();
  const row = rows[0];
  ok('حُفظ السجل في القاعدة', Boolean(row));
  ok('حُفظ الاسم', row?.name === 'مديرية تربية بغداد / الرصافة الأولى');
  ok('صارت الافتراضية تلقائيًا', row?.is_default === 1);
  ok('حُفظ التصنيف', row?.category === 'تربية');
  ok('فُهرس نصّ الترويسة للبحث', (row?.search_fold ?? '').includes('جمهوريه العراق'));

  const layout = row ? JSON.parse(row.layout_json) : {};
  ok('حُفظت الأقسام الثلاثة', layout.columns === 3 && layout.sections?.length === 3);
  ok(
    'القسم الأول بسطريه بترتيبهما',
    layout.sections?.[0]?.blocks?.map((b) => b.value).join('|') === 'جمهورية العراق|وزارة التربية'
  );
  ok('القسم الثاني بسطره', layout.sections?.[1]?.blocks?.[0]?.value === 'شعار الجهة');
  ok('القسم الثالث بحقله التلقائي', layout.sections?.[2]?.blocks?.[0]?.value === '{رقم_الصادر}');
  ok('محاذاة القسم الثالث يسارًا', layout.sections?.[2]?.blocks?.[0]?.align === 'left');
  ok('حُفظت البسملة', layout.basmala?.show === true);
  ok('حُفظ الخط', layout.font === 'amiri');

  // ── المكتبة: البحث والمفضّلة والتكرار ──────────────────────────────
  await page.type('input[placeholder^="ابحث"]', 'الرصافه');
  await wait(500);
  ok(
    'البحث المتساهل مع الهمزة يجدها',
    (await page.text()).includes('مديرية تربية بغداد / الرصافة الأولى')
  );

  await page.type('input[placeholder^="ابحث"]', 'جوازات');
  await wait(500);
  ok('ولا يجد ما ليس فيها', (await page.text()).includes('لا ترويسة بهذا الوصف'));

  await page.type('input[placeholder^="ابحث"]', '');
  await wait(500);

  ok('ضُغط نجم المفضّلة', await clickTitle('أضفها إلى المفضّلة'));
  rows = read();
  ok('قُيّدت المفضّلة في القاعدة', rows[0]?.is_favorite === 1);

  ok('ضُغط زرّ النسخة', await clickTitle('نسخة منها'));
  await wait(600);
  rows = read();
  ok('أُنشئت نسخة ثانية', rows.length === 2);
  ok('النسخة باسمها المشتق', rows[1]?.name?.endsWith('— نسخة'));
  ok('النسخة لا ترث الافتراضية ولا التفضيل', rows[1]?.is_default === 0 && rows[1]?.is_favorite === 0);
  ok('النسخة ورثت التصنيف', rows[1]?.category === 'تربية');

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-library.png'));

  return steps.join('\n');
}
