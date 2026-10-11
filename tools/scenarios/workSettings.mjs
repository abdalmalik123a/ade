/**
 * سيناريو: قيد العمل والإعدادات (محادثة «السجلّ والزبائن وقيد العمل والإعدادات» — البندان ١٩ و٢٠ من IMPROVEMENTS.md؛ والبند ٥
 * منجزٌ في الموجة ٢ ويثبته `weekly` و`issue`).
 *
 * ١٩ — زرّ الساعة الرملية في بطاقة الطلب فعلٌ بكلمته («ينقصه شيء») ينقل الطلب إلى «ينتظر الزبون»؛ وشارة «قيد العمل» في السكّة
 *      بالرقم الهندي، وهي «مفتوح» في الصفحة نفسه، والمسودّات بجانبه بعددها لا فيه (قرار المالك د٢).
 * ٢٠ — الإعدادات بفهرسٍ في أعلاها بأسماء أقسامها، ثابتٍ وهي تُمرَّر، وكلّ اسمٍ ينقل إلى قسمه.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const indic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  // بالتاريخ المحلّي — بتوقيت المكتب لا UTC.
  const today = new Date().toLocaleDateString('en-CA');

  // طلبان مفتوحان (أحدهما موعده اليوم)، ومسودّة كتاب.
  await page.eval(`
    await window.diwan.orders.save({ id: null, clientId: null, customer: 'مدرسة النور', title: 'هويّات الطلبة', dueDate: '${today}' });
    await window.diwan.orders.save({ id: null, clientId: null, customer: 'سالم حسن', title: 'صور شخصية', quantity: 4 });
    const doc = { id: 'work-draft', schemaVersion: 2, kind: 'flow', issuing: 'registered', fields: [], meta: {},
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [{ kind: 'run', text: 'نؤيد لكم' }] }] };
    await window.diwan.drafts.save({ id: null, templateId: null, citizenId: null, title: 'تأييد', bodyHtml: 'نؤيد لكم',
      values: { __doc: JSON.stringify(doc), __letterhead: 'null', __registry: '{}', __docType: 'تأييد', __owner: 'زينب علي حسن' } });
    return true;
  `);
  await page.goto('orders-board');
  await wait(1200);

  // ── ١٩: الشارة و«مفتوح» عددٌ واحد، والمسودّات بجانبه ───────────────────
  const badge = await page.eval(`const b = document.querySelector('[data-dest="work"] [data-badge]'); return b ? { text: b.innerText.trim(), title: b.title, kind: b.dataset.badge } : null;`);
  const open = await page.eval(`const o = document.querySelector('[data-orders-summary] [data-open-count]'); return o ? { n: Number(o.dataset.openCount), text: o.innerText.trim() } : null;`);
  const drafts = await page.eval(`return document.querySelector('[data-orders-summary] [data-draft-count]')?.innerText.trim() ?? '';`);
  ok(`الشارة بالرقم الهندي «${badge?.text}» وتلميحها يقول ما تعدّ`, badge?.text === indic(2) && badge.title.includes('المسودّات لا تُعدّ') && badge.title.includes('موعده اليوم') && badge.kind === 'alert');
  ok(`و«${open?.text}» في الصفحة هو عدد الشارة نفسه`, open?.n === 2 && open.text === `مفتوح ${indic(2)}`);
  ok(`والمسودّات بجانبه بعددها لا فيه («${drafts}»)`, drafts === 'مسودّة واحدة');

  // ── ١٩: الساعة الرملية فعلٌ بكلمته ───────────────────────────────────
  const card = `[...document.querySelectorAll('[data-column="yours"] [data-order]')].find((c) => c.innerText.includes('صور شخصية'))`;
  const btn = await page.eval(`const b = ${card}?.querySelector('[data-act="wait"]'); return b ? { text: b.innerText, title: b.title } : null;`);
  ok(`زرّ الساعة الرملية بكلمته («${btn?.text.replace('hourglass_top', '').trim()}»)، وتلميحه إلى أين ينقل`, Boolean(btn?.text.includes('ينقصه شيء')) && btn.title.includes('«ينتظر الزبون»'));
  await page.eval(`${card}.querySelector('[data-act="wait"]').click(); return true;`);
  await wait(800);
  ok('والضغط ينقله إلى «ينتظر الزبون»', await page.eval(`return [...document.querySelectorAll('[data-column="customer"] [data-order]')].some((c) => c.innerText.includes('صور شخصية'));`));
  ok('ومعه «وصل ما ينقص» يعيده', await page.eval(`return [...document.querySelectorAll('[data-column="customer"] [data-order]')].find((c) => c.innerText.includes('صور شخصية'))?.querySelector('[data-act="advance"]')?.innerText.includes('وصل ما ينقص') ?? false;`));
  ok('والشارة كما هي: الطلب ما زال مفتوحًا', (await page.eval(`return document.querySelector('[data-dest="work"] [data-badge]')?.innerText.trim();`)) === indic(2));

  // ── ٢٠: فهرس الإعدادات ───────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(1200);
  const names = await page.eval(`return [...document.querySelectorAll('[data-settings-index] [data-settings-go]')].map((b) => b.innerText.trim());`);
  ok(`فهرسٌ في أعلى الإعدادات بأسماء أقسامها (${names.join('، ')})`, names.length >= 11 && names[0] === 'التفعيل' && names.includes('البيانات والنسخ الاحتياطية') && names.includes('الطابعات') && names.includes('الاختصارات الثابتة'));
  const before = await page.eval(`return document.querySelector('[data-settings-section="الاختصارات الثابتة"]').getBoundingClientRect().top;`);
  await click('[data-settings-index] [data-settings-go="الاختصارات الثابتة"]');
  await wait(1200);
  const at = await page.eval(`
    const h = document.querySelector('[data-settings-section="الاختصارات الثابتة"]').getBoundingClientRect();
    const nav = document.querySelector('[data-settings-index]').getBoundingClientRect();
    return { top: h.top, navBottom: nav.bottom, navTop: nav.top, inView: h.top >= nav.bottom - 1 && h.bottom <= innerHeight };`);
  ok(`والضغط على «الاختصارات الثابتة» ينقل إليها تحت الفهرس (${Math.round(before)} ← ${Math.round(at.top)})`, before > at.top && at.inView);
  ok('والفهرس ثابتٌ في أعلاها وهي تُمرَّر', at.navTop >= 0 && at.navTop < 120);
  await click('[data-settings-index] [data-settings-go="البيانات والنسخ الاحتياطية"]');
  await wait(1200);
  ok('و«البيانات والنسخ الاحتياطية» — وكانت في وسط الصفحة بلا طريق', await page.eval(`
    const h = document.querySelector('[data-settings-section="البيانات والنسخ الاحتياطية"]').getBoundingClientRect();
    return h.top >= document.querySelector('[data-settings-index]').getBoundingClientRect().bottom - 1 && h.top < innerHeight / 2;`));
  return steps;
}
