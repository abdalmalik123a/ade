/**
 * سيناريو: النسخ عند الشبّاك (د٣) — والانقطاع في وسط مهمّةٍ بنسخٍ متعدّدة.
 *
 * كتابٌ بثلاث نسخ إلى طابعةٍ «تتوقّف» عند ورقتها الثالثة (نفد الورق — باب المِقْود في render.ts): فتخرج نسختان
 * ويقف الشريط، والسجلّ يقول «إصدار أول» بنسختين لا ثلاث ولا «إعادة طباعة». ثم «أكمل» فتخرج الثالثة وحدها
 * والسجلّ ثلاث. ثم «أعد الطبع» من شريط ما خرج يعيدها بثلاث — طبعةً ثانية بنسخها. والخانة تعود ١ للزبون التالي.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-copies-${Date.now()}`);
const LOG = join(DIR, 'print.log');
const PRINTER = 'تتوقّف الاختبار';

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  return { DIWAN_TEST_PRINT_LOG: LOG };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const prints = () => {
    const d = db();
    const rows = d.prepare('SELECT copies, reason FROM document_prints ORDER BY id').all();
    d.close();
    return rows;
  };
  const sheets = () => readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length;

  await page.eval(`
    await window.diwan.templates.save({ id: null, code: null, title: 'تأييد نسخ', subtitle: null, category: 'اختبار',
      subjectLine: null, letterheadId: null, bodyHtml: 'نؤيد بأن {الاسم} موظفٌ لدينا.',
      variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }] });
    const s = await window.diwan.settings.get();
    await window.diwan.settings.set({ printRoles: { ...s.printRoles, documents: { normal: ${JSON.stringify(PRINTER)}, color: null, dialog: false } } });
    return true;
  `);
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('تأييد نسخ', 'button');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1200);
  await page.eval(`
    const input = [...document.querySelectorAll('[data-screen="service"] label')]
      .find((l) => (l.textContent ?? '').trim().startsWith('الاسم'))?.querySelector('input[type="text"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'سالم حسن علي');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  await page.clickText('راجع الأوراق', 'button');
  await wait(1200);

  ok('في شريط القرار خانة «النسخ» وأصلها ١', (await page.eval(`return document.querySelector('[data-copies]')?.value ?? '';`)) === '1');
  await page.eval(`
    const el = document.querySelector('[data-copies]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '3');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  ok('و«اطبع» يقول عدد الأوراق بنسخها', await page.eval(`return [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'اطبع ٣ أوراق');`));
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'اطبع ٣ أوراق').click(); return true;`);
  await wait(4000);

  // ── الانقطاع: الطابعة تقف عند الثالثة ─────────────────────────────
  ok('وقفت الطابعة عند الثالثة فقال الشريط ذلك', (await page.eval(`return document.querySelector('[data-print-run]')?.dataset.printRun ?? '';`)) === 'stopped');
  let p = prints();
  ok(`والسجلّ: «إصدار أول» بنسختين — ما خرج فعلًا (${JSON.stringify(p)})`, p.length === 1 && p[0].copies === 2 && p[0].reason === 'إصدار أول');
  const d = db();
  const issued = d.prepare('SELECT copies FROM documents').all();
  d.close();
  ok('والكتاب قُيِّد بنسخه الثلاث', issued.length === 1 && issued[0].copies === 3);

  // ── الاستئناف: الثالثة وحدها ───────────────────────────────────────
  await page.eval(`document.querySelector('[data-act="print-resume"]').click(); return true;`);
  await wait(3500);
  p = prints();
  ok(`و«أكمل» يطبع الثالثة وحدها فيصير السجلّ ثلاثًا (${JSON.stringify(p)})`, p.length === 1 && p[0].copies === 3 && p[0].reason === 'إصدار أول' && !(await page.eval(`return Boolean(document.querySelector('[data-print-run]'));`)));
  ok(`وأُرسلت أربع أوراق: نسختان، والثالثة التي رُدّت، ثم أُعيدت (${sheets()})`, sheets() === 4);
  ok('وشريط ما خرج يقول النسخ', (await page.eval(`return document.querySelector('[data-after-print]')?.innerText ?? '';`)).includes('× ٣ نسخ'));

  // ── «أعد الطبع» بالنسخ نفسها ───────────────────────────────────────
  await page.eval(`document.querySelector('[data-act="reprint"]').click(); return true;`);
  await wait(4000);
  p = prints();
  ok(`و«أعد الطبع» يعيدها بثلاث — طبعةً ثانية بنسخها (${JSON.stringify(p)})`, p.length === 2 && p[1].copies === 3 && p[1].reason === 'إعادة طباعة طبق الأصل' && sheets() === 7);

  // ── الزبون التالي: الخانة ١ ───────────────────────────────────────
  await page.clickText('تأييد نسخ', 'button');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1000);
  await page.eval(`
    const input = [...document.querySelectorAll('[data-screen="service"] label')]
      .find((l) => (l.textContent ?? '').trim().startsWith('الاسم'))?.querySelector('input[type="text"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'زينب علي');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  await page.clickText('راجع الأوراق', 'button');
  await wait(1000);
  ok('وللزبون التالي تعود الخانة ١', (await page.eval(`return document.querySelector('[data-copies]')?.value ?? '';`)) === '1');
  await page.eval(`document.querySelector('[data-act="park"]')?.click(); return true;`);
  await wait(400);

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
