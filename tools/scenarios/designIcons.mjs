/**
 * سيناريو: عناصر ديوان المحزومة (DESIGNS.md ١٫٤) — أيقونة الموقع للدعوة تُدرج من «رسومات» شكلًا حرًّا باسمها وتُلوَّن،
 * والبحث يجد ما يخصّ رمضان، و«المكتبة ← العناصر» تعرضها.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const setValue = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1000);
  await click('[data-add="clipart"]');
  await wait(600);
  ok('«رسومات» تعرض أيقونات ديوان', (await page.eval(`return document.querySelectorAll('[data-act="insert-vector"]').length;`)) >= 30);
  await click('[data-clipart-modal] [data-category="صور ظلّية"]');
  await wait(300);
  ok('وصنف «صور ظلّية» وحده', (await page.eval(`return [...document.querySelectorAll('[data-act="insert-vector"]')].every((b) => b.innerText.includes('صور ظلّية'));`)) && (await has('[data-vector="mosque"]')));
  await click('[data-clipart-modal] [data-category="الكل"]');
  await page.type('[data-clipart-search]', 'رمضان');
  await wait(300);
  const ramadan = await page.eval(`return [...document.querySelectorAll('[data-act="insert-vector"]')].map((b) => b.dataset.vector);`);
  ok(`والبحث «رمضان» يجد الفانوس والهلال والمسجد (${ramadan.join('، ')})`, ['lantern', 'crescent', 'mosque'].every((k) => ramadan.includes(k)));
  await page.type('[data-clipart-search]', 'موقع');
  await wait(300);
  await click('[data-vector="pin"]');
  await wait(500);
  const drawn = await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  ok('أيقونة الموقع تُدرج شكلًا حرًّا', drawn.includes('d="M50 95 C50 95 18 58 18 38'));
  ok('وباسمها في الطبقات', await page.eval(`return [...document.querySelectorAll('[data-layer]')].some((b) => b.innerText.includes('الموقع'));`));
  await setValue('input[data-act="paint-fill-color"]', '#7a1e2c');
  await wait(300);
  ok('وتُلوَّن كأيّ شكل', (await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`)).includes('fill="#7a1e2c"'));

  await page.goto('templates-library-drafts');
  await wait(500);
  await click('[data-confirm] [data-choice="discard"]');
  await page.goto('diwan-elements');
  await wait(700);
  ok('و«المكتبة ← العناصر» تعرضها', (await has('[data-elements="bundled"] [data-element="الموقع"]')) && (await has('[data-elements="bundled"] [data-element="النخلة"]')));
  return steps.join('\n');
}
