/**
 * سيناريو: «أزل الخلفية» في التصاميم (DESIGNS.md ٢٫٣) — صورة تفّاحةٍ على جدارٍ متدرّج تُدرَج في اللوحة البيضاء، فتُفصل
 * على الجهاز بنموذج الأشياء: الجدار شفّاف والتفّاحة معتمة؛ و«امسح» على وسطها يمسحه و«أعِد» يعيده؛ ثم «استعمل الصورة»
 * فتصير صورة العنصر PNG شفّافةً في المخزن، والتراجع يعيد الأصل.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DIR = join(process.env.TEMP ?? '.', `diwan-cutout-${Date.now()}`);
const FILE = join(DIR, 'تفاحة.png');
const SIZE = 384;

/** PNG ملوّنٌ بلا شفافية من بكسلات RGB. */
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
  const rgb = Buffer.alloc(SIZE * SIZE * 3);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 30;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inApple = Math.hypot(x - SIZE * 0.5, y - SIZE * 0.56) < SIZE * 0.27;
      const shade = 0.6 + 0.5 * (1 - Math.hypot(x - SIZE * 0.42, y - SIZE * 0.45) / SIZE);
      const c = inApple ? [200 * shade, 30 * shade, 35 * shade] : [150 + (y / SIZE) * 60 + noise(), 160 - (x / SIZE) * 40 + noise(), 120 + noise()];
      for (let k = 0; k < 3; k++) rgb[(y * SIZE + x) * 3 + k] = Math.max(0, Math.min(255, Math.round(c[k])));
    }
  }
  writeFileSync(FILE, png(SIZE, SIZE, rgb));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  /** شفافيّة لوحة القصّ عند نسبٍ من عرضها وارتفاعها. */
  const alphaAt = (fx, fy) =>
    page.eval(`
      const c = document.querySelector('[data-cutout-canvas]');
      if (!c) return null;
      return c.getContext('2d').getImageData(Math.round(c.width * ${fx}), Math.round(c.height * ${fy}), 1, 1).data[3];`);
  const imageSrc = () =>
    page.eval(`
      const t = document.querySelector('[data-design] img');
      return t ? decodeURIComponent(t.getAttribute('src') ?? '') : null;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await click('[data-add="local-image"]');
  await wait(1200);
  const before = await imageSrc();
  ok(`الصورة تُدرَج، ومعها «أزل الخلفية» (${before})`, Boolean(before) && (await page.eval(`return Boolean(document.querySelector('[data-act="cutout"]'));`)));

  await click('[data-act="cutout"]');
  let phase = null;
  for (let i = 0; i < 120 && phase !== 'ready' && phase !== 'error'; i++) {
    await wait(500);
    phase = await page.eval(`return document.querySelector('[data-cutout]')?.getAttribute('data-cutout') ?? null;`);
  }
  const status = await page.eval(`return document.querySelector('[data-cutout-status]')?.textContent ?? '';`);
  ok(`تُفصل على الجهاز (${status})`, phase === 'ready');
  const corner = await alphaAt(0.02, 0.02);
  const middle = await alphaAt(0.5, 0.56);
  ok(`الجدار شفّاف والتفّاحة معتمة (${corner} / ${middle})`, corner !== null && corner < 20 && middle > 240);

  // «امسح» (الأداة الأولى) بنقرةٍ على وسط التفّاحة، ثم «أعِد».
  await page.eval(`
    const c = document.querySelector('[data-cutout-canvas]');
    const r = c.getBoundingClientRect();
    const at = { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.56, buttons: 1 };
    c.dispatchEvent(new MouseEvent('mousedown', at));
    c.dispatchEvent(new MouseEvent('mouseup', at));
    return true;`);
  await wait(200);
  const erased = await alphaAt(0.5, 0.56);
  await click('[data-act="cutout-reset"]');
  await wait(200);
  ok(`«امسح» يمسح ما تحتها، و«أعِد» يعيده (${erased} ← ${await alphaAt(0.5, 0.56)})`, erased < 20 && (await alphaAt(0.5, 0.56)) > 240);

  await click('[data-act="cutout-done"]');
  await wait(1500);
  const after = await imageSrc();
  const stored = await page.eval(`
    const src = document.querySelector('[data-design] img')?.getAttribute('src');
    if (!src) return null;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { w: c.width, corner: ctx.getImageData(2, 2, 1, 1).data[3], middle: ctx.getImageData(c.width / 2, Math.round(c.height * 0.56), 1, 1).data[3] };`);
  const closed = !(await page.eval(`return Boolean(document.querySelector('[data-cutout]'));`));
  ok(
    `«استعمل الصورة»: النافذة تُغلق وصورة العنصر PNG شفّافةٌ في المخزن (${after}، ${JSON.stringify(stored)})`,
    closed && /images\/[0-9a-f]{32}\.png/.test(after ?? '') && stored?.w === 384 && stored.corner === 0 && stored.middle > 240
  );

  await click('[data-undo]');
  await wait(400);
  ok(`والتراجع يعيد الأصل (${await imageSrc()})`, (await imageSrc()) === before);
  return steps.join('\n');
}
