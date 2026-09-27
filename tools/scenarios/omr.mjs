/**
 * سيناريو: ورقة الإجابة بالدوائر — من الطباعة إلى الدرجة.
 *
 * ورقةُ الإجابة تُرسم كما تُطبع (PNG بـ٣٠٠ نقطة من محرّك الطباعة نفسه)، ثم
 * تُظلَّل دوائرها كما يظلّلها قلم، وإحداها تُمال وتُصغَّر كما يُخرجها ماسح
 * المكتب، وأخرى بيضاء بلا ورقة. فتُصحَّح من «مجلّد صورٍ ممسوحة»: الرقم والدرجة
 * والفارغ والمتعدّد صحيحة، والبيضاء تُقال ولا تُصحَّح، والجدول يُحفظ لـExcel،
 * والمفتاح يُحفظ مع الورقة.
 *
 * وهذا ما لا يبلغه فحص الوحدات: أن الورقة **المطبوعة** تطابق مخطّط القارئ.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { buildSync } from 'esbuild';
import Database from 'better-sqlite3';

const ROOT = join(process.env.TEMP ?? '.', `diwan-omr-${Date.now()}`);
const SCANS = join(ROOT, 'scans');
const SAVES = join(ROOT, 'saves');
const OMR_JS = join(ROOT, 'omr.mjs');

export function prepare() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(SCANS, { recursive: true });
  mkdirSync(SAVES, { recursive: true });
  // المخطّط من مصدره لا منسوخًا — فإن تغيّر تغيّر معه السيناريو.
  buildSync({ entryPoints: ['src/shared/omr.ts'], bundle: true, format: 'esm', platform: 'node', outfile: OMR_JS, logLevel: 'error' });
  return { DIWAN_TEST_OPEN_DIR: SCANS, DIWAN_TEST_SAVE_DIR: SAVES };
}

// ── PNG: قراءةٌ وكتابةٌ بلا مكتبة ─────────────────────────────────────

function readPng(buf) {
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') [w, h, type] = [data.readUInt32BE(0), data.readUInt32BE(4), data[9]];
    if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      row[i] = (row[i] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
    for (let x = 0; x < w; x++) out.set(row.subarray(x * bpp, x * bpp + 3), (y * w + x) * 3);
    prev = row;
  }
  return { w, h, rgb: out };
}

function writePng({ w, h, rgb }) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** يظلّل الدوائر المطلوبة بقلمٍ غامقٍ لا يملأ الدائرة تمامًا — كيد الطالب. */
function pencil(sheet, lay, marks) {
  const px = sheet.w / 210;
  const fill = (cx, cy) => {
    const [ox, oy, r] = [(cx + 0.25) * px, (cy - 0.2) * px, 1.85 * px];
    for (let y = Math.floor(oy - r); y <= oy + r; y++) {
      for (let x = Math.floor(ox - r); x <= ox + r; x++) {
        if (Math.hypot(x - ox, y - oy) <= r) sheet.rgb.set([55, 55, 70], (y * sheet.w + x) * 3);
      }
    }
  };
  for (const b of lay.answers) if ((marks.answers[b.q] ?? []).includes(b.c)) fill(b.x, b.y);
  for (const b of lay.id) if (marks.id[b.digit] === String(b.value)) fill(b.x, b.y);
  return sheet;
}

/** كما يخرج من ماسح المكتب: مائلٌ درجةً ونصفًا، بدقّة ٢٠٠، على غطاءٍ رمادي. */
function scanner(sheet) {
  const k = 200 / 300;
  const w = Math.round(sheet.w * k) + 60;
  const h = Math.round(sheet.h * k) + 60;
  const rgb = new Uint8Array(w * h * 3).fill(232);
  const t = (1.5 * Math.PI) / 180;
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / k;
      const dy = (y - h / 2) / k;
      const sx = Math.round(sheet.w / 2 + dx * cos + dy * sin);
      const sy = Math.round(sheet.h / 2 - dx * sin + dy * cos);
      if (sx >= 0 && sy >= 0 && sx < sheet.w && sy < sheet.h) rgb.set(sheet.rgb.subarray((sy * sheet.w + sx) * 3, (sy * sheet.w + sx) * 3 + 3), (y * w + x) * 3);
    }
  }
  return { w, h, rgb };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const omr = await import(pathToFileURL(OMR_JS).href);

  await page.goto('exam-papers');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="omr-open"]').click(); return true;`);
  await wait(300);
  ok('لوحة تصحيح الدوائر تُفتح من شاشة الأسئلة', await page.eval(`return Boolean(document.querySelector('[data-omr]'));`));
  ok('والتصحيح مقفلٌ حتى يكتمل المفتاح', await page.eval(`return document.querySelector('[data-act="omr-folder"]').disabled;`));

  // عشرون سؤالًا بأربعة بدائل — المفتاح أ ب ج د مكرّرًا.
  const key = Array.from({ length: 20 }, (_, q) => q % 4);
  await page.type('[data-omr-key]', key.map((k) => omr.CHOICE_LETTERS[k]).join(' '));
  ok('وينفتح حين يكتمل', await page.eval(`return !document.querySelector('[data-act="omr-folder"]').disabled;`));

  // ── الورقة كما تُطبع ─────────────────────────────────────────────
  const spec = { questions: 20, choices: 4, idDigits: 3, key };
  const html = omr.omrSheetHtml(spec, { title: 'ورقة أسئلة' });
  const saved = await page.eval(`return window.diwan.output.savePng300({ sheetHtml: ${JSON.stringify(html)}, suggestedName: 'answer-sheet', page: { w: 210, h: 297 } });`);
  const printed = readPng(readFileSync(saved));
  ok('ورقة الإجابة تُرسم بمقاس A4 على ٣٠٠ نقطة', printed.w === 2480 && printed.h === 3508);

  const lay = omr.omrLayout(spec);
  const copy = () => ({ ...printed, rgb: printed.rgb.slice() });
  const allRight = Object.fromEntries(key.map((k, q) => [q, [k]]));
  const mixed = { ...allRight, 2: [], 8: [key[8], (key[8] + 1) % 4] };
  for (let q = 10; q < 15; q++) mixed[q] = [(key[q] + 1) % 4];
  const half = Object.fromEntries(key.map((k, q) => [q, [q < 10 ? k : (k + 2) % 4]]));

  writeFileSync(join(SCANS, '1-full.png'), writePng(pencil(copy(), lay, { answers: allRight, id: '407' })));
  writeFileSync(join(SCANS, '2-mixed.png'), writePng(pencil(copy(), lay, { answers: mixed, id: '125' })));
  writeFileSync(join(SCANS, '3-tilted.png'), writePng(scanner(pencil(copy(), lay, { answers: half, id: '309' }))));
  writeFileSync(join(SCANS, '4-empty.png'), writePng({ w: 800, h: 1100, rgb: new Uint8Array(800 * 1100 * 3).fill(250) }));

  await page.eval(`document.querySelector('[data-act="omr-folder"]').click(); return true;`);
  let rows = [];
  for (let i = 0; i < 60 && rows.length < 4; i++) {
    await wait(500);
    rows = await page.eval(`return [...document.querySelectorAll('[data-omr-results] tbody tr:not([data-item])')].map((tr) => [...tr.cells].map((c) => c.innerText.trim()));`);
  }
  const row = (name) => rows.find((r) => r[0] === name) ?? [];
  ok('صُحّحت الأوراق الأربع', rows.length === 4);
  ok('الكاملة: الرقم ٤٠٧ والدرجة ٢٠ من ٢٠', row('1-full')[1] === '407' && row('1-full')[2] === '٢٠ / ٢٠ (١٠٠٪)');
  ok('المختلطة: ١٣ من ٢٠، وفارغٌ واحد ومتعدّدٌ واحد', row('2-mixed')[1] === '125' && row('2-mixed')[2] === '١٣ / ٢٠ (٦٥٪)' && row('2-mixed')[3] === '١' && row('2-mixed')[4] === '١');
  ok('المائلة من الماسح بدقّة ٢٠٠: الرقم ٣٠٩ و١٠ من ٢٠', row('3-tilted')[1] === '309' && row('3-tilted')[2] === '١٠ / ٢٠ (٥٠٪)');
  ok('والبيضاء تُقال ولا يُخترع لها جواب', (row('4-empty')[1] ?? '').includes('لم تُوجد مربّعات'));
  if (rows.length < 4 || !row('1-full')[1]) steps.push(`  … الجدول: ${JSON.stringify(rows)}`);

  // ── تحليل الأسئلة (د٩): من الأوراق الثلاث المصحّحة ─────────────────
  const items = await page.eval(`return [...document.querySelectorAll('[data-item-analysis] tr[data-item]')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()));`);
  ok(`وتحليل الأسئلة بعد التصحيح: عشرون سؤالًا (${items.length})`, items.length === 20);
  ok('الأول أصابه الجميع: سهلٌ لا يفرّق', items[0]?.[1] === '١٠٠٪' && (items[0]?.[4] ?? '').includes('سهل'));
  // الحادي عشر: الكاملة وحدها أصابته، والمختلطة والمائلة أخطأتاه ببديلين مختلفين.
  ok(`والحادي عشر أصابه الثلث، وأكثر خطئه يُسمّى (${JSON.stringify(items[10])})`, items[10]?.[1] === '٣٣٪' && (items[10]?.[3] ?? '').includes('٣٣٪'));

  // ── Excel ────────────────────────────────────────────────────────
  await page.clickText('احفظ النتائج لـExcel');
  await wait(800);
  const csvName = readdirSync(SAVES).find((f) => f.endsWith('.csv'));
  const csv = csvName ? readFileSync(join(SAVES, csvName), 'utf8') : '';
  ok('والنتائج تُحفظ CSV بعلامة UTF-8 تفتحها Excel', csv.charCodeAt(0) === 0xfeff && csv.includes('"407"') && csv.includes('"متعدّد"'));

  // ── المفتاح مع الورقة ────────────────────────────────────────────
  await page.eval(`
    const el = document.querySelector('textarea[data-question-text]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'ظلّل الإجابة الصحيحة في ورقة الإجابة');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  await page.eval(`document.querySelector('button[data-act="save"]').click(); return true;`);
  await wait(1500);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const stored = db.prepare('SELECT doc_json AS docJson FROM templates ORDER BY id DESC').get();
  db.close();
  const meta = stored ? JSON.parse(stored.docJson).meta : null;
  ok('ومفتاح الدوائر يُحفظ مع الورقة', meta?.omr?.questions === 20 && meta?.omr?.key?.join('') === key.join(''));

  rmSync(ROOT, { recursive: true, force: true });
  return steps.join('\n');
}
