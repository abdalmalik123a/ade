/**
 * سيناريو: ورقة المستمسكات كما يعمل المكتب (S47، D198).
 *
 * من بطاقة «المستمسكات على ورقة» في الشبّاك بلا شخص: الورقة مكان العمل — خانةٌ فارغة تُملأ بالنقر، والظهر يُطلب بعد الوجه وحده،
 * و«＋» الجواز وجهًا واحدًا، فمستمسكان بنوعين على ورقةٍ واحدة بمقاسيهما (١٢٥×٨٨ و٨٥٫٦×٥٣٫٩٨)؛ والنقر يحدّد ويفتح اللوحة، و«فوق»
 * يغيّر المواضع؛ ثم «اطبع» على دور «استنساخ المستمسكات» (`DIWAN_TEST_PRINT_LOG`) و«حفظ PDF» صفحةً A4 **ومقاساتهما في PDF نفسه**
 * (مجسّاتٌ داخل كلّ خانةٍ بملّيمتر داكنة وخارجها بيضاء)؛ والسكن ١٤٨×٢١٠ بوجهيه لا يُقصّ، والنسخ تُرصف.
 * و`DIWAN_TEST_OPEN_FILE` مسارٌ واحد: تُكتب فيه صورةٌ مصنوعةٌ داكنة بنسبة المستمسك قبل كلّ «افتح الصورة».
 * (D199) والتحديد بالخيارين: زجاجٌ مصنوعٌ عليه بطاقةٌ في ركنه للجواز ← «قصٌّ مستطيل» يبدأ حولها ← نسبة الجواز؛ والوطنية ←
 * «الأركان الأربعة» بنوعها ← نسبة الوطنية؛ و«دوّر ٩٠°» يقلب الصورة — والخانات بمقاساتها لا تتغيّر.
 * (D200) وقوّة ديوان: «عدّة بطاقاتٍ بمسحةٍ واحدة» تدخل الورقة ولا تكتب في القاعدة؛ ومن ملفّ شخصٍ مصنوع «احفظ في ملفّه» مرّةً واحدة
 * (وما جاء من ملفّه «في ملفّه» أصلًا)، وبلا شخصٍ لا يظهر؛ والمسح العابر لا أثر له في `store/tmp` بعد الإغلاق.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { pdfToImages } from '../pdfImage.mjs';

const DIR = join(process.env.TEMP ?? '.', `diwan-iddocs-${Date.now()}`);
const LOG = join(DIR, 'print.jsonl');
const OPEN = join(DIR, 'open.png');

/** PNG بلا مكتبة (كـ`idTools`): لونٌ واحد، أو دالّةٌ لكلّ بكسل. */
function png(w, h, color) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(typeof color === 'function' ? color(x, y) : color, y * (w * 3 + 1) + 1 + x * 3);
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
/** زجاج ماسحٍ أبيض ٨٥٠×١١٠٠ عليه بطاقةٌ في ركنه بإطارٍ وكتابةٍ وصورة (كـ`idTools`). */
const CARD = { x: 60, y: 80, w: 340, h: 214 };
const glassImage = (cards = [CARD]) =>
  writeFileSync(
    OPEN,
    png(850, 1100, (x, y) => {
      const c = cards.find((k) => x >= k.x && y >= k.y && x < k.x + k.w && y < k.y + k.h);
      if (!c) return [250, 250, 248];
      if (x - c.x < 4 || c.x + c.w - x <= 4 || y - c.y < 4 || c.y + c.h - y <= 4) return [120, 120, 125];
      const ly = y - c.y - 30;
      if (x - c.x > 20 && x - c.x < c.w * 0.55 && ly >= 0 && ly < 120 && ly % 30 < 4) return [40, 40, 50];
      if (x > c.x + c.w - 90 && x < c.x + c.w - 25 && y > c.y + 25 && y < c.y + c.h - 25) return [150, 110, 90];
      return [236, 240, 250];
    })
  );

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  nextImage(85.6, 53.98, [120, 20, 20]);
  // والماسح الوهميّ يعيد الصورة نفسها (كـ`transientScans`).
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_PRINT_LOG: LOG, DIWAN_TEST_OPEN_FILE: OPEN, DIWAN_TEST_SCAN_FILE: OPEN };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  /** مواضع الخانات في الورقة بالملّم: { doc, face, page, x, y, w, h, empty }. */
  const rows = (sql, ...args) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const out = d.prepare(sql).all(...args);
    d.close();
    return out;
  };
  const tmpFiles = () => (existsSync(join(profile, 'data', 'store', 'tmp')) ? readdirSync(join(profile, 'data', 'store', 'tmp')) : []);
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

  // ── (D199) التحديد بالخيارين، والتدوير — والخانات بمقاساتها كما هي ───────
  const before = JSON.stringify((await cards()).map((x) => [x.w, x.h, x.page]));
  const natural = (doc, face) => page.eval(`const i = document.querySelector('[data-doc="${doc}"][data-face="${face}"] img');
    return i && i.complete ? [i.naturalWidth, i.naturalHeight] : null;`);
  const passId = c.find((x) => x.w === 125).doc;
  glassImage();
  await click(`[data-doc="${passId}"]`);
  await wait(300);
  await click('[data-act="doc-replace-front"]');
  await pickFile('front');
  await click('[data-act="face-rect-front"]');
  await page.until(`return Boolean(document.querySelector('[data-rect-crop] [data-rect]'));`, 5000);
  const [rx, ry, rw, rh] = (await page.eval(`return document.querySelector('[data-rect-crop] [data-rect]').dataset.rect;`)).split(',').map(Number);
  ok(`«قصٌّ مستطيل» يبدأ حول البطاقة في ركن الزجاج بنسبة الجواز (${rx},${ry} ${rw}×${rh})`,
    rx >= CARD.x - 15 && ry >= CARD.y - 15 && rx + rw <= CARD.x + CARD.w + 15 && ry + rh <= CARD.y + CARD.h + 15 && rw * rh > 0.7 * CARD.w * CARD.h && Math.abs(rw / rh - 125 / 88) < 0.02);
  await click('[data-act="rect-apply"]');
  await wait(800);
  let n = await natural(passId, 'front');
  ok(`و«اعتمد» يقصّها: صورة الجواز بنسبته ١٢٥:٨٨ (${n?.join('×')})`, n && Math.abs(n[0] / n[1] - 125 / 88) < 0.02 && n[0] < 400);

  await click(`[data-doc="${nat}"]`);
  await wait(300);
  await click('[data-act="face-corners-front"]');
  await page.until(`return Boolean(document.querySelector('[data-aspect="doc"]'));`, 5000);
  const chosen = await page.eval(`const b = document.querySelector('[data-aspect="doc"]'); return b.className.includes('bg-primary-fixed') ? b.innerText : '';`);
  ok(`و«الأركان الأربعة» تفتح التسوية بنوع المستمسك مختارًا (${chosen})`, chosen.includes('البطاقة الوطنية'));
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('حفظ وتطبيق'))?.click(); return true;`);
  // ناتج التسوية بعرض ١٢٠٠ (`DeskewModal`) — لا الصورة الأولى (٣٤٢) التي بنسبة الوطنية أصلًا.
  await page.until(`const i = document.querySelector('[data-doc="${nat}"][data-face="front"] img'); return i && i.complete && i.naturalWidth === 1200;`, 5000);
  n = await natural(nat, 'front');
  ok(`و«اعتمد» يقوّمها بنسبة الوطنية ٨٥٫٦:٥٣٫٩٨ (${n?.join('×')})`, n && n[0] === 1200 && Math.abs(n[0] / n[1] - 85.6 / 53.98) < 0.01);
  const back0 = await natural(nat, 'back');
  await click('[data-act="face-rotate-back"]');
  await page.until(`const i = document.querySelector('[data-doc="${nat}"][data-face="back"] img'); return i && i.complete && i.naturalWidth === ${back0?.[1] ?? -1};`, 4000);
  const back1 = await natural(nat, 'back');
  ok(`و«دوّر ٩٠°» يقلب عرض الصورة وطولها (${back0?.join('×')} ← ${back1?.join('×')})`, back0 && back1 && back1[0] === back0[1] && back1[1] === back0[0]);
  ok('والخانات بمقاساتها ومواضعها لم تتغيّر بالتحديد والتدوير', JSON.stringify((await cards()).map((x) => [x.w, x.h, x.page])) === before);
  await click('[data-act="doc-done"]');
  await wait(200);

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

  ok('وبلا شخصٍ لا «احفظ في ملفّه»', await page.eval(`return Boolean(document.querySelector('[data-doc-panel]')) && !document.querySelector('[data-act="doc-save-file"]');`));

  // ── (D200 أ) «عدّة بطاقاتٍ بمسحةٍ واحدة» تدخل الورقة ولا تكتب في القاعدة ──
  const docsBefore = new Set((await cards()).map((x) => x.doc)).size;
  glassImage([CARD, { x: 450, y: 420, w: 340, h: 214 }]);
  await click('[data-act="sheet-add"]');
  await wait(300);
  await click('[data-act="add-multi"]');
  await page.until(`return Boolean(document.querySelector('[data-multi-card]'));`, 4000);
  await click('[data-act="multi-file-fronts"]');
  await page.until(`return Number(document.querySelector('[data-multi-cards]')?.dataset.multiCards) === 2;`, 6000);
  await click('[data-act="multi-file-backs"]');
  await page.until(`return (document.querySelector('[data-multi-pairs]')?.innerText ?? '').includes('طوبق 2');`, 6000);
  const saveLabel = await page.eval(`return document.querySelector('[data-act="multi-save"]').innerText;`);
  ok(`وزرّها «أضفها إلى الورقة» (${saveLabel})`, saveLabel.includes('أضفها إلى الورقة'));
  await click('[data-act="multi-save"]');
  await wait(800);
  c = await cards();
  const added = [...new Set(c.map((x) => x.doc))].slice(docsBefore);
  ok(`«عدّة بطاقاتٍ بمسحةٍ واحدة»: بطاقتان بوجهيهما تدخلان الورقة بمقاس الوطنية (${added.length})`,
    added.length === 2 && added.every((d) => c.filter((x) => x.doc === d && !x.empty && x.w === 85.6).length === 2));
  ok('ولا يُكتب في القاعدة شيء', rows('SELECT COUNT(*) AS n FROM attachments')[0].n === 0);

  await click('[data-act="id-sheet-close"]');
  await wait(300);
  ok('و✕ يغلقها', !(await page.eval(`return Boolean(document.querySelector('[data-id-sheet]'));`)));

  // ── (D200 ب ج) من ملفّ شخص: «احفظ في ملفّه» مرّةً واحدة، والمسح العابر يُحذف بالإغلاق ──
  const cid = await page.eval(`
    const shot = (color) => { const c = document.createElement('canvas'); c.width = 342; c.height = 216;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 342, 216); return c.toDataURL('image/png'); };
    const c = await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', verified: false });
    await window.diwan.attachments.addFromDataUrl(c.id, 'البطاقة الوطنية الموحدة — الوجه', shot('#733'));
    await window.diwan.attachments.addFromDataUrl(c.id, 'البطاقة الوطنية الموحدة — الظهر', shot('#373'));
    return c.id;`);
  await page.goto('citizens-identity-records');
  await wait(600);
  await page.eval(`document.querySelector('[data-global-search]').focus(); return true;`);
  await page.type('[data-global-search]', 'زينب علي');
  await wait(900);
  await click('[data-search-results] [data-search-citizen]');
  await wait(1200);
  await click('[data-act="citizen-id-sheet"]');
  await page.until(`return Boolean(document.querySelector('[data-id-sheet]'));`);
  c = await cards();
  const zNat = c.find((x) => x.w === 85.6 && !x.empty).doc;
  await click(`[data-doc="${zNat}"]`);
  await wait(300);
  ok('ما جاء من ملفّه «في ملفّه» أصلًا فلا يُحفظ ثانيةً', await page.eval(`const b = document.querySelector('[data-act="doc-save-file"]'); return Boolean(b) && b.disabled && b.innerText.includes('في ملفّه');`));
  nextImage(125, 88, [20, 30, 120]);
  await click('[data-act="sheet-add"]');
  await wait(300);
  await click('[data-add-type="passport"] [data-faces="1"]');
  await pickFile('front');
  const zPass = (await cards()).find((x) => x.w === 125).doc;
  await click(`[data-doc="${zPass}"]`);
  await wait(300);
  await click('[data-act="doc-save-file"]');
  await page.until(`const b = document.querySelector('[data-act="doc-save-file"]'); return Boolean(b) && b.disabled && !b.innerText.includes('احفظ');`, 8000);
  const saved = rows('SELECT doc_type AS t FROM attachments WHERE citizen_id = ? ORDER BY id', cid).map((r) => r.t);
  ok(`و«احفظ في ملفّه» يحفظ الجواز باسم نوعه (${saved.join('، ')})`, saved.length === 3 && saved[2] === 'جواز السفر');
  await click('[data-act="doc-save-file"]');
  await wait(600);
  ok('والنقر ثانيةً لا يزيد', rows('SELECT COUNT(*) AS n FROM attachments WHERE citizen_id = ?', cid)[0].n === 3);

  // المسح العابر: خانة السكن الفارغة تُمسح ثم تُغلق الورقة.
  await click('[data-id-sheet] [data-sheet-empty][data-face="front"]');
  await wait(300);
  await click('[data-act="scan-front"]');
  await page.until(`return Boolean(document.querySelector('[data-aspect="doc"]'));`, 6000);
  const during = tmpFiles().length;
  await page.key('Escape');
  await wait(400);
  await click('[data-source-picker] button[title="إغلاق"]');
  await wait(200);
  await click('[data-act="id-sheet-close"]');
  await wait(900);
  ok(`والمسح عابرٌ: في store/tmp ما دامت مفتوحة (${during})، ولا أثر له بعد إغلاقها`, during === 1 && tmpFiles().length === 0);
  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
