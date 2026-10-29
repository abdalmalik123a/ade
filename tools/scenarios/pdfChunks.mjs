/**
 * سيناريو: تجزئة PDF في الدفعات الكبيرة (D113) — ٢٠ ورقة بلا علامة مائية وبعلامة «معاينة»
 * تُخرج PDF بعشرين صفحة بالضبط في كلٍّ، ولا صفحة محتواها أقصر من نصف وسيط الصفحات (لا صفحات بيضاء).
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const NAMES = [
  'زينب علي حسن', 'سالم حسن الربيعي', 'مريم جاسم محمد', 'كريم سالم العبيدي',
  'هدى عمر التميمي', 'نور باسم الساعدي', 'أحمد كريم الجبوري', 'فاطمة علي الخفاجي',
  'حيدر سعد الموسوي'
];

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-pdfchunks-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const env = { DIWAN_TEST_SAVE_DIR: join(dir, 'save') };
  Object.assign(process.env, env);
  return env;
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

async function inspectPdf(filePath) {
  const bytes = readFileSync(filePath);
  const doc = await PDFDocument.load(bytes);
  const count = doc.getPageCount();
  const pages = doc.getPages();
  const sizes = pages.map((p) => {
    const c = p.node.Contents();
    if (!c) return 0;
    if (typeof c.size === 'function') return c.size();
    if (typeof c.length === 'number') return c.length;
    return JSON.stringify(c).length;
  });
  const med = median(sizes);
  const min = Math.min(...sizes);
  return { count, sizes, median: med, min, hasBlank: min < 0.5 * med };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const clickShown = (sel) =>
    page.eval(`const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => b.offsetParent); el?.click(); return Boolean(el);`);

  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  const work = join(saveDir, '..');

  const savedPdf = async (since, kind) => {
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

  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="student-id"]');
  await wait(1000);

  // التبويب «إضافة وتعبئة»
  await page.eval(`document.querySelector('[data-design-panel="fill"]')?.click(); return true;`);
  await wait(300);

  // ١٨٠ اسمًا = ٢٠ ورقة (٩ بطاقات في الورقة)
  const rows = Array.from({ length: 180 }, (_, i) => `${NAMES[i % NAMES.length]} ${i + 1}\tالخامس\t2026-${String(i + 1).padStart(4, '0')}`);
  const tsv = ['الاسم\tالصف\tالرقم', ...rows].join('\n');
  await page.type('textarea[data-batch-text]', tsv);
  await wait(1000);

  // مراجعة الأوراق
  await click('button[data-act="sheets"]');
  await wait(2000);

  // ١. بدون علامة مائية
  let since = Date.now();
  await clickShown('[data-sheets] button[data-act="pdf"]');
  const noWmPath = await savedPdf(since, 'chunks-nowm');
  ok('حفظ PDF لعشرين ورقة بلا علامة مائية', Boolean(noWmPath));
  if (noWmPath) {
    const info = await inspectPdf(noWmPath);
    ok('بلا علامة: عشرون ورقة تُخرج عشرين صفحة PDF', info.count === 20);
    ok('بلا علامة: لا صفحة بيضاء (محتوى كل صفحة ≥ نصف الوسيط)', !info.hasBlank);
  }

  // ٢. بعلامة «معاينة»
  await page.eval(`document.querySelector('details[data-options-box]')?.setAttribute('open', ''); return true;`);
  await wait(200);
  await page.eval(`const el = document.querySelector('input[data-act="preview-watermark"]'); if (el && !el.checked) { el.click(); } return el?.checked;`);
  await wait(600);

  since = Date.now();
  await clickShown('[data-sheets] button[data-act="pdf"]');
  const wmPath = await savedPdf(since, 'chunks-wm');
  ok('حفظ PDF لعشرين ورقة بعلامة معاينة', Boolean(wmPath));
  if (wmPath) {
    const info = await inspectPdf(wmPath);
    ok('بعلامة معاينة: عشرون ورقة تُخرج عشرين صفحة PDF', info.count === 20);
    ok('بعلامة معاينة: لا صفحة بيضاء (محتوى كل صفحة ≥ نصف الوسيط)', !info.hasBlank);
  }

  return steps.join('\n');
}
