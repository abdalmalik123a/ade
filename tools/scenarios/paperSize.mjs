/**
 * سيناريو: الكتاب الرسمي يُؤرشف ويُطبع ويُعاد طبعه بمقاس ورقته (مراجعة ٧ ت١).
 *
 * كانت علامات الورقة تصل إلى «الإصدار الرسمي» بلا مقاسها، فيخرج الفولسكاب على A4 (أسطره تنزل
 * إلى صفحة ثانية) والأفقيُّ مقصوصًا وA5 في ركنٍ — والمعاينة والمسودّة صحيحتان. فنضبط الورقة في المحرّر
 * على الفولسكاب ثم A4 أفقيًّا ثم A5، ونُصدر بعلامات الورقة التي رسمتها الواجهة، ونقرأ `MediaBox` من
 * PDF الأرشيف، ومن «تصدير PDF»، ومقاس الطباعة في سجلّ المِقْود عند «أعد الطبع».
 */
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';

const STAMP = Date.now();
const LOG = join(process.env.TEMP ?? '.', `diwan-papersize-${STAMP}.jsonl`);
const SAVE = join(process.env.TEMP ?? '.', `diwan-papersize-save-${STAMP}`);

export async function prepare() {
  rmSync(LOG, { force: true });
  rmSync(SAVE, { recursive: true, force: true });
  mkdirSync(SAVE, { recursive: true });
  return { DIWAN_TEST_PRINT_LOG: LOG, DIWAN_TEST_SAVE_DIR: SAVE };
}

/** مقاس أوّل صفحةٍ في PDF بالنقطة، مقرَّبًا. */
const boxOf = (file) => {
  if (!file || !existsSync(file)) return null;
  const m = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/.exec(readFileSync(file, 'latin1'));
  return m ? [Math.round(+m[1]), Math.round(+m[2])] : null;
};
const printed = () =>
  existsSync(LOG)
    ? readFileSync(LOG, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (selector) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    `);
  const choose = async (selector, value) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
    await wait(300);
  };
  const row = (id) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return d.prepare('SELECT rendered_path FROM documents WHERE id = ?').get(id);
    } finally {
      d.close();
    }
  };

  await page.goto('smart-editor-a4-preview');
  await wait(1000);
  // الإصدار يرفض الورقة الفارغة: نكتب سطرًا كما يكتب الموظف.
  await page.eval(`
    const ed = document.querySelector('[data-screen="editor"] [data-page-editor]');
    ed.focus();
    const range = document.createRange();
    range.selectNodeContents(ed.querySelector(':scope > p') ?? ed);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;`);
  await wait(200);
  await page.send('Input.insertText', { text: 'نؤيد لكم صحة الأوراق المرفقة بالمقاس المطلوب.' });
  await wait(400);

  /** يضبط ورقة المحرّر ثم يُصدر بعلاماتها كما رسمتها الواجهة. */
  const issueAs = async (label, size, orientation) => {
    await choose('[data-act="page-size"]', size);
    await click(orientation === 'landscape' ? '[data-act="landscape"]' : '[data-act="portrait"]');
    await wait(600);
    const attr = await page.eval(`return document.querySelector('[data-screen="editor"] [data-letter-sheet]')?.getAttribute('data-page') ?? null;`);
    const id = await page.eval(`
      const el = document.querySelector('[data-screen="editor"] [data-letter-sheet]');
      const out = await window.diwan.documents.issue({
        sheetHtml: el.outerHTML, templateId: null, citizenId: null, authorityId: null,
        citizenName: 'اسم الاختبار', nationalId: null, docType: ${JSON.stringify(label)}, destination: null, purpose: null,
        values: {}, copies: 1, copyKind: null, fee: 0, gregorianDate: '2026/10/08', hijriDate: null,
        operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null
      }, false);
      return out.id;`);
    await wait(500);
    const rel = row(id)?.rendered_path;
    return { attr, id, archive: boxOf(rel ? join(profile, 'data', 'store', rel) : null) };
  };

  // A4 عمودي: الشاهد — لا يتغيّر شيء لمن يعمل عليه.
  const a4 = await issueAs('A4', 'A4', 'portrait');
  ok(`الورقة تحمل مقاسها: A4 = ${a4.attr}`, a4.attr === '210x297');
  ok(`وأرشيف A4 عموديّ (${a4.archive})`, a4.archive?.[0] === 595 && a4.archive?.[1] === 842);

  // الفولسكاب ٢١٠×٣٣٠
  const fs = await issueAs('فولسكاب', 'FS', 'portrait');
  ok(`الورقة تحمل مقاسها: فولسكاب = ${fs.attr}`, fs.attr === '210x330');
  ok(`وأرشيف الفولسكاب ٢١٠×٣٣٠ لا A4 (${fs.archive})`, fs.archive?.[0] === 595 && fs.archive?.[1] === 935);

  // A4 أفقي
  const land = await issueAs('أفقي', 'A4', 'landscape');
  ok(`الورقة تحمل مقاسها: أفقي = ${land.attr}`, land.attr === '297x210');
  ok(`وأرشيف الأفقيّ لا يُقصّ (${land.archive})`, land.archive?.[0] === 842 && land.archive?.[1] === 595);

  // A5
  const a5 = await issueAs('A5', 'A5', 'portrait');
  ok(`الورقة تحمل مقاسها: A5 = ${a5.attr}`, a5.attr === '148x210');
  ok(`وأرشيف A5 ١٤٨×٢١٠ لا ركنٌ من A4 (${a5.archive})`, a5.archive?.[0] === 420 && a5.archive?.[1] === 595);

  // «أعد الطبع» من الأرشيف: بمقاس كلٍّ، وبلا مقاسٍ يُكتب في السجلّ
  for (const one of [a4, fs, land, a5]) {
    await page.eval(`return window.diwan.documents.reprint([${one.id}], 1, 'طابعة الاختبار').then(() => true);`);
  }
  await wait(1500);
  const pages = printed().map((l) => l.page);
  ok(`وإعادة الطبع بمقاس كلّ كتاب (${pages.join('، ')})`, pages.join(',') === '210x297,210x330,297x210,148x210');

  // تصدير PDF من السجلّ بمقاس الكتاب
  const exported = await page.eval(`return window.diwan.documents.exportPdf(${fs.id});`);
  ok(`وتصدير PDF من السجلّ بالفولسكاب (${boxOf(exported)})`, boxOf(exported)?.[0] === 595 && boxOf(exported)?.[1] === 935);

  return steps.join('\n');
}
