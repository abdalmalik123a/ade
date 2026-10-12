/**
 * سيناريو: «امسح لونًا» (البند ٣٨) — على صورٍ مولَّدة لا لشخصٍ حقيقيّ.
 *
 * ١. **الصور الشخصية**: صورة المعاملة المولَّدة تُلصق وتُفرَّغ، ثم تُعاد بقعةٌ من الجدار بفرشاة «أبقِ» (كما يترك النموذج بقايا
 *    خلفية)، فتمسحها ضغطةٌ واحدة بـ«امسح لونًا» والوجه لا يتغيّر، و«تراجع» يعيدها، و«أعِد القناع» يمسحها.
 * ٢. **«أزل الخلفية» في التصاميم**: تفّاحة `designCutout` على جدارها تُفرَّغ، وتُعاد بقعتان من الجدار أعلاها لا تتّصلان؛
 *    فالضغطة على إحداهما تمسحها وحدها («المتّصل وحده»)، و«الصورة كلّها» يمسح الثانية وهي ظاهرة، و«تراجع» يعيدهما،
 *    والسماحية الصغيرة تترك من الضجيج بقايا والكبيرة تمسحها وهي ظاهرة، و«أعِد» يعيد القناع، و«استعمل الصورة» PNG شفّافة.
 *
 * والنموذج لا يُبقي بطاقةً مولَّدة (جُرّب على شعاراتٍ وبطاقاتٍ وإطار: يفصل الشيء وحده) — فالبقايا تُصنع بالفرشاة، والاقتراح
 * بعد التفريغ (حوافّ الصورة لونًا واحدًا) يثبته اختبار الوحدة `colorErase`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DIR = join(process.env.TEMP ?? '.', `diwan-color-erase-${Date.now()}`);
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
  // تفّاحة `designCutout` نفسها: قرصٌ أحمر مظلَّل على جدارٍ متدرّج بضجيج.
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
  /** فأرةٌ على عنصر: ضغطٌ ثم مرورٌ بالنقاط ثم رفع — بنِسبٍ من عرضه وارتفاعه. */
  const stroke = (sel, points) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      const r = el.getBoundingClientRect();
      const pts = ${JSON.stringify(points)};
      const ev = (type, [fx, fy]) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, buttons: type === 'mouseup' ? 0 : 1 }));
      ev('mousedown', pts[0]);
      for (const p of pts.slice(1)) ev('mousemove', p);
      ev('mouseup', pts[pts.length - 1]);
      return true;`);

  // ── ١. الصور الشخصية ─────────────────────────────────────────────────
  /** متوسّط لون مستطيلٍ من لوحة الإطار (نِسبًا). */
  const color = (x0, y0, x1, y1) =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const d = c.getContext('2d').getImageData(Math.round(${x0} * c.width), Math.round(${y0} * c.height), Math.max(1, Math.round(${x1 - x0} * c.width)), Math.max(1, Math.round(${y1 - y0} * c.height))).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return [r / n, g / n, b / n].map(Math.round);`);
  /** قراءةٌ بعد أن يستقرّ الرسم: التحسين يُعاد بعد توقّفٍ قصير. */
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
  const white = (c) => c.every((v) => v >= 250);
  const corner = () => settled(() => color(0.02, 0.02, 0.1, 0.06));
  const face = () => settled(() => color(0.4, 0.3, 0.6, 0.4));

  const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');
  await page.goto('passport-photos');
  await wait(700);
  await page.eval(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'whatsapp.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;`);
  const cutDone = await until(`document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done'`, 30000);
  await wait(600);
  ok('الصور الشخصية: الصورة تُلصق وتُفرَّغ، و«امسح لونًا» بين أدواتها', cutDone && (await exists('[data-tool="color"]:not([disabled])')));
  const faceBefore = await face();

  // بقعةٌ من الجدار تعود بفرشاة «أبقِ» في أعلى يسار الإطار — كما يترك النموذج بقايا خلفية.
  await click('[data-tool="keep"]');
  await wait(150);
  await setValue('input[data-act="brush-size"]', 60);
  await wait(150);
  await stroke('[data-photo-frame]', [[0.05, 0.04], [0.2, 0.04], [0.2, 0.12], [0.05, 0.12]]);
  const wall = await corner();
  ok(`بقعة الجدار تعود بـ«أبقِ» (${wall})`, !white(wall));

  await click('[data-tool="color"]');
  await wait(200);
  ok('و«امسح لونًا» يُظهر السماحية والمتّصل والتنعيم و«تراجع»', (await exists('[data-erase-bar] [data-erase-tolerance]')) && (await exists('[data-erase-mode="all"]')) && (await exists('[data-erase-smooth]')) && (await exists('[data-act="erase-undo"][disabled]')));
  await stroke('[data-photo-frame]', [[0.06, 0.04]]);
  const erased = await corner();
  const faceAfter = await face();
  ok(`ضغطةٌ على الجدار تمسح البقعة (${wall} ← ${erased}) والوجه كما هو (${faceBefore} ← ${faceAfter})`, white(erased) && faceAfter.every((v, i) => Math.abs(v - faceBefore[i]) <= 2));
  if (shotsDir) await page.shot(join(shotsDir, 'color-erase-photo.png'));
  await click('[data-act="erase-undo"]');
  const back = await corner();
  ok(`و«تراجع» يعيدها (${back})`, !white(back) && Math.abs(back[0] - wall[0]) <= 4);
  await click('[data-act="reset-mask"]');
  ok(`و«أعِد القناع» يمسحها كما فرّغها النموذج (${await corner()})`, white(await corner()));

  // ── ٢. «أزل الخلفية» في التصاميم ───────────────────────────────────────
  /** شفافيّة لوحة القصّ عند نسبٍ منها، وعدد ما فيه شفافيّةٌ أقلّ من النصف في مستطيلٍ منها. */
  const alphaAt = (fx, fy) =>
    page.eval(`
      const c = document.querySelector('[data-cutout-canvas]');
      return c ? c.getContext('2d').getImageData(Math.round(c.width * ${fx}), Math.round(c.height * ${fy}), 1, 1).data[3] : null;`);
  const opaqueIn = (x0, y0, x1, y1) =>
    page.eval(`
      const c = document.querySelector('[data-cutout-canvas]');
      const d = c.getContext('2d').getImageData(Math.round(c.width * ${x0}), Math.round(c.height * ${y0}), Math.round(c.width * ${x1 - x0}), Math.round(c.height * ${y1 - y0})).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] >= 128) n++;
      return n;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await click('[data-add="local-image"]');
  await wait(1200);
  await click('[data-act="cutout"]');
  const ready = await until(`document.querySelector('[data-cutout]')?.getAttribute('data-cutout') === 'ready'`, 60000);
  ok(`التصاميم: التفّاحة تُفرَّغ (الزاوية ${await alphaAt(0.03, 0.03)}، والوسط ${await alphaAt(0.5, 0.56)})، و«امسح لونًا» بين أدواته`, ready && (await alphaAt(0.03, 0.03)) < 20 && (await alphaAt(0.5, 0.56)) > 240 && (await exists('[data-cutout-tool="color"]')));

  // بقعتان من الجدار أعلى التفّاحة تعودان بـ«أبقِ» — متقاربتا اللون، وبينهما شفافيّةٌ لا تصلهما.
  const A = [0.06, 0.06, 0.12, 0.12];
  const B = [0.34, 0.06, 0.4, 0.12];
  const area = (r) => Math.round(384 * (r[2] - r[0])) * Math.round(384 * (r[3] - r[1]));
  await click('[data-cutout-tool="keep"]');
  await wait(150);
  await setValue('input[data-act="cutout-brush"]', 16);
  await wait(150);
  await stroke('[data-cutout-canvas]', [[0.05, 0.05], [0.13, 0.05], [0.13, 0.13], [0.05, 0.13], [0.09, 0.09]]);
  await stroke('[data-cutout-canvas]', [[0.33, 0.05], [0.41, 0.05], [0.41, 0.13], [0.33, 0.13], [0.37, 0.09]]);
  const a0 = await opaqueIn(...A);
  const b0 = await opaqueIn(...B);
  ok(`بقعتا الجدار تعودان (${a0} و${b0} من ${area(A)})، وبينهما شفّاف (${await alphaAt(0.23, 0.09)})`, a0 === area(A) && b0 === area(B) && (await alphaAt(0.23, 0.09)) < 20);

  await click('[data-cutout-tool="color"]');
  await wait(200);
  await stroke('[data-cutout-canvas]', [[0.09, 0.09]]);
  await wait(150);
  const a1 = await opaqueIn(...A);
  const b1 = await opaqueIn(...B);
  ok(`«المتّصل وحده»: الضغطة تمسح بقعتها وحدها (${a1} / ${b1}) والتفّاحة معتمة (${await alphaAt(0.5, 0.56)})`, a1 === 0 && b1 > area(B) * 0.9 && (await alphaAt(0.5, 0.56)) > 240);
  await click('[data-erase-mode="all"]');
  await wait(400);
  const b2 = await opaqueIn(...B);
  ok(`و«الصورة كلّها» يمسح الثانية وهي ظاهرة (${b2}) والتفّاحة باقية (${await alphaAt(0.5, 0.56)})`, b2 < area(B) * 0.05 && (await alphaAt(0.5, 0.56)) > 240);
  if (shotsDir) await page.shot(join(shotsDir, 'color-erase-design.png'));
  await click('[data-act="erase-undo"]');
  await wait(150);
  ok(`و«تراجع» يعيدهما (${await opaqueIn(...A)} / ${await opaqueIn(...B)})`, (await opaqueIn(...A)) === area(A) && (await opaqueIn(...B)) === area(B));

  // السماحية: ١ لا تبلغ ضجيج الجدار فتبقى منه بقايا، و٦٠ تمسحه — وهي ظاهرة بلا ضغطةٍ ثانية.
  await click('[data-erase-mode="contiguous"]');
  await setValue('input[data-erase-tolerance]', 1);
  await wait(150);
  await stroke('[data-cutout-canvas]', [[0.09, 0.09]]);
  await wait(200);
  const low = await opaqueIn(...A);
  await setValue('input[data-erase-tolerance]', 60);
  await wait(400);
  const high = await opaqueIn(...A);
  ok(`والسماحية الصغيرة تترك بقايا (${low} بكسلًا) والكبيرة تمسحها وهي ظاهرة (${high})`, low > area(A) * 0.5 && high === 0);

  await click('[data-act="cutout-reset"]');
  await wait(200);
  ok(`و«أعِد» يعيد قناع النموذج (${await opaqueIn(...A)} / ${await opaqueIn(...B)} / ${await alphaAt(0.5, 0.56)})`, (await opaqueIn(...A)) === 0 && (await opaqueIn(...B)) === 0 && (await alphaAt(0.5, 0.56)) > 240);
  await click('[data-act="cutout-done"]');
  await wait(1500);
  const src = await page.eval(`return decodeURIComponent(document.querySelector('[data-design] img')?.getAttribute('src') ?? '');`);
  ok(`و«استعمل الصورة» PNG شفّافةٌ في المخزن (${src})`, /images\/[0-9a-f]{32}\.png/.test(src) && !(await exists('[data-cutout]')));
  return steps.join('\n');
}
