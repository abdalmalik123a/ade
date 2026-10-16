/**
 * سيناريو: الطلب يتبع الطباعة (G02، د٨) — طلبٌ بتصميمٍ ودفعة يصير «جاهزًا للتسليم» حين تُطبع دفعته كلّها من حوار ويندوز
 * («بإعدادات ويندوز…»، والطابعة `null`)؛ ويبقى على حاله حين تتوقّف الطباعة (طابعة الدور «معطّلة…»).
 *
 * بلا ورق: المِقْود يكتب كلّ ورقةٍ في سجلّ (`DIWAN_TEST_PRINT_LOG`، يُضبط هنا لا في الطرفية — L58). والطلب يُبنى بالجسر
 * (فالسيناريو يحرس الطباعة لا شاشة الطلب) ويُفتح تصميمه من بطاقته كما يفتحه الموظف. والفحص في القاعدة والسجلّ، لا الشاشة وحدها.
 * وطلبٌ «مسلَّم» لا يُفحص: لا طريق في الواجهة يفتح تصميم طلبٍ من «سُلِّمت» (فيها «أعِده إلى جاهز» وحده).
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const LOG = join(process.env.TEMP ?? '.', `diwan-order-print-${Date.now()}.jsonl`);
const DESIGN = 'هوية طلاب النور';
const LIST = ['الاسم\tالصف\tالرقم', ...Array.from({ length: 12 }, (_, i) => `طالب ${i + 1}\tالخامس\t2026-${String(i + 1).padStart(4, '0')}`)].join('\n');

export function prepare() {
  rmSync(LOG, { force: true });
  return { DIWAN_TEST_PRINT_LOG: LOG };
}

const printed = () =>
  existsSync(LOG)
    ? readFileSync(LOG, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const fromIndic = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  const status = (title) => db((d) => d.prepare('SELECT status FROM orders WHERE title = ?').get(title)?.status);
  /** ينتظر نصًّا في الشاشة — رسائل التصميم تختفي بعد ثوانٍ. */
  const awaitText = async (needle, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      if ((await page.text()).includes(needle)) return true;
      await wait(250);
    }
    return false;
  };

  // ── تصميمٌ يُحفظ، وطلبان مربوطان به بدفعةٍ من ١٢ اسمًا ──
  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="student-id"]');
  await wait(1000);
  await page.type('input[data-title]', DESIGN);
  await click('button[data-act="save"]');
  await wait(1200);
  const designId = db((d) => d.prepare('SELECT id FROM templates WHERE title = ?').get(DESIGN)?.id);
  ok('حُفظ تصميم الطلب', Number.isInteger(designId));
  await page.eval(`
    for (const title of ['هويّات الخامس', 'هويّات السادس']) {
      await window.diwan.orders.save({ id: null, clientId: null, customer: 'مدرسة النور الابتدائية', title, quantity: 12,
        templateId: ${designId ?? null}, batchText: ${JSON.stringify(LIST)} });
    }
    return true;
  `);
  ok('وسُجّل الطلبان «جديدين»', status('هويّات الخامس') === 'new' && status('هويّات السادس') === 'new');

  /** يفتح تصميم الطلب من بطاقته في «قيد العمل» — والدفعة معه — ثم «راجع الأوراق» فـ«اطبع». */
  const printOrder = async (title) => {
    await page.goto('orders-board');
    await wait(900);
    await page.eval(`
      const card = [...document.querySelectorAll('[data-order]')].find((c) => c.innerText.includes(${JSON.stringify(title)}));
      card?.querySelector('[data-act="open-design"]')?.click();
      return true;
    `);
    await wait(2500);
    const batch = await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`);
    await click('[data-act="sheets"]');
    await wait(1500);
    const of = (await page.eval(`return document.querySelector('[data-sheets]')?.innerText ?? '';`)).match(/ورقة [٠-٩]+ من ([٠-٩]+)/);
    await click('[data-act="print-sheets"]');
    await wait(800);
    return { batch, sheets: of ? fromIndic(of[1]) : 0 };
  };

  // ── من حوار ويندوز: «اطبع» ← أوّل طابعةٍ في المنتقي ← «بإعدادات ويندوز…» ──
  const a = await printOrder('هويّات الخامس');
  ok('فُتح تصميم الطلب بدفعته: ١٢ اسمًا', a.batch.includes('١٢'));
  ok(`و«راجع الأوراق» يعدّ أوراقها (${a.sheets})`, a.sheets > 0);
  ok('وسأل منتقي الطابعة لدور التصاميم', await page.eval(`return document.querySelector('[data-print-chooser]')?.getAttribute('data-print-chooser') === 'designs';`));
  let printers = 0;
  for (let i = 0; i < 20 && !printers; i++) {
    await wait(200);
    printers = await page.eval(`return document.querySelectorAll('[data-print-chooser] [data-print-printer]').length;`);
  }
  if (!printers) {
    ok('لا طابعة مثبّتة في ويندوز على هذا الجهاز — فلا يُضغط «بإعدادات ويندوز…» ولا يُفحص ما بعده', false);
    return steps.join('\n');
  }
  await click('[data-print-chooser] [data-print-printer]');
  await wait(200);
  await click('[data-act="print-system"]');
  const said = await awaitText('صار جاهزًا للتسليم');
  // وبحوار ويندوز الدفعة مهمّةٌ واحدة (`output:printJob`): سطرٌ واحد بأوراقها كلّها، لا سطرٌ لكلّ ورقة.
  const lines = printed();
  ok(
    `في السجلّ مهمّةٌ واحدة بأوراقها الـ${a.sheets}، والطابعة null وبلا صمت — حوار ويندوز`,
    lines.length === 1 && lines[0].printer === null && lines[0].silent === false
  );
  ok('والطلب في القاعدة «جاهز»', status('هويّات الخامس') === 'ready');
  ok('وقيل للموظف «صار جاهزًا للتسليم»', said);
  await page.goto('orders-board');
  await wait(900);
  ok(
    'وبطاقته في عمود «جاهز للتسليم»',
    (await page.eval(`
      const card = [...document.querySelectorAll('[data-order]')].find((c) => c.innerText.includes('هويّات الخامس'));
      return card?.closest('[data-column]')?.dataset.column ?? '';
    `)) === 'ready'
  );

  // ── الضدّ: طابعة الدور «معطّلة…» — توقّفت الطباعة، والطلب على حاله ──
  await page.eval(`return window.diwan.settings.set({ printRoles: { designs: { normal: 'معطّلة — طابعة التصاميم', color: null, dialog: false } } }).then(() => true);`);
  const before = printed().length;
  await printOrder('هويّات السادس');
  const stopped = await awaitText('توقّفت الطباعة');
  ok('وطابعةٌ معطّلة: «توقّفت الطباعة»', stopped);
  ok('وطُلبت من طابعة الدور لا من حوار', printed().slice(before).some((l) => l.printer?.startsWith('معطّلة')));
  ok('والطلب الثاني على حاله «جديد»', status('هويّات السادس') === 'new');
  ok('والأوّل باقٍ «جاهزًا»', status('هويّات الخامس') === 'ready');
  return steps.join('\n');
}
