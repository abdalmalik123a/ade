/**
 * سيناريو: ورقة المستمسكات كما يعمل المكتب (S47، D198).
 *
 * من بطاقة «المستمسكات على ورقة» في الشبّاك بلا شخص: الورقة مكان العمل — خانةٌ فارغة تُملأ بالنقر، والظهر يُطلب بعد الوجه وحده،
 * و«＋» الجواز وجهًا واحدًا، فمستمسكان بنوعين على ورقةٍ واحدة بمقاسيهما (١٢٥×٨٨ و٨٥٫٦×٥٣٫٩٨)؛ والنقر يحدّد ويفتح اللوحة، و«فوق»
 * يغيّر المواضع؛ ثم «اطبع» على دور «استنساخ المستمسكات» (`DIWAN_TEST_PRINT_LOG`) و«حفظ PDF» صفحةً A4 **ومقاساتهما في PDF نفسه**
 * (مجسّاتٌ داخل كلّ خانةٍ بملّيمتر داكنة وخارجها بيضاء)؛ والسكن ١٤٨×٢١٠ بوجهيه لا يُقصّ، والنسخ تُرصف.
 * و`DIWAN_TEST_OPEN_FILE` مسارٌ واحد: تُكتب فيه صورةٌ مصنوعةٌ داكنة بنسبة المستمسك قبل كلّ «افتح الصورة».
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { pdfToImages } from '../pdfImage.mjs';

const DIR = join(process.env.TEMP ?? '.', `diwan-iddocs-${Date.now()}`);
const LOG = join(DIR, 'print.jsonl');
const OPEN = join(DIR, 'open.png');

/** PNG بلا مكتبة، بلونٍ واحد (كـ`idTools`). */
function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** الصورة التالية لـ«افتح الصورة»: بنسبة المستمسك (عرضه وطوله بالملّم × ٤). */
const nextImage = (w, h, color) => writeFileSync(OPEN, png(Math.round(w * 4), Math.round(h * 4), color));

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  nextImage(85.6, 53.98, [120, 20, 20]);
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_PRINT_LOG: LOG, DIWAN_TEST_OPEN_FILE: OPEN };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  /** مواضع الخانات في الورقة بالملّم: { doc, face, page, x, y, w, h, empty }. */
  const cards = () =>
    page.eval(`return [...document.querySelectorAll('[data-id-sheet] [data-sheet-page] [data-doc]')].map((b) => ({
      doc: b.dataset.doc, face: b.dataset.face, page: Number(b.closest('[data-sheet-page]').dataset.sheetPage), empty: b.hasAttribute('data-sheet-empty'),
      x: parseFloat(b.style.left), y: parseFloat(b.style.top), w: parseFloat(b.style.width), h: parseFloat(b.style.height) }));`);
  const pickFile = async (face) => {
    await page.until(`return Boolean(document.querySelector('[data-source-picker="${face}"]'));`, 4000);
    await click('[data-source-picker] [data-act="source-file"]');
    await page.until(`return !document.querySelector('[data-source-picker="${face}"]');`, 4000);
    await wait(400);
  };

  // ── من بطاقة الشبّاك: الوطنية والسكن فارغتان ─────────────────────────────
  await page.goto('service-counter');
  await wait(600);
  await click('[data-cards] [data-card="id-sheet"]');
  await page.until(`return Boolean(document.querySelector('[data-id-sheet]'));`);
  let c = await cards();
  ok(`تُفتح الورقة والخانات الفارغة ظاهرةٌ تُنقر (${c.filter((x) => x.empty).length})`, c.length === 4 && c.every((x) => x.empty));

  // السكن يُحذف من لوحته: النقر على خانته يحدّده (ويعرض المصدر فيُغلق).
  const res = c[2].doc;
  await click(`[data-doc="${res}"][data-face="front"]`);
  await wait(300);
  await click('[data-source-picker] button[title="إغلاق"]');
  await wait(200);
  ok('والنقر يحدّد المستمسك ويفتح لوحته', await page.eval(`return document.querySelector('[data-doc-panel]')?.dataset.docPanel === ${JSON.stringify(res)};`));
  await click('[data-act="doc-delete"]');
  await wait(300);

  // ── «＋» الجواز وجهًا واحدًا ───────────────────────────────────────────
  nextImage(125, 88, [20, 30, 120]);
  await click('[data-act="sheet-add"]');
  await wait(300);
  await click('[data-add-type="passport"] [data-faces="1"]');
  await pickFile('front');
  ok('«＋» الجواز وجهًا واحدًا من الحاسوب يدخل الورقة', (await cards()).some((x) => x.w === 125 && x.h === 88 && !x.empty));

  // ── الخانة الفارغة تُملأ بالنقر، والظهر يُطلب بعد الوجه وحده ─────────────
  nextImage(85.6, 53.98, [120, 20, 20]);
  const nat = c[0].doc;
  await click(`[data-doc="${nat}"][data-face="front"]`);
  await pickFile('front');
  ok('وملءُ الوجه يطلب الظهر وحده', await page.until(`return Boolean(document.querySelector('[data-source-picker="back"]'));`, 3000));
  nextImage(85.6, 53.98, [20, 100, 30]);
  await pickFile('back');
  c = await cards();
  if (shotsDir) await page.shot(join(shotsDir, 'id-docs-sheet.png'));
  const sizes = c.map((x) => `${x.w}x${x.h}`).sort().join(' ');
  ok(`مستمسكان بنوعين على ورقةٍ واحدة بمقاسيهما (${sizes})`, c.length === 3 && c.every((x) => x.page === 0 && !x.empty) && sizes === '125x88 85.6x53.98 85.6x53.98');
  const [nf, nb] = [c.find((x) => x.doc === nat && x.face === 'front'), c.find((x) => x.doc === nat && x.face === 'back')];
  ok('والوطنية جنبًا: الوجه يمين الظهر', nf.y === nb.y && nf.x > nb.x);

  // ── «فوق» من لوحتها يغيّر المواضع ───────────────────────────────────────
  await click(`[data-doc="${nat}"][data-face="front"]`);
  await wait(300);
  await click('[data-arrange="over"]');
  await wait(300);
  c = await cards();
  const [of, ob] = [c.find((x) => x.doc === nat && x.face === 'front'), c.find((x) => x.doc === nat && x.face === 'back')];
  ok('و«فوق» يضع الظهر تحت الوجه', of.x === ob.x && ob.y > of.y);

  // ── «اطبع» على دور «استنساخ المستمسكات» ───────────────────────────────────
  await page.eval(`return window.diwan.settings.set({ printRoles: { copies: { normal: 'ملوّنة الاستنساخ', color: null, dialog: false } } }).then(() => true);`);
  await click('[data-act="sheet-print"]');
  await wait(2500);
  const lines = existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  ok('وتُطبع على طابعة دور «استنساخ المستمسكات» مباشرةً', lines.length === 1 && lines[0].printer === 'ملوّنة الاستنساخ' && lines[0].silent);

  // ── «حفظ PDF»: صفحةٌ A4 ومقاسات الخانات فيها ─────────────────────────────
  await click('[data-act="sheet-pdf"]');
  let pdfs = [];
  for (let i = 0; i < 30 && !pdfs.length; i++) {
    await wait(300);
    pdfs = readdirSync(DIR).filter((f) => f.endsWith('.pdf'));
  }
  const pdfPath = pdfs.length ? join(DIR, pdfs[0]) : null;
  const pdf = pdfPath ? readFileSync(pdfPath).toString('latin1') : '';
  const pageCount = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const box = /\/MediaBox\s*\[([^\]]*)\]/.exec(pdf)?.[1]?.trim() ?? '—';
  ok(`وتُحفظ PDF صفحةً واحدة A4 (${pageCount} صفحة، ${box})`, pageCount === 1 && /^0 0 59[45]/.test(box));
  const probe = c.flatMap((x) => [
    { x: x.x + 1, y: x.y + 1 },
    { x: x.x + x.w - 1, y: x.y + x.h - 1 },
    { x: x.x - 1, y: x.y + x.h / 2 },
    { x: x.x + x.w + 1, y: x.y + x.h / 2 }
  ]);
  const values = pdfPath ? (await pdfToImages(pdfPath, { dpi: 100, probe }))[0]?.probe ?? [] : [];
  const fits = c.every((_, i) => values[4 * i] < 140 && values[4 * i + 1] < 140 && values[4 * i + 2] > 220 && values[4 * i + 3] > 220);
  ok(`وفي PDF كلّ خانةٍ بمقاسها: داخلها بملّيمتر داكن وخارجها أبيض (${values.join(' ')})`, values.length === probe.length && fits);

  // ── السكن ١٤٨×٢١٠ بوجهيه لا يُقصّ، والنسخ تُرصف ─────────────────────────
  nextImage(148, 210, [90, 60, 20]);
  await click('[data-act="sheet-add"]');
  await wait(300);
  await click('[data-add-type="residence"] [data-faces="2"]');
  await pickFile('front');
  await pickFile('back');
  c = await cards();
  const resCards = c.filter((x) => x.w === 148 && x.h === 210);
  ok(`والسكن ١٤٨×٢١٠ بوجهيه بمقاسه لا يُقصّ، كلّ وجهٍ في ورقة (${resCards.map((x) => x.page).join('،')})`, resCards.length === 2 && resCards[0].page !== resCards[1].page);
  const pass = c.find((x) => x.w === 125).doc;
  await click(`[data-doc="${pass}"]`);
  await wait(300);
  await page.eval(`const el = document.querySelector('[data-doc-copies]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2');
    el.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await wait(300);
  ok('ونسختان من الجواز تُرصفان', (await cards()).filter((x) => x.doc === pass).length === 2);
  ok(`و«اطبع» يقول عدد الأوراق (${await page.eval(`return document.querySelector('[data-act="sheet-print"]').innerText;`)})`, /اطبع ٤ أوراق/.test(await page.eval(`return document.querySelector('[data-act="sheet-print"]').innerText;`)));

  await click('[data-act="id-sheet-close"]');
  await wait(300);
  ok('و✕ يغلقها', !(await page.eval(`return Boolean(document.querySelector('[data-id-sheet]'));`)));
  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
