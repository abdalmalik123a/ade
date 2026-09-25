/**
 * سيناريو: الجهات والطلبات — على التطبيق الحقيقي.
 *
 * تُضاف «مدرسة الرافدين» بهاتفها وشعارٍ أزرق، فيُستخرج لونها منه. ثم يُحفظ
 * تصميم هويّةٍ لها، ويُسجَّل طلبٌ بموعده وقائمة أسمائه، ويسير في حالاته حتى يُسلَّم.
 * ثم يُفتح تصميم الطلب من بطاقته فتأتي الدفعة جاهزة، و«صمّم لها» من ملفّها يفتح
 * المعرض عليها. ويُفتّش في القاعدة: ولا عمود مبالغ في الطلبات.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import Database from 'better-sqlite3';

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([length, body, crc]);
}

/** شعارٌ أزرق على بياض — ليُستخرج لونه. */
function logoPng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const inside = (x - size / 2) ** 2 + (y - size / 2) ** 2 < (size / 3) ** 2;
      row[1 + x * 3] = inside ? 20 : 255;
      row[2 + x * 3] = inside ? 70 : 255;
      row[3 + x * 3] = inside ? 170 : 255;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-orders-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'logo.png');
  writeFileSync(file, logoPng(96));
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });

  // ── الجهة ─────────────────────────────────────────────────────────
  await page.goto('clients-directory');
  await wait(800);
  ok('للجهات شاشةٌ في الشريط', (await page.text()).includes('الجهات — مدارس ودوائر'));
  await click('[data-act="new-client"]');
  await wait(300);
  await page.type('input[data-client-name]', 'مدرسة الرافدين الابتدائية');
  await page.type('input[data-client-phone]', '0770 123 4567');
  await page.clickText('مدرسة', 'button');
  await click('[data-act="save-client"]');
  await wait(800);
  ok('أُضيفت الجهة', (await page.text()).includes('أُضيفت مدرسة الرافدين الابتدائية'));
  await click('[data-act="client-logo"]');
  await wait(1500);
  const conn = db();
  const client = conn.prepare('SELECT id, name, kind, phone, color FROM authorities').get();
  const seal = conn.prepare("SELECT kind, authority_id AS a FROM seals").get();
  conn.close();
  ok('بنوعها وهاتفها', client?.kind === 'مدرسة' && client?.phone === '0770 123 4567');
  ok('وشعارها شعارٌ مربوطٌ بها', seal?.kind === 'شعار' && seal?.a === client?.id);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt((client?.color ?? '#000000').slice(i, i + 2), 16));
  ok(`ولونها أزرقُ مستخرجٌ من الشعار (${client?.color})`, b > r && b > g);
  if (shotsDir) await page.shot(join(shotsDir, 'client-file.png'));

  // ── «صمّم لها»: المعرض عليها ───────────────────────────────────────
  await click('[data-act="design-for"]');
  await wait(1800);
  ok('و«صمّم لها» يفتح المعرض عليها', await page.eval(`
    const chip = document.querySelector('[data-client-chip]');
    return Boolean(chip && chip.className.includes('bg-primary-container'));
  `));
  ok('ولمحاته باسمها', (await page.eval(`return document.querySelector('[data-kind="student-id"]').innerText;`)).includes('مدرسة الرافدين الابتدائية'));
  ok('وبشعارها', await page.eval(`return [...document.querySelectorAll('[data-kind="student-id"] img')].some((i) => i.src.includes('diwan://store/seals/'));`));

  // يُحفظ تصميم هويّةٍ لها — ليُربط بالطلب.
  await click('button[data-kind="student-id"]');
  await wait(1000);
  await click('button[data-act="save"]');
  await wait(1200);

  // ── الطلب ─────────────────────────────────────────────────────────
  await page.goto('orders-board');
  await wait(800);
  ok('للطلبات شاشةٌ بحالاتها الأربع', (await page.eval(`return document.querySelectorAll('[data-column]').length;`)) === 4);
  await click('[data-act="new-order"]');
  await wait(600);
  await page.eval(`
    const sel = document.querySelector('select[data-order-client]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, sel.options[1].value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await page.clickText('هويّات طلاب', 'button');
  await page.type('input[data-order-quantity]', '١٢');
  await page.clickText('اليوم', '[data-order-dialog] button');
  await page.eval(`
    const sel = document.querySelector('select[data-order-design]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, sel.options[1].value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  const list = ['الاسم\tالصف\tالرقم', ...Array.from({ length: 12 }, (_, i) => `طالب ${i + 1}\tالخامس\t2026-${String(i + 1).padStart(4, '0')}`)].join('\n');
  await page.type('textarea[data-order-batch]', list);
  await click('[data-act="save-order"]');
  await wait(1000);

  const card = () =>
    page.eval(`
      const c = document.querySelector('[data-order]');
      return c ? { column: c.closest('[data-column]')?.dataset.column, due: c.querySelector('[data-due]')?.textContent, text: c.innerText } : null;
    `);
  let c = await card();
  ok('سُجّل الطلب في «جديد»', c?.column === 'new' && c.text.includes('هويّات طلاب'));
  ok('باسم الجهة وعدده وقائمته', c?.text.includes('مدرسة الرافدين') && c.text.includes('١٢') && c.text.includes('القائمة مرفقة'));
  ok('وموعده «اليوم»', c?.due === 'اليوم');
  await page.goto('orders-board');
  await wait(600);
  ok('والشريط الجانبي ينبّه: «اليوم ١»', (await page.eval(`return document.querySelector('aside [data-path="orders-board"]').innerText;`)).includes('اليوم 1'));
  if (shotsDir) await page.shot(join(shotsDir, 'orders-board.png'));

  // ── فتح تصميم الطلب: الدفعة جاهزة ─────────────────────────────────
  await click('[data-order] [data-act="open-design"]');
  await wait(2500);
  const summary = await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`);
  ok('و«التصميم» يفتحه بقائمته في الدفعة: ١٢ اسمًا', summary.includes('١٢'));
  ok('والمحرّر يُري أوّل اسمٍ منها', (await page.eval(`return document.querySelector('[data-design]').innerHTML;`)).includes('طالب 1'));

  // ── الحالات حتى التسليم ───────────────────────────────────────────
  await page.goto('orders-board');
  await wait(800);
  for (const expected of ['working', 'ready']) {
    await click('[data-order] [data-act="advance"]');
    await wait(700);
    c = await card();
    ok(`وسار إلى «${expected}»`, c?.column === expected);
  }
  await click('[data-order] [data-act="advance"]');
  await wait(800);
  ok('وسُلِّم فخرج من اللوحة', (await card()) === null);
  await click('[data-tab="delivered"]');
  await wait(700);
  ok('ويظهر في «سُلِّمت»', (await page.eval(`return document.querySelectorAll('[data-delivered]').length;`)) === 1);

  const conn2 = db();
  const order = conn2.prepare('SELECT status, delivered_at, quantity, due_date, template_id, batch_text FROM orders').get();
  const cols = conn2.prepare('PRAGMA table_info(orders)').all().map((x) => x.name);
  conn2.close();
  ok('وقُيّد التسليم بوقته', order?.status === 'delivered' && Boolean(order.delivered_at));
  ok('وبعدده وتصميمه وقائمته', order?.quantity === 12 && Boolean(order.template_id) && order.batch_text?.split('\n').length === 13);
  ok('ولا عمود مبالغ في الطلبات', !cols.some((n) => /price|fee|amount|paid|deposit/.test(n)));

  // ── زبونٌ فرد بلا جهة ─────────────────────────────────────────────
  await click('[data-tab="open"]');
  await wait(500);
  await click('[data-act="new-order"]');
  await wait(500);
  await click('[data-who="person"]');
  await wait(200);
  await page.type('input[data-order-title]', 'شهادة شكر');
  await click('[data-act="save-order"]');
  await wait(600);
  ok('ويُرفض طلبٌ بلا صاحب', (await page.text()).includes('لمن الطلب؟'));
  await page.type('input[data-order-customer]', 'أبو علي');
  await click('[data-act="save-order"]');
  await wait(800);
  ok('ويُسجَّل لزبونٍ فرد باسمه', (await page.eval(`return document.querySelector('[data-order]')?.innerText ?? '';`)).includes('أبو علي'));

  return steps.join('\n');
}
