/**
 * سيناريو: الفأرة كاملة (DESIGNS.md ١٫٦) — مستطيل التحديد، وCtrl+A والتجميع وفكّه (والضغط على عضوٍ يحدّد مجموعته)،
 * والنسخ واللصق، ومقبض التدوير، والإخفاء من «الطبقات»، والتكبير بالأزرار وبـCtrl مع العجلة — ولكلّ اختصارٍ زرّه.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const count = (sel) => page.eval(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
  const key = (code, mods = {}) =>
    page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: ${JSON.stringify(code)}, ctrlKey: ${!!mods.ctrl}, shiftKey: ${!!mods.shift}, bubbles: true })); return true;`);
  /** فأرةٌ حقيقيّة الأحداث: ضغطٌ على عنصرٍ ثم تحريكٌ على المكتب ثم رفع. */
  const drag = async (downSel, from, to, mods = {}) => {
    const opt = (p) => `{ bubbles: true, clientX: ${p.x}, clientY: ${p.y}, ctrlKey: ${!!mods.ctrl}, shiftKey: ${!!mods.shift} }`;
    await page.eval(`
      document.querySelector(${JSON.stringify(downSel)}).dispatchEvent(new MouseEvent('mousedown', ${opt(from)}));
      document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mousemove', ${opt(to)}));
      return true;`);
    // يُرسم بعد الحدث لا في أثنائه.
    await wait(150);
    const during = await page.eval(`return Boolean(document.querySelector('[data-marquee]'));`);
    await page.eval(`document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup', ${opt(to)})); return true;`);
    return during;
  };
  const total = () => count('[data-layer]');
  const selected = () => count('[data-handle].outline-primary');

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1200);
  const n = await total();

  // ── مستطيل التحديد ──────────────────────────────────────────────
  const sheet = await page.eval(`const r = document.querySelector('[data-design]').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };`);
  const seen = await drag('[data-design]', { x: sheet.right - 2, y: sheet.top + 2 }, { x: sheet.left + 2, y: sheet.bottom - 2 });
  await wait(300);
  ok('مستطيل التحديد يُرى وهو يُسحب', seen);
  ok(`ويحدّد ما يمسّه (${await selected()} من ${n})`, (await selected()) >= n - 1 && (await selected()) > 1);

  // ── Ctrl+A والتجميع ─────────────────────────────────────────────
  await key('Escape');
  await key('KeyA', { ctrl: true });
  await wait(200);
  ok('Ctrl+A يحدّد الكلّ', (await selected()) === n);
  await click('[data-edit="group"]');
  await wait(300);
  ok('و«جمّع» يضعها في مجموعة (بعلامتها في الطبقات)', (await count('[data-layer-group]')) === n);
  await key('Escape');
  await page.eval(`const h = document.querySelector('[data-handle]'); const r = h.getBoundingClientRect(); h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 })); document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true;`);
  await wait(200);
  ok('والضغط على عضوٍ يحدّد مجموعته كلّها', (await selected()) === n);
  await key('KeyG', { ctrl: true, shift: true });
  await wait(300);
  ok('وCtrl+Shift+G يفكّها', (await count('[data-layer-group]')) === 0);

  // ── النسخ واللصق ───────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-layer]').click(); return true;`);
  await wait(200);
  await key('KeyC', { ctrl: true });
  await key('KeyV', { ctrl: true });
  await wait(300);
  ok('Ctrl+C ثم Ctrl+V يلصق نسخةً', (await total()) === n + 1);
  await click('[data-edit="paste"]');
  await wait(300);
  ok('وزرّ «الصق» كذلك', (await total()) === n + 2);

  // ── التدوير ─────────────────────────────────────────────────────
  const grip = await page.eval(`
    const g = document.querySelector('[data-grip="rotate"]');
    if (!g) return null;
    const r = g.getBoundingClientRect(); const box = g.parentElement.getBoundingClientRect();
    return { g: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, c: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };`);
  ok('مقبض التدوير فوق العنصر المحدَّد', Boolean(grip));
  if (grip) {
    // ربع دورةٍ مع العقارب: من فوق المركز إلى يمينه.
    await drag('[data-grip="rotate"]', grip.g, { x: grip.c.x + 80, y: grip.c.y });
    await wait(300);
    const rotated = await page.eval(`return [...document.querySelectorAll('[data-design] [style*="rotate("]')].length;`);
    ok('وسحبُه يُدير العنصر', rotated >= 1);
  }

  // ── الإخفاء ─────────────────────────────────────────────────────
  const handlesBefore = await count('[data-handle]');
  await page.eval(`document.querySelector('[data-layer-hide]').click(); return true;`);
  await wait(300);
  ok('والعين في «الطبقات» تُخفيه (لا يُرسم ولا مقبض له)', (await count('[data-handle]')) === handlesBefore - 1 && (await count('[data-layer-hide] .material-symbols-outlined')) > 0);

  // ── التكبير ─────────────────────────────────────────────────────
  const pct = () => page.eval(`return Number((document.querySelector('[data-zoom="in"]')?.nextElementSibling?.textContent ?? '').replace(/[^٠-٩0-9]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));`);
  const z0 = await pct();
  await click('[data-zoom="in"]');
  await wait(200);
  const z1 = await pct();
  ok(`زرّ التكبير يكبّر (${z0}٪ ← ${z1}٪)`, z1 > z0);
  await page.eval(`document.querySelector('[data-desk]').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true })); return true;`);
  await wait(200);
  ok('وCtrl مع العجلة يصغّر', (await pct()) < z1);
  await click('[data-zoom="fit"]');
  await wait(300);
  const z2 = await pct();
  ok(`و«بقدر الشاشة» يعيده (${z2}٪، وكان ${z0}٪)`, Math.abs(z2 - z0) <= 3);
  return steps.join('\n');
}
