/**
 * سيناريو: مقاس «مخصّص» للورقة بالمليمتر في المحرّر والطباعة (S09 · ر102).
 *
 * يفتح مصمّم النماذج، ويتحقّق من وجود خيار «مخصّص...» في قائمة المقاسات،
 * ويختاره فيفتح حوار المقاس المخصّص، ويدخل أبعادًا مليمترية (١٧٠×٢٥٠ ملم) ويطبّقها،
 * ثم يتحقّق من انعكاس المقاس على الورقة في التحرير (`[data-paper]`) وعناصر التحكّم المباشرة،
 * ويجرّب تعديل العرض من شريط الورقة مباشرةً، ثم يقلب الاتجاه إلى أفقي فينعكس المقاس،
 * وأخيرًا يعود إلى مقاسٍ قياسي (A5) لضمان عدم تأثّر المقاسات القائمة.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const choose = async (selector, value) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await wait(350);
  };

  // ١. فتح مصمّم النماذج
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1200);

  ok('انفتح محرّر النموذج وظهر شريط الورقة', await page.eval(`return Boolean(document.querySelector('[data-page-bar]'));`));

  // ٢. الورقة الافتراضية A4 (عرضها 210 ملم)
  const initialWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('الورقة الافتراضية A4 بعرض 210 ملم', initialWidth === '210mm');

  // ٣. قائمة المقاسات تشمل «مخصّص...»
  const options = await page.eval(`return [...document.querySelectorAll('[data-act="page-size"] option')].map((o) => o.value);`);
  ok('قائمة المقاسات تشمل custom', options.includes('custom'));

  // ٤. اختيار مقاس مخصّص وظهور الحوار
  await choose('[data-act="page-size"]', 'custom');
  await wait(400);
  ok('ظهر حوار المقاس المخصّص', await page.eval(`return Boolean(document.querySelector('[data-custom-size-dialog]'));`));

  // ٥. إدخال الأبعاد وتطبيقها عبر الحوار
  await page.eval(`
    const w = document.querySelector('[data-dialog-custom-w]');
    const h = document.querySelector('[data-dialog-custom-h]');
    if (w) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(w, '170');
      w.dispatchEvent(new Event('input', { bubbles: true }));
      w.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (h) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(h, '250');
      h.dispatchEvent(new Event('input', { bubbles: true }));
      h.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  `);
  await wait(200);
  await page.eval(`document.querySelector('[data-act="custom-size-apply"]').click(); return true;`);
  await wait(500);

  const editCustomWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('عرض الورقة في التحرير تحدّث إلى 170 ملم', editCustomWidth === '170mm');

  const customWVal = await page.eval(`return document.querySelector('[data-custom-w]')?.value;`);
  const customHVal = await page.eval(`return document.querySelector('[data-custom-h]')?.value;`);
  ok('حقول الأبعاد المباشرة في الشريط تعكس القيم المخصّصة (170×250)', customWVal === '170' && customHVal === '250');

  // ٦. تعديل العرض من عناصر التحكّم المباشرة في شريط الورقة
  await page.eval(`
    const w = document.querySelector('[data-custom-w]');
    if (w) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(w, '185');
      w.dispatchEvent(new Event('input', { bubbles: true }));
      w.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  `);
  await wait(500);

  const inlineWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('تعديل العرض من شريط الورقة حدّث الأبعاد فورًا (185 ملم)', inlineWidth === '185mm');

  // ٧. التحويل إلى أفقي
  await page.eval(`document.querySelector('[data-act="landscape"]').click(); return true;`);
  await wait(500);

  const landWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('الاتجاه الأفقي يعكس الأبعاد بدقّة (250 ملم)', landWidth === '250mm');

  // العودة إلى الرأسي
  await page.eval(`document.querySelector('[data-act="portrait"]').click(); return true;`);
  await wait(500);

  const portWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('العودة إلى الرأسي تستعيد العرض المخصّص (185 ملم)', portWidth === '185mm');

  // ٨. العودة إلى مقاس قياسي (A5)
  await choose('[data-act="page-size"]', 'A5');
  await wait(500);

  const a5PortWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('العودة إلى A5 الرأسي سليمة (148 ملم)', a5PortWidth === '148mm');

  await page.eval(`document.querySelector('[data-act="landscape"]').click(); return true;`);
  await wait(500);

  const a5LandWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('A5 الأفقي سليم (210 ملم)', a5LandWidth === '210mm');

  return steps.join('\n');
}
