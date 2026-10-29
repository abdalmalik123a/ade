/**
 * سيناريو: شريط الأدوات السريعة في التصاميم وتبويبات العمود.
 *
 * - أزرار الشريط تضيف نصًّا وحقلًا وشكلًا بضغطةٍ واحدة، وبلا اختصاراتٍ بحرفٍ مفرد
 *   (ضغط U أو F لا يضيف شيئًا).
 * - العمود أربعة تبويبات، وتبديلها لا يمحو ما كُتب في خانة الدفعة.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  const layers = () => page.eval(`return document.querySelectorAll('[data-layer]').length;`);
  const dock = (title) =>
    page.eval(`const b = [...document.querySelectorAll('[data-tool-dock] button')].find((x) => (x.title || '').includes(${JSON.stringify(title)})); if (!b) return false; b.click(); return true;`);
  const tab = (name) =>
    page.eval(`const b = document.querySelector(${JSON.stringify(name === 'الطبقات' ? '[data-editor-panel="fill"] [data-close-panel]' : '[data-design-panel="fill"]')}); if (!b) return false; b.click(); return true;`);

  await page.goto('designed-documents');
  await wait(800);
  await click('button[data-kind="student-id"]');
  await wait(1200);

  const base = await layers();
  ok('الشريط السريع ظاهر بسبعة أزرار', (await page.eval(`return document.querySelectorAll('[data-tool-dock] button').length;`)) === 7);

  await dock('إضافة نص');
  await wait(250);
  ok('زرّ النصّ يضيف طبقة', (await layers()) === base + 1);
  await dock('حقل متغير');
  await wait(250);
  ok('وزرّ الحقل يضيف طبقة', (await layers()) === base + 2);
  await dock('مستطيل');
  await wait(250);
  ok('وزرّ الشكل يضيف طبقة', (await layers()) === base + 3);

  // لا اختصار بحرفٍ مفرد: أخرج التركيز من أي حقل ثم اضغط.
  await page.eval(`document.activeElement?.blur?.(); return true;`);
  await page.key('KeyU');
  await page.key('KeyF');
  await wait(250);
  ok('ضغط U وF لا يضيف شيئًا', (await layers()) === base + 3);

  // التبويبات: أربعة، والتبديل يحفظ نصّ الدفعة.
  ok('خصائص وطبقات ثابتتان بلا تبويبات متنافية', await page.eval(`return !document.querySelector('[data-sidebar-tabs]') && document.querySelector('[data-design-properties]').checkVisibility() && document.querySelector('[data-design-layers]').checkVisibility();`));
  await tab('إضافة وتعبئة');
  await wait(200);
  await page.type('textarea[data-batch-text]', 'زينب علي حسن');
  await tab('الطبقات');
  await wait(200);
  ok('الطبقات ظاهرة بعد إغلاق التعبئة', await page.eval(`return Boolean(document.querySelector('[data-layer]')?.checkVisibility());`));
  await tab('إضافة وتعبئة');
  await wait(200);
  const kept = await page.eval(`return document.querySelector('textarea[data-batch-text]')?.value ?? '';`);
  ok('ونصّ الدفعة باقٍ بعد التبديل', kept.includes('زينب علي حسن'));
  return steps.join('\n');
}
