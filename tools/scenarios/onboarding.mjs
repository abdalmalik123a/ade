/**
 * سيناريو: أول تشغيل — معالج البداية، والشريط العلوي الذي يتبع الشاشة.
 *
 * ملفٌّ جديد يفتح على المعالج: اسم المكتب، والطابعة، وحجم الخط، و«ابدأ جاهزًا».
 * فيُكتب الاسم ويُختار «كبير»، ويُترك «ورقة أسئلة» ممّا يقدّمه المكتب، ويُختار «أبدأ فارغًا» —
 * فيُفتّش: أحُفظ الاسم وحجم الخطّ والبطاقات في القاعدة؟ أكُبّرت الواجهة؟ أفُتح الشبّاك بلا بطاقة
 * الأسئلة؟ ولا يعود المعالج. ثم المكتبة: «ورقة فارغة» و«استورد» بطرقه كلّها (المرحلة ٥). ثم
 * يُتفقَّد الشريط العلوي: بحثٌ وحده في كل شاشة، وسياق الكتاب في المحرّر.
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
  // «ابدأ جاهزًا»: المكتب لا يكتب أسئلة — تُترك بطاقتها، ويبدأ فارغًا.
  ok('«ابدأ جاهزًا»: ما يقدّمه المكتب بطاقاتٌ تُختار', (await page.eval(`return document.querySelectorAll('[data-onboarding-cards] [data-onboarding-card]').length;`)) >= 8);
  await click('[data-onboarding-card="papers"]');
  await wait(200);
  ok('وطرق البداية: Word، والحزمة الجاهزة، والشعارات، والبدء فارغًا', (await page.eval(`return [...document.querySelectorAll('[data-onboarding-go]')].map((b) => b.dataset.onboardingGo).join(',');`)) === 'word,pack,letterhead,service');
  await click('[data-onboarding-go="service"]');
  await wait(1200);

  ok('وأُغلق المعالج', !(await page.eval(`return Boolean(document.querySelector('[data-onboarding]'));`)));
  ok('وفُتح الشبّاك بلا بطاقة الأسئلة', await page.eval(`return Boolean(document.querySelector('[data-screen="service"] [data-card="photos"]')) && !document.querySelector('[data-screen="service"] [data-card="papers"]');`));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const rows = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  db.close();
  ok('وحُفظ اسم المكتب', rows.officeName === 'مكتب الرافدين للاستنساخ');
  ok('وحجم الخطّ', rows.uiScale === '1.15');
  ok('ولا يعود المعالج', rows.onboarded === 'true');
  ok('والبطاقات بلا «ورقة أسئلة»', !JSON.parse(rows.counterCards ?? '[]').includes('papers') && JSON.parse(rows.counterCards ?? '[]').includes('photos'));
  // السكّة لا تتّسع لاسم المكتب (المرحلة ٢): في تلميح شعارها.
  ok('واسم المكتب على شعار السكّة', (await page.eval(`return document.querySelector('[data-act="sidebar-about"]').title;`)).includes('مكتب الرافدين للاستنساخ'));

  // ── المكتبة: «ورقة فارغة» و«استورد» واحدٌ بطرقه كلّها (المرحلة ٥) ──────
  await page.goto('templates-library-drafts');
  await wait(900);
  const hub = await page.eval(`return [...document.querySelectorAll('[data-new-template] [data-act]')].map((b) => b.dataset.act).join(',');`);
  // والعقود الجاهزة حُذفت بقرار المالك (٢٩ أيلول ٢٠٢٦) — يحلّ محلّها ملفّ مستنداتٍ يُستورد.
  ok(
    `والمكتبة: ورقةٌ فارغة، و«استورد» بـWord ومجلّده وصورة الورقة والاستمارة وPhotoshop والحزمة — بلا باب العقود (${hub})`,
    hub === 'new-blank,import-menu,new-word,new-folder,new-photo,new-form-image,new-design-import,content-import'
  );
  ok('بلا زرّ إضافةٍ مكرّر', !(await page.text()).includes('إضافة نموذج'));
  ok('والمسودات ليست في المكتبة — هي في «قيد العمل»', !(await page.text()).includes('مسودات'));

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
