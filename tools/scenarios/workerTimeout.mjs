/**
 * سيناريو: مهلة العامل المستقلّ وإلغاؤه (A03 وA07، D55) — ببابي الاختبار: العامل يتأخّر ٤ ث قبل كلّ عمل (`DIWAN_TEST_SLOW_WORKER`)
 * والمهلة ٢٫٥ ث (`DIWAN_TEST_WORKER_TIMEOUT`).
 *
 * «أزل الخلفية» ← «استغرق أكثر ممّا يُحتمل — أُوقف» في النافذة، والبرنامج يعمل بعدها · ثم «أزل الخلفية» ثانيةً و«ألغِ» قبل المهلة ← النافذة
 * مغلقة، ولا «أُوقف» بعدها ولا صورةٌ تبدّلت، و`workerPing` برقم عمليةٍ جديد. والانتظار بالشرط — إلا انتظار ما بعد المهلة لإثبات غياب الرسالة.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';

const TIMED_OUT = 'استغرق أكثر ممّا يُحتمل — أُوقف';
const SLOW = 4000;
const TIMEOUT = 2500;

/** PNG رماديٌّ ٦٤×٦٤ بلا شفافية — يكفي لفتح النافذة؛ والعمل لا يبلغ النموذج قبل المهلة. */
function png(size) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size, 150);
  for (let y = 0; y < size; y++) raw[y * (size * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-workertimeout-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'كوب.png');
  writeFileSync(file, png(64));
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SLOW_WORKER: String(SLOW), DIWAN_TEST_WORKER_TIMEOUT: String(TIMEOUT) };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** ينتظر الشرط حتى مهلةٍ قصوى — ولا مهلة ثابتة بين الخطوات. */
  const until = async (check, ms = 15_000) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await check()) return true;
      if (Date.now() > end) return false;
      await wait(100);
    }
  };
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const phase = () => page.eval(`return document.querySelector('[data-cutout]')?.getAttribute('data-cutout') ?? null;`);
  const status = () => page.eval(`return document.querySelector('[data-cutout-status]')?.textContent ?? '';`);
  const imageSrc = () => page.eval(`return document.querySelector('[data-design] img')?.getAttribute('src') ?? null;`);
  const ping = () => page.eval(`return window.diwan.app.workerPing().then((r) => r.pid, (e) => String(e?.message ?? e));`);

  await page.goto('designed-documents');
  ok('شاشة التصاميم', await until(() => has('[data-act="blank-card"]')));
  await click('[data-act="blank-card"]');
  await until(() => page.eval(`return [...document.querySelectorAll('button[type="submit"]')].some((b) => b.textContent.includes('اللوحة البيضاء'));`));
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  ok('اللوحة البيضاء تُفتح', await until(() => has('[data-add="local-image"]')));
  await click('[data-add="local-image"]');
  ok('والصورة تُدرَج ومعها «أزل الخلفية»', await until(() => has('[data-act="cutout"]')));
  const original = await imageSrc();

  // ١. المهلة: العامل يتأخّر أكثر منها ← يُوقف ويُقال ذلك في النافذة.
  await click('[data-act="cutout"]');
  ok(`المهلة تُقال في النافذة: «${TIMED_OUT}»`, await until(async () => (await phase()) === 'error' && (await status()) === TIMED_OUT, 15_000));
  await click('[data-act="cutout-cancel"]');
  ok('والنافذة تُغلق بـ«ألغِ»', await until(async () => !(await has('[data-cutout]'))));
  const afterTimeout = await ping();
  ok(`والبرنامج يعمل بعدها: العامل يُجيب من جديد (${afterTimeout})`, Number.isInteger(afterTimeout));

  // ٢. الإلغاء: «ألغِ» والنموذج يعمل ← يُوقف، ولا رسالة ولا صورة بعده.
  await click('[data-act="cutout"]');
  ok('«أزل الخلفية» ثانيةً يعمل', await until(async () => (await phase()) === 'running'));
  await click('[data-act="cutout-cancel"]');
  const cancelledAt = Date.now();
  ok('و«ألغِ» قبل المهلة يغلق النافذة', await until(async () => !(await has('[data-cutout]'))));
  // و«أنا هنا» فورًا — قبل أن تنقضي المهلة: رقمٌ جديد يعني أنّ «ألغِ» قتل العامل لا المهلة.
  const afterCancel = await ping();
  const early = Date.now() - cancelledAt < TIMEOUT;
  ok(`و«أنا هنا» برقم عمليةٍ جديد قبل المهلة (${afterTimeout} ← ${afterCancel})`, early && Number.isInteger(afterCancel) && afterCancel !== afterTimeout);
  // انتظار ما بعد المهلة والتأخير معًا: لو بقي الطلب لقيلت «أُوقف» أو تبدّلت الصورة أو قُيِّدت مهلةٌ ثانية.
  await wait(SLOW + 1000);
  const text = await page.text();
  ok('ولا «أُوقف» بعده ولا خطأ', !text.includes(TIMED_OUT) && !(await has('[data-cutout]')));
  ok('ولا صورةٌ تبدّلت بجوابٍ متأخّر', (await imageSrc()) === original);
  const log = join(profile, 'logs', 'diwan-errors.log');
  const timeouts = existsSync(log) ? readFileSync(log, 'utf8').split('[worker-timeout]').length - 1 : 0;
  ok(`وفي سجلّ الأخطاء مهلةٌ واحدة لا اثنتان (${timeouts})`, timeouts === 1);

  // والشاشة تعمل بعدها: تنقّلٌ وقراءة.
  await page.goto('templates-library-drafts');
  ok('والمكتبة تُفتح بعدها', await until(() => has('[data-act="new-blank"]')));
  return steps.join('\n');
}
