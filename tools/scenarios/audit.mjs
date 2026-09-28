/**
 * سيناريو: ما كشفه التدقيق المستقل — على التطبيق الحقيقي.
 *
 * - الباركود: قيمةٌ بحروفٍ عربية تُقال في موضعها (كان الصندوق يبقى فارغًا فيُظنّ مطبوعًا)،
 *   والأرقام الهندية تُرسم قضبانًا، وفاحص ما قبل الطباعة يعدّ بطاقات الدفعة التي لا يُطبع
 *   فيها الباركود.
 * - الرقم الوطني: التطويل في الخانة يُنبَّه، ويُحفظ الرقم أرقامًا لاتينية — فالمكتوب
 *   بالهندية يُعرف صاحبه ويُكشف تكراره.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

const TATWEEL = String.fromCharCode(0x640);

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const barcode = () =>
    page.eval(`
      const node = document.querySelector('[data-barcode]');
      return { svg: Boolean(node?.querySelector('svg rect')), error: node?.querySelector('[data-barcode-error]')?.innerText ?? '' };`);

  // ── الباركود ─────────────────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(1200);
  await click('button[data-kind="student-id"]');
  await wait(900);
  await click('button[data-add="barcode"]');
  await wait(500);
  await page.type('input[data-value="الرقم"]', 'رقم5');
  await wait(500);
  let b = await barcode();
  ok(`قيمةٌ بحروفٍ عربية تُقال في موضع الباركود لا تُترك فراغًا («${b.error}»)`, !b.svg && b.error.includes('لا يحمل الحروف العربية'));
  await page.type('input[data-value="الرقم"]', '١٢٣٤٥٦');
  await wait(500);
  b = await barcode();
  ok('والأرقام الهندية تُرسم قضبانًا', b.svg && !b.error);

  await page.type('textarea[data-batch-text]', ['الاسم\tالرقم', 'أحمد كريم\t٢٠٢٦٠٠١', 'علي حسين\tرقم7', 'سالم محمود\t2026003'].join('\n'));
  await wait(700);
  await click('button[data-act="sheets"]');
  await wait(1500);
  const preflight = await page.eval(`return document.querySelector('[data-sheets] [data-preflight]')?.innerText ?? '';`);
  ok(`وفاحص ما قبل الطباعة يعدّ بطاقات الدفعة التي لا يُطبع فيها («${preflight.split('\n').find((l) => l.includes('الباركود')) ?? ''}»)`, preflight.includes('لا يحمل الحروف العربية') && preflight.includes('١ بطاقة') && preflight.includes('رقم7'));
  const bars = await page.eval(`return [...document.querySelectorAll('[data-sheets] .print-page [data-canvas]')].map((c) => Boolean(c.querySelector('svg rect')));`);
  ok(`وفي الأوراق: بطاقتا الأرقام بباركودهما (${JSON.stringify(bars)})`, bars.length === 3 && bars.filter(Boolean).length === 2);
  await page.eval(`document.querySelector('[data-sheets] button[title="رجوع (Esc)"]')?.click(); return true;`);
  await wait(400);

  // ── الرقم الوطني ─────────────────────────────────────────────────
  await page.goto('citizens-identity-records');
  await wait(900);
  await page.clickText('إضافة ملف مواطن');
  await wait(600);
  await page.type('input[data-citizen-field="fullName"]', 'زينب علي حسن الربيعي');
  await page.type('input[data-citizen-field="nationalId"]', `١٩٩٩١٢٣٤٥٦٧${TATWEEL}٨`);
  await wait(300);
  const hint = await page.eval(`return document.querySelector('[data-field-hint="nationalId"]')?.innerText ?? '';`);
  ok(`التطويل في الرقم الوطني يُنبَّه («${hint}»)`, hint.includes('أرقامٌ فقط'));
  await page.clickText('حفظ الملف');
  await wait(1000);
  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const nid = d.prepare("SELECT national_id AS n FROM citizens WHERE full_name = 'زينب علي حسن الربيعي'").get()?.n;
  d.close();
  ok(`ويُحفظ أرقامًا لاتينية بلا شوائب («${nid}»)`, nid === '199912345678');
  const dup = await page.eval(`
    try { await window.diwan.citizens.save({ id: null, fullName: 'زينب علي', verified: false, nationalId: '199912345678' }); return 'حُفظ'; }
    catch (e) { return e.message; }`);
  ok('والمكتوب لاتينيًّا بعدها يُعرف مكرَّرًا', dup.includes('مسجَّل لمواطن آخر'));
  const found = await page.eval(`return (await window.diwan.citizens.list({ query: '١٩٩٩١٢٣٤' })).map((c) => c.fullName);`);
  ok('والبحث بالأرقام الهندية يجده', found.includes('زينب علي حسن الربيعي'));
  return steps.join('\n');
}
