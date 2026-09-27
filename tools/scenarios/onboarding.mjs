/**
 * سيناريو: أول تشغيل — معالج البداية، والشريط العلوي الذي يتبع الشاشة.
 *
 * ملفٌّ جديد يفتح على المعالج: اسم المكتب، والطابعة، وحجم الخط، ومن أين يبدأ.
 * فيُكتب الاسم ويُختار «كبير» ويُختار «عندي ملفات Word» — فيُفتّش: أحُفظ الاسم
 * وحجم الخطّ في القاعدة؟ أكُبّرت الواجهة؟ أفُتحت مكتبة النماذج؟ ولا يعود المعالج
 * بعد ذلك. ثم يُتفقَّد الشريط العلوي: بحثٌ وحده في كل شاشة، وسياق الكتاب في المحرّر.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

/** هذا السيناريو يفحص المعالج نفسه — فلا يتخطّاه المِقْود. */
export const keepOnboarding = true;

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);

  await wait(500);
  ok('ملفٌّ جديد يفتح على معالج البداية', await page.eval(`return Boolean(document.querySelector('[data-onboarding]'));`));
  if (shotsDir) await page.shot(join(shotsDir, 'onboarding-1.png'));

  await page.type('input[data-onboarding-office]', 'مكتب الرافدين للاستنساخ');
  await click('[data-act="onboarding-next"]');
  await wait(300);
  await click('[data-act="onboarding-next"]');
  await wait(300);
  await click('[data-onboarding] [data-scale="1.15"]');
  await wait(500);
  ok('و«كبير» يكبّر الواجهة فورًا', (await page.eval(`return window.devicePixelRatio;`)) > 1.1);
  if (shotsDir) await page.shot(join(shotsDir, 'onboarding-3.png'));
  await click('[data-act="onboarding-next"]');
  await wait(300);
  await click('[data-onboarding-go="templates"]');
  await wait(1200);

  ok('وأُغلق المعالج', !(await page.eval(`return Boolean(document.querySelector('[data-onboarding]'));`)));
  ok('وفُتحت مكتبة النماذج كما اختار', (await page.text()).includes('نموذجٌ جديد'));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const rows = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  db.close();
  ok('وحُفظ اسم المكتب', rows.officeName === 'مكتب الرافدين للاستنساخ');
  ok('وحجم الخطّ', rows.uiScale === '1.15');
  ok('ولا يعود المعالج', rows.onboarded === 'true');
  ok('واسم المكتب في الشريط الجانبي', (await page.text()).includes('مكتب الرافدين للاستنساخ'));

  // ── مكتبة النماذج: مدخلٌ واحد لنموذجٍ جديد بطرقه الثلاث ─────────────
  const hub = await page.eval(`return [...document.querySelectorAll('[data-new-template] [data-act]')].map((b) => b.dataset.act).join(',');`);
  ok('ونموذجٌ جديد بطرقه الثلاث وباب العقود في مكانٍ واحد', hub === 'new-blank,install-contracts,new-word,new-folder');
  ok('بلا زرّ إضافةٍ مكرّر', !(await page.text()).includes('إضافة نموذج'));

  // ── الشريط العلوي يتبع الشاشة ──────────────────────────────────────
  const bar = () => page.eval(`return document.querySelector('header').innerText;`);
  for (const route of ['service-counter', 'designed-documents', 'transactions-archive-ledger']) {
    await page.goto(route);
    await wait(700);
    const text = await bar();
    ok(`الشريط في «${route}» بحثٌ وحده`, !text.includes('طباعة فورية') && !text.includes('حفظ مسودة') && !text.includes('نموذجٌ آخر'));
  }
  await page.goto('smart-editor-a4-preview');
  await wait(900);
  const editorBar = await bar();
  ok('وفي المحرّر سياقُ الكتاب وتبديله', editorBar.includes('لم يُختر نموذج') && editorBar.includes('نموذجٌ آخر'));

  // ── حجم الخطّ يُعدَّل من الإعدادات ────────────────────────────────
  await page.goto('office-settings');
  await wait(900);
  await click('[data-ui-scale] [data-scale="1"]');
  await wait(600);
  ok('ويُعاد «عادي» من الإعدادات', (await page.eval(`return window.devicePixelRatio;`)) < 1.05);

  return steps.join('\n');
}
