/**
 * سيناريو: «خطوط ديوان» (DESIGNS.md ٠٫٧) — سياسةٌ واحدة، ولا بديل صامت.
 *
 * خطّان مستوردان من أميري المحزوم بأسماءٍ أخرى («Amiry» ملفًّا، و«Amirx» بوجهيه من مجلّد خطوط Windows يُعدّه السيناريو) —
 * فلا يتعلّق شيءٌ بخطوط الجهاز. يُستورد الملفّ ويُرفض ما ليس خطًّا، ويُضاف خطّ Windows بضغطة، ويُرسم بهما في الواجهة،
 * ويُطبع بهما PDF (نافذة الإخراج تحقن قواعدهما)؛ ومحرّر الكتب والترويسة يختاران منهما، والغائب يُقال باسمه ويُضاف من
 * Windows بضغطة. ويبقيان بعد إعادة التشغيل.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = join(process.env.TEMP ?? '.', `diwan-fonts-${Date.now()}`);
const WIN = join(ROOT, 'windows');
const OUT = join(ROOT, 'out');
const AMIRI = join(process.cwd(), 'node_modules', '@fontsource', 'amiri', 'files');

/** أميري (WOFF) ← TTF باسمٍ آخر بالطول نفسه: «Amiri» ← `to` في جدول الأسماء. */
function renamed(file, to) {
  const w = readFileSync(join(AMIRI, file));
  const n = w.readUInt16BE(12);
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(w.readUInt32BE(4), 0);
  head.writeUInt16BE(n, 4);
  let offset = head.length;
  const bodies = [];
  for (let i = 0; i < n; i++) {
    const at = 44 + i * 20;
    const tag = w.subarray(at, at + 4);
    const raw = w.subarray(w.readUInt32BE(at + 4), w.readUInt32BE(at + 4) + w.readUInt32BE(at + 8));
    let data = w.readUInt32BE(at + 8) < w.readUInt32BE(at + 12) ? inflateSync(raw) : Buffer.from(raw);
    if (tag.toString('latin1') === 'name') {
      const be = (s) => Buffer.from(s, 'utf16le').swap16().toString('latin1');
      data = Buffer.from(data.toString('latin1').split(be('Amiri')).join(be(to)).split('Amiri').join(to), 'latin1');
    }
    tag.copy(head, 12 + i * 16);
    head.writeUInt32BE(offset, 12 + i * 16 + 8);
    head.writeUInt32BE(data.length, 12 + i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  }
  return Buffer.concat([head, ...bodies]);
}

export function prepare() {
  mkdirSync(WIN, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(WIN, 'amirx.ttf'), renamed('amiri-arabic-400-normal.woff', 'Amirx'));
  writeFileSync(join(WIN, 'amirxbd.ttf'), renamed('amiri-arabic-700-normal.woff', 'Amirx'));
  writeFileSync(join(ROOT, 'Amiry-Regular.ttf'), renamed('amiri-arabic-400-normal.woff', 'Amiry'));
  writeFileSync(join(ROOT, 'ليس-خطًّا.ttf'), 'نصٌّ وليس خطًّا');
  return {
    DIWAN_TEST_WINDOWS_FONTS: WIN,
    DIWAN_TEST_OPEN_FILES: [join(ROOT, 'Amiry-Regular.ttf'), join(ROOT, 'ليس-خطًّا.ttf')].join('|'),
    DIWAN_TEST_SAVE_DIR: OUT
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** أيُرسم الخطّ في هذه الصفحة؟ — يُطلب ويُنتظر، ثم يُسأل أوجهٌ حُمّل له. */
const renders = (page, family) =>
  page.eval(`
    await document.fonts.load("16px '${family}'", 'بسم');
    return [...document.fonts].some((f) => f.family.replace(/["']/g, '') === '${family}' && f.status === 'loaded');
  `);

/** مسودّة كتابٍ بخطوطٍ في متنه — تُفتح من «قيد العمل». */
const DRAFT = (fonts) => `
  const run = (text, font) => ({ kind: 'run', text, marks: { font } });
  const doc = { id: 'fonts-draft', schemaVersion: 2, kind: 'flow', issuing: 'registered', fields: [], meta: {},
    blocks: ${JSON.stringify(fonts)}.map((f, i) => ({ id: 'b' + i, kind: 'paragraph', align: 'right', inlines: [run('سطرٌ بخطّ ' + f, f)] })) };
  return await window.diwan.drafts.save({ id: null, templateId: null, citizenId: null, title: 'كتاب الخطوط', bodyHtml: '',
    values: { __doc: JSON.stringify(doc), __letterhead: 'null', __registry: '{}', __docType: 'كتاب الخطوط', __owner: 'سالم حسن' } });
`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const text = () => page.text();

  // ── المكتبة ← الخطوط ──────────────────────────────────────────────
  await page.goto('diwan-fonts');
  await wait(600);
  ok('«المكتبة ← الخطوط» بالمحزوم التسعة', (await page.eval(`return document.querySelectorAll('[data-fonts="bundled"] [data-font]').length;`)) === 9);
  ok('ولا مستورد بعد', (await page.eval(`return document.querySelectorAll('[data-fonts="imported"] [data-font]').length;`)) === 0);

  await click('[data-act="fonts-import"]');
  await wait(1500);
  const said = await text();
  ok('ملفّ الخطّ يُستورد باسم عائلته', said.includes('أُضيف «Amiry»') && (await has('[data-fonts="imported"] [data-font="Amiry"]')));
  ok('وما ليس خطًّا يُرفض باسمه وسببه', said.includes('ليس-خطًّا.ttf') && said.includes('ليس ملفّ خطّ يُعرف'));
  ok('ويُرسم به في الواجهة (من المخزن)', await renders(page, 'Amiry'));

  await click('[data-act="fonts-windows"]');
  await wait(1500);
  ok('خطوط Windows تُعرض بعائلاتها', await has('[data-windows-font="Amirx"]'));
  await click('[data-windows-font="Amirx"] [data-act="font-add"]');
  await wait(1500);
  ok('وتُضاف بضغطة بوجهيها', (await text()).includes('أُضيف «Amirx» (٢ وجه)') && (await has('[data-fonts="imported"] [data-font="Amirx"]')));
  ok('وتصير «في المكتبة»', (await page.eval(`return document.querySelector('[data-windows-font="Amirx"]')?.innerText ?? '';`)).includes('في المكتبة'));

  // ── الإخراج: نافذةٌ بلا جسر تحقن العملية الرئيسة فيها قواعد المستورد ─────
  const pdf = await page.eval(`
    return await window.diwan.output.savePdf({ suggestedName: 'خط-مستورد.pdf', sheetHtml:
      '<div class="print-sheet" dir="rtl" style="width:210mm;height:297mm;padding:20mm;font-family:\\'Amirx\\',serif;font-size:24pt">شهادة بخطٍّ مستورد</div>' });
  `);
  const pdfBytes = pdf ? readFileSync(pdf).toString('latin1') : '';
  ok('وPDF يُطبع بالخطّ المستورد نفسه (مضمَّنًا فيه)', /\/BaseFont\s*\/[A-Z]{6}\+Amirx/.test(pdfBytes));

  // ── محرّر الكتب: القائمة من المكتبة، والغائب يُقال باسمه ───────────────
  const draftId = await page.eval(DRAFT(['Amirx', 'Gone Font']));
  await page.goto('orders-board');
  await wait(800);
  await click(`[data-pending="resume-draft"] [data-act="resume-draft"]`);
  await wait(2000);
  const options = await page.eval(`return [...document.querySelectorAll('select[data-act="font"] option')].map((o) => o.value);`);
  ok('قائمة خطوط المحرّر من المكتبة: المحزوم والمستورد', options.includes('Noto Naskh Arabic') && options.includes('Amirx') && options.includes('Amiry'));
  ok('ولا خطّ Windows لم يُضَف (Simplified Arabic)', !options.includes('Simplified Arabic'));
  ok('والخطّ الغائب في الورقة يُقال باسمه', await has('[data-missing-font="Gone Font"]'));
  await wait(1200);
  ok('ويُقال إنّه ليس على هذا الجهاز ويُقترح بديله', (await page.eval(`return document.querySelector('[data-missing-font]')?.innerText ?? '';`)).includes('أقرب بديل'));

  // الخطّ نفسه يُحذف من المكتبة (من صفحتها): الكتاب الذي يستعمله يقول ذلك ويُعيده من Windows بضغطة.
  await page.eval(`await window.diwan.drafts.delete(${draftId}); return true;`);
  await page.goto('templates-library-drafts');
  await wait(500);
  await page.goto('diwan-fonts');
  await wait(700);
  await click('[data-font="Amirx"] [data-act="font-remove"]');
  await wait(500);
  ok('الحذف يسأل', (await page.eval(`return document.querySelector('[data-confirm]')?.innerText ?? '';`)).includes('أتحذف «Amirx»'));
  await click('[data-confirm] [data-choice="yes"]');
  await wait(900);
  ok('ويُحذف من المكتبة', !(await has('[data-font="Amirx"]')) && (await page.eval(`return (await window.diwan.fonts.list()).every((f) => f.family !== 'Amirx');`)));
  const second = await page.eval(DRAFT(['Amirx']));
  await page.goto('orders-board');
  await wait(800);
  await click(`[data-pending="resume-draft"] [data-act="resume-draft"]`);
  await wait(2500);
  ok('خطٌّ حُذف من المكتبة يُقال في الكتاب', await has('[data-missing-font="Amirx"]'));
  await click('[data-act="font-add-windows"]');
  await wait(2000);
  ok('و«أضِفه من Windows» يعيده بضغطة فيختفي التنبيه', !(await has('[data-missing-font]')) && (await page.eval(`return (await window.diwan.fonts.list()).filter((f) => f.family === 'Amirx').length;`)) === 2);
  await page.eval(`await window.diwan.drafts.delete(${second}); return true;`);

  // ── الترويسة: خطٌّ واحدٌ لها من المكتبة نفسها ─────────────────────────
  await page.goto('header-seal-configuration');
  await wait(900);
  const heads = await page.eval(`return [...document.querySelectorAll('select[data-act="letterhead-font"] option')].map((o) => o.value);`);
  ok('خطّ الترويسة يُختار من المكتبة بما فيها المستورد', heads.includes('Amirx') && heads.includes('Amiri'));
  await page.eval(`
    const s = document.querySelector('select[data-act="letterhead-font"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'Amirx');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await wait(500);
  ok('ويُختار للترويسة كلّها', (await page.eval(`return document.querySelector('select[data-act="letterhead-font"]')?.value ?? '';`)) === 'Amirx');
  // تعديلٌ لم يُحفظ: الترويسة تسأل عند المغادرة (ج٣) — يُترك.
  await page.goto('templates-library-drafts');
  await wait(500);
  await click('[data-confirm] [data-choice="discard"]');
  await wait(600);
  ok('(وتُترك بلا حفظ)', !(await has('[data-confirm]')));
  ok('ولا أثرٌ لخطوطٍ في مجلّد الإخراج غير الـPDF', readdirSync(OUT).every((f) => f.endsWith('.pdf')));
  return steps.join('\n');
}

export async function afterRestart(page) {
  const list = await page.eval(`return (await window.diwan.fonts.list()).map((f) => f.family + ':' + f.weight);`);
  return [
    `${list.includes('Amirx:400') && list.includes('Amirx:700') ? '✓' : '✗'} المستورد باقٍ بعد إعادة التشغيل`,
    `${(await renders(page, 'Amirx')) ? '✓' : '✗'} ويُرسم به من أوّل الإقلاع`
  ].join('\n');
}
