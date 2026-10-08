/**
 * سيناريو: «قيد العمل» يمتلئ وحده (المرحلة ٣ من UPGRADE.md — ن١٤).
 *
 * معاملةٌ تُعلَّق في الشبّاك، ومسودة كتابٍ تُترك في المحرّر — فتظهران في قيد العمل بلا يد: المعلّقة
 * في «ينتظر الزبون» والمسودة في «عليك أن تكمله»، ولكلٍّ زرّه. و«استأنف» يعيد المعاملة إلى الشبّاك
 * من حيث تُركت. ثم معاملةٌ في وسطها والبرنامج يُغلق: تُعلَّق قبل الإغلاق، وتنتظر بعد إعادة الفتح.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = `
  const run = (text) => ({ kind: 'run', text });
  const ref = (key) => ({ kind: 'field', id: key, ref: key });
  await window.diwan.templates.save({
    id: null, code: null, title: 'تأييد دوام', subtitle: null, category: null, subjectLine: null,
    letterheadId: null, bodyHtml: 'نؤيد أن {الاسم} مستمر بالدوام.', variables: [],
    doc: {
      id: 'work-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [run('نؤيد أن '), ref('الاسم'), run(' مستمر بالدوام.')] }],
      fields: [{ id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' }],
      meta: {}
    }
  });
  return true;
`;

/** يملأ الاسم في ورقة الإدخال. */
const NAME = (value) => `
  const label = [...document.querySelectorAll('[data-screen="service"] label')].find((l) => l.querySelector('span')?.textContent.trim().startsWith('الاسم'));
  const input = label?.querySelector('input');
  if (!input) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
`;

async function openFill(page) {
  await page.goto('templates-library-drafts');
  await sleep(400);
  await page.goto('service-counter');
  await sleep(900);
  await page.clickText('تأييد دوام', '[data-template-card]');
  await sleep(300);
  await page.clickText('املأ (1)');
  await sleep(1200);
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const column = (col, kind) => page.eval(`return [...document.querySelectorAll('[data-column="${col}"] [data-pending="${kind}"]')].map((c) => c.innerText);`);

  await page.eval(SEED);

  // ── معاملةٌ تُعلَّق ───────────────────────────────────────────────
  await openFill(page);
  ok('كُتب اسم الزبون', await page.eval(NAME('علي حسن كاظم')));
  await page.eval(`document.querySelector('[data-screen="service"] [data-act="park"]').click(); return true;`);
  await sleep(600);

  // ── مسودة كتابٍ تُترك ─────────────────────────────────────────────
  await page.goto('smart-editor-a4-preview');
  await sleep(800);
  await page.type('[data-editor-owner]', 'زينب علي');
  await sleep(500);
  await page.goto('orders-board');
  await sleep(1200);

  const waiting = await column('customer', 'resume-parked');
  const yours = await column('yours', 'resume-draft');
  ok('المعلّقة في «ينتظر الزبون» بلا يد', waiting.some((t) => t.includes('علي حسن كاظم')));
  ok('والمسودة في «عليك أن تكمله»', yours.some((t) => t.includes('زينب علي')));
  // د٢ (قرار المالك): المسودّات لا تُعدّ في رقم السكّة — المعلّقة وحدها هنا (ولا طلبات).
  const badge = await page.eval(`return Number(document.querySelector('[data-dest="work"] [data-badge]')?.innerText ?? 0);`);
  ok(`والسكّة تعدّ المعلّقة على «قيد العمل» لا المسودّة (${badge})`, badge === 1);

  // ── د٢: المسودّة تُحذف بسؤالها ───────────────────────────────────
  const draftCard = `[...document.querySelectorAll('[data-column="yours"] [data-pending="resume-draft"]')].find((c) => c.innerText.includes('زينب علي'))`;
  ok('للمسودّة زرّ حذف', await page.eval(`return Boolean(${draftCard}?.querySelector('[data-act="delete-draft"]'));`));
  await page.eval(`${draftCard}.querySelector('[data-act="delete-draft"]').click(); return true;`);
  await sleep(500);
  ok('ويسأل قبل الحذف', (await page.eval(`return document.querySelector('[data-confirm]')?.innerText ?? '';`)).includes('أتحذف المسودّة'));
  await page.eval(`document.querySelector('[data-confirm] [data-choice="no"]').click(); return true;`);
  await sleep(500);
  ok('و«لا» تُبقيها', (await column('yours', 'resume-draft')).some((t) => t.includes('زينب علي')));
  const draftsBefore = await page.eval(`return (await window.diwan.drafts.list()).length;`);
  await page.eval(`${draftCard}.querySelector('[data-act="delete-draft"]').click(); return true;`);
  await sleep(500);
  await page.eval(`document.querySelector('[data-confirm] [data-choice="yes"]').click(); return true;`);
  await sleep(900);
  ok('و«احذفها» تحذفها من «قيد العمل» ومن القاعدة', !(await column('yours', 'resume-draft')).some((t) => t.includes('زينب علي')) && (await page.eval(`return (await window.diwan.drafts.list()).length;`)) === draftsBefore - 1);

  // ── «استأنف» يعيدها إلى الشبّاك من حيث تُركت ───────────────────────
  await page.eval(`[...document.querySelectorAll('[data-column="customer"] [data-pending="resume-parked"]')].find((c) => c.innerText.includes('علي حسن كاظم')).querySelector('[data-act="resume-parked"]').click(); return true;`);
  await sleep(1500);
  const back = await page.eval(`
    const label = [...document.querySelectorAll('[data-screen="service"] label')].find((l) => l.querySelector('span')?.textContent.trim().startsWith('الاسم'));
    return { here: document.querySelector('[data-dest="service"]')?.getAttribute('aria-current'), name: label?.querySelector('input')?.value ?? '' };
  `);
  ok('«استأنف» يفتح الشبّاك على المعاملة باسمها', back.here === 'page' && back.name === 'علي حسن كاظم');
  ok('وتخرج من المعلّقات', (await page.eval(`return (await window.diwan.service.parked()).length;`)) === 0);

  // ── معاملةٌ في وسطها والبرنامج يُغلق ────────────────────────────────
  await page.eval(NAME('سجاد محمد'));
  await sleep(300);
  await page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50); 1' });
  await sleep(4000);
  return steps.join('\n');
}

export async function afterRestart(page) {
  const list = await page.eval(`return (await window.diwan.service.parked()).map((p) => p.label);`);
  return `${list.includes('سجاد محمد') ? '✓' : '✗'} معاملةٌ في وسطها حين أُغلق البرنامج: عُلّقت وتنتظر في «قيد العمل» (${JSON.stringify(list)})`;
}
