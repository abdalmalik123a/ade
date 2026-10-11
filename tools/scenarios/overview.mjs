/**
 * سيناريو: «نظرة عامة على ديوان» و«؟» الصفحات و«التنبيهات» (الموجة ٢، بقرار المالك ٦ تشرين الأول — بدل جولة اليوم الأوّل
 * ونافذة «ما ينتظرك اليوم»).
 *
 * ملفٌّ جديد يُكمل المعالج إلى «عندي شعارات المدارس»: فتظهر النظرة مرّةً قبل وجهته، تمرّ على الصفحات صفحةً صفحة وتضيء ما
 * تشرحه، ثم تُغلق إلى الشعارات — ولا تعود بعد إقلاع. و«؟» في أعلى الصفحة يشرحها وحدها، ومنه النظرة كلّها **في مكانها**:
 * «السابق» يعود وEsc يُغلقها. و«التنبيهات» جرسٌ برقم ما ينتظر عملًا، وكلّ سطرٍ يقود إلى مكانه، ونظرته من وسط كتابٍ لا
 * تغادره ولا تُسقط ما كُتب. ثم أوّل كتابٍ يصدر: يختفي «؟» من الصفحات كلّها ولا يعود بعد إقلاع، ويبقى الجرس ونظرته.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

/** هذا السيناريو يُكمل المعالج نفسه — فلا يتخطّاه المِقْود. */
export const keepOnboarding = true;

const SHEET = `{ sheetHtml: '<div class="a4-sheet"><p>نؤيد</p></div>', templateId: null, citizenId: null, authorityId: null, citizenName: 'سالم حسن',
  nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
  gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null }`;

/** وجهة السكّة لكلّ صفحة — لتُطابَق بها الصفحة التي تعرضها النظرة. */
const DEST = { service: 'service', orders: 'work', archive: 'record', citizens: 'customers', clients: 'customers', templates: 'library', letterhead: 'library', settings: 'settings' };

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector('${sel}'));`);
  /** الوجهة المعروضة في السكّة، وتبويبها إن كان لها تبويبات. */
  const where = () =>
    page.eval(`
      const dest = document.querySelector('[data-dest][aria-current="page"]')?.dataset.dest ?? (document.querySelector('[data-act="open-settings"][aria-current="page"]') ? 'settings' : '');
      return { dest, tab: document.querySelector('[data-tabs] [aria-current="page"]')?.dataset.path ?? null };`);
  const overview = () =>
    page.eval(`
      const o = document.querySelector('[data-overview]');
      if (!o) return null;
      const dest = document.querySelector('[data-dest][aria-current="page"]')?.dataset.dest ?? (document.querySelector('[data-act="open-settings"][aria-current="page"]') ? 'settings' : '');
      return { step: Number(o.dataset.overviewStep), total: Number(o.dataset.overviewTotal), route: o.dataset.overviewRoute, dest, editor: Boolean(document.querySelector('[data-screen="editor"]')),
        title: o.querySelector('[data-overview-title]')?.textContent ?? '', body: o.querySelector('p')?.textContent ?? '', spot: Boolean(o.querySelector('[data-overview-spot]')) };`);
  const bell = () => page.eval(`const b = document.querySelector('[data-act="notifications"]'); return { count: Number(b?.dataset.count), badge: b?.querySelector('[data-badge]')?.textContent ?? '' };`);

  // ── المعالج حتى آخره ─────────────────────────────────────────────────
  await wait(500);
  await page.type('input[data-onboarding-office]', 'مكتب النور');
  for (let k = 0; k < 3; k++) {
    await click('[data-act="onboarding-next"]');
    await wait(300);
  }
  await click('[data-onboarding-go="letterhead"]');
  await wait(1500);
  const first = await overview();
  ok('أكمل المعالج: «نظرة عامة على ديوان» مرّةً قبل وجهته', Boolean(first) && first.step === 0);
  ok('و«تخطَّ» ظاهرٌ فيها من أوّلها', await has('[data-overview] [data-act="overview-skip"]'));
  if (shotsDir) await page.shot(join(shotsDir, 'overview-1.png'));

  // ── صفحةً صفحة ──────────────────────────────────────────────────────
  const seen = [];
  for (let k = 0; k < 20; k++) {
    await wait(k ? 600 : 0);
    const s = await overview();
    if (!s) break;
    seen.push(s);
    if (shotsDir && s.route === 'orders') await page.shot(join(shotsDir, 'overview-orders.png'));
    await click('[data-act="overview-next"]');
  }
  const total = first?.total ?? 0;
  ok(`تمرّ على خطواتها كلّها (${seen.length} من ${total})`, total >= 10 && seen.length === total && seen.every((s, k) => s.step === k));
  ok('وكلّ خطوةٍ تعرض صفحتها', seen.every((s) => s.dest === DEST[s.route]));
  const routes = new Set(seen.map((s) => s.route));
  ok('على الشبّاك وقيد العمل والسجلّ والزبائن والجهات والمكتبة والشعارات والإعدادات', Object.keys(DEST).every((r) => routes.has(r)));
  const dark = seen.slice(0, -1).filter((s) => !s.spot).map((s) => s.title);
  ok(`وتضيء ما تشرحه في كلّ صفحة${dark.length ? ` — لم يُضأ: ${dark.join('، ')}` : ''}`, dark.length === 0);
  ok('وآخرها «ابدأ العمل» وسط الشاشة، يذكر «؟»', seen.at(-1)?.title === 'ابدأ العمل' && !seen.at(-1)?.spot && seen.at(-1)?.body.includes('«؟»'));
  ok('ثم تُغلق إلى وجهة المعالج: الشعارات', !(await overview()) && (await where()).tab === 'header-seal-configuration');

  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await wait(3000);
  ok('ولا تعود بعد إقلاع', !(await overview()) && !(await has('[data-onboarding]')));
  ok('ولا نافذة تُقاطع عند الإقلاع', !(await has('[data-notifications]')));

  // ── «؟» الصفحة ──────────────────────────────────────────────────────
  await page.goto('clients-directory');
  ok('«؟» في أعلى الصفحة ما لم يخرج عملٌ بعد', await has('[data-act="page-help"]'));
  await click('[data-act="page-help"]');
  await wait(300);
  ok('ويشرحها وحدها', await has('[data-page-help="clients"]'));
  await page.goto('orders-board');
  ok('وينطوي حين تُترك الصفحة', !(await has('[data-page-help]')));
  await click('[data-act="page-help"]');
  await wait(300);
  ok('وفي كلّ صفحةٍ شرحها', await has('[data-page-help="orders"]'));
  if (shotsDir) await page.shot(join(shotsDir, 'overview-help.png'));
  await click('[data-act="page-help-overview"]');
  await wait(900);
  ok('ومنه «النظرة العامة كلّها»', (await overview())?.step === 0);
  await click('[data-act="overview-next"]');
  await wait(700);
  await click('[data-act="overview-next"]');
  await wait(700);
  await click('[data-act="overview-prev"]');
  await wait(700);
  ok('و«السابق» يعود خطوة — في مكانها: لا تغادر الصفحة', (await overview())?.step === 1 && (await where()).dest === 'work');
  await page.key('Escape');
  await wait(600);
  ok('وEsc يُغلقها', !(await overview()) && (await where()).dest === 'work');

  // ── «التنبيهات» ─────────────────────────────────────────────────────
  let b = await bell();
  ok('الجرس في الشريط العلوي — لا رقم عليه ولا شيء ينتظر', b.count === 0 && b.badge === '');
  await click('[data-act="notifications"]');
  await wait(300);
  ok('ويقول ذلك إن فُتح', (await page.eval(`return document.querySelector('[data-notifications]')?.innerText ?? '';`)).includes('لا شيء ينتظرك'));
  await page.key('Escape');
  await wait(300);
  ok('وEsc يغلقه', !(await has('[data-notifications]')));

  await page.eval(`
    await window.diwan.orders.save({ id: null, clientId: null, customer: 'مدرسة النور', title: 'هويّات الطلبة', dueDate: '2026-01-15' });
    await window.diwan.drafts.save({ id: null, templateId: null, citizenId: null, title: 'كتاب تأييد', values: {}, bodyHtml: '<p>نؤيد</p>' });
    return true;`);
  await page.goto('service-counter');
  b = await bell();
  ok('طلبٌ تأخّر: رقمٌ على الجرس — والمسودة تُعرض ولا تُعدّ', b.count === 1 && b.badge === '1');
  await click('[data-act="notifications"]');
  await wait(300);
  const panel = await page.eval(`return document.querySelector('[data-notifications]')?.innerText ?? '';`);
  ok('فيه المتأخّر باسم صاحبه', panel.includes('1 متأخّرة') && panel.includes('مدرسة النور — هويّات الطلبة'));
  ok('والمسودة في قيد العمل', panel.includes('مسودةٌ لم تصدر'));
  if (shotsDir) await page.shot(join(shotsDir, 'overview-bell.png'));
  await click('[data-notifications] [data-today-waiting]');
  await wait(700);
  ok('وكلّ سطرٍ يقود إلى مكانه', !(await has('[data-notifications]')) && (await where()).dest === 'work');

  // في وسط كتاب: النظرة من الجرس لا تغادره — والانتقال كان يُسقط ما لم يُحفظ (أو يفتح المحرّر فارغًا والكتاب في المسودات).
  await page.goto('smart-editor-a4-preview');
  await page.type('[data-editor-owner]', 'سالم حسن');
  await click('[data-act="notifications"]');
  await wait(300);
  await click('[data-act="replay-overview"]');
  await wait(600);
  const replay = [];
  for (let k = 0; k < 20; k++) {
    const s = await overview();
    if (!s) break;
    replay.push(s);
    if (shotsDir && k === 2) await page.shot(join(shotsDir, 'overview-stay.png'));
    await click('[data-act="overview-next"]');
    await wait(350);
  }
  ok('وفي أسفله «نظرة عامة على ديوان» بخطواتها كلّها', replay.length === total);
  ok('ومن وسط كتابٍ لا تغادره', replay.length > 0 && replay.every((s) => s.editor));
  const unlit = replay.slice(0, -1).filter((s) => !s.spot).map((s) => s.title);
  ok(`وتضيء كلّ صفحةٍ في السكّة أو الشريط العلوي${unlit.length ? ` — لم يُضأ: ${unlit.join('، ')}` : ''}`, unlit.length === 0);
  ok('ثم تُغلق والكتاب كما كان', !(await overview()) && (await page.eval(`return document.querySelector('[data-editor-owner]')?.value ?? '';`)) === 'سالم حسن');

  // ── أوّل عملٍ يخرج من المكتب ─────────────────────────────────────────
  await page.goto('service-counter');
  ok('ما دام لم يصدر شيء: «؟» بارز', await has('[data-act="page-help"]:not([data-quiet])'));
  const issued = await page.eval(`try { await window.diwan.documents.issue(${SHEET}, false); return 'ok'; } catch (e) { return String(e?.message ?? e); }`);
  await page.goto('orders-board');
  // البند ٨ (قرار المالك ١١ ت١ ٢٠٢٦): لا يختفي — يهدأ زرًّا صغيرًا اسمه «مساعدة» في الصفحات كلّها.
  const quiet = () => page.eval(`const b = document.querySelector('[data-act="page-help"][data-quiet]'); return b ? b.textContent.trim() : '';`);
  ok('صدر أوّل كتاب: «؟» صار «مساعدة» صغيرة ولم يختفِ', issued === 'ok' && (await quiet()).includes('مساعدة'));
  await page.goto('clients-directory');
  ok('في الصفحات كلّها', (await quiet()).includes('مساعدة'));
  await click('[data-act="page-help"]');
  ok('ويشرح الصفحة كما كان', await has('[data-page-help="clients"]'));
  await page.key('Escape');
  ok('وEscape يطويه', !(await has('[data-page-help]')));
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const firstWork = db.prepare("SELECT value FROM settings WHERE key = 'firstWorkAt'").get();
  db.close();
  ok('وقُيِّد أوّل عملٍ مرّةً في القاعدة', Boolean(firstWork?.value));
  b = await bell();
  ok('وصار على الجرس تذكير النسخة الاحتياطية', b.count === 2);

  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await wait(3000);
  ok('وبعد إقلاع: «مساعدة» الهادئة باقية، ولا يعود «؟» البارز', (await has('[data-act="page-help"][data-quiet]')) && !(await has('[data-act="page-help"]:not([data-quiet])')) && (await has('[data-act="notifications"]')));
  await click('[data-act="notifications"]');
  await wait(300);
  await click('[data-act="replay-overview"]');
  await wait(900);
  for (let k = 0; k < 20; k++) {
    const s = await overview();
    if (!s || s.step === s.total - 1) break;
    await click('[data-act="overview-next"]');
    await wait(300);
  }
  const last = await overview();
  ok('والنظرة من الجرس باقية — وآخرها لا يذكر «؟» وقد اختفى', last?.title === 'ابدأ العمل' && !last.body.includes('«؟»'));
  await click('[data-act="overview-next"]');
  await wait(600);
  ok('و«ابدأ العمل» يُغلقها', !(await overview()));

  return steps.join('\n');
}
