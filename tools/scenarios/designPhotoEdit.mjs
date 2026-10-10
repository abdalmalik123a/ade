/**
 * سيناريو: «حسّن الصورة» في التصاميم (DESIGNS.md ٢٫٢) — صورةٌ عريضة ٣٦٠ × ٢٤٠ تُدرَج، فلا يُحفظ شيءٌ بلا تعديل؛ وربع دورةٍ
 * يجعلها طويلة، و«مربّع» يقصّها مربّعًا، والإضاءة تفتّحها في المعاينة — ثم «استعمل الصورة» فتصير JPG مربّعةً ٢٤٠ في المخزن،
 * والتراجع يعيد الأصل.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DIR = join(process.env.TEMP ?? '.', `diwan-photo-${Date.now()}`);
const FILE = join(DIR, 'منتج.png');
const W = 360;
const H = 240;

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
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // رماديٌّ متوسّط وفي يساره مربّعٌ أحمر — ليُرى الدوران والإضاءة.
      const c = x < 80 && y < 80 ? [200, 40, 40] : [110, 110, 110];
      c.forEach((v, k) => (rgb[(y * W + x) * 3 + k] = v));
    }
  }
  writeFileSync(FILE, png(W, H, rgb));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const setValue = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);
  const preview = () =>
    page.eval(`
      const c = document.querySelector('[data-photo-preview]');
      if (!c) return null;
      const d = c.getContext('2d').getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data;
      return { w: c.width, h: c.height, mid: d[0] };`);
  const imageSrc = () => page.eval(`return decodeURIComponent(document.querySelector('[data-design] img')?.getAttribute('src') ?? '');`);

  await page.goto('designed-documents');
  await wait(700);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await click('[data-add="local-image"]');
  await wait(1200);
  const before = await imageSrc();
  await click('[data-act="photo-edit"]');
  for (let i = 0; i < 40; i++) {
    await wait(250);
    if (await page.eval(`return document.querySelector('[data-photo-edit]')?.dataset.photoEdit === 'ready' && Boolean(document.querySelector('[data-photo-preview]'));`)) break;
  }
  await wait(300);
  const start = await preview();
  const disabled = await page.eval(`return document.querySelector('[data-act="photo-done"]')?.disabled ?? null;`);
  ok(`«حسّن الصورة» تفتح الصورة عريضةً (${start?.w} × ${start?.h})، و«استعمل» معطّلٌ بلا تعديل`, start?.w > start?.h && disabled === true);

  await click('[data-act="photo-rotate-right"]');
  await wait(400);
  const turned = await preview();
  ok(`ربع دورةٍ يجعلها طويلة (${turned?.w} × ${turned?.h})`, turned?.h > turned?.w);

  await click('[data-crop-ratio="مربّع"]');
  await wait(300);
  const box = await page.eval(`const r = document.querySelector('[data-crop-box]').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)];`);
  ok(`و«مربّع» يقصّها مربّعًا (${box.join(' × ')})`, Math.abs(box[0] - box[1]) <= 2);

  await setValue('input[data-act="photo-exposure"]', '0.6');
  await wait(400);
  const bright = await preview();
  ok(`والإضاءة تفتّحها في المعاينة (${turned?.mid} ← ${bright?.mid})`, bright?.mid > turned?.mid + 10);

  await click('[data-act="photo-done"]');
  await wait(1500);
  const after = await imageSrc();
  const stored = await page.eval(`
    const src = document.querySelector('[data-design] img')?.getAttribute('src');
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src; await img.decode();
    return [img.naturalWidth, img.naturalHeight];`);
  ok(`«استعمل الصورة»: JPG مربّعةٌ في المخزن (${after}، ${stored?.join(' × ')})`, /images\/[0-9a-f]{32}\.jpg/.test(after) && stored?.[0] === 240 && stored?.[1] === 240 && !(await page.eval(`return Boolean(document.querySelector('[data-photo-edit]'));`)));

  await click('[data-undo]');
  await wait(400);
  ok('والتراجع يعيد الأصل', (await imageSrc()) === before);
  return steps.join('\n');
}
