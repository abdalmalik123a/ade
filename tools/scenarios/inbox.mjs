/**
 * سيناريو: «الملفّات» في الشبّاك (المرحلة ٢ من UPGRADE.md — ن٨).
 *
 * ما وصل المكتب يظهر في الشبّاك بلا مستكشف ملفّات: ملفّ PDF في التنزيلات، وصورةٌ في واتساب، وملفّ
 * Word، وما على الفلاشة ولو قديمًا — وما مضى عليه أكثر من أسبوع في التنزيلات لا يزحم القائمة. وكلٌّ
 * يُفتح في أداته: PDF في أداة PDF، والصورة في الصور الشخصية، وملفّ Word نموذجًا في المصمّم.
 *
 * والمجلّدات تحت المِقْود (`DIWAN_TEST_INBOX`) لا مجلّدات صاحب الجهاز.
 */
import { copyFileSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

export async function prepare() {
  const root = join(process.env.TEMP, 'inbox');
  const dir = (name) => {
    const d = join(root, name);
    mkdirSync(d, { recursive: true });
    return d;
  };
  const downloads = dir('downloads');
  const whatsapp = dir('whatsapp');
  const flash = dir('flash');

  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  writeFileSync(join(downloads, 'كتاب الدائرة.pdf'), bytes);
  copyFileSync(resolve('tests/fixtures/warning-letter.docx'), join(downloads, 'انذار.docx'));
  copyFileSync(resolve('tests/fixtures/tiny.jpg'), join(whatsapp, 'صورة الزبون.jpg'));
  // النسخ في ويندوز يحفظ تاريخ الأصل — وهذان «وصلا الآن».
  const now = new Date();
  utimesSync(join(downloads, 'انذار.docx'), now, now);
  utimesSync(join(whatsapp, 'صورة الزبون.jpg'), now, now);
  // قديمٌ في التنزيلات: لا يزحم القائمة. وقديمٌ على الفلاشة: يظهر — أُوصلت لأجله.
  const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  writeFileSync(join(downloads, 'قديم.pdf'), bytes);
  utimesSync(join(downloads, 'قديم.pdf'), old, old);
  writeFileSync(join(flash, 'من الفلاشة.pdf'), bytes);
  utimesSync(join(flash, 'من الفلاشة.pdf'), old, old);
  writeFileSync(join(downloads, 'ملاحظات.txt'), 'ليس ممّا يُفتح');

  return { DIWAN_TEST_INBOX: `downloads=${downloads}|whatsapp=${whatsapp}|flash=${flash}` };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const list = () =>
    page.eval(`return [...document.querySelectorAll('[data-inbox] [data-inbox-file]')].map((r) => ({ kind: r.dataset.inboxFile, text: r.innerText }));`);
  const openRow = (name, act = 'inbox-open') =>
    page.eval(`
      const row = [...document.querySelectorAll('[data-inbox] [data-inbox-file]')].find((r) => r.innerText.includes(${JSON.stringify(name)}));
      row?.querySelector('[data-act="${act}"]')?.click();
      return Boolean(row);
    `);

  await page.goto('service-counter');
  await wait(1500);
  let rows = await list();
  const has = (name) => rows.some((r) => r.text.includes(name));
  ok('«آخر ما وصل» في الشبّاك', (await page.eval(`return Boolean(document.querySelector('[data-inbox]'));`)) && rows.length > 0);
  ok('ملفّ PDF من التنزيلات، وصورة من واتساب، وملفّ Word', has('كتاب الدائرة.pdf') && has('صورة الزبون.jpg') && has('انذار.docx'));
  ok('ومصدر كلٍّ مكتوب', rows.find((r) => r.text.includes('صورة الزبون'))?.text.includes('واتساب') && rows.find((r) => r.text.includes('كتاب الدائرة'))?.text.includes('التنزيلات'));
  ok('وما على الفلاشة يظهر ولو قديمًا', has('من الفلاشة.pdf') && rows.find((r) => r.text.includes('من الفلاشة'))?.text.includes('الفلاشة'));
  ok('والقديم في التنزيلات لا يزحمها، وما لا يُفتح في ديوان لا يُعرض', !has('قديم.pdf') && !has('ملاحظات.txt'));
  ok('ومنطقة الإفلات في مكانها', await page.eval(`return Boolean(document.querySelector('[data-dropzone="counter"]'));`));
  if (shotsDir) await page.shot(join(shotsDir, 'inbox-counter.png'));

  // ── PDF إلى أداته ─────────────────────────────────────────────────
  await openRow('كتاب الدائرة.pdf');
  await wait(2500);
  let text = await page.text();
  ok('ملفّ PDF يُفتح في أداة PDF بصفحتيه', (await page.eval(`return document.querySelector('[data-sidebar="rail"] [aria-current="page"]')?.dataset.dest;`)) === 'service' && text.includes('كتاب الدائرة') && /صفحتان|2 صفحة|صفحتين/.test(text));

  // ── الصورة إلى الصور الشخصية ──────────────────────────────────────
  await page.goto('service-counter');
  await wait(1200);
  await openRow('صورة الزبون.jpg', 'inbox-photo');
  await wait(2500);
  ok('والصورة تُفتح في الصور الشخصية', await page.eval(`return Boolean(document.querySelector('[data-photo-frame] canvas'));`));

  // ── ملفّ Word نموذجًا ─────────────────────────────────────────────
  await page.goto('service-counter');
  await wait(1200);
  await openRow('انذار.docx');
  await wait(3000);
  text = await page.text();
  ok('وملفّ Word يُفتح نموذجًا في المصمّم كما كُتب', text.includes('مدرسة الصحوة الابتدائية') && (await page.eval(`return Boolean(document.querySelector('[data-editor="v2"] [data-page-editor]'));`)));
  ok('ومعه الخانات المقترحة من فراغاته', (await page.eval(`return document.querySelectorAll('[data-hint="blank"]').length;`)) >= 3);
  if (shotsDir) await page.shot(join(shotsDir, 'inbox-word.png'));

  return steps.join('\n');
}
