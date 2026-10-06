/**
 * سيناريو: وصل استلام الطلب (الموجة ٢) — خيارٌ مطفأ في الأصل.
 *
 * مطفأً لا يُرى منه شيء. ثم يُكتب هاتف المكتب وعنوانه ويُشغَّل الوصل من الإعدادات، فيُسجَّل طلبٌ بما تركه الزبون
 * و«سجّل واطبع الوصل»: يخرج على طابعة «الكتب والمعاملات» باسم المكتب وهاتفه وعنوانه، ورقم الطلب، والزبون، والمطلوب، وما
 * تركه، وموعده — بلا مبالغ. ويُعاد طبعه من بطاقته، ورقمه وحده يجد الطلب في البحث، والورقتان في ملخّص الأسبوع. ثم يُطفأ
 * فيختفي. ومعه إصلاح «النسخ المطبوعة» في «السجلّ» (طلب المالك: «أصلحها مع الوصل»): معاملةٌ تُطبع فينفد الورق عند ثالثتها
 * ثم تُستأنف، وأخرى تُحفظ بلا طباعة — فلكلّ كتابٍ ما طُبع منه فعلًا.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.TEMP ?? '.', `diwan-receipt-${Date.now()}`);
const LOG = join(DIR, 'prints.jsonl');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  return { DIWAN_TEST_PRINT_LOG: LOG };
}

/** ما أُرسل إلى الطابعة — من سجلّ الاختبار (أوّل ٤٠٠ حرفٍ من نصّ كلّ ورقة). */
const prints = () => {
  try {
    return readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector('${sel}'));`);
  const clickIn = (scope, text) =>
    page.eval(`const b = [...document.querySelectorAll('${scope} button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); b?.click(); return Boolean(b);`);

  // طابعة «الكتب والمعاملات» واحدة: تطبع بلا سؤال.
  await page.eval(`return window.diwan.settings.set({ printRoles: { documents: { normal: 'طابعة الاختبار', color: null, dialog: false } } }).then(() => true);`);

  // ── مطفأ ─────────────────────────────────────────────────────────────
  await page.goto('orders-board');
  await click('[data-act="new-order"]');
  await wait(500);
  ok('مطفأٌ في الأصل: لا خانة «ما تركه» ولا «واطبع الوصل»', (await has('[data-order-dialog]')) && !(await has('[data-order-received]')) && !(await has('[data-act="save-order-receipt"]')));
  await clickIn('[data-order-dialog]', 'إلغاء');
  await wait(300);

  // ── الإعدادات: هاتف المكتب وعنوانه، والوصل ────────────────────────────
  await page.goto('office-settings');
  await page.type('input[data-setting="officeName"]', 'مكتب النور للاستنساخ');
  await page.type('input[data-setting="officePhone"]', '07801112233');
  await page.type('input[data-setting="officeAddress"]', 'بغداد — الكرادة');
  await click('[data-act="save-settings"]');
  await wait(600);
  await click('[data-setting="receiptSlip"]');
  await wait(600);
  const saved = await page.eval(`return window.diwan.settings.get();`);
  ok('وفي الإعدادات: هاتف المكتب وعنوانه، والوصل يُشغَّل', saved.officePhone === '07801112233' && saved.officeAddress === 'بغداد — الكرادة' && saved.receiptSlip === true);
  if (shotsDir) await page.shot(join(shotsDir, 'receipt-settings.png'));

  // ── طلبٌ بوصله ───────────────────────────────────────────────────────
  await page.goto('orders-board');
  await click('[data-act="new-order"]');
  await wait(500);
  await click('[data-who="person"]');
  await wait(200);
  await page.type('input[data-order-customer]', 'سالم حسن');
  await page.type('input[placeholder="هاتفه"]', '07701234567');
  await page.type('input[data-order-title]', 'هويّات الطلبة');
  await page.type('input[data-order-quantity]', '40');
  ok('مشغَّلًا: خانة «ما تركه الزبون عندنا»', await has('[data-order-received]'));
  await page.type('input[data-order-received]', 'هوية موحّدة و٤ صور');
  await clickIn('[data-order-dialog]', 'غدًا');
  if (shotsDir) await page.shot(join(shotsDir, 'receipt-dialog.png'));
  await click('[data-act="save-order-receipt"]');
  await wait(1500);

  const first = prints().at(-1);
  const text = first?.text ?? '';
  ok('«سجّل واطبع الوصل»: يُسجَّل ويخرج على طابعة «الكتب والمعاملات»', prints().length === 1 && first?.printer === 'طابعة الاختبار');
  const missing = ['مكتب النور للاستنساخ', '07801112233', 'بغداد — الكرادة', 'وصل استلام', 'نسخة الزبون', 'سالم حسن — 07701234567', 'هويّات الطلبة — العدد 40', 'هوية موحّدة و٤ صور', 'موعد التسليم'].filter((p) => !text.includes(p));
  ok(`فيه المكتب والزبون والمطلوب وما تركه وموعده${missing.length ? ` — ينقص: ${missing.join('، ')}` : ''}`, missing.length === 0);
  ok('بلا مبالغ', !/دينار|المبلغ|السعر|الأجرة/.test(text));
  ok('ويُقال إنّه طُبع', (await page.text()).includes('طُبع وصل الاستلام رقم'));

  const id = await page.eval(`return Number(document.querySelector('[data-order]')?.dataset.order);`);
  ok('ورقم الوصل رقم الطلب', text.includes(`رقم ${id}`));
  await page.eval(`document.querySelector('[data-order="${id}"] [data-act="print-receipt"]').click(); return true;`);
  await wait(1200);
  ok('وزرّ «الوصل» على البطاقة يعيد طبعه', prints().length === 2 && prints().at(-1).text.includes(`رقم ${id}`));

  await page.eval(`return window.diwan.orders.save({ id: null, clientId: null, customer: 'زينب كاظم', title: 'صور شخصية' }).then(() => true);`);
  await page.type('input[data-orders-search]', String(id));
  await wait(700);
  ok('ورقمه وحده يجد الطلب حين يعود الزبون بوصله', JSON.stringify(await page.eval(`return [...document.querySelectorAll('[data-order]')].map((e) => Number(e.dataset.order));`)) === JSON.stringify([id]));
  await page.type('input[data-orders-search]', '');
  await wait(500);

  const week = await page.eval(`return (await window.diwan.today.agenda()).week.thisWeek;`);
  ok('والورقتان في ملخّص الأسبوع', week.sheets === 2);

  // ── ويُطفأ ───────────────────────────────────────────────────────────
  await page.goto('office-settings');
  await click('[data-setting="receiptSlip"]');
  await wait(600);
  await page.goto('orders-board');
  await wait(500);
  ok('مطفأً: لا زرّ وصلٍ على البطاقات', (await has('[data-order]')) && !(await has('[data-act="print-receipt"]')));
  await page.eval(`document.querySelector('[data-order="${id}"] button.block')?.click(); return true;`);
  await wait(500);
  ok('ولا خانة في الطلب — وما كُتب فيه باقٍ', !(await has('[data-order-received]')) && (await page.eval(`return window.diwan.orders.list({ status: 'open' }).then((l) => l.find((o) => o.id === ${id})?.received);`)) === 'هوية موحّدة و٤ صور');
  await click('[data-act="save-order"]');
  await wait(600);
  ok('وحفظه وهو مطفأ لا يمحو ما تركه الزبون', (await page.eval(`return window.diwan.orders.list({ status: 'open' }).then((l) => l.find((o) => o.id === ${id})?.received);`)) === 'هوية موحّدة و٤ صور');

  // ── «النسخ المطبوعة» في «السجلّ»: ما طُبع فعلًا ──────────────────────────
  const tx = await page.eval(`
    const sheet = (n) => ({ sheetHtml: '<div class="a4-sheet"><p>ورقة ' + n + '</p></div>', templateId: null, letterheadId: null, authorityId: null,
      docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0 });
    const common = { citizenId: null, nationalId: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, gregorianDate: '', hijriDate: null };
    const kept = await window.diwan.documents.issueTransaction({ ...common, citizenName: 'كريم علي', sheets: [sheet(1)] });
    const done = await window.diwan.documents.issueTransaction({ ...common, citizenName: 'سالم حسن', sheets: [sheet(1), sheet(2), sheet(3)] });
    const ids = [...done.documents.map((d) => d.id), kept.documents[0].id];
    const copies = () => Promise.all(ids.map(async (id) => (await window.diwan.documents.get(id)).printedCopies));
    const first = await window.diwan.documents.printIssued({ ids: ids.slice(0, 3), printer: 'تتوقّف عند الثالثة', mode: 'full', label: 'معاملة' });
    const before = await copies();
    const resumed = await window.diwan.output.resumeJob(first.id, first.sent);
    return { first, resumed, before, after: await copies() };`);
  ok(`طُبعت ورقتان ثم نفد الورق: النسخ لهما وحدهما (${JSON.stringify(tx.before)})`, tx.first.ok === false && tx.first.sent === 2 && JSON.stringify(tx.before) === '[1,1,0,0]');
  ok(`والاستئناف يقيّد الثالثة، والمحفوظة بلا طباعة لا نسخة لها (${JSON.stringify(tx.after)})`, tx.resumed.ok === true && JSON.stringify(tx.after) === '[1,1,1,0]');

  return steps.join('\n');
}
