/**
 * سيناريو: صفحات ورقة الأسئلة بالقياس لا بالتقدير (D133).
 *
 * كان التقسيم يعدّ الحروف «أسطرًا»: ستّة أسئلةٍ بفروعٍ قصيرة تسعها صفحةٌ قُسمت وجهين، وثلاث صورٍ بعرض ٦٠٠ فاضت إلى ورقةٍ ثالثة
 * تذييلها «٢ من ٢»، ولا أكثر من وجهين. واليوم تُقاس الأسئلة مرسومةً:
 * (أ) ستّة أسئلة لكلٍّ ثلاثة فروعٍ قصيرة ← ورقةٌ واحدة بلا «الصفحة» ·
 * (ب) ثلاثون سؤالًا بفرعين ← ن ≥ ٣ أوراق، وتذييلاتها «الصفحة 1 من ن»…«ن من ن»، ولا ورقة أطول من ١١٢٣ بكسلًا، وPDF ن صفحة لا بيضاء فيها ·
 * (ج) ثلاث صورٍ بعرض ٦٠٠ ← لا ورقة تفيض، وPDF بعدد الأوراق ·
 * (د) «بوجهين» على (أ) ← ورقتان، وإطفاؤه ← ورقة.
 * وصفحات PDF (ب) و(ج) صورًا في مجلّد اللقطات إن أُعطي، لتُرى بلا فيضٍ ولا تراكب.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { pdfToImages } from '../pdfImage.mjs';

const DIR = join(process.env.TEMP ?? '.', `diwan-exam-pages-${Date.now()}`);
const FILE = join(DIR, 'مخطط_الدائرة.png');

/** صورةٌ بلونٍ واحد ٦٠٠×٤٥٠ — بعرض ٦٠٠ ترتفع ٤٥٠ بكسلًا في الورقة. */
function png(width, height) {
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set([40, 100, 200], y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function prepare() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, png(600, 450));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

/** حجم محتوى الصفحة: مجرى واحد أو مصفوفة مجارٍ (كـ`pdfChunks`). */
function contentSize(doc, c) {
  if (!c) return 0;
  if (typeof c.getContentsSize === 'function') return c.getContentsSize();
  if (typeof c.asArray === 'function') return c.asArray().reduce((n, ref) => n + contentSize(doc, doc.context.lookup(ref)), 0);
  return 0;
}

async function inspectPdf(filePath) {
  const doc = await PDFDocument.load(readFileSync(filePath));
  const sizes = doc.getPages().map((p) => contentSize(doc, p.node.Contents()));
  const sorted = [...sizes].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return { count: doc.getPageCount(), sizes, hasBlank: Math.min(...sizes) < 0.3 * med };
}

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  const work = join(saveDir, '..');

  const head = async () => {
    await page.type('input[data-head="المدرسة"]', 'مدرسة النور');
    await page.type('input[data-head="المادة"]', 'الفيزياء');
    await page.type('input[data-head="الصف"]', 'السادس العلمي');
    await page.type('input[data-head="نوع الامتحان"]', 'النهائي');
  };

  /** يبني ورقةً بـ`n` سؤالًا لكلٍّ `branches` فرعًا، ويكتب نصوصها بترتيبها على الشاشة. */
  const build = async (n, branches, questionText, branchText) => {
    await page.eval(`
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const button = (text) => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(text));
      for (let i = 1; i < ${n}; i++) { button('أضف سؤالًا').click(); await sleep(30); }
      // زرّ «أضف فرعًا» للسؤال نفسه آخرُ أبنائه (بعد فروعه) — لا أوّل زرٍّ بعده، فذاك زرّ فرعه.
      for (let k = 0; k < ${n}; k++) {
        for (let j = 0; j < ${branches}; j++) {
          const root = document.querySelectorAll('[data-question="root"]')[k];
          [...root.children].filter((c) => c.matches('button[title="أضف فرعًا"]')).pop().click();
          await sleep(30);
        }
      }
      const set = (el, v) => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const boxes = [...document.querySelectorAll('textarea[data-question-text]')];
      for (let i = 0; i < boxes.length; i++) {
        const q = Math.floor(i / ${branches + 1});
        const b = i % ${branches + 1};
        set(boxes[i], b === 0 ? ${JSON.stringify(questionText)} + ' (' + (q + 1) + ')' : ${JSON.stringify(branchText)} + ' ' + b);
        await sleep(15);
      }
      return boxes.length;
    `);
    await wait(1200);
  };

  /** الأوراق المعروضة: عددها وارتفاع كلّ ورقةٍ ومتنها، ونصّ تذييلاتها. */
  const sheets = () =>
    page.eval(`
      const all = [...document.querySelectorAll('[data-sheet-page]')];
      return all.map((s) => ({
        h: s.offsetHeight,
        body: s.firstElementChild ? s.firstElementChild.scrollHeight : 0,
        footer: s.querySelector('[data-paper-page-footer]')?.innerText ?? '',
        text: s.innerText
      }));
    `);
  const noOverflow = (list) => list.every((s) => s.h <= 1124 && s.body <= 1124);

  const checkbox = async (act, on) => {
    await page.eval(`const el = document.querySelector('input[data-act="${act}"]'); if (el && el.checked !== ${on}) el.click(); return el?.checked;`);
    await wait(700);
  };

  const pdf = async (kind) => {
    const since = Date.now();
    await page.eval(`const el = [...document.querySelectorAll('button[data-act="pdf"]')].find((b) => b.offsetParent); el?.click(); return Boolean(el);`);
    for (let i = 0; i < 60; i++) {
      await wait(500);
      const f = readdirSync(saveDir).find((n) => n.toLowerCase().endsWith('.pdf') && statSync(join(saveDir, n)).mtimeMs >= since);
      if (f) {
        await wait(800);
        const copy = join(work, `${kind}.pdf`);
        copyFileSync(join(saveDir, f), copy);
        return copy;
      }
    }
    return null;
  };
  const pictures = async (file, kind) => {
    if (!shotsDir) return;
    for (const im of await pdfToImages(file)) writeFileSync(join(shotsDir, `exam-pages-${kind}-${im.page}.png`), im.png);
  };

  /** «ورقة جديدة» — والورقة المكتوبة تُترك بلا حفظ. */
  const fresh = async () => {
    await page.clickText('ورقة جديدة');
    await wait(500);
    await page.eval(`document.querySelector('[data-confirm] [data-choice="discard"]')?.click(); return true;`);
    await wait(600);
  };

  await page.goto('exam-papers');
  await wait(800);
  await head();

  // (أ) ستّة أسئلة لكلٍّ ثلاثة فروعٍ قصيرة
  await build(6, 3, 'أجب عمّا يأتي', 'عرّف الكمية الفيزيائية');
  let list = await sheets();
  ok(`(أ) ستّة أسئلة بثلاثة فروعٍ قصيرة ← ورقةٌ واحدة (${list.length})`, list.length === 1);
  ok('(أ) ولا «الصفحة» في تذييلها', list.length === 1 && !list[0].footer && !list[0].text.includes('الصفحة'));
  ok(`(أ) ولا تفيض (${list.map((s) => s.body).join('، ')})`, noOverflow(list));

  // (د) «بوجهين» على (أ) ثم إطفاؤه
  await checkbox('duplex', true);
  list = await sheets();
  ok(`(د) «بوجهين» يقسمها ورقتين (${list.length})`, list.length === 2);
  ok('(د) وتذييلاهما «الصفحة 1 من 2» و«الصفحة 2 من 2»', list.length === 2 && list[0].footer.includes('الصفحة 1 من 2') && list[1].footer.includes('الصفحة 2 من 2'));
  await checkbox('duplex', false);
  list = await sheets();
  ok(`(د) وإطفاؤه يعيدها ورقةً واحدة (${list.length})`, list.length === 1);

  // (ب) ثلاثون سؤالًا بفرعين
  await fresh();
  await head();
  await build(30, 2, 'اشرح ما يأتي مع ذكر القانون والوحدة', 'بيّن العوامل التي يعتمد عليها');
  list = await sheets();
  const n = list.length;
  ok(`(ب) ثلاثون سؤالًا بفرعين ← ${n} أوراق (≥ ٣)`, n >= 3);
  ok(
    '(ب) وتذييلاتها «الصفحة 1 من ن»…«ن من ن»، و«اقلب الصفحة» إلا الأخيرة',
    list.every((s, i) => s.footer.includes(`الصفحة ${i + 1} من ${n}`) && s.footer.includes('اقلب الصفحة') === (i < n - 1))
  );
  ok('(ب) و«تابع أسئلة الفيزياء — النهائي» من الثانية', list.slice(1).every((s) => s.text.includes('تابع أسئلة الفيزياء — النهائي')) && !list[0].text.includes('تابع أسئلة'));
  ok(`(ب) ولا ورقة أطول من ١١٢٣ بكسلًا (${list.map((s) => s.body).join('، ')})`, noOverflow(list));
  const questions = list.map((s) => (s.text.match(/اشرح ما يأتي مع ذكر القانون والوحدة \(\d+\)/g) ?? []).length);
  ok(`(ب) والأسئلة الثلاثون كلّها، كلٌّ مرّة (${questions.join(' + ')})`, questions.reduce((a, b) => a + b, 0) === 30);
  const longPdf = await pdf('long');
  ok('(ب) حُفظ PDF', Boolean(longPdf));
  if (longPdf) {
    const info = await inspectPdf(longPdf);
    ok(`(ب) PDF ${info.count} صفحة بعدد الأوراق (${n})`, info.count === n);
    ok(`(ب) ولا صفحة بيضاء (${info.sizes.join('، ')})`, !info.hasBlank);
    await pictures(longPdf, 'long');
  }

  // (ج) ثلاث صورٍ بعرض ٦٠٠
  await fresh();
  await head();
  await build(3, 0, 'بالاعتماد على الشكل الآتي احسب المقاومة المكافئة', '');
  for (let i = 0; i < 3; i++) {
    await page.eval(`document.querySelectorAll('button[data-act="question-image"]')[${i}].click(); return true;`);
    await wait(900);
  }
  await page.eval(`
    for (const inp of document.querySelectorAll('[data-question-image-preview] input[type="number"]')) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '600');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  `);
  await wait(2000);
  const images = await page.eval(`return [...document.querySelectorAll('[data-sheet-page] [data-question-image] img')].map((im) => (im.complete && im.naturalWidth > 0 ? im.offsetHeight : 0));`);
  ok(`(ج) الصور الثلاث مرسومةٌ بعرض ٦٠٠ (ارتفاعها ${images.join('، ')})`, images.length === 3 && images.every((h) => h >= 440));
  list = await sheets();
  ok(`(ج) ثلاث صورٍ ← ${list.length} أوراق، ولا ورقة تفيض (${list.map((s) => s.body).join('، ')})`, list.length >= 2 && noOverflow(list));
  const imagePdf = await pdf('images');
  if (imagePdf) {
    const info = await inspectPdf(imagePdf);
    ok(`(ج) PDF ${info.count} صفحة بعدد الأوراق (${list.length})`, info.count === list.length);
    await pictures(imagePdf, 'images');
  } else ok('(ج) حُفظ PDF الصور', false);

  return steps.join('\n');
}
