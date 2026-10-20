/**
 * سيناريو: تباعد الفقرات قبل وبعد في شريط المحرّر (S11).
 *
 * يفتح مصمّم النماذج، ويتحقّق من وجود قائمة تباعد الفقرات `[data-act="paragraph-spacing"]`،
 * ويكتب فقرة، ثم يضبط التباعد إلى ١٢ نقطة ويتحقّق من ظهور `margin-bottom: 12px` على الفقرة،
 * ثم يغيّره إلى ١٨ نقطة، وأخيرًا يعيده إلى ٠ ويتحقّق من اختفاء `margin-bottom` تمامًا.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const choose = async (selector, value) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('not found: ' + ${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await wait(350);
  };

  const type = async (text) => {
    await page.send('Input.insertText', { text });
    await wait(300);
  };

  // ١. فتح مصمّم النماذج
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1200);

  ok('انفتح محرّر النموذج وظهرت أداة تباعد الفقرات', await page.eval(`return Boolean(document.querySelector('[data-act="paragraph-spacing"]'));`));

  // ٢. خيارات قائمة تباعد الفقرات تشمل 0، 6، 12، 18
  const options = await page.eval(`return [...document.querySelectorAll('[data-act="paragraph-spacing"] option')].map((o) => o.value);`);
  ok('خيارات تباعد الفقرات تشمل 0 و6 و12 و18', ['0', '6', '12', '18'].every((v) => options.includes(v)));

  // ٣. كتابة نصّ في الفقرة الأولى
  await page.eval(`
    const ed = document.querySelector('[data-page-editor]');
    if (ed) ed.focus();
    return true;
  `);
  await wait(200);
  await type('الفقرة الأولى لاختبار تباعد الفقرات');
  await wait(300);

  // ٤. تباعد الفقرة الافتراضي ليس فيه margin-bottom
  const initialStyle = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تبدأ بلا تباعد (بلا margin-bottom)', !initialStyle.includes('margin-bottom'));

  // ٥. اختيار تباعد 12 نقطة
  await choose('[data-act="paragraph-spacing"]', '12');
  await wait(400);

  const style12 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تأخذ تباعد 12 بكسل (margin-bottom: 12px)', style12.includes('margin-bottom:12px') || style12.includes('margin-bottom: 12px'));

  // ٦. اختيار تباعد 18 نقطة
  await choose('[data-act="paragraph-spacing"]', '18');
  await wait(400);

  const style18 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تأخذ تباعد 18 بكسل (margin-bottom: 18px)', style18.includes('margin-bottom:18px') || style18.includes('margin-bottom: 18px'));

  // ٧. إعادة التباعد إلى 0 (إلغاء التباعد)
  await choose('[data-act="paragraph-spacing"]', '0');
  await wait(400);

  const style0 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('إعادة التباعد إلى 0 تزيل margin-bottom تمامًا', !style0.includes('margin-bottom'));

  return steps.join('\n');
}
