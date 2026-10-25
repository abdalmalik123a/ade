/**
 * سيناريو: حقل الصورة في الكتاب (S38، DC-2) — يُملأ عند كلّ ورقة من صورة الزبون في ملفّه أو من الجهاز.
 *
 * في مصمّم النماذج: سطرٌ و«حقل صورة» ← إطارٌ باسمه ← يُحفظ بحقله · وفي الشبّاك: «هات الزبون» زينب علي حسن (ملفّها بصورةٍ مختلَقة)
 * ← الحقل ممتلئ ← «راجع» فيه `<img>` بمسارها ← يُحفظ ← PDF الأرشيف فيه الصورة (`tools/pdfImage.mjs`) · وبلا زبونٍ: الإطار مطبوع ·
 * وفي المحرّر: «حقل صورة» ← «اختر صورة» من الجهاز في لوح القيم ← Word المصدَّر فيه صورة.
 *
 * الصورة مولَّدة هنا لا لشخص: مستطيلٌ رماديّ فاتح وبيضويٌّ أخضر بلونٍ لا يقع في الورقة غيره — فيُعدّ في PDF بكسلًا بكسلًا.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { strFromU8, unzipSync } from 'fflate';
import { pdfToImages } from '../pdfImage.mjs';

const GREEN = [30, 160, 90];
/** الأخضر رماديًّا بأوزان الإضاءة (٠٫٢٩٩ و٠٫٥٨٧ و٠٫١١٤). */
const GRAY = Math.round(0.299 * GREEN[0] + 0.587 * GREEN[1] + 0.114 * GREEN[2]);
const TITLE = 'بطاقة تعريف المراجع';

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

/** صورةٌ ٣٥٠×٤٥٠ (نسبة ٣٫٥×٤٫٥): خلفيةٌ رماديّة فاتحة وبيضويٌّ أخضر في وسطها. */
function photoPng() {
  const w = 350;
  const h = 450;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const inside = ((x - 175) / 140) ** 2 + ((y - 225) / 190) ** 2 < 1;
      row.set(inside ? GREEN : [225, 228, 232], 1 + x * 3);
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
  const dir = join(process.env.TEMP ?? '.', `diwan-image-field-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const photo = join(dir, 'صورة-شخصية.png');
  writeFileSync(photo, photoPng());
  process.env.IMAGE_FIELD_PHOTO = photo;
  const save = join(dir, 'save');
  mkdirSync(save, { recursive: true });
  process.env.DIWAN_TEST_SAVE_DIR = save;
  return { DIWAN_TEST_OPEN_FILE: photo, DIWAN_TEST_SAVE_DIR: save };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const until = async (expr, ms = 8000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await page.eval(`return Boolean(${expr});`)) return true;
      await wait(250);
    }
    return false;
  };
  const ED = '[data-page-editor]';
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  /** المؤشّر في آخر أوّل سطرٍ من الورقة، ثم الكتابة كما تكتب لوحة المفاتيح. */
  const typeFirstLine = async (text) => {
    await page.eval(`
      const ed = document.querySelector('${ED}');
      ed.focus();
      const range = document.createRange();
      range.selectNodeContents(ed.querySelector(':scope > p'));
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
    await page.send('Input.insertText', { text });
    await wait(300);
  };
  const insertImageField = async () => {
    await click('[data-act="insert"]');
    await wait(400);
    await click('[data-act="ins-image"]');
    await wait(400);
    return click('[data-act="ins-image-field"]');
  };
  /**
   * بكسلات PDF الأرشيف بلون الصورة المختلَقة — يرسمها Chromium رماديّةً (`pdfImage`) ويعدّها في الصفحة نفسها:
   * أخضرها رماديٌّ وسطٌ (نحو ١١٣) لا يقع في ورقةٍ نصّها أسود وخلفيّتها بيضاء إلا على حوافّ الحروف قليلًا.
   */
  const greenInPdf = async (path) => {
    const [first] = await pdfToImages(path, { dpi: 72 });
    if (!first) return 0;
    return page.eval(`
      const bytes = Uint8Array.from(atob(${JSON.stringify(first.png.toString('base64'))}), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ${GRAY}) < 20 && Math.abs(d[i + 1] - ${GRAY}) < 20 && Math.abs(d[i + 2] - ${GRAY}) < 20) n++;
      return n;
    `);
  };

  // ── ١. المصمّم: سطرٌ و«حقل صورة» ← إطارٌ باسمه ← يُحفظ بحقله ────────
  await page.goto('templates-library-drafts');
  await wait(700);
  await click('[data-act="new-blank"]');
  await wait(1200);
  await page.type('input[placeholder^="مثال: تأييد"]', TITLE);
  await wait(200);
  const line = 'بطاقة تعريف المراجع أحمد عادل';
  await typeFirstLine(line);
  ok('«حقل صورة» في لوح «صورة» من قائمة الإدراج', await insertImageField());
  ok(
    'وفي الورقة إطارٌ ١٣٢×١٧٠ وفيه «الصورة»',
    await until(`(() => { const f = document.querySelector('${ED} [data-image-field="الصورة"]'); return f && f.textContent === 'الصورة' && f.offsetWidth === 132 && f.offsetHeight === 170; })()`)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'image-field-editor.png'));
  // ثم حقل الاسم بـF4 — بعد حقل الصورة عمدًا: كان أوّلُ حقلٍ مملوءٍ يُؤخذ اسمَ صاحب العلاقة، فيصير المسار اسمًا في السجلّ.
  await wait(400);
  const from = line.indexOf('أحمد عادل');
  await page.eval(`
    const ed = document.querySelector('${ED}');
    ed.focus();
    const node = document.createTreeWalker(ed.querySelector(':scope > p'), NodeFilter.SHOW_TEXT).nextNode();
    const range = document.createRange();
    range.setStart(node, ${from});
    range.setEnd(node, ${from + 'أحمد عادل'.length});
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  `);
  await wait(250);
  await page.key('F4');
  // ونقرةٌ برمجيّة فور F4 — بلا ترك التركيز ولا انتظار: الحفظ يستعجل المحرّر ويأخذ آخر ما فيه (D172؛ كان المحرّر يرسل بعد ربع ثانية).
  await page.clickText('حفظ النموذج');
  let row = null;
  for (let t = 0; t < 40 && !row; t++) {
    await wait(250);
    const d1 = db();
    row = d1.prepare('SELECT doc_json AS docJson FROM templates WHERE title = ?').get(TITLE) ?? null;
    d1.close();
  }
  const saved = row ? JSON.parse(row.docJson) : null;
  const block = saved?.blocks?.find((b) => b.kind === 'image');
  ok('وحُفظ النموذج بكتلةٍ مربوطةٍ بالحقل ومقاسها', block?.field === 'الصورة' && block.src === '' && block.width === 132 && block.height === 170);
  ok(
    'وحقله صورةٌ مصدرها صورة الزبون في ملفّه، ثم حقل الاسم',
    JSON.stringify(saved?.fields?.map((f) => [f.key, f.type, f.source])) === JSON.stringify([['الصورة', 'image', 'photoPath'], ['أحمد_عادل', 'text', null]])
  );

  // ── ٢. ملفّ زينب بصورةٍ مختلَقة ──────────────────────────────────────
  const citizen = await page.eval(`
    const photo = await window.diwan.files.pickImage('photos');
    const c = await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', nationalId: null, jobTitle: null, workplace: null,
      employeeCode: null, serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null,
      landmark: null, phone: null, photoPath: photo, category: null, notes: null, verified: false });
    return { id: c.id, photo };
  `);
  ok('ملفّ زينب علي حسن بصورته في المخزن', /^photos\//.test(citizen.photo ?? ''));

  // ── ٣. الشبّاك: «هات الزبون» يملأ الحقل، والمراجعة والأرشيف بالصورة ──
  await page.goto('service-counter');
  await wait(900);
  await page.clickText(TITLE, 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  ok(
    'خانة الصورة في «املأ» بمصغّرةٍ و«اختر صورة» لا خانة نصّ',
    (await until(`document.querySelector('[data-image-input="الصورة"] [data-act="pick-field-image"]')`)) && !(await page.eval(`return Boolean(document.querySelector('[data-image-thumb]'));`))
  );
  if (shotsDir) await page.shot(join(shotsDir, 'image-field-fill.png'));
  await click('[data-act="pick-customer"]');
  await wait(800);
  await page.clickText('زينب علي حسن', 'button');
  ok('و«هات الزبون» يملؤها بصورتها من ملفّها', await until(`document.querySelector('[data-image-thumb="الصورة"]')?.getAttribute('src') === 'diwan://store/${citizen.photo}'`));
  await page.type('[data-fill-form] input[type="text"]', 'زينب علي حسن');
  await page.clickText('راجع الأوراق', 'button');
  await wait(1200);
  ok('وفي المراجعة صورتها على الورقة', await until(`document.querySelector('.a4-sheet img[src="diwan://store/${citizen.photo}"]')?.complete`));
  if (shotsDir) await page.shot(join(shotsDir, 'image-field-review.png'));
  await page.clickText('احفظ بلا طباعة');
  await wait(1800);
  const d2 = db();
  const issued = d2.prepare('SELECT id, citizen_id AS citizenId, citizen_name AS name, body_html AS body FROM documents ORDER BY id DESC').get();
  d2.close();
  ok('وحُفظت في السجلّ بصورتها', Boolean(issued) && issued.body.includes(`diwan://store/${citizen.photo}`));
  // والمسار ليس اسمًا: صاحب العلاقة زينب من ملفّها لا مسار صورتها (أوّل حقلٍ مملوء كان يُؤخذ اسمًا).
  ok(`وصاحب العلاقة في السجلّ زينب لا مسار الصورة (${issued?.name ?? '—'})`, issued?.citizenId === citizen.id && issued?.name === 'زينب علي حسن');
  if (issued) {
    const path = await page.eval(`return window.diwan.documents.exportPdf(${issued.id});`);
    const green = path ? await greenInPdf(path) : 0;
    ok(`وPDF الأرشيف فيه الصورة (${green} بكسلًا بلونها)`, green > 2000);
  }

  // ── ٤. بلا زبون: الإطار مطبوع بمقاسه ────────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.clickText(TITLE, 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  await wait(1200);
  await page.clickText('راجع الأوراق', 'button');
  await wait(1200);
  ok(
    'وبلا زبونٍ إطارٌ رفيعٌ بمقاسه على الورقة مكانًا للصورة',
    await page.eval(`
      const f = document.querySelector('.a4-sheet [data-image-field="الصورة"] span');
      return Boolean(f) && !document.querySelector('.a4-sheet img') && f.offsetWidth === 132 && f.offsetHeight === 170 && getComputedStyle(f).borderTopStyle === 'solid';
    `)
  );

  // ── ٥. المحرّر: «اختر صورة» من الجهاز في لوح القيم، وWord بالصورة ────
  // يُفتح من بطاقته في «اختر» بالشبّاك — والمعاملة الفارغة تُلغى أوّلًا.
  await click('[data-act="discard"]');
  await wait(600);
  await page.goto('smart-editor-a4-preview');
  await wait(1200);
  await typeFirstLine('صورة المراجع');
  await insertImageField();
  ok('وفي المحرّر خانة الصورة في لوح القيم', await until(`document.querySelector('[data-value-of="الصورة"] [data-act="pick-field-image"]')`));
  await click('[data-value-of="الصورة"] [data-act="pick-field-image"]');
  ok('و«اختر صورة» يضعها من الجهاز', await until(`/^diwan:\\/\\/store\\/photos\\//.test(document.querySelector('[data-image-thumb="الصورة"]')?.getAttribute('src') ?? '')`));
  const before = new Set(readdirSync(saveDir));
  await click('[data-act="export-word"]');
  let docx = null;
  for (let t = 0; t < 40 && !docx; t++) {
    await wait(250);
    docx = readdirSync(saveDir).find((f) => f.endsWith('.docx') && !before.has(f)) ?? null;
  }
  const files = docx ? unzipSync(new Uint8Array(readFileSync(join(saveDir, docx)))) : {};
  // وفيه صورة الحقل بايتًا ببايت (وقد يكون معها شعار الترويسة).
  const photo = readFileSync(process.env.IMAGE_FIELD_PHOTO);
  const media = Object.keys(files).filter((k) => k.startsWith('word/media/'));
  ok(
    `وWord المصدَّر فيه الصورة (${media.length} صورة في حزمته)`,
    media.some((k) => Buffer.from(files[k]).equals(photo)) && strFromU8(files['word/document.xml'] ?? new Uint8Array()).includes('<w:drawing>')
  );

  return steps.join('\n');
}
