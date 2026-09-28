/**
 * سيناريو: المتانة (المرحلة ٧).
 *
 * - **لا خطأ يُبلع**: وعدٌ يُرفض ولا يلتقطه أحد يظهر للموظف في شريط الأخطاء بسببه —
 *   والمِقْود نفسه يلتقطه (فحصٌ للفاحص: لو لم يُلتقط لكان «صفر استثناءات» في
 *   السيناريوهات كلّها كذبًا).
 * - **الملفات الفاسدة**: ملفٌّ ليس ما يقوله امتداده يُفتح من أربعة أبواب — Excel
 *   الدفعة، واستيراد التصميم، وصورة الورقة، واستيراد Word — فيُقال سببه بالعربية.
 * - **الاستمرار**: تنقّلٌ بين الشاشات كلّها مئات المرّات، والذاكرة والعُقد والمُنصتات
 *   لا تنتفخ.
 * - **الإغلاق المفاجئ** (`afterRestart`): مسودّةٌ حُفظت تلقائيًّا، ودفعةٌ من أربعة آلاف
 *   كتاب في منتصف قيدها — ثم يُقتل البرنامج. فبعد تشغيله: المسودة باقية، والدفعة كلّها
 *   أو لا شيء منها، والقاعدة سليمة، والسلسلة سليمة، والترقيم بلا ثقب.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const ROOT = join(process.env.TEMP ?? '.', `diwan-resilience-${Date.now()}`);
const BROKEN = join(ROOT, 'broken.xlsx');
const ROUTES = [
  'service-counter',
  'orders-board',
  'passport-photos',
  'pdf-tools',
  'clients-directory',
  'smart-editor-a4-preview',
  'templates-library-drafts',
  'transactions-archive-ledger',
  'citizens-identity-records',
  'exam-papers',
  'designed-documents',
  'header-seal-configuration',
  'audit-log-integrity',
  'office-settings'
];
// دفعةٌ بحجم دفعات المكاتب؛ والقيد يتمهّل ٣ م.ث بعد كلّ كتاب (DIWAN_TEST_SLOW_ISSUE)
// فتستغرق ستّ ثوانٍ — ويُقتل البرنامج في منتصفها، لا بعدها ولا قبلها.
const BATCH = 2000;

export function prepare() {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(BROKEN, Buffer.from('ليس هذا ملف Excel — نصٌّ أُعيدت تسميته. '.repeat(50), 'utf8'));
  return { DIWAN_TEST_OPEN_FILE: BROKEN, DIWAN_TEST_SAVE_DIR: ROOT, DIWAN_TEST_SLOW_ISSUE: '3' };
}

const MIB = 1024 * 1024;

export default async function scenario(page, { profile, kill }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const bar = () => page.eval(`return document.querySelector('[data-error-bar] [data-error-message]')?.innerText ?? '';`);
  const closeBar = () => page.eval(`document.querySelector('[data-error-bar] button[title="إغلاق"]')?.click(); return true;`);

  // ── لا خطأ يُبلع: فحصٌ للفاحص ──────────────────────────────────────
  await page.eval(`setTimeout(() => Promise.reject(new Error('اختبارُ خطأٍ لم يلتقطه أحد')), 0); return true;`);
  await wait(600);
  ok('وعدٌ رُفض ولم يُلتقط يُقال للموظف في شريط الأخطاء', (await bar()).includes('اختبارُ خطأٍ لم يلتقطه أحد'));
  ok('والمِقْود يلتقطه أيضًا — فصفر الاستثناءات في السيناريوهات صادق', page.exceptions.some((e) => e.includes('اختبارُ خطأٍ')));
  page.exceptions.length = 0; // المتوقَّع وحده يُمحى — وما بعده يُحسب
  await closeBar();
  await wait(200);
  ok('ويُغلق الشريط', !(await bar()));

  // ── الملفات الفاسدة من أربعة أبواب ─────────────────────────────────
  await page.goto('designed-documents');
  await wait(1200);
  await click('button[data-kind="staff-id"]');
  await wait(900);
  await click('[data-act="open-sheet"]');
  await wait(1200);
  const sheetError = await page.eval(`return document.querySelector('[data-sheet-error]')?.innerText ?? '';`);
  ok(`Excel الدفعة الفاسد يُقال سببه: «${sheetError}»`, sheetError.includes('تعذّر قراءة ملف Excel'));

  await click('button[data-act="import"]');
  await wait(1500);
  ok('والتصميم الفاسد يُقال — لا لوحةٌ فارغة تسأل عن مقاسه', (await page.text()).includes('ليس صورةً تُقرأ'));

  await page.goto('templates-library-drafts');
  await wait(900);
  await click('[data-act="new-photo"]');
  await wait(300);
  await click('[data-act="paper-pick"]');
  await wait(2000);
  const paperError = await page.eval(`return document.querySelector('[data-paper-error]')?.innerText ?? '';`);
  ok(`وصورة الورقة الفاسدة يُقال سببها: «${paperError}»`, paperError.includes('ليس صورةً تُقرأ'));
  await page.eval(`document.querySelector('[data-paper-photo] button[title="إغلاق"]')?.click(); return true;`);
  await wait(300);

  await click('[data-act="new-word"]');
  await wait(1500);
  const wordText = await page.text();
  ok('واستيراد Word لملفٍّ ليس Word يُقال سببه', wordText.includes('الملف ليس Word ولا XML') && !(await page.eval(`return Boolean(document.querySelector('[data-designer-page]'));`)));
  ok(`ولم يُفلت من الأبواب الأربعة خطأٌ بلا من يلتقطه (${page.exceptions.length})`, page.exceptions.length === 0);

  // ── الاستمرار: مئات التنقّلات ─────────────────────────────────────
  await page.send('Performance.enable');
  const measure = async () => {
    await page.send('HeapProfiler.collectGarbage');
    await wait(300);
    const heap = await page.send('Runtime.getHeapUsage');
    const { metrics } = await page.send('Performance.getMetrics');
    const m = (name) => metrics.find((x) => x.name === name)?.value ?? 0;
    return { heap: heap.usedSize, nodes: m('Nodes'), listeners: m('JSEventListeners') };
  };
  const rounds = Number(process.env.SOAK_ROUNDS ?? 15);
  for (const r of ROUTES) await page.goto(r); // جولةٌ للإحماء: ما يُحمَّل مرّةً لا يُحسب انتفاخًا
  await page.goto('service-counter');
  const before = await measure();
  const t0 = Date.now();
  for (let i = 0; i < rounds; i++) for (const r of ROUTES) await page.goto(r);
  await page.goto('service-counter');
  const after = await measure();
  const navs = rounds * ROUTES.length;
  steps.push(
    `  … ${navs} تنقّلًا في ${Math.round((Date.now() - t0) / 1000)} ث: الذاكرة ${(before.heap / MIB).toFixed(1)} ← ${(after.heap / MIB).toFixed(1)} م.ب، ` +
      `العُقد ${before.nodes} ← ${after.nodes}، المُنصتات ${before.listeners} ← ${after.listeners}`
  );
  ok(`${navs} تنقّلًا والذاكرة لا تنتفخ`, after.heap <= before.heap * 1.3 + 5 * MIB);
  ok('ولا العُقد', after.nodes <= before.nodes * 1.5 + 500);
  ok('ولا المُنصتات', after.listeners <= before.listeners * 1.5 + 50);
  ok(`ولا خطأ في التنقّل كلّه (${page.exceptions.length})`, page.exceptions.length === 0);

  // ── قبل الانقطاع: مسودةٌ محفوظة، ودفعةٌ في منتصف قيدها ───────────────
  await page.eval(`
    const run = (text) => ({ kind: 'run', text });
    await window.diwan.templates.save({
      id: null, code: null, title: 'إفادة قبل الانقطاع', subtitle: null, category: 'دوائر', subjectLine: null, letterheadId: null,
      bodyHtml: 'نؤيد أن {الاسم} يعمل لدينا.', variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }],
      doc: { id: 'before-crash', schemaVersion: 1, kind: 'flow', issuing: 'registered',
        blocks: [{ id: 'b0', kind: 'paragraph', align: 'right', inlines: [run('نؤيد أن '), { kind: 'field', id: 'f', ref: 'الاسم' }, run(' يعمل لدينا.')] }],
        fields: [{ id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' }], meta: {} }
    });
    return true;`);
  await page.goto('templates-library-drafts');
  await wait(900);
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find((b) => {
      if (!b.textContent.includes('فتح في المحرر')) return false;
      let el = b;
      for (let i = 0; i < 8 && el; i++, el = el.parentElement) if (el.innerText?.includes('إفادة قبل الانقطاع')) return true;
      return false;
    });
    btn?.click();
    return true;`);
  await wait(1500);
  await page.eval(`
    const l = [...document.querySelectorAll('[data-screen="editor"] label')].find((x) => x.textContent.trim().startsWith('الاسم'));
    const box = l?.closest('div.flex-col') ?? l?.parentElement;
    const input = l?.querySelector('input, textarea') ?? box?.querySelector('input, textarea');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'مسودةٌ قبل الانقطاع');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  let saved = false;
  for (let i = 0; i < 20 && !saved; i++) {
    await wait(500);
    saved = (await page.text()).includes('حُفظت المسودة');
  }
  ok('حُفظت المسودة تلقائيًّا قبل الانقطاع', saved);

  // دفعةٌ تُطلق بعد لحظةٍ ولا تُنتظر: العملية الرئيسة إذا دخلت قيدها لم تمرّر رسائل
  // البروتوكول حتى تفرغ، فيُطلق القيد بمؤقّتٍ في الصفحة بعد أن يعود هذا النداء.
  await page.eval(`
    const sheet = (i) => ({ sheetHtml: '<div class="a4-sheet"><div>نؤيد أن موظف ' + i + ' يعمل لدينا.</div></div>', templateId: null, letterheadId: null,
      authorityId: null, docType: 'إفادة', destination: null, purpose: null, values: {}, copies: 1, copyKind: 'نسخة أصلية', fee: 0 });
    const inputs = Array.from({ length: ${BATCH} }, (_, i) => ({ citizenId: null, citizenName: 'موظف ' + i, nationalId: null, operator: null, printer: null,
      serialPrefix: 'م', serialYear: 2026, gregorianDate: '', hijriDate: null, sheets: [sheet(i)] }));
    setTimeout(() => void window.diwan.documents.issueBatch(inputs, false).catch(() => null), 300);
    return true;`);
  await wait(2500);
  // من خارج البرنامج: القيد مفتوح فلا يُرى منه شيء — وهذا ما يُقتل فيه.
  const mid = (() => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true, timeout: 50 });
    try {
      return d.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
    } catch {
      return -1;
    } finally {
      d.close();
    }
  })();
  kill();
  await wait(1000);
  ok(`وقُتل البرنامج والدفعة في منتصف قيدها (المقيَّد منها حين القتل: ${mid})`, mid === 0);
  return steps.join('\n');
}

/** بعد الانقطاع: التطبيق نفسه، والملف الشخصي نفسه. */
export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(800);

  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const integrity = d.prepare('PRAGMA integrity_check').get();
  const count = d.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
  d.close();
  ok(`بعد الانقطاع: القاعدة سليمة (${Object.values(integrity)[0]})`, Object.values(integrity)[0] === 'ok');
  ok(`والدفعة التي قُطعت لم يصدر منها شيء — لا نصفها (${count} من ${BATCH})`, count === 0);

  const drafts = await page.eval(`return (await window.diwan.drafts.list()).map((r) => r.valuesJson);`);
  ok('والمسودة المحفوظة تلقائيًّا باقية', drafts.some((v) => v.includes('مسودةٌ قبل الانقطاع')));

  const check = await page.eval(`return await window.diwan.documents.verify();`);
  ok(`وسلسلة البصمات سليمة (${check.checked} كتابًا)`, check.problems.length === 0);

  const next = await page.eval(`
    const out = await window.diwan.documents.issueBatch([{ citizenId: null, citizenName: 'بعد الانقطاع', nationalId: null, operator: null, printer: null,
      serialPrefix: 'م', serialYear: 2026, gregorianDate: '', hijriDate: null,
      sheets: [{ sheetHtml: '<div class="a4-sheet"><div>كتابٌ بعد الانقطاع.</div></div>', templateId: null, letterheadId: null, authorityId: null,
        docType: 'إفادة', destination: null, purpose: null, values: {}, copies: 1, copyKind: 'نسخة أصلية', fee: 0 }] }], false);
    return out[0].documents[0].serial;`);
  const seq = Number(String(next).split('/').pop());
  ok(`والترقيم يكمل بلا ثقبٍ ولا تكرار (${next})`, seq === count + 1);
  ok(`ولا خطأ بعد الإقلاع (${page.exceptions.length})`, page.exceptions.length === 0);
  return steps.join('\n');
}
