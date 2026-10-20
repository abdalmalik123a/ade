/**
 * سيناريو: صورةٌ داخل السؤال في ورقة الأسئلة (S15 · ر157 · D131).
 *
 * يفتح شاشة الأسئلة، ويملأ رأس الامتحان، ويكتب نص السؤال، ثم يضغط زرّ «أرفق صورة توضيحية»
 * (data-act="question-image") ويتحقق من:
 * ١. ظهور بطاقة المعاينة المصغرة للصورة في لوح تحرير السؤال.
 * ٢. ظهور الصورة (وسم <img> برابط diwan://store/...) تحت نص السؤال في المعاينة والورقة.
 * ٣. ضبط عرض الصورة وتأثيره على المعاينة.
 * ٤. حذف الصورة بـ data-act="remove-question-image" واختفائها من المعاينة.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DIR = join(process.env.TEMP ?? '.', `diwan-exam-img-${Date.now()}`);
const FILE = join(DIR, 'دائرة_كهربائية.png');
const SIZE = 120;

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
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = 40;
    rgb[i + 1] = 100;
    rgb[i + 2] = 200;
  }
  writeFileSync(FILE, png(SIZE, SIZE, rgb));
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const head = (key, value) => page.type(`input[data-head="${key}"]`, value);

  const question = async (n, text) => {
    const ok = await page.eval(`
      const boxes = [...document.querySelectorAll('textarea[data-question-text]')];
      const el = boxes[${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return ok;
  };

  const click = async (selector) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('not found: ' + ${JSON.stringify(selector)});
      el.click();
      return true;
    `);
    await wait(400);
  };

  // ١. الانتقال إلى شاشة الأسئلة
  await page.goto('exam-papers');
  await wait(700);

  // ٢. ملء الرأس
  await head('المحافظة', 'بغداد / الكرخ الأولى');
  await head('المدرسة', 'ثانوية دجلة للبنات');
  await head('المادة', 'الفيزياء');
  await head('الصف', 'الرابع العلمي');
  await wait(400);

  // ٣. كتابة نص السؤال
  await question(0, 'بالاعتماد على الدائرة الكهربائية الموضحة في الشكل أدناه، احسب المقاومة المكافئة:');
  await wait(400);

  // ٤. التأكد من وجود زر إرفاق صورة للسؤال
  const hasImgBtn = await page.eval(`return Boolean(document.querySelector('button[data-act="question-image"]'));`);
  ok('زرّ إرفاق صورة للسؤال متاح في لوح التحرير', hasImgBtn);

  // ٥. الضغط على زر إرفاق الصورة
  await click('button[data-act="question-image"]');
  await wait(800);

  // ٦. التحقق من ظهور بطاقة المعاينة المصغّرة في لوح تحرير السؤال
  const hasPreview = await page.eval(`return Boolean(document.querySelector('[data-question-image-preview]'));`);
  ok('ظهور بطاقة معاينة الصورة المصغرة في المحرّر', hasPreview);

  // ٧. التحقق من ظهور الصورة داخل ورقة الأسئلة في المعاينة
  const hasImgInSheet = await page.eval(`
    const img = document.querySelector('[data-paper] [data-question-image] img');
    return Boolean(img && img.src.includes('diwan://store/'));
  `);
  ok('الصورة مرسومة في المعاينة برابط مخزن ديوان الآمن (diwan://store/)', hasImgInSheet);

  // ٨. تعديل عرض الصورة إلى 240px
  await page.eval(`
    const inp = document.querySelector('[data-question-image-preview] input[type="number"]');
    if (inp) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '240');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);
  await wait(400);

  const customWidthInSheet = await page.eval(`
    const img = document.querySelector('[data-paper] [data-question-image] img');
    return img ? img.style.width === '240px' : false;
  `);
  ok('تعديل عرض الصورة ينعكس على المعاينة (240px)', customWidthInSheet);

  if (shotsDir) await page.shot(join(shotsDir, 'exam-question-image.png'));

  // ٩. حذف الصورة والتأكد من اختفائها
  await click('button[data-act="remove-question-image"]');
  await wait(400);

  const previewRemoved = await page.eval(`return !document.querySelector('[data-question-image-preview]');`);
  const sheetImgRemoved = await page.eval(`return !document.querySelector('[data-paper] [data-question-image]');`);
  ok('حذف الصورة يزيلها من المحرّر', previewRemoved);
  ok('وحذفها يزيلها من ورقة الأسئلة في المعاينة', sheetImgRemoved);

  return steps;
}
