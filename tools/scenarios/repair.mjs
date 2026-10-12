/**
 * سيناريو: «رمّم» (البند ٤٠) — على صورٍ مولَّدة.
 *
 * ١. **«حسّن الصورة» في التصاميم**: قماشٌ مخطّطٌ بضجيجٍ عليه بقعتان حمراوان. فرشاة «رمّم» على الأولى تملؤها من جوارها
 *    (لا حمرة)، و«تراجع» يعيدها، ثم بعد ربع دورةٍ تقع الفرشاة على الثانية في موضعها المدوَّر؛ و«استعمل الصورة» تحفظها
 *    بلا البقعتين.
 * ٢. **الصور الشخصية**: صورة المعاملة المولَّدة ببقعةٍ أرجوانية على الرقبة تحت الذقن (تُرسم في الصفحة). خطّ الذقن ظاهرٌ
 *    حدًّا، والفرشاة فوقه على الوجه لا تغيّر شيئًا ويُقال لماذا، وتحته تملأ البقعة بلون الجلد، و«تراجع» يعيدها.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DIR = join(process.env.TEMP ?? '.', `diwan-repair-${Date.now()}`);
const FILE = join(DIR, 'قماش.png');
const W = 360;
const H = 240;
const A = [90, 120];
const B = [270, 80];

function png(width, height, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function prepare() {
  mkdirSync(DIR, { recursive: true });
  const rgb = Buffer.alloc(W * H * 3);
  let seed = 9;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 17) - 8;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const spot = Math.hypot(x - A[0], y - A[1]) < 9 || Math.hypot(x - B[0], y - B[1]) < 9;
      const n = noise();
      const c = spot ? [215, 35, 40] : Math.floor((x + y) / 10) % 2 ? [150 + n, 138 + n, 118 + n] : [112 + n, 102 + n, 86 + n];
      c.forEach((v, k) => (rgb[(y * W + x) * 3 + k] = Math.max(0, Math.min(255, v))));
    }
  }
  writeFileSync(FILE, png(W, H, rgb));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const red = (c) => c && c[0] - c[1] > 70;

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const exists = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const until = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await page.eval(`return Boolean(${expr});`)) return true;
      await wait(250);
    }
    return false;
  };
  const setValue = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);
  /** دائرةٌ صغيرة بالفرشاة حول نقطةٍ من عنصر (نِسَبٌ من عرضه وارتفاعه). */
  const scrub = (sel, fx, fy, r = 0.015) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      const b = el.getBoundingClientRect();
      const at = (x, y, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: b.left + b.width * x, clientY: b.top + b.height * y, buttons: type === 'mouseup' ? 0 : 1 }));
      at(${fx}, ${fy}, 'mousedown');
      for (let a = 0; a <= 6.3; a += 0.6) at(${fx} + Math.cos(a) * ${r}, ${fy} + Math.sin(a) * ${r} * b.width / b.height, 'mousemove');
      at(${fx}, ${fy}, 'mouseup');
      return true;`);

  // ── ١. «حسّن الصورة» في التصاميم ───────────────────────────────────────
  const preview = (fx, fy) =>
    page.eval(`
      const c = document.querySelector('[data-photo-preview]');
      const d = c.getContext('2d').getImageData(Math.round(c.width * ${fx}) - 1, Math.round(c.height * ${fy}) - 1, 3, 3).data;
      const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) s[j] += d[i + j];
      return s.map((v) => Math.round(v / 9));`);
  await page.goto('designed-documents');
  await wait(700);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await click('[data-add="local-image"]');
  await wait(1200);
  await click('[data-act="photo-edit"]');
  await until(`document.querySelector('[data-photo-edit]')?.dataset.photoEdit === 'ready' && document.querySelector('[data-photo-preview]')`, 10000);
  await wait(300);
  await click('[data-act="photo-repair"]');
  await wait(200);
  ok('التصاميم: «حسّن الصورة» فيها «رمّم» بفرشاته، و«تراجع» معطّلٌ قبل أيّ ترميم', (await exists('[data-repair-layer]')) && (await exists('input[data-act="photo-repair-brush"]')) && (await exists('[data-act="photo-repair-undo"][disabled]')));
  await setValue('input[data-act="photo-repair-brush"]', 16);
  await wait(150);
  const a0 = await preview(A[0] / W, A[1] / H);
  await scrub('[data-repair-layer]', A[0] / W, A[1] / H);
  await wait(500);
  const a1 = await preview(A[0] / W, A[1] / H);
  ok(`الفرشاة على البقعة الحمراء تملؤها من جوارها (${a0} ← ${a1})`, red(a0) && !red(a1) && a1[0] > 80 && a1[0] < 190);
  await click('[data-act="photo-repair-undo"]');
  await wait(400);
  ok(`و«تراجع» يعيدها (${await preview(A[0] / W, A[1] / H)})`, red(await preview(A[0] / W, A[1] / H)));
  await scrub('[data-repair-layer]', A[0] / W, A[1] / H);
  await wait(400);

  // بعد ربع دورةٍ مع العقارب: (x، y) في الأصل ← (H − y، x) في الإطار الطويل.
  await click('[data-act="photo-rotate-right"]');
  await wait(500);
  const bx = (H - B[1]) / H;
  const by = B[0] / W;
  const b0 = await preview(bx, by);
  await scrub('[data-repair-layer]', bx, by);
  await wait(500);
  const b1 = await preview(bx, by);
  ok(`وبعد ربع دورةٍ تقع الفرشاة على البقعة الثانية في موضعها المدوَّر (${b0} ← ${b1})`, red(b0) && !red(b1));
  if (shotsDir) await page.shot(join(shotsDir, 'repair-design.png'));
  await click('[data-act="photo-done"]');
  await wait(1500);
  const stored = await page.eval(`
    const src = document.querySelector('[data-design] img')?.getAttribute('src');
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    return { src: decodeURIComponent(src), w: c.width, h: c.height, a: px(${H - A[1]}, ${A[0]}), b: px(${H - B[1]}, ${B[0]}) };`);
  ok(`و«استعمل الصورة» تحفظها مدوَّرةً بلا البقعتين (${stored.w}×${stored.h}، ${stored.a} و${stored.b})`, /images\/[0-9a-f]{32}\.jpg/.test(stored.src) && stored.w === H && stored.h === W && !red(stored.a) && !red(stored.b));

  // ── ٢. الصور الشخصية ─────────────────────────────────────────────────
  /** لون نقطةٍ من الصورة (بكسلاتها ٣٨٤) في لوحة الإطار، ونسبتها من عنصر الإطار (للفرشاة). */
  const read = (x, y) =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const box = JSON.parse(c.dataset.box);
      const k = c.width / c.clientWidth;
      const d = c.getContext('2d').getImageData(Math.round((box.left + (${x} * box.width) / 384) * k) - 1, Math.round((box.top + (${y} * box.height) / 384) * k) - 1, 3, 3).data;
      const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) s[j] += d[i + j];
      return s.map((v) => Math.round(v / 9));`);
  const settled = async (x, y) => {
    let a = await read(x, y);
    for (let t = 0; t < 24; t++) {
      await wait(250);
      const b = await read(x, y);
      if (JSON.stringify(a) === JSON.stringify(b)) return b;
      a = b;
    }
    return a;
  };
  const frac = (x, y) =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const box = JSON.parse(c.dataset.box);
      return [(box.left + (${x} * box.width) / 384) / c.clientWidth, (box.top + (${y} * box.height) / 384) / c.clientHeight];`);
  const magenta = (c) => c[0] > 180 && c[2] > 150 && c[1] < 110;

  const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');
  await page.goto('passport-photos');
  await wait(700);
  await page.eval(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    ctx.fillStyle = 'rgb(220, 40, 200)';
    ctx.beginPath(); ctx.arc(192, 205, 5, 0, Math.PI * 2); ctx.fill();
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'whatsapp.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;`);
  await until(`document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done'`, 30000);
  await wait(500);
  await page.eval(`const el = document.querySelector('input[data-act="zoom"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5'); el.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await wait(400);
  await click('[data-tool="repair"]');
  await wait(200);
  ok('الصور الشخصية: «رمّم» بين الأدوات وخطّ الذقن ظاهرٌ حدًّا', (await exists('[data-tool="repair"]:not([disabled])')) && (await exists('[data-repair-line]')));
  await setValue('input[data-act="brush-size"]', 12);
  await wait(150);

  const nose = await settled(192, 140);
  const [nx, ny] = await frac(192, 140);
  await scrub('[data-photo-frame]', nx, ny, 0.02);
  await wait(400);
  const toast = await page.eval(`return document.body.textContent.includes('تحت الذقن وحده — الوجه لا يُمسّ');`);
  ok(`والفرشاة فوق الذقن لا تمسّ الوجه (${nose} ← ${await settled(192, 140)}) ويُقال لماذا`, JSON.stringify(nose) === JSON.stringify(await settled(192, 140)) && toast);

  const spot = await settled(192, 205);
  const [sx, sy] = await frac(192, 205);
  await scrub('[data-photo-frame]', sx, sy, 0.012);
  const fixed = await settled(192, 205);
  ok(`وتحت الذقن تملأ البقعة الأرجوانية بلون الجلد (${spot} ← ${fixed})`, magenta(spot) && !magenta(fixed) && fixed[0] > fixed[1] && fixed[1] > fixed[2]);
  if (shotsDir) await page.shot(join(shotsDir, 'repair-photo.png'));
  await click('[data-act="repair-undo"]');
  ok(`و«تراجع» يعيدها (${await settled(192, 205)})`, magenta(await settled(192, 205)));
  return steps.join('\n');
}
