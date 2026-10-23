/**
 * سيناريو: مقاس «مخصّص» للورقة بالمليمتر في المحرّر والطباعة (S09 · ر102).
 *
 * يفتح مصمّم النماذج، ويتحقّق من وجود خيار «مخصّص...» في قائمة المقاسات،
 * ويختاره فيفتح حوار المقاس المخصّص، ويدخل أبعادًا مليمترية (١٧٠×٢٥٠ ملم) ويطبّقها،
 * ثم يتحقّق من انعكاس المقاس على الورقة في التحرير (`[data-paper]`) وعناصر التحكّم المباشرة،
 * ويجرّب تعديل العرض من شريط الورقة مباشرةً، ثم يقلب الاتجاه إلى أفقي فينعكس المقاس،
 * ثم يعود إلى مقاسٍ قياسي (A5) لضمان عدم تأثّر المقاسات القائمة.
 * و(D135): يكتب الأبعاد في الشريط بضغطاتٍ حقيقية (Tab وEnter يعتمدان، وEsc يعيد)، ثم يحفظ النموذج بمقاس ١٠٠×١٥٠ ويعيد فتحه.
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

  // ٦. تعديل العرض من عناصر التحكّم المباشرة في شريط الورقة — يُعتمد عند ترك الخانة (D135).
  // والكتابة ثم ترك الخانة خطوتان بينهما رسم كما يفعل الإنسان: في المهمّة نفسها يعتمد `onBlur` النصّ القديم (مراجعة D135).
  await page.eval(`
    const w = document.querySelector('[data-custom-w]');
    if (w) {
      w.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(w, '185');
      w.dispatchEvent(new Event('input', { bubbles: true }));
      w.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  `);
  await wait(300);
  await page.eval(`document.querySelector('[data-custom-w]')?.blur(); return true;`);
  await wait(500);

  const inlineWidth = await page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  ok('تعديل العرض من شريط الورقة يُعتمد بترك الخانة (185 ملم)', inlineWidth === '185mm');

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

  // ٩. (D135) خانتا الشريط بضغطاتٍ حقيقية: كانت تُحصر مع كلّ حرف فصارت «150» ألفًا. والآن تتبع الكتابة وتُعتمد بـTab أو Enter، وEsc يعيد.
  const paperW = () => page.eval(`return document.querySelector('[data-paper]')?.style.width;`);
  const field = (axis) => page.eval(`return document.querySelector('[data-custom-${axis}]')?.value;`);
  /** يحدّد ما في الخانة ثم يكتب فوقه حرفًا حرفًا. */
  const keys = async (selector, text) => {
    await page.eval(`const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); return true;`);
    await page.typeKeys(selector, text);
  };
  const tab = async () => {
    const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    await wait(300);
  };
  await page.eval(`document.querySelector('[data-act="portrait"]').click(); return true;`);
  await wait(400);
  await choose('[data-act="page-size"]', 'custom');
  await wait(400);
  await page.eval(`document.querySelector('[data-act="custom-size-cancel"]')?.click(); return true;`);
  await wait(300);
  const before = await paperW();
  await keys('[data-custom-w]', '150');
  const typed = await field('w');
  const during = await paperW();
  ok(`«150» بالضغطات تبقى في الخانة كما كُتبت (${typed}) والورقة كما كانت حتى تُعتمد (${during})`, typed === '150' && during === before);
  await tab();
  const left = await page.eval(`return !document.activeElement?.matches('[data-custom-w]');`);
  ok(`وTab يعتمدها: الورقة 150 ملم (${await paperW()})`, (await paperW()) === '150mm' && (await field('w')) === '150' && left);
  await keys('[data-custom-h]', '1200');
  await page.key('Enter');
  ok(`وEnter يعتمد الارتفاع محصورًا (1200 ← ${await field('h')})`, (await field('h')) === '1000');
  await keys('[data-custom-w]', '77');
  await page.key('Escape');
  ok(
    `وEsc يعيد ما لم يُعتمد (${await field('w')}، ${await paperW()}) ولا يغلق المصمّم`,
    (await field('w')) === '150' && (await paperW()) === '150mm' && (await page.eval(`return Boolean(document.querySelector('[data-page-bar]'));`))
  );

  // ١٠. (D135) حفظ النموذج بمقاس ١٠٠×١٥٠ وإعادة فتحه: كان `normalizePage` يُسقط المقاس فيُفتح A4.
  await keys('[data-custom-w]', '100');
  await page.key('Enter');
  await keys('[data-custom-h]', '150');
  await tab();
  ok(`المقاس قبل الحفظ ١٠٠×١٥٠ (${await field('w')}×${await field('h')}، ${await paperW()})`, (await paperW()) === '100mm' && (await field('h')) === '150');
  const TITLE = 'بطاقة بمقاس مخصّص';
  // والمصمّم لا يحفظ نموذجًا بلا متن.
  await page.typeKeys('.ProseMirror', 'بطاقة دعوة');
  await page.type('input[placeholder^="مثال: تأييد"]', TITLE);
  await page.clickText('حفظ النموذج');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list()).find((x) => x.title === ${JSON.stringify(TITLE)});
    if (!t) return null;
    const d = await window.diwan.templates.doc(t.id);
    return { size: d.pageSetup.size, customSize: d.pageSetup.customSize ?? null };
  `);
  ok(`وفي القاعدة بعد الحفظ: ${JSON.stringify(saved)}`, saved?.size === 'custom' && saved?.customSize?.w === 100 && saved?.customSize?.h === 150);
  if (await page.eval(`return Boolean(document.querySelector('[data-page-bar]'));`)) {
    await page.eval(`document.querySelector('button[title="إغلاق"]')?.click(); return true;`);
    await wait(600);
  }
  await page.goto('templates-library-drafts');
  await wait(800);
  const reopened = await page.eval(`
    // زرّ «تعديل» في بطاقة النموذج: أعلى أصلٍ لا يحوي غير زرٍّ واحد منه هو البطاقة.
    const edit = [...document.querySelectorAll('button[title="تعديل صيغ المتغيرات"]')].find((b) => {
      let card = b;
      while (card.parentElement && card.parentElement.querySelectorAll('button[title="تعديل صيغ المتغيرات"]').length === 1) card = card.parentElement;
      return card.innerText.includes(${JSON.stringify(TITLE)});
    });
    edit?.click();
    return Boolean(edit);
  `);
  await wait(1500);
  ok(
    `أُعيد فتحه فالورقة بعرض 100 ملم (${await paperW()}) والخانتان ${await field('w')}×${await field('h')}`,
    reopened && (await paperW()) === '100mm' && (await field('w')) === '100' && (await field('h')) === '150'
  );

  return steps.join('\n');
}
