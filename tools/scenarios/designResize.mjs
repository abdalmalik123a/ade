/**
 * سيناريو: «غيّر المقاس» (DESIGNS.md ١٫٧) — الشهادة إلى منشورٍ مربّعٍ وستوري: العناصر نفسها تتوزّع ولا تتمطّط (الوسام
 * يبقى دائرةً بالملّم)، والتراجع يعيدها بقيدٍ واحد.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const size = () => page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  const choose = (value) =>
    page.eval(`
      const s = document.querySelector('select[data-preset]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)});
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`);
  /** أبعاد كلّ عنصرٍ بالبكسل على الشاشة (مقابضه) — بمعرّفه. */
  const boxes = () => page.eval(`return Object.fromEntries([...document.querySelectorAll('[data-handle]')].map((h) => [h.dataset.handle, { w: h.offsetWidth, h: h.offsetHeight }]));`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1200);
  // أيقونةٌ مربّعة بالملّم — لتُرى أنّها لا تتمطّط.
  await click('[data-add="clipart"]');
  await wait(500);
  await click('[data-vector="star"]');
  await wait(400);
  const icon = await page.eval(`return document.querySelector('[data-handle].outline-primary')?.dataset.handle ?? null;`);
  const before = await boxes();
  const n = Object.keys(before).length;
  ok('«غيّر المقاس» فيه مقاسات الشاشة', await page.eval(`return [...document.querySelectorAll('select[data-preset] option')].some((o) => o.value === 'story');`));

  await choose('post-square');
  await wait(600);
  ok('الشهادة صارت منشورًا مربّعًا', (await size()).includes('285.8 × 285.8'));
  const after = await boxes();
  ok('بعناصرها نفسها', Object.keys(after).length === n);
  // الأيقونة المربّعة تبقى مربّعة — لا تتمطّط مع الورقة.
  ok(`والأيقونة المربّعة تبقى مربّعة (${before[icon]?.w}×${before[icon]?.h} ← ${after[icon]?.w}×${after[icon]?.h})`, Boolean(icon) && Math.abs(after[icon].w - after[icon].h) <= 2);

  await choose('story');
  await wait(600);
  ok('ثم ستوري', (await size()).includes('285.8 × 508.0'));

  await click('[data-undo]');
  await wait(300);
  await click('[data-undo]');
  await wait(400);
  ok('والتراجع يعيدها قيدًا قيدًا إلى الشهادة', (await size()).includes('297.0 × 210.0'));
  return steps.join('\n');
}
