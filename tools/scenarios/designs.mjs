/**
 * سيناريو: التصاميم — تُفتح صورة وتُملأ حقولٌ فوقها وتُطبع.
 *
 * يبني صورة PNG بمقاس هوية CR80 عند ٣٠٠ نقطة/إنش (١٠١١ × ٦٣٨ بكسل، و`pHYs`
 * يقول ذلك)، ثم يفتحها خلفيةً ويتفقّد: أقُرئ المقاس من الملف أم خُمِّن؟ ثم يضع
 * حقلًا فوقها ويملؤه ويحفظ — ويفتّش في القاعدة: لوحةٌ بنِسَبها وحقولها.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  process.env.DIWAN_TEST_SAVE_DIR = dir; // ليقرأه السيناريو نفسه أيضًا
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const design = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;

  await page.goto('designed-documents');
  await wait(900);

  let text = await page.text();
  ok('للتصاميم شاشةٌ في الشريط', text.includes('التصاميم — شهادات وهويات'));
  ok('تبدأ بالمعرض: «لمن؟» ثم اللون والنمط', text.includes('لمن؟') && text.includes('النمط'));

  // ── المعرض: اثنا عشر نوعًا حيّةً بعيّنة، لا صناديق فارغة ─────────────
  await wait(1200);
  const gallery = await page.eval(`return document.querySelectorAll('[data-kind]').length;`);
  ok('والمعرض اثنا عشر نوعًا', gallery === 12);
  ok('ولمحاتُها تصاميم مرسومة بعيّنةٍ لا وسوم', await page.eval(`
    const thumbs = document.querySelectorAll('[data-kind] [data-canvas]');
    const text = [...thumbs].map((t) => t.innerText).join(' ');
    return thumbs.length === 12 && text.includes('زينب علي حسين') && !text.includes('{الاسم}');
  `));
  const thumbBefore = await page.eval(`return document.querySelector('[data-kind="thanks"] [data-canvas] img').src.length;`);
  await page.eval(`document.querySelector('[data-style="islamic"]').click()`);
  await wait(600);
  const thumbAfter = await page.eval(`return document.querySelector('[data-kind="thanks"] [data-canvas] img').src;`);
  ok('والنمط يبدّل اللمحات كلّها معًا', thumbAfter.length !== thumbBefore && decodeURIComponent(thumbAfter).includes('pattern'));
  await page.type('input[data-brand-name]', 'ثانوية المتميّزين');
  await wait(600);
  ok(
    'واسم الجهة يُكتب في التصاميم نفسها',
    (await page.eval(`return document.querySelector('[data-kind="student-id"]').innerText;`)).includes('ثانوية المتميّزين')
  );

  const countRows = () => {
    const conn = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const n = conn.prepare('SELECT COUNT(*) AS n FROM templates').get().n;
    conn.close();
    return n;
  };
  ok('والقاعدة فارغةٌ رغم عرضها — تُقترح ولا تُزرع', countRows() === 0);

  await click('button[data-kind="student-id"]');
  await wait(900);
  const picked = await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  ok('واختيارُ الهوية يفتحها بمقاسها', picked.includes('85.6') && picked.includes('54.0'));
  ok('وبحقولها', (await page.text()).includes('املأ الحقول'));
  const inputs = await page.eval(`return [...document.querySelectorAll('input[data-value]')].map((e) => e.dataset.value).join(',');`);
  ok('واسم الجهة فيها نصًّا لا حقلًا يُملأ', !inputs.includes('المدرسة'));
  ok('وصورة الطالب تُختار صورةً لا تُكتب', await page.eval(`return Boolean(document.querySelector('button[data-photo="الصورة"]'));`));
  ok(
    'وتُصفّ تسعًا في A4',
    (await page.eval(`return document.querySelector('[data-imposition]')?.innerText ?? '';`)).includes('9 في ورقة A4')
  );

  // ── الدفعة: قائمة الصفّ من Excel، وأوراقٌ تُراجع ثم تُحفظ PDF ──────
  const list = [
    'الاسم\tالصف\tالرقم\tالهاتف',
    ...Array.from({ length: 11 }, (_, i) => `طالب ${i + 1}\tالخامس\t2026-${String(i + 1).padStart(4, '0')}\t0770`),
    'عبد الرحمن محمد عبد الكريم حسين الجبوري\tالسادس\t2026-0099\t0780'
  ].join('\n');
  await page.type('textarea[data-batch-text]', list);
  await wait(600);
  const summary = await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`);
  ok('الدفعة: ١٢ اسمًا في ورقتين', summary.includes('١٢') && summary.includes('٢'));
  ok('والعمود بلا حقلٍ يُقال عنه', (await page.text()).includes('فتُرك: الهاتف'));
  ok('والمحرّر يُري أوّل اسمٍ لا وسمه', (await design()).includes('طالب 1'));
  await click('button[data-act="sheets"]');
  await wait(1500);
  const sheets = await page.eval(`
    const o = document.querySelector('[data-sheets]');
    if (!o) return null;
    return {
      summary: o.querySelector('[data-sheets-summary]').innerText,
      cards: o.querySelectorAll('.print-page [data-canvas]').length,
      marks: o.querySelectorAll('.print-page div[style*="background:#000"]').length
    };
  `);
  ok('وتُراجع الأوراق قبل الطباعة: ١٢ بطاقة على ورقتين', Boolean(sheets?.summary.includes('١٢') && sheets.summary.includes('٢ ورقة')));
  ok('والورقة الأولى تسعُ بطاقات بعلامات قصّها', sheets?.cards === 9 && sheets.marks === 24);
  if (shotsDir) await page.shot(join(shotsDir, 'designs-sheets.png'));
  await page.eval(`document.querySelector('[data-sheets] button[title="التالية"]').click()`);
  await wait(800);
  const last = await page.eval(`
    const o = document.querySelector('[data-sheets]');
    const el = [...o.querySelectorAll('[data-fit]')].find((e) => e.textContent.includes('عبد الرحمن'));
    return el ? { fits: el.firstElementChild.offsetWidth <= el.clientWidth + 0.5, w: el.firstElementChild.offsetWidth, room: el.clientWidth, size: parseFloat(el.style.fontSize), max: parseFloat(el.dataset.fit) } : null;
  `);
  ok(`والاسم الطويل صغُر حتى وسع ولم يُقصّ (${JSON.stringify(last)})`, Boolean(last?.fits && last.size < last.max));
  if (shotsDir) await page.shot(join(shotsDir, 'designs-sheets-2.png'));
  await click('button[data-act="pdf"]');
  await wait(4000);
  const pdfFile = readdirSync(saveDir).find((f) => f.endsWith('.pdf'));
  const pdf = pdfFile ? readFileSync(join(saveDir, pdfFile), 'latin1') : '';
  const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/g)].map((m) => [Math.round(+m[1]), Math.round(+m[2])]);
  ok('وحُفظ PDF', Boolean(pdfFile));
  ok('وفيه الأسماء لا ورقٌ أبيض', pdf.includes('/FontFile'));
  ok('بورقتين A4 أفقيّتين (٢٩٧ × ٢١٠ ملم)', boxes.length === 2 && boxes.every(([w, h]) => w === 842 && h === 595));

  // ── خيارات الورق وفاحص ما قبل الطباعة ─────────────────────────────
  const sheetState = () =>
    page.eval(`
      const o = document.querySelector('[data-sheets]');
      return { summary: o.querySelector('[data-sheets-summary]').innerText, text: o.innerText, first: o.querySelectorAll('.print-page')[0]?.innerText ?? '' };
    `);
  ok('وفاحص ما قبل الطباعة ظاهر', await page.eval(`return Boolean(document.querySelector('[data-preflight]'));`));
  // ورقةٌ استُعمل منها أربع خانات: تُكمَل من الخامسة، فتبقى ورقتان لاثنتي عشرة.
  await page.eval(`document.querySelector('[data-sheets] button[data-slot="4"]').click(); return true;`);
  await wait(500);
  ok('البدء من الخانة الخامسة: ١٢ بطاقة على ورقتين', (await sheetState()).summary.includes('٢ ورقة'));
  await page.eval(`document.querySelector('[data-sheets] button[data-slot="0"]').click(); return true;`);
  // بطاقتان تلفتا تُعادان وحدهما.
  await page.type('[data-sheets] input[data-act="pick-cards"]', '3-4');
  await wait(500);
  ok('وإعادة ما تلف وحده: «3-4» بطاقتان على ورقة', (await sheetState()).summary.includes('٢ بطاقة على ١ ورقة'));
  await page.type('[data-sheets] input[data-act="pick-cards"]', '');
  // ورقةٌ فاصلة لكلّ صفّ: الخامس (١١) والسادس (١).
  await page.eval(`
    const s = document.querySelector('[data-sheets] select[data-act="group-col"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'الصف');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await wait(700);
  const grouped = await sheetState();
  ok('والفواصل: أوّل ورقةٍ فاصلةُ «الخامس» بعددها', grouped.first.includes('الخامس') && grouped.first.includes('١١'));
  ok('وخمس أوراق: فاصلٌ وورقتان للخامس، وفاصلٌ وورقة للسادس', grouped.summary.includes('٥ ورقة'));

  await page.eval(`document.querySelector('[data-sheets] button[title="رجوع (Esc)"]').click()`);
  await wait(400);
  await page.type('textarea[data-batch-text]', '');
  await wait(300);

  ok('ولا تدخل القاعدة حتى تُحفظ', countRows() === 0);

  // ولوحةٌ نظيفة لما بعده: مغادرةُ الشاشة والعودةُ إليها تبدأ من المعرض.
  await page.goto('templates-library-drafts');
  await wait(600);
  await page.goto('designed-documents');
  await wait(800);

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
  // «هوية طالب» اسمُ تصميمٍ في المعرض أيضًا، فالنقر بالسمة لا بالنصّ —
  // وإلا فُتح المقترَح وظُنّ أنه المحفوظ.
  const opened = await page.eval(`
    const el = document.querySelector('button[data-saved]');
    if (!el) return null;
    // البطاقة تحمل الاسم، والزرّ فيها «فتح وتعديل».
    const card = el.parentElement?.textContent.trim() ?? '';
    el.click();
    return card;
  `);
  ok('والمحفوظ معروضٌ في قسمه', Boolean(opened) && opened.includes('هوية طالب'));
  await wait(900);
  ok('ويُفتح فيعود مقاسه', (await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`)).includes('85.6'));
  // والعدّ بالأسماء لا برقمٍ يتغيّر بكل إضافة. والباركود أُضيف بعد الحفظ،
  // فلا يعود معه — وهذا هو الصواب: يُفتح ما حُفظ لا ما كان على الشاشة.
  const reopened = await page.eval(`
    return [...document.querySelectorAll('input[data-value]')].map((el) => el.dataset.value);
  `);
  ok('وحقوله كما حُفظت لا كما كانت الشاشة', JSON.stringify(reopened) === '["اسم الطالب"]');

  // ── لا ذكاء اصطناعي ولا شبكة (المبدأ ٣): لا زرّ له، ولا جسر إليه ───────
  await page.eval(`document.querySelector('[data-act="gallery"]')?.click(); return true;`);
  await wait(400);
  ok('لا زرّ للتصميم بالذكاء الاصطناعي', await page.eval(`return !document.querySelector('[data-act="ai-recipe"]');`));
  ok('ولا جسر إلى Gemini', await page.eval(`return !('gemini' in window.diwan.designs) && !('setGeminiKey' in window.diwan.designs);`));

  if (shotsDir) await page.shot(join(shotsDir, 'designs.png'));
  return steps.join('\n');
}
