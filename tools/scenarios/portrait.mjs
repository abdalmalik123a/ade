/**
 * سيناريو: صورة المعاملة — لصقٌ، فإزالة خلفيةٍ بالنموذج على الجهاز، فقاط، فمقاس، فحفظٌ ورفعٌ
 * وملف مواطن، واستيراد قاطٍ شفّاف (والمعتم يُرفض بسببه).
 *
 * الصورة مولَّدة لا لشخصٍ حقيقي (`tests/fixtures/portrait-generated.png`) — تُلصق كما يلصق
 * الموظف صورةً من واتساب الحاسوب. والقاط المستورد صورةٌ تُبنى هنا: سترةٌ داكنة بفتحة عنق.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

/** PNG من دالّة بكسل: `rgba` بأربع قنوات (نوع ٦)، وإلا ثلاثٌ معتمة (نوع ٢). */
function png(w, h, px, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(rgba ? 6 : 2, 9);
  const ch = rgba ? 4 : 3;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * ch);
    for (let x = 0; x < w; x++) row.set(px(x, y).slice(0, ch), 1 + x * ch);
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** قاطٌ مبسّط: كتفان داكنان منحدران، وفتحة عنقٍ على شكل V شفّافة، وما حولهما شفّاف. */
const suitPng = () =>
  png(
    400,
    300,
    (x, y) => {
      const dx = Math.abs(x - 200);
      const shoulder = y > 40 + Math.max(0, dx - 60) * 0.35 && dx < 195;
      const gap = y < 130 && dx < 38 * (1 - (y - 40) / 90);
      return shoulder && !gap ? [30, 32, 40, 255] : [0, 0, 0, 0];
    },
    true
  );

const opaquePng = () => png(200, 150, () => [40, 40, 40], false);

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-portrait-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const suit = join(dir, 'قاط المكتب.png');
  writeFileSync(suit, opaquePng());
  process.env.DIWAN_TEST_SAVE_DIR = dir;
  process.env.PORTRAIT_SUIT_FILE = suit;
  return { DIWAN_TEST_OPEN_FILE: suit, DIWAN_TEST_SAVE_DIR: dir };
}

/** أبعاد JPEG ودقّته من رأسه: SOF للأبعاد، وJFIF للكثافة. */
function jpegInfo(buf) {
  let dpi = null;
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf.toString('latin1', 6, 11) === 'JFIF\0' && buf[13] === 1) dpi = buf.readUInt16BE(14);
  for (let p = 2; p + 9 < buf.length; ) {
    if (buf[p] !== 0xff) return { dpi };
    const marker = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { dpi, height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
    p += 2 + len;
  }
  return { dpi };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const until = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await page.eval(`return Boolean(${expr});`)) return true;
      await wait(250);
    }
    return false;
  };
  /** متوسّط لون مستطيلٍ من لوحة الإطار (نِسبًا من عرضها وارتفاعها). */
  const color = (x0, y0, x1, y1) =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const d = c.getContext('2d').getImageData(Math.round(${x0} * c.width), Math.round(${y0} * c.height), Math.max(1, Math.round(${x1 - x0} * c.width)), Math.max(1, Math.round(${y1 - y0} * c.height))).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return [r / n, g / n, b / n];
    `);
  const near = (c, rgb, tol = 6) => c.every((v, i) => Math.abs(v - rgb[i]) <= tol);
  /** عيّنةٌ من بكسلات شريطٍ في أسفل الإطار — ليُقاس الفرق بكسلًا ببكسل لا بمتوسّط اللون. */
  const band = () =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const y0 = Math.round(c.height * 0.8), h = c.height - y0;
      const d = c.getContext('2d').getImageData(0, y0, c.width, h).data;
      const out = [];
      for (let y = 0; y < h; y += 4) for (let x = 0; x < c.width; x += 4) { const i = (y * c.width + x) * 4; out.push(d[i], d[i + 1], d[i + 2]); }
      return out;
    `);
  const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
  /**
   * قراءةٌ بعد أن يستقرّ الرسم (قراءتان متتاليتان متطابقتان): نافذة الفحص إن غطّتها نافذةٌ أخرى
   * أبطأ Chromium مؤقّتاتها إلى نحو ثانية — فالوقت الثابت يقرأ الإطار قبل أن يُعاد رسمه.
   */
  const settled = async (read) => {
    let a = await read();
    for (let t = 0; t < 24; t++) {
      await wait(250);
      const b = await read();
      if (JSON.stringify(b) === JSON.stringify(a)) return b;
      a = b;
    }
    return a;
  };
  const setValue = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      return true;
    `);
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');

  await page.goto('passport-photos');
  await wait(700);

  // ١. اللصق: حدث «لصق» فيه صورة — كما يلصقها الموظف من واتساب الحاسوب.
  await page.eval(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'whatsapp.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;
  `);
  ok('الصورة الملصوقة تُفتح في إطارها', await until(`document.querySelector('[data-photo-frame] canvas')`, 8000));

  // ٢. الخلفية تُزال وحدها على الجهاز، والرأس يُقصّ على دليل المقاس.
  ok('وتُزال خلفيّتها على الجهاز', await until(`document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done'`, 30000));
  await wait(600);
  ok('والخلفية بيضاء: زاوية الإطار ٢٥٥', near(await color(0, 0, 0.06, 0.04), [255, 255, 255], 2));
  ok('والرأس في دليل ٣٫٥×٤٫٥ (٧٠–٨٠٪)', (await page.eval(`return document.querySelector('[data-head-check]')?.dataset.headCheck;`)) === 'ok');
  ok('والصورة الصغيرة يُنبَّه على دقّتها الفعلية', await page.eval(`return Boolean(document.querySelector('[data-dpi-warn]'));`));
  if (shotsDir) await page.shot(join(shotsDir, 'portrait-cutout.png'));

  await click('[data-bg="lightBlue"]');
  await wait(300);
  ok('والأزرق الفاتح يُختار ولا يكون أصلًا', near(await color(0, 0, 0.06, 0.04), [0xdb, 0xe8, 0xf5], 2));
  await click('[data-bg="white"]');
  await wait(300);

  // ٣. الإضاءة: المنزلق يغيّر الصورة، و«الأصل» يعيدها.
  const faceBefore = await settled(() => color(0.4, 0.3, 0.6, 0.4));
  await setValue('input[data-act="exposure"]', 0.8);
  // يُعاد التحسين بعد توقّف المنزلق ويُرسم — يُنتظر الرسم لا وقتٌ ثابت (المثبّت أبطأ أحيانًا).
  const lum = (c) => c[0] + c[1] + c[2];
  let faceBright = await color(0.4, 0.3, 0.6, 0.4);
  for (let t = 0; t < 20 && lum(faceBright) <= lum(faceBefore) + 15; t++) {
    await wait(200);
    faceBright = await color(0.4, 0.3, 0.6, 0.4);
  }
  const brighter = lum(faceBright) > lum(faceBefore) + 15;
  ok(`ومنزلق الإضاءة يفتّح الوجه${brighter ? '' : ` (${lum(faceBefore).toFixed(0)} ← ${lum(faceBright).toFixed(0)})`}`, brighter);
  await click('[data-act="auto-enhance"]');
  await wait(300);
  const face = await settled(() => color(0.4, 0.3, 0.6, 0.4));

  // ٤. القاط: يُلبَس تحت الرقبة، ويُكبَّر.
  const chestBefore = await settled(band);
  await click('[data-suit="suit-brown-gold-tie"]');
  ok('ويُلبَس القاط', await until(`document.querySelector('[data-tool="suit"]') && !document.querySelector('[data-tool="suit"]').disabled`, 8000));
  // يُنتظر رسم القاط لا وقتٌ ثابت: أوّل قاطٍ يُفكّ من حزمته، والجهاز قد يكون مشغولًا.
  let chestSuit = await band();
  for (let t = 0; t < 20 && diff(chestSuit, chestBefore) <= 10; t++) {
    await wait(200);
    chestSuit = await band();
  }
  const faceSuit = await settled(() => color(0.4, 0.3, 0.6, 0.4));
  const chestMoved = diff(chestSuit, chestBefore);
  const faceSame = near(faceSuit, face, 1);
  ok(`فيتغيّر الصدر ولا يتغيّر الوجه${chestMoved > 10 && faceSame ? '' : ` (الصدر ${chestMoved.toFixed(1)}، الوجه ${face.map((v) => v.toFixed(1))} ← ${faceSuit.map((v) => v.toFixed(1))})`}`, chestMoved > 10 && faceSame);
  await setValue('input[data-act="suit-scale"]', 1.3);
  let chestBig = await band();
  for (let t = 0; t < 20 && diff(chestBig, chestSuit) <= 3; t++) {
    await wait(200);
    chestBig = await band();
  }
  ok('ومنزلق الحجم يغيّره', diff(chestBig, chestSuit) > 3);
  await click('[data-act="suit-reset"]');
  await wait(300);
  if (shotsDir) await page.shot(join(shotsDir, 'portrait-suit.png'));

  // ٥. الحفظ: بكسلات المقاس بدقّته الحقيقية، والدقّة مكتوبةٌ في الملف.
  await click('[data-act="save-photo"]');
  await wait(2500);
  const saved = readdirSync(saveDir).find((f) => f.endsWith('.jpg') && !f.includes('للرفع'));
  const info = saved ? jpegInfo(readFileSync(join(saveDir, saved))) : {};
  ok('وتُحفظ ٨٢٧×١٠٦٣ بكسلًا (٣٫٥×٤٫٥ سم بـ٦٠٠ نقطة)', info.width === 827 && info.height === 1063);
  ok('ودقّتها ٦٠٠ مكتوبةٌ في الملف', info.dpi === 600);

  await setValue('[data-upload-limit]', 100 * 1024);
  await wait(200);
  await click('[data-act="save-upload"]');
  await wait(3000);
  const upload = readdirSync(saveDir).find((f) => f.includes('للرفع'));
  ok('وللرفع تحت ١٠٠ ك.ب', Boolean(upload) && statSync(join(saveDir, upload)).size <= 100 * 1024);

  // ٦. في ملف مواطن: صورته في ملفّه، ومستمسكٌ بها.
  const citizenId = await page.eval(`
    const c = await window.diwan.citizens.save({ id: null, fullName: 'زبون الصورة التجريبي', nationalId: null, jobTitle: null, workplace: null,
      employeeCode: null, serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null,
      landmark: null, phone: null, photoPath: null, category: null, notes: null, verified: false });
    return c.id;
  `);
  await click('[data-act="link-citizen"]');
  await wait(900);
  await page.eval(`document.querySelector('[data-picker-row="زبون الصورة التجريبي"] input').click(); return true;`);
  await wait(200);
  await click('[data-act="picker-confirm"]');
  await wait(2500);
  const citizen = await page.eval(`const c = await window.diwan.citizens.get(${citizenId}); return { photo: c.photoPath, n: c.attachments.length };`);
  ok('وتُحفظ صورةً في ملف المواطن ومستمسكًا فيه', /^photos\//.test(citizen.photo ?? '') && citizen.n === 1);

  // ٧. استيراد قاط: المعتم يُرفض بسببه، والشفّاف يُضاف ويُلبَس.
  await click('[data-act="import-suit"]');
  await wait(1200);
  ok('والقاط المعتم يُرفض ويُقال لماذا', (await page.text()).includes('بلا شفافية'));
  writeFileSync(process.env.PORTRAIT_SUIT_FILE, suitPng());
  await wait(3800);
  await click('[data-act="import-suit"]');
  ok('والشفّاف يُضاف إلى القاط ويُلبَس', await until(`[...document.querySelectorAll('[data-suit^="custom-"]')].some((b) => b.className.includes('border-secondary'))`, 8000));
  if (shotsDir) await page.shot(join(shotsDir, 'portrait-custom-suit.png'));

  // ٨. قالبٌ للمكتب: يُحفظ ويُختار، والإطار بنسبته.
  await click('[data-act="presets"]');
  await wait(400);
  await setValue('[data-preset-name]', 'استمارة الدائرة');
  await setValue('[data-preset-w]', 40);
  await setValue('[data-preset-h]', 50);
  await click('[data-act="save-preset"]');
  await wait(800);
  const ratio = await page.eval(`const f = document.querySelector('[data-photo-frame]'); return f.offsetWidth / f.offsetHeight;`);
  ok('والقالب الجديد يُحفظ ويُختار بنسبته', (await page.text()).includes('استمارة الدائرة') && Math.abs(ratio - 40 / 50) < 0.01);

  return steps.join('\n');
}
