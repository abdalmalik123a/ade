/**
 * سيناريو: الطلب وملفّ المدرسة يملآن التصاميم (DESIGNS.md ٣٫٥) — مدرسةٌ بملفّها (مديريتها ومديرتها) وطلبُ «بطاقات امتحانية»
 * بأربعين بلا تصميم: «صمّم» في بطاقة الطلب يفتح المعرض لها، والبطاقة الامتحانية تُفتح باسمها ومديريتها والعام الدراسي وأربعين
 * نسخة؛ وما كُتب باليد لا يطمسه «طبّق»؛ ثمّ تصميمٌ محفوظ وطلبٌ ثانٍ به وبقائمة: «التصميم» يفتحه بقائمته وملفّها يملؤه،
 * والنسخ لا تبقى أربعين. (الجهة والأسماء مختلَقة.)
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const INDIC = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const value = (key) => page.eval(`return document.querySelector('input[data-value=${JSON.stringify(key)}]')?.value ?? null;`);
  const copies = () => page.eval(`return document.querySelector('input[title="عدد النسخ"]')?.value ?? null;`);
  const now = new Date();
  const from = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const YEAR = `${INDIC(from)} – ${INDIC(from + 1)}`;
  const GOV = 'مديرية تربية بغداد الكرخ الأولى';

  await page.goto('designed-documents');
  await wait(600);
  const ids = await page.eval(`
    const c = await window.diwan.clients.save({ id: null, name: 'مدرسة النور الابتدائية', kind: 'مدرسة', address: 'بغداد — الكرخ', phone: '0770 000 0000', governorate: ${JSON.stringify(GOV)}, principal: 'سعاد كاظم جواد', schoolGender: 'المختلطة' });
    const o = await window.diwan.orders.save({ id: null, clientId: c.id, title: 'بطاقات امتحانية', quantity: 40 });
    return { client: c.id, order: o.id };`);

  // ── طلبٌ بلا تصميم: «صمّم» يفتح المعرض للمدرسة ─────────────────────
  await page.goto('orders-board');
  await wait(900);
  const label = await page.eval(`return document.querySelector('[data-order="${ids.order}"] [data-act="open-design"]')?.innerText.split('\\n').pop().trim() ?? '';`);
  ok(`طلبٌ بلا تصميمٍ لجهة: في بطاقته «${label}»`, label.includes('صمّم'));
  await click(`[data-order="${ids.order}"] [data-act="open-design"]`);
  await wait(1800);
  ok('ويفتح المعرض باسم المدرسة في لمحاته', (await page.eval(`return document.querySelector('[data-kind="exam-card"]')?.innerText ?? '';`)).includes('مدرسة النور الابتدائية'));
  await click('button[data-kind="exam-card"]');
  await wait(1500);
  ok(`والبطاقة الامتحانية: المديرية من ملفّها (${await value('المديرية')})`, (await value('المديرية')) === GOV);
  ok(`والعام الدراسي من التاريخ (${await value('العام الدراسي')})`, (await value('العام الدراسي')) === YEAR);
  ok(`وأربعون نسخة من كمّية الطلب (${await copies()})`, (await copies()) === '40');
  const said = await page.eval(`return document.body.innerText;`);
  ok('ويُقال ما مُلئ ومن أين', said.includes('من ملفّ «مدرسة النور الابتدائية»') && said.includes('٤٠ نسخة من الطلب'));
  ok('واسم المدرسة في التصميم نفسه', (await page.eval(`return document.querySelector('[data-design]').innerText;`)).includes('مدرسة النور الابتدائية'));

  // ── ما كُتب باليد لا يُطمس ─────────────────────────────────────────
  await page.type('input[data-value="المديرية"]', 'مديرية تربية الرصافة الثانية');
  await page.eval(`
    const s = document.querySelector('select[data-act="brand-client"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${ids.client}');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await wait(200);
  await click('[data-act="brand-apply"]');
  await wait(900);
  ok(`و«طقم الجهة ← طبّق» لا يطمس ما كُتب باليد (${await value('المديرية')})`, (await value('المديرية')) === 'مديرية تربية الرصافة الثانية');

  // ── تصميمٌ محفوظ وطلبٌ ثانٍ به وبقائمة ──────────────────────────────
  await page.type('input[data-title]', 'بطاقة امتحانية — النور');
  await click('button[data-act="save"]');
  await wait(1200);
  const second = await page.eval(`
    const t = (await window.diwan.templates.list(null, 'print-only')).find((x) => x.title === 'بطاقة امتحانية — النور');
    const o = await window.diwan.orders.save({ id: null, clientId: ${ids.client}, title: 'بطاقات الصفّ الخامس', quantity: 2, templateId: t.id, batchText: 'الاسم\\tالصف\\nزينب علي حسن\\tالخامس\\nسالم حسن\\tالخامس' });
    return o.id;`);
  await page.goto('orders-board');
  await wait(900);
  await click(`[data-order="${second}"] [data-act="open-design"]`);
  await wait(2500);
  const summary = await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`);
  ok(`«التصميم» يفتحه بقائمته في الدفعة (${summary.split('\n')[0]})`, summary.includes('٢'));
  ok(`وملفّ المدرسة يملأ حقوله من جديد (${await value('المديرية')})`, (await value('المديرية')) === GOV && (await value('العام الدراسي')) === YEAR);
  ok(`والنسخ لا تبقى أربعين — الطلب بقائمة (${await copies()})`, (await copies()) === '1');
  return steps.join('\n');
}
