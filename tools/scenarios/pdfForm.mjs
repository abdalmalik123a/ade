/**
 * سيناريو: استمارة PDF قابلة للتعبئة (تعميق الموجود ٧).
 *
 * استمارةٌ بحقولٍ لاتينية الأسماء كما تأتي من برامجها (full_name، mother_name، national_id)،
 * وحقلٌ مملوءٌ من قبل، ومربّع اختيار. تُفتح فيُقال إنها استمارة، ويُختار مواطنٌ من السجل،
 * فتصير حقولها الفارغة نصوصًا في مواضعها مملوءةً بمعانيها — ثم تُحفظ: الاسم واسم الأم
 * بعربيّةٍ حقيقية، والرقم الوطني، وما كان مملوءًا باقٍ، ولا استمارة في الناتج.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const DIR = join(process.env.TEMP ?? '.', `diwan-pdfform-${Date.now()}`);
const FORM = join(DIR, 'استمارة قابلة للتعبئة.pdf');
const OUT = join(DIR, 'out');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText('FORM-HEADER', { x: 40, y: 790, size: 16, font: await doc.embedFont(StandardFonts.Helvetica) });
  const form = doc.getForm();
  form.createTextField('full_name').addToPage(page, { x: 250, y: 700, width: 280, height: 22 });
  form.createTextField('mother_name').addToPage(page, { x: 250, y: 660, width: 280, height: 22 });
  form.createTextField('national_id').addToPage(page, { x: 250, y: 620, width: 180, height: 22 });
  const office = form.createTextField('Office');
  office.setText('REF-9');
  office.addToPage(page, { x: 250, y: 580, width: 180, height: 22 });
  form.createCheckBox('agree').addToPage(page, { x: 250, y: 540, width: 14, height: 14 });
  writeFileSync(FORM, await doc.save());
  return { DIWAN_TEST_OPEN_FILES: FORM, DIWAN_TEST_SAVE_DIR: OUT };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);

  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', motherName: 'فاطمة كاظم جواد', nationalId: '199912345678', verified: false }); return true;`);

  await page.goto('pdf-tools');
  await wait(600);
  await click('[data-act="pdf-open"]');
  for (let i = 0; i < 30 && !(await page.eval(`return Boolean(document.querySelector('[data-pdf-form]'));`)); i++) await wait(300);
  const count = await page.eval(`return Number(document.querySelector('[data-pdf-form]')?.dataset.pdfForm ?? 0);`);
  ok(`يُقال إنها استمارةٌ قابلة للتعبئة (${count} حقول)`, count === 5);

  await page.type('[data-form-citizen]', 'زينب');
  for (let i = 0; i < 20 && !(await page.eval(`return Boolean(document.querySelector('[data-form-citizen-pick]'));`)); i++) await wait(250);
  await click('[data-form-citizen-pick]');
  await wait(300);
  await click('[data-act="form-fill"]');
  await wait(800);
  const texts = await page.eval(`return [...document.querySelectorAll('[data-pdf-view] [data-pdf-overlay="text"]')].map((e) => e.innerText.trim());`);
  ok(`الحقول الفارغة الثلاثة نصوصٌ في مواضعها، مملوءةٌ بمعانيها (${texts.join(' · ')})`, texts.length === 3 && texts.includes('زينب علي حسن') && texts.includes('فاطمة كاظم جواد') && texts.includes('199912345678'));

  if (shotsDir) await page.shot(join(shotsDir, 'pdf-form-filled.png'));
  const before = new Set(readdirSync(OUT));
  await click('[data-act="pdf-save"]');
  let file = null;
  for (let i = 0; i < 40 && !file; i++) {
    await wait(400);
    file = readdirSync(OUT).find((f) => f.endsWith('.pdf') && !before.has(f));
  }
  if (!file) {
    ok('حُفظت الاستمارة المملوءة', false);
    return steps.join('\n');
  }
  const bytes = new Uint8Array(readFileSync(join(OUT, file)));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const text = (await (await doc.getPage(1)).getTextContent()).items.map((it) => it.str ?? '').join('').normalize('NFKC');
  // pdf.js يستخرج عربيّ Chromium حرفًا حرفًا بترتيب العرض: فالكلمة تُطلب بحروفها في مقطعٍ بطولها.
  const has = (word) => {
    const flat = text.replace(/ی/g, 'ي').replace(/ھ/g, 'ه').replace(/\s+/g, '');
    const w = word.replace(/\s+/g, '');
    if (flat.includes(w) || flat.includes([...w].reverse().join(''))) return true;
    const key = (s) => [...s].sort().join('');
    for (let i = 0; i + w.length <= flat.length; i++) if (key(flat.slice(i, i + w.length)) === key(w)) return true;
    return false;
  };
  ok('والمحفوظة فيها الاسم واسم الأم نصًّا عربيًّا، والرقم الوطني', has('زينب') && has('فاطمة') && text.includes('199912345678'));
  ok('وما كان مملوءًا من قبل باقٍ، وما كُتب على الصفحة', text.includes('REF-9') && text.includes('FORM-HEADER'));
  const fields = (await PDFDocument.load(bytes)).getForm().getFields().length;
  ok(`ولا استمارة في الناتج — حقولها سُطّحت أو صارت نصوصًا (${fields})`, fields === 0);
  return steps.join('\n');
}
