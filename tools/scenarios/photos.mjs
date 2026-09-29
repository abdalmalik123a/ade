/**
 * سيناريو: الصور الشخصية — صورةٌ تُفتح وتُقصّ وتُصفّ وتُحفظ PDF بمقاس ورق الصور.
 *
 * تُبنى صورةٌ ٦٠٠×٨٠٠ (رأسٌ داكن على خلفية فاتحة)، فتُفتح، ويُختار ٣٫٥×٤٫٥ على
 * ورق ١٠×١٥ — فيُفتّش: ستٌّ في الورقة؟ الإطار يُكبَّر ولا يظهر فيه بياض؟ والـPDF
 * صفحةٌ بمقاس ١٠١٫٦ × ١٥٢٫٤ ملم فيها ستّ صور؟
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

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

/** صورة شخصٍ مبسّطة: رأسٌ وكتفان داكنان على خلفيةٍ فاتحة. */
function portraitPng(w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const head = (x - w / 2) ** 2 + (y - h * 0.38) ** 2 < (w * 0.18) ** 2;
      const body = y > h * 0.62 && Math.abs(x - w / 2) < w * 0.35;
      const v = head || body ? 60 : 220;
      row[1 + x * 3] = v;
      row[2 + x * 3] = v;
      row[3 + x * 3] = v + 20;
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
  const dir = join(process.env.TEMP ?? '.', `diwan-photos-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'customer.png');
  writeFileSync(file, portraitPng(600, 800));
  process.env.DIWAN_TEST_SAVE_DIR = dir;
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;

  await page.goto('passport-photos');
  await wait(700);
  ok('للصور الشخصية شاشةٌ في الشريط', (await page.text()).includes('تُقصّ على الوجه بمقاسها'));
  await click('[data-act="open-photo"]');
  await wait(1200);
  ok('فُتحت الصورة في إطارها', await page.eval(`return Boolean(document.querySelector('[data-photo-frame] canvas'));`));

  await click('[data-size-key="35x45"]');
  await click('[data-paper="photo"]');
  await wait(300);
  ok('و٣٫٥×٤٫٥ على ورق الصور: ستٌّ في الورقة', (await page.eval(`return document.querySelector('[data-photo-layout]').innerText;`)).includes('٦ في الورقة'));
  const ratio = await page.eval(`const f = document.querySelector('[data-photo-frame]'); return f.offsetWidth / f.offsetHeight;`);
  ok('والإطار بنسبة المقاس', Math.abs(ratio - 35 / 45) < 0.01);

  await page.eval(`
    const s = document.querySelector('input[data-act="zoom"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, '2');
    s.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await wait(300);
  // الصورة تُرسم في لوحةٍ داخل الإطار — وموضعها المحسوب (cropBox) على اللوحة نفسها.
  const covered = await page.eval(`
    const f = document.querySelector('[data-photo-frame]');
    const i = JSON.parse(f.querySelector('canvas').dataset.box);
    const w = f.offsetWidth, h = f.offsetHeight;
    return i.left <= 0.5 && i.top <= 0.5 && i.left + i.width >= w - 0.5 && i.top + i.height >= h - 0.5 && i.width > w * 1.9;
  `);
  ok('والتكبير يكبّرها ولا يظهر في الإطار بياض', covered);
  if (shotsDir) await page.shot(join(shotsDir, 'photos-crop.png'));

  await click('[data-act="review-photos"]');
  await wait(1200);
  ok('وتُراجع الورقة: ستّ صورٍ على ورقةٍ واحدة', await page.eval(`
    const o = document.querySelector('[data-sheets]');
    return o.querySelector('[data-sheets-summary]').innerText.includes('٦ صورة على ١ ورقة') && o.querySelectorAll('.print-page img').length === 6;
  `));
  if (shotsDir) await page.shot(join(shotsDir, 'photos-sheet.png'));
  await click('[data-sheets] [data-act="pdf"]');
  await wait(3500);
  const pdfFile = readdirSync(saveDir).find((f) => f.endsWith('.pdf'));
  const pdf = pdfFile ? readFileSync(join(saveDir, pdfFile), 'latin1') : '';
  const box = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/.exec(pdf);
  ok('وPDF بمقاس ورق الصور (١٠١٫٦ × ١٥٢٫٤ ملم)', Boolean(box) && Math.round(+box[1]) === 288 && Math.round(+box[2]) === 432);
  ok('وفيه الصور لا ورقٌ أبيض', /\/Subtype\s*\/Image/.test(pdf));

  return steps.join('\n');
}
