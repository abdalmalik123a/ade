/**
 * تجارب المرحلة صفر المقيسة (DESIGNS.md ٠٫١٠) — على جهازٍ بمواصفات المكاتب (٨ غيغا وCore i5)، بالبرنامج الحقيقي:
 *
 * ١. **دفعة ٤٠٠ هوية**: قائمةٌ تُلصق، ومجلّد ٤٠٠ صورةٍ يُطابَق بأسمائها، ومراجعة الأوراق، وPDF — بالزمن والذاكرة.
 *    والصور مولّدةٌ بضجيجٍ لا يُضغط (أثقل من صور الهويات الحقيقية) — فالنتيجة أسوأ الحالات لا أحسنها.
 * ٢. **القناع والتدرّج في PDF**: أيبقى التدرّج متّجهًا (`/Shading`) أم يصير صورة، وماذا يصنع القناع والقصّ.
 * ٣. **العربية على قوس** (`<textPath>`): أتبقى الحروف موصولةً على المنحنى — لقطةٌ من الواجهة، وPDF.
 *
 *   node tools/drive.mjs tools/experiments/designs-0.10.mjs
 *
 * ليست سيناريو (لا ✓ ولا ✗، ولا تدخل الجولة): تكتب أرقامها ولقطاتها في `reports/تجارب-٠٫١٠/` (خارج git).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const STAMP = Date.now();
const ROOT = join(process.env.TEMP ?? '.', `diwan-exp010-${STAMP}`);
const PHOTOS = join(ROOT, 'photos');
const OUT = join(ROOT, 'out');
const REPORT = join(process.cwd(), 'reports', 'تجارب-٠٫١٠');
const N = 400;

// ── صورٌ مولّدة ───────────────────────────────────────────────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
};
/** صورةٌ بوجهٍ بيضويٍّ فوق تدرّجٍ وضجيجٍ لا يُضغط — كلٌّ بلونٍ من رقمها. */
function photo(i, w = 240, h = 320) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  let seed = i * 2654435761;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 24);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const face = ((x - w / 2) / (w * 0.3)) ** 2 + ((y - h * 0.45) / (h * 0.3)) ** 2 < 1;
      const base = face ? [224, 186, 160] : [40 + ((i * 37) % 160), 90, 150 + (y * 80) / h];
      for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.max(0, Math.min(255, base[c] + (rnd() % 40) - 20));
    }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const FIRST = ['زينب', 'مريم', 'فاطمة', 'سارة', 'نور', 'علي', 'حسين', 'محمد', 'أحمد', 'عمر', 'يوسف', 'حسن'];
const LAST = ['علي', 'حسن', 'كريم', 'جاسم', 'عباس', 'محمود', 'صالح', 'هادي', 'ناصر', 'سلمان'];
const NAMES = Array.from({ length: N }, (_, i) => `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]} ${i + 1}`);

export function prepare() {
  mkdirSync(PHOTOS, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  NAMES.forEach((name, i) => writeFileSync(join(PHOTOS, `${name}.png`), photo(i)));
  // ورقة المؤثّرات تُفتح في «ملفات PDF» بعد أن تُحفظ — فتُرى كما خرجت لا كما رُسمت.
  return { DIWAN_TEST_OPEN_DIR: PHOTOS, DIWAN_TEST_SAVE_DIR: OUT, DIWAN_TEST_OPEN_FILES: join(OUT, 'مؤثّرات-٠٫١٠.pdf') };
}

// ── القياس ───────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** ذاكرة عمليّات البرنامج كلّها (النافذة ونوافذ الإخراج والرئيسة) بالميغابايت. */
function memoryMb() {
  try {
    const csv = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV /NH', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const kb = [...csv.matchAll(/"([\d,.\s]+) K"/g)].map((m) => Number(m[1].replace(/[^\d]/g, '')));
    return { total: Math.round(kb.reduce((a, b) => a + b, 0) / 1024), largest: Math.round(Math.max(0, ...kb) / 1024), processes: kb.length };
  } catch {
    return { total: 0, largest: 0, processes: 0 };
  }
}
/** يقيس عملًا بزمنه وذروة ذاكرته (عيّنةٌ كلّ نصف ثانية). */
async function measured(work) {
  let peak = memoryMb();
  let running = true;
  const sampler = (async () => {
    while (running) {
      const m = memoryMb();
      if (m.total > peak.total) peak = m;
      await wait(500);
    }
  })();
  const t0 = Date.now();
  const value = await work();
  const ms = Date.now() - t0;
  running = false;
  await sampler;
  return { ms, peak, value };
}
const until = async (fn, timeout = 300_000, step = 250) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await wait(step);
  }
  return null;
};
const sec = (ms) => `${(ms / 1000).toFixed(1)} ث`;

export default async function experiment(page) {
  mkdirSync(REPORT, { recursive: true });
  const lines = [];
  const log = (s) => lines.push(s);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const pdfs = () => readdirSync(OUT).filter((f) => f.endsWith('.pdf'));

  const idle = memoryMb();
  log(`الجهاز: ${execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name"', { encoding: 'utf8' }).trim()} · ${Math.round(Number(execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"', { encoding: 'utf8' })) / 1024 ** 3)} غيغا`);
  log(`البرنامج خاملًا: ${idle.total} م.ب في ${idle.processes} عمليات`);

  // ── ١. دفعة ٤٠٠ هوية ────────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(800);
  await click('button[data-kind="student-id"]');
  await wait(1200);
  const keys = await page.eval(`return [...document.querySelectorAll('input[data-value]')].map((e) => e.dataset.value);`);
  const photoKey = await page.eval(`return document.querySelector('button[data-photo]')?.dataset.photo ?? null;`);
  const cols = keys.filter((k) => k !== photoKey);
  const value = (k, i) => (k.includes('اسم') || k === 'الاسم' ? NAMES[i] : /رقم|الرقم/.test(k) ? String(2026000 + i) : /صف|المرحلة/.test(k) ? 'الخامس الإعدادي' : /شعبة/.test(k) ? 'أ' : `${k} ${i + 1}`);
  const tsv = [cols.join('\t'), ...NAMES.map((_, i) => cols.map((k) => value(k, i)).join('\t'))].join('\n');

  const paste = await measured(async () => {
    await page.type('textarea[data-batch-text]', tsv);
    return until(() => page.eval(`return (document.querySelector('[data-batch-summary]')?.innerText ?? '').includes('٤٠٠');`));
  });
  log(`\n١. دفعة ${N} هوية (${keys.length} حقلًا: ${keys.join('، ')})`);
  log(`   لصق القائمة وقراءتها: ${sec(paste.ms)}`);

  const photos = await measured(async () => {
    await click('button[data-act="photos"]');
    return until(() => page.eval(`return /طوبقت/.test(document.querySelector('[data-batch]')?.innerText ?? '');`));
  });
  const matchedText = await page.eval(`return (document.querySelector('[data-batch]')?.innerText ?? '').match(/طوبقت[^\\n]*/)?.[0] ?? '';`);
  const photoBytes = readdirSync(PHOTOS).reduce((a, f) => a + statSync(join(PHOTOS, f)).size, 0);
  log(`   نسخ ${N} صورة (${(photoBytes / 1024 ** 2).toFixed(0)} م.ب) إلى المخزن ومطابقتها: ${sec(photos.ms)} — ${matchedText}`);

  const sheets = await measured(async () => {
    await click('button[data-act="sheets"]');
    return until(() => page.eval(`return Boolean(document.querySelector('[data-sheets-summary]'));`));
  });
  const summary = await page.eval(`return document.querySelector('[data-sheets-summary]')?.innerText ?? '';`);
  log(`   مراجعة الأوراق: ${sec(sheets.ms)} — ${summary.trim()} · ذروة الذاكرة ${sheets.peak.total} م.ب`);

  const pdf = await measured(async () => {
    const before = pdfs().length;
    await click('[data-sheets] [data-act="pdf"]');
    return until(() => pdfs().length > before && page.eval(`return (document.body.innerText ?? '').includes('حُفظ PDF');`), 600_000);
  });
  const pdfFile = pdfs().map((f) => join(OUT, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  const pdfSize = pdfFile ? statSync(pdfFile).size : 0;
  log(`   PDF: ${sec(pdf.ms)} — ${(pdfSize / 1024 ** 2).toFixed(1)} م.ب · ذروة الذاكرة ${pdf.peak.total} م.ب (أكبر عمليةٍ ${pdf.peak.largest} م.ب، ${pdf.peak.processes} عمليات)${pdf.value ? '' : ' — لم يكتمل في المهلة'}`);
  await click('[data-sheets] button[title="رجوع (Esc)"]');
  await wait(500);

  // ── ٢. القناع والتدرّج في PDF ───────────────────────────────────
  const swatch = (label, inner) =>
    `<div style="display:inline-block;vertical-align:top;width:85mm;margin:4mm;text-align:center;font:10pt 'Cairo'">${inner}<div>${label}</div></div>`;
  const face = `data:image/png;base64,${photo(7, 120, 160).toString('base64')}`;
  const effects = [
    swatch('تدرّج خطّي (CSS)', `<div style="height:40mm;background:linear-gradient(135deg,#1f3a8a,#c9a45c)"></div>`),
    swatch('تدرّج دائري (CSS)', `<div style="height:40mm;background:radial-gradient(circle,#fff7d6,#b45309)"></div>`),
    swatch('تدرّج SVG', `<svg viewBox="0 0 100 50" style="width:85mm;height:40mm"><defs><linearGradient id="g" x2="1"><stop offset="0" stop-color="#7a1e2c"/><stop offset="1" stop-color="#f8e7c2"/></linearGradient></defs><rect width="100" height="50" fill="url(#g)"/></svg>`),
    swatch('شفافية ٥٠٪ فوق لون', `<div style="height:40mm;background:#1f3a8a"><div style="height:100%;margin-left:20mm;background:#c9a45c;opacity:.5"></div></div>`),
    swatch('صورة بقناع دائري (clip-path)', `<img src="${face}" style="height:40mm;clip-path:circle(45%)"/>`),
    swatch('صورة بقناع متدرّج (mask-image)', `<img src="${face}" style="height:40mm;-webkit-mask-image:radial-gradient(circle,#000 55%,transparent 72%)"/>`),
    swatch('صورة بقناع SVG (شكل درع)', `<svg viewBox="0 0 120 160" style="height:40mm"><defs><clipPath id="s"><path d="M10 10h100v80c0 40-50 60-50 60S10 130 10 90z"/></clipPath></defs><image href="${face}" width="120" height="160" clip-path="url(#s)"/></svg>`),
    swatch('خطّ منقّط وظلّ', `<div style="height:36mm;border:2mm dashed #7a1e2c;border-radius:6mm;box-shadow:0 2mm 4mm rgba(0,0,0,.35)"></div>`)
  ].join('');
  const effectsPdf = await measured(() =>
    page.eval(`return await window.diwan.output.savePdf({ suggestedName: 'مؤثّرات-٠٫١٠', sheetHtml: ${JSON.stringify(`<div dir="rtl" style="width:210mm;height:297mm;padding:8mm;box-sizing:border-box;background:#fff">${effects}</div>`)} });`)
  );
  const fx = effectsPdf.value ? readFileSync(effectsPdf.value).toString('latin1') : '';
  const count = (re) => (fx.match(re) ?? []).length;
  log('\n٢. القناع والتدرّج في PDF (ورقةٌ بثمانية مؤثّرات)');
  log(`   الزمن ${sec(effectsPdf.ms)} · الحجم ${(fx.length / 1024).toFixed(0)} ك.ب`);
  log(`   تدرّجاتٌ متّجهة (/ShadingType): ${count(/\/ShadingType/g)} · صورٌ نقطية (/Subtype /Image): ${count(/\/Subtype\s*\/Image/g)} · أقنعة نعومة (/SMask): ${count(/\/SMask/g)}`);
  // كما خرجت: تُفتح في «ملفات PDF» (pdf.js) وتُلتقط.
  await page.goto('pdf-tools');
  await wait(600);
  await click('[data-act="pdf-open"]');
  await wait(4000);
  const fxShot = join(REPORT, 'مؤثّرات-كما-خرجت.png');
  await page.shot(fxShot);
  log(`   لقطة الـPDF كما خرج (في «ملفات PDF»): ${fxShot}`);

  // ── ٣. العربية على قوس ───────────────────────────────────────────
  const arc = (font) =>
    `<svg viewBox="0 0 400 220" style="width:120mm;height:66mm" xmlns="http://www.w3.org/2000/svg"><path id="arc-${font}" d="M30 200 A170 170 0 0 1 370 200" fill="none" stroke="#ddd"/>` +
    `<text style="font-family:'${font}';font-size:30px" fill="#1f3a8a"><textPath href="#arc-${font}" startOffset="50%" text-anchor="middle">مدرسة النور للبنين — شهادة تقدير</textPath></text></svg>`;
  const arcs = ['Amiri', 'Cairo', 'Aref Ruqaa', 'Noto Kufi Arabic'].map((f) => `<div style="display:inline-block;margin:3mm;text-align:center;font:9pt 'Cairo'">${arc(f)}<div>${f}</div></div>`).join('');
  await page.eval(`
    const d = document.createElement('div');
    d.id = 'exp-arc';
    d.dir = 'rtl';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;padding:16px;overflow:auto';
    d.innerHTML = ${JSON.stringify(arcs)};
    document.body.appendChild(d);
    await document.fonts.ready;
    return true;`);
  await wait(800);
  const arcShot = join(REPORT, 'عربية-على-قوس.png');
  await page.shot(arcShot);
  const fit = await page.eval(`
    return [...document.querySelectorAll('#exp-arc svg')].map((svg) => {
      const t = svg.querySelector('textPath'); const p = svg.querySelector('path');
      return { text: Math.round(t.getComputedTextLength()), path: Math.round(p.getTotalLength()), chars: t.getNumberOfChars() };
    });`);
  await page.eval(`document.getElementById('exp-arc')?.remove(); return true;`);
  const arcPdf = await page.eval(`return await window.diwan.output.savePdf({ suggestedName: 'عربية-على-قوس', sheetHtml: ${JSON.stringify(`<div dir="rtl" style="width:210mm;height:297mm;padding:8mm;box-sizing:border-box;background:#fff">${arcs}</div>`)} });`);
  log('\n٣. العربية على قوس (SVG textPath) بأربعة خطوط');
  log(`   لقطة الواجهة: ${arcShot}`);
  log(`   طول النصّ على القوس / طول القوس: ${fit.map((f, i) => `${['Amiri', 'Cairo', 'Aref Ruqaa', 'Noto Kufi Arabic'][i]} ${f.text}/${f.path}`).join(' · ')}`);
  log(`   PDF: ${arcPdf ?? '—'}`);

  // النسخ للمالك: PDFات التجارب بجانب التقرير.
  for (const f of pdfs()) writeFileSync(join(REPORT, f), readFileSync(join(OUT, f)));
  writeFileSync(join(REPORT, 'النتائج.txt'), `${lines.join('\n')}\n`, 'utf8');
  return lines.join('\n');
}
