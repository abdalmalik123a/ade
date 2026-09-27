/**
 * سيناريو: استوديو التصوير — صورُ صفٍّ بأسمائهم، طالبًا بعد طالب.
 *
 * كاميرا مصنوعة (DIWAN_TEST_FAKE_CAMERA) لأن الجهاز قد لا تكون عليه كاميرا:
 * تُلتقط صورتان بمسافة فتُعطيان للطالبين الأوّلين وتُطابقان في الدفعة، ثم
 * يُختار «مجلّد الكاميرا الاحترافية» وتُكتب فيه صورةٌ فتُعطى للثالث وحدها.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const FOLDER = join(process.env.TEMP ?? '.', `diwan-studio-${Date.now()}`);

/** PNG صغيرٌ صالح — كما يحفظه برنامج كاميرا في مجلّده. */
function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
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
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([40, 120, 200], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function prepare() {
  rmSync(FOLDER, { recursive: true, force: true });
  mkdirSync(FOLDER, { recursive: true });
  return { DIWAN_TEST_FAKE_CAMERA: '1', DIWAN_TEST_OPEN_DIR: FOLDER };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const studio = () =>
    page.eval(`
      const o = document.querySelector('[data-studio]');
      return o ? { name: o.querySelector('[data-studio-name]')?.innerText ?? '', progress: o.querySelector('[data-studio-progress]')?.innerText ?? '', done: Boolean(o.querySelector('[data-studio-done]')) } : null;
    `);

  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="student-id"]');
  await wait(900);
  await page.type(
    'textarea[data-batch-text]',
    ['الاسم\tالصف', 'زينب علي\tالخامس', 'أحمد كريم\tالخامس', 'مريم سالم\tالخامس'].join('\n')
  );
  await wait(600);

  await click('button[data-act="studio"]');
  await wait(2500);
  let s = await studio();
  ok('انفتح الاستوديو على أوّل طالب', s?.name === 'زينب علي');
  const cameras = await page.eval(`return [...document.querySelectorAll('[data-studio] select[data-act="camera-source"] option')].map((o) => o.textContent);`);
  ok('والكاميرات التي يراها الحاسوب في القائمة، ومعها مجلّد الكاميرا الاحترافية', cameras.length >= 2 && cameras.some((c) => c.includes('احترافية')));
  const live = await page.eval(`const v = document.querySelector('[data-studio] video'); return v ? v.videoWidth : 0;`);
  ok('والكاميرا تعمل (بثٌّ حيّ في الإطار)', live > 0);

  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); return true;`);
  await wait(1200);
  s = await studio();
  ok('«مسافة» تلتقط وتنتقل إلى التالي', s?.name === 'أحمد كريم' && s.progress.includes('١ من ٣'));
  await click('[data-studio] button[data-act="shoot"]');
  await wait(1200);
  s = await studio();
  ok('والثاني كذلك', s?.name === 'مريم سالم' && s.progress.includes('٢ من ٣'));

  // الكاميرا الاحترافية: مجلّد لقطاتها يُراقَب، وكلّ صورةٍ جديدة فيه للحاضر.
  await page.eval(`
    const sel = document.querySelector('[data-studio] select[data-act="camera-source"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '__folder__');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await wait(500);
  await click('[data-studio] button[data-act="watch-folder"]');
  await wait(800);
  writeFileSync(join(FOLDER, 'IMG_0001.png'), png(600, 400));
  await wait(3500);
  s = await studio();
  ok('ولقطةُ الكاميرا الاحترافية في مجلّدها تُعطى للثالثة', s?.done === true && s.progress.includes('٣ من ٣'));

  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return true;`);
  await wait(600);
  const photos = await page.eval(`return document.querySelector('[data-batch-photos]')?.innerText ?? '';`);
  ok('وطوبقت الصور الثلاث بأصحابها في الدفعة', photos.includes('٣ صورة من ٣'));
  ok('وتظهر في البطاقة', (await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`)).includes('diwan://store/photos/'));

  return steps.join('\n');
}
