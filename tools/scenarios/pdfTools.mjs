/**
 * سيناريو: «ملفات PDF» — محرّر PDF للتقديم الإلكتروني (المرحلة الأولى).
 *
 * ثلاثة ملفّات تُفتح معًا (فتُدمج): كتابٌ عربيّ رسمه محرّك الطباعة، واستمارةٌ بثلاث صفحات،
 * وصورة هوية. ثم ما يفعله المكتب يوميًّا: يُدير صفحةً ويحذف أخرى ويرتّب، ويضيف نصًّا عربيًّا
 * وشعارًا وعلامةً مائية، ويقصّ — ويحفظ ملفًّا جديدًا. ويُفتَّش الناتج بـpdf.js: عدد الصفحات
 * ودورانها وقصّها، والنصّ العربي المضاف نصٌّ حقيقي، والأصل كما وصل. ثم الاستخراج والتقسيم
 * والصفحاتُ صورًا.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const ROOT = join(process.env.TEMP ?? '.', `diwan-pdftools-${Date.now()}`);
const OUT = join(ROOT, 'out');
const LETTER = join(ROOT, 'كتاب.pdf');
const FORM = join(ROOT, 'استمارة.pdf');
const ID = join(ROOT, 'هوية.png');
const LOGO = join(ROOT, 'شعار.png');

const LETTER_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page { size: 210mm 297mm; margin: 0 } body { margin: 0; font-family: Tahoma, sans-serif; font-size: 15pt }
.pg { width: 210mm; height: 297mm; padding: 25mm 22mm; box-sizing: border-box; background: #fff }
</style></head><body><div class="pg"><p>جمهورية العراق — وزارة التربية</p><p style="text-align:center">م / تأييد</p>
<p>تؤيد إدارة المدرسة أن الطالب أحمد كريم جاسم مستمر بالدوام.</p></div></body></html>`;

/** PNG بلا مكتبة: لونٌ واحد — يكفي لصورة هويةٍ وشعار. */
function png(w, h, rgb) {
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
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', require_deflate(raw)), chunk('IEND', Buffer.alloc(0))]);
}
import { deflateSync } from 'node:zlib';
const require_deflate = (b) => deflateSync(b);

export async function prepare() {
  mkdirSync(OUT, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const n of [1, 2, 3]) doc.addPage([595.28, 841.89]).drawText(`FORM PAGE ${n}`, { x: 40, y: 790, size: 20, font });
  writeFileSync(FORM, await doc.save());
  writeFileSync(ID, png(860, 540, [40, 90, 160]));
  writeFileSync(LOGO, png(200, 200, [200, 30, 30]));
  return { DIWAN_TEST_OPEN_FILES: [LETTER, FORM, ID].join('|'), DIWAN_TEST_OPEN_FILE: LOGO, DIWAN_TEST_SAVE_DIR: OUT };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);

  // الكتاب العربي يُرسم بمحرّك الطباعة قبل أن يُفتح.
  const saved = await page.eval(`return window.diwan.output.savePdf({ sheetHtml: ${JSON.stringify(LETTER_HTML)}, suggestedName: 'letter', page: { w: 210, h: 297 } });`);
  writeFileSync(LETTER, readFileSync(saved));
  const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
  const before = { letter: hash(LETTER), form: hash(FORM), id: hash(ID) };

  await page.goto('pdf-tools');
  await wait(600);
  ok('«ملفات PDF» في العمل اليومي، ويبدأ بدعوةٍ إلى الفتح', await page.eval(`return Boolean(document.querySelector('[data-pdf-empty]'));`));
  await click('[data-act="pdf-open"]');
  let thumbs = 0;
  for (let i = 0; i < 40 && thumbs < 5; i++) {
    await wait(300);
    thumbs = await page.eval(`return [...document.querySelectorAll('[data-pdf-page] img')].length;`);
  }
  const count = await page.eval(`return document.querySelectorAll('[data-pdf-page]').length;`);
  ok(`ثلاثة ملفّات تُفتح معًا فتُدمج: ٥ صفحات بمصغّراتها (${count} / ${thumbs})`, count === 5 && thumbs === 5);
  ok('والصفحة الأولى معروضةً كبيرة', await page.eval(`return Boolean(document.querySelector('[data-pdf-view] img'));`));
  if (shotsDir) await page.shot(join(shotsDir, 'pdf-open.png'));

  // ── الصفحات: [كتاب، استمارة١، استمارة٢، استمارة٣، هوية] ──────────────
  const check = async (n) => {
    await click(`[data-pdf-check="${n}"]`);
    await wait(150);
  };
  const clearSel = () => page.eval(`document.querySelectorAll('[data-pdf-check]').forEach((c) => c.checked && c.click()); return true;`);
  await check(2);
  await click('[data-act="pdf-rotate-right"]');
  await wait(300);
  await clearSel();
  await check(4);
  await click('[data-act="pdf-delete"]');
  await wait(300);
  await clearSel();
  // الهوية (الرابعة الآن) تتقدّم خطوة: [كتاب، استمارة١ مدارة، هوية، استمارة٢].
  await check(4);
  await click('[data-act="pdf-up"]');
  await wait(300);
  await clearSel();
  ok('تُدار صفحةٌ وتُحذف أخرى وتتقدّم ثالثة', (await page.eval(`return document.querySelectorAll('[data-pdf-page]').length;`)) === 4);

  // ── الإضافة على الصفحة الأولى: نصٌّ عربي، وشعار، وعلامة مائية على الكلّ ──
  await page.eval(`document.querySelector('[data-pdf-page="1"]').click(); return true;`);
  await wait(600);
  await click('[data-act="pdf-text"]');
  await wait(300);
  await page.type('[data-pdf-overlay-text]', 'تمّ الاستلام — مكتب النور REF-77');
  await wait(200);
  await click('[data-act="pdf-logo"]');
  await wait(400);
  await click('[data-act="pdf-logo-device"]');
  await wait(900);
  await click('[data-act="pdf-watermark"]');
  await wait(400);
  await page.type('[data-pdf-overlay-text]', 'نسخة للتقديم WM-9');
  await wait(300);
  const onPage = await page.eval(`return [...document.querySelectorAll('[data-pdf-view] [data-pdf-overlay]')].map((e) => e.dataset.pdfOverlay).sort().join(',');`);
  ok(`والنصّ والشعار والعلامة المائية فوق الصفحة (${onPage})`, onPage === 'image,text,text');
  if (shotsDir) await page.shot(join(shotsDir, 'pdf-overlays.png'));

  // ── القصّ: صفحة الهوية (الثالثة) ─────────────────────────────────────
  await page.eval(`document.querySelector('[data-pdf-page="3"]').click(); return true;`);
  await wait(600);
  await click('[data-act="pdf-crop"]');
  await wait(400);
  ok('القصّ صندوقٌ على الصفحة', await page.eval(`return Boolean(document.querySelector('[data-pdf-crop]'));`));
  await click('[data-act="pdf-crop-page"]');
  await wait(600);

  // ── الحفظ: ملفٌّ جديد، والأصل كما هو ──────────────────────────────────
  // ما في المجلّد قبل الحفظ (ومنه الكتاب الذي رُسم أوّلًا) لا يُعدّ ناتجًا.
  const initial = new Set(readdirSync(OUT));
  await click('[data-act="pdf-save"]');
  let result = null;
  for (let i = 0; i < 40 && !result; i++) {
    await wait(400);
    result = readdirSync(OUT).find((f) => f.endsWith('.pdf') && !initial.has(f));
  }
  ok(`حُفظ ملفًّا جديدًا («${result}»)`, Boolean(result));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js يستخرج عربيّ Chromium حرفًا حرفًا بترتيب العرض (معكوسًا) وبصور حروفٍ فارسية
  // (ی ھ): فالكلمة تُطلب مستقيمةً أو معكوسة، بلا مسافات، بعد ردّ الصور إلى أصلها.
  const has = (text, word) => {
    const flat = text.replace(/ی/g, 'ي').replace(/ھ/g, 'ه').replace(/\s+/g, '');
    const w = word.replace(/\s+/g, '');
    if (flat.includes(w) || flat.includes([...w].reverse().join(''))) return true;
    // والحروف المتلاصقة قد تتبادل موضعيها في الاستخراج («ور»، «ب ا»): فتُقبل الكلمة إن
    // وُجدت حروفها نفسها — لا أكثر ولا أقلّ — في مقطعٍ بطولها.
    const key = (s) => [...s].sort().join('');
    const want = key(w);
    const chars = [...flat];
    for (let i = 0; i + w.length <= chars.length; i++) if (key(chars.slice(i, i + w.length).join('')) === want) return true;
    return false;
  };
  const inspect = async (file) => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const vp = p.getViewport({ scale: 1 });
      const text = (await p.getTextContent()).items.map((it) => it.str ?? '').join('').normalize('NFKC');
      pages.push({ w: Math.round(vp.width), h: Math.round(vp.height), text });
    }
    return pages;
  };
  if (result) {
    const out = await inspect(join(OUT, result));
    steps.push(`  … ${out.map((p, i) => `${i + 1}:${p.w}×${p.h}`).join(' ')}`);
    ok('أربع صفحاتٍ بترتيبها: الكتاب، والاستمارة المدارة، والهوية، والاستمارة', out.length === 4 && has(out[1].text, 'FORM PAGE 1') && has(out[3].text, 'FORM PAGE 2') && has(out[0].text, 'مستمر'));
    ok('والمدارة تُرى عرضًا', out[1].w > out[1].h);
    ok('والهوية مقصوصة (٩٠٪ من صفحتها)', Math.abs(out[2].w - 758) <= 2 && Math.abs(out[2].h - 536) <= 2);
    ok('والنصّ المضاف نصٌّ حقيقي في صفحته وحدها', has(out[0].text, 'REF-77') && has(out[0].text, 'مكتب النور') && !has(out[1].text, 'REF-77'));
    ok('والعلامة المائية على الصفحات كلّها', out.every((p) => has(p.text, 'WM-9') && has(p.text, 'نسخة للتقديم')));
    ok('والأصول كما وصلت — لم يُكتب فوقها حرف', hash(LETTER) === before.letter && hash(FORM) === before.form && hash(ID) === before.id);
  }

  // ── الاستخراج والتقسيم والصفحاتُ صورًا ───────────────────────────────
  const outBefore = new Set(readdirSync(OUT));
  const fresh = () => readdirSync(OUT).filter((f) => !outBefore.has(f));
  await check(1);
  await check(2);
  await click('[data-act="pdf-extract"]');
  await wait(2500);
  const extracted = fresh().filter((f) => f.endsWith('.pdf'));
  ok(`«استخرج المحدَّد»: صفحتان ملفًّا وحدهما (${extracted.join('، ')})`, extracted.length === 1 && (await inspect(join(OUT, extracted[0]))).length === 2);
  await clearSel();
  for (const f of fresh()) outBefore.add(f);

  await click('[data-act="pdf-split"]');
  await wait(300);
  await page.type('[data-pdf-split]', '1؛ 2-4');
  await click('[data-act="pdf-split-go"]');
  await wait(4000);
  const parts = fresh().filter((f) => f.endsWith('.pdf')).sort();
  const sizes = [];
  for (const p of parts) sizes.push((await inspect(join(OUT, p))).length);
  ok(`«قسّم 1؛ 2-4»: ملفّان بصفحةٍ وثلاث (${sizes.join('، ')})`, parts.length === 2 && sizes.sort().join() === '1,3');
  for (const f of fresh()) outBefore.add(f);

  await click('[data-act="pdf-images"]');
  let jpgs = [];
  for (let i = 0; i < 40 && jpgs.length < 4; i++) {
    await wait(500);
    jpgs = fresh().filter((f) => f.endsWith('.jpg'));
  }
  const heads = jpgs.map((f) => readFileSync(join(OUT, f)).subarray(0, 2).toString('hex'));
  ok(`«صفحاتٌ صورًا»: أربع صور JPG للرفع (${jpgs.length})`, jpgs.length === 4 && heads.every((h) => h === 'ffd8') && jpgs.every((f) => statSync(join(OUT, f)).size > 5000));
  return steps.join('\n');
}
