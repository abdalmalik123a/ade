/**
 * فحص البرنامج المثبَّت (A22، D141): في Windows Sandbox بعد التثبيت النظيف (`inside.mjs`)، وعلى جهاز المالك بعد الترقية — بـ`drive.mjs`
 * و`DIWAN_EXE` على البرنامج المثبَّت وملفّ تعريفٍ مؤقّت (فلا تُمسّ بيانات المكتب). وليس في `tools/scenarios/`: «بناء الاختبار» فيه أبوابٌ يُفحص هنا غيابها.
 *
 * الإصدار (`DIWAN_EXPECT_VERSION` إن ضُبط) · «أنا هنا» من العامل ومحرّك PSD (Rust) برقمه · ولا باب `workerCrash` (لا مُعالج له في بناء الإصدار) ·
 * والتفعيل يُقرأ (`DIWAN_EXPECT_LICENSE` إن ضُبط: «trial» في الصندوق) · والشبّاك والمكتبة يُقرآن · وسجلّ الأخطاء بلا `[native]` (يكتبه `workerHost` إن تعذّر المحرّك).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** ينتظر الشرط حتى مهلةٍ قصوى — ولا مهلة ثابتة بين الخطوات. */
  const until = async (check, ms = 15_000) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await check()) return true;
      if (Date.now() > end) return false;
      await wait(200);
    }
  };

  const info = await page.eval(`return window.diwan.ui.info();`);
  const expect = process.env.DIWAN_EXPECT_VERSION;
  ok(`الإصدار ${info?.version}${expect ? ` (المنتظر ${expect})` : ''}`, typeof info?.version === 'string' && (!expect || info.version === expect));

  const ping = await page.eval(`return window.diwan.app.workerPing().then((r) => r, (e) => ({ error: String(e?.message ?? e) }));`);
  ok(`«أنا هنا» من العامل (${ping?.pid}) لا من الرئيسة (${ping?.main})${ping?.error ? ` — ${ping.error}` : ''}`, Number.isInteger(ping?.pid) && ping.pid !== ping.main);
  ok(`ومحرّك PSD (Rust) يعمل برقمه (${ping?.psd || ping?.psdError || 'لا جواب'})`, typeof ping?.psd === 'string' && /^\d+\.\d+\.\d+/.test(ping.psd));

  const door = await page.eval(`return window.diwan.app.workerCrash().then(() => 'أُجيب', (e) => String(e?.message ?? e));`);
  ok(`ولا باب اختبار: «workerCrash» بلا مُعالج (${String(door).slice(0, 90)})`, String(door).includes('No handler registered'));

  const lic = await page.eval(`return window.diwan.license.status().then((s) => ({ status: s.status, daysLeft: s.daysLeft ?? null }), (e) => ({ error: String(e?.message ?? e) }));`);
  // وعلى جهازٍ فيه ديوان مثبَّتٌ قبلُ يأخذ الملفّ المؤقّت مرساة المدّة القديمة من السجلّ فيُقرأ «انتهت» — وهو الصحيح؛ والصندوق النظيف يطلب «trial».
  const wantLicense = process.env.DIWAN_EXPECT_LICENSE;
  ok(
    `والتفعيل يُقرأ: ${lic?.status ?? lic?.error}${lic?.daysLeft != null ? ` (${lic.daysLeft} يومًا)` : ''}${wantLicense ? ` (المنتظر ${wantLicense})` : ''}`,
    wantLicense ? lic?.status === wantLicense : ['trial', 'activated', 'subscribed', 'expired'].includes(lic?.status)
  );

  await page.goto('service-counter');
  ok('والشبّاك يُقرأ', await until(async () => (await page.text()).length > 50));
  await page.goto('templates-library-drafts');
  ok('والمكتبة تُفتح', await until(() => page.eval(`return Boolean(document.querySelector('[data-act="new-blank"]'));`)));

  const log = join(profile, 'logs', 'diwan-errors.log');
  const text = existsSync(log) ? readFileSync(log, 'utf8') : '';
  ok(`وسجلّ الأخطاء بلا [native] (${text ? `${text.split('\n\n').filter(Boolean).length} قيدًا` : 'لا سجلّ'})`, !text.includes('[native]'));
  return steps.join('\n');
}
