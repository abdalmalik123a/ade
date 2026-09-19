/**
 * سيناريو: التصاميم — تُفتح صورة وتُملأ حقولٌ فوقها وتُطبع.
 *
 * يبني صورة PNG بمقاس هوية CR80 عند ٣٠٠ نقطة/إنش (١٠١١ × ٦٣٨ بكسل، و`pHYs`
 * يقول ذلك)، ثم يفتحها خلفيةً ويتفقّد: أقُرئ المقاس من الملف أم خُمِّن؟ ثم يضع
 * حقلًا فوقها ويملؤه ويحفظ — ويفتّش في القاعدة: لوحةٌ بنِسَبها وحقولها.
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

/** صورةٌ حقيقية تُفتح في المتصفّح — لا بايتاتٌ تُوهم القارئ. */
function designPng(width, height, ppm) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // عمق ٨ بت
  ihdr.writeUInt8(2, 9); // RGB

  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(ppm, 0);
  phys.writeUInt32BE(ppm, 4);
  phys.writeUInt8(1, 8); // الوحدة: المتر

  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = 0xf3;
    row[2 + x * 3] = 0xe9;
    row[3 + x * 3] = 0xd2;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** الملف يُبنى قبل إقلاع التطبيق، ويُفتح عبر باب المِقْود المحصور. */
export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-design-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'student-id.png');
  // ١١٨١١ بكسل/متر = ٣٠٠ نقطة/إنش، و١٠١١ × ٦٣٨ بكسل = ٨٥٫٦ × ٥٤ ملم.
  writeFileSync(file, designPng(1011, 638, 11811));
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const design = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);

  await page.goto('designed-documents');
  await wait(700);

  let text = await page.text();
  ok('للتصاميم شاشةٌ في الشريط', text.includes('التصاميم — شهادات وهويات'));
  ok('تُفتح وتُملأ وتُطبع', text.includes('تُفتح وتُملأ وتُطبع'));

  // ── المقاس من الملف لا من تخميننا ──────────────────────────────────
  await click('button[data-act="background"]');
  await wait(1200);

  const size = await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  ok('قُرئ المقاس من الملف', size.includes('85.6') && size.includes('54.0'));
  ok('وقُرئت دقّته معه', size.includes('300'));
  ok('ولم يُسأل عن مقاسٍ يعرفه', !(await page.text()).includes('اختر مقاسًا معياريًّا'));

  ok('ورُسمت الخلفية', (await design()).includes('diwan://store/designs/'));

  // ── حقلٌ فوق التصميم ───────────────────────────────────────────────
  await page.type('input[data-add-text]', '{اسم الطالب}');
  await wait(200);
  await click('button[data-act="add"]');
  await wait(500);

  text = await page.text();
  ok('صار ما بين القوسين حقلًا', text.includes('املأ الحقول (1)'));
  ok('وظهر باسمه في شاشة الإدخال', text.includes('اسم الطالب'));

  await page.type('input[data-value="اسم الطالب"]', 'مريم عادل حسن');
  await wait(500);
  ok('والقيمة تُرسم فوق التصميم', (await design()).includes('مريم عادل حسن'));

  // ── الاسم والحفظ ───────────────────────────────────────────────────
  await page.type('input[data-title]', 'هوية طالب');
  await wait(200);
  await click('button[data-act="save"]');
  await wait(1500);
  ok('حُفظ التصميم', (await page.text()).includes('حُفظ التصميم'));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, subtitle, issuing, doc_json AS docJson FROM templates').get();
  db.close();

  ok('وقُيّد', Boolean(row));
  ok('بحكمٍ يفصله عن الكتب', row?.issuing === 'print-only');
  ok('وبمقاسه في عنوانه الفرعي', (row?.subtitle ?? '').includes('85.6'));

  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  ok('والوثيقة لوحةٌ لا متن', doc?.kind === 'canvas' && doc?.blocks?.length === 0);
  ok('بمقاسها بالملّم', Math.round(doc?.canvas?.size?.w ?? 0) === 86);
  ok('وبدقّة خلفيتها', doc?.canvas?.background?.dpi === 300);

  const el = doc?.canvas?.elements?.[0];
  ok('وبعنصرها', el?.kind === 'text');
  ok('وموضعه نسبةٌ لا بكسل', el?.box?.x > 0 && el?.box?.x < 1 && el?.box?.y < 1);
  ok('وحقله عقدةٌ في نصّه', el?.inlines?.some((n) => n.kind === 'field' && n.ref === 'اسم الطالب'));
  ok('والحقل في شاشة الإدخال', doc?.fields?.[0]?.key === 'اسم الطالب');

  // ── المحرّر: مقابضُ ومحاذاةٌ وطبقاتٌ وتراجع ────────────────────────
  /** أسماءُ الطبقات من أعلاها إلى أسفلها — وهي ترتيب `z` معكوسًا. */
  const layers = () =>
    page.eval(`
      return [...document.querySelectorAll('[data-layer]')].map((e) => e.textContent.trim());
    `);

  /** منتصفُ عنصرٍ محدَّد أفقيًّا، ومنتصفُ الورقة — بالبكسل على الشاشة. */
  const centres = () =>
    page.eval(`
      const sheet = document.querySelector('[data-design]');
      const el = document.querySelector('[data-grip]')?.parentElement;
      if (!el) return null;
      return {
        element: parseFloat(el.style.right) + parseFloat(el.style.width) / 2,
        page: sheet.offsetWidth / 2
      };
    `);

  await click('button[data-add="barcode"]');
  await wait(500);
  ok('أُضيف باركود', (await page.text()).includes('باركود'));
  ok('وظهر حقلُه في شاشة الإدخال', (await page.text()).includes('املأ الحقول (2)'));

  await page.type('input[data-value="الرقم"]', '2026003112');
  await wait(600);
  const drawn = await page.eval(`
    const node = document.querySelector('[data-barcode]');
    return node ? node.innerHTML.includes('<svg') : false;
  `);
  ok('ورُسم الباركود قضبانًا', drawn);

  // المقابض تظهر على المحدَّد وحده
  const grips = await page.eval(`return document.querySelectorAll('[data-grip]').length;`);
  ok('وللمحدَّد ثمانيةُ مقابض', grips === 8);

  // المحاذاة: وسّط أفقيًّا — والعنصر وحده يُوسَّط في الورقة لا في نفسه
  const before = await centres();
  ok('والباركود ليس في الوسط قبلها', Math.abs(before.element - before.page) > 2);
  await click('button[data-align="hCenter"]');
  await wait(400);
  const after = await centres();
  ok('وصار منتصفُه منتصفَ الورقة', Math.abs(after.element - after.page) < 2);

  // الطبقات: «إلى الخلف» يجعل المحدَّد أسفل القائمة (والقائمة من الأعلى)
  const stacked = await layers();
  ok('والباركود أعلى الطبقات إذ أُضيف أخيرًا', stacked[0].includes('باركود'));
  await click('button[data-layer-move="back"]');
  await wait(400);
  const sunk = await layers();
  ok('و«إلى الخلف» يُنزله أسفلها', sunk[sunk.length - 1].includes('باركود'));

  // التراجع يعيد ما كان — الترتيب نفسه لا ترتيبًا مختلفًا
  await click('button[data-undo]');
  await wait(500);
  ok('والتراجع يعيد الترتيب كما كان', JSON.stringify(await layers()) === JSON.stringify(stacked));

  // المعاينة تُخفي المقابض ولا تُخفي الرسم
  await click('button[data-preview]');
  await wait(400);
  ok('والمعاينة تُخفي المقابض', (await page.eval(`return document.querySelectorAll('[data-handle]').length;`)) === 0);
  ok('ولا تُخفي ما يُطبع', (await design()).includes('مريم عادل حسن'));
  await click('button[data-preview]');
  await wait(300);

  // ── ومكتبة الكتب لا تراه ───────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(900);
  ok('ومكتبة الكتب لا تُري التصميم', !(await page.text()).includes('هوية طالب'));

  // ── ويُفتح فتعود لوحته ─────────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(900);
  const opened = await page.eval(`
    const els = [...document.querySelectorAll('button')];
    const el = els.find((e) => (e.textContent || '').includes('هوية طالب'));
    if (!el) return false;
    el.click();
    return true;
  `);
  ok('والمحفوظ معروضٌ في قسمه', opened);
  await wait(900);
  ok('ويُفتح فيعود مقاسه', (await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`)).includes('85.6'));
  ok('وحقوله', (await page.text()).includes('املأ الحقول (1)'));

  if (shotsDir) await page.shot(join(shotsDir, 'designs.png'));
  return steps.join('\n');
}
