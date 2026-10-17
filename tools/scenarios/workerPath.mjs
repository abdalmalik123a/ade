/**
 * سيناريو: العامل المستقلّ في الطريق كلّه (A03، D53) — عمليةٌ ثالثة تُقلع عند أوّل طلب، وتُجيب «أنا هنا»، وتسقط بأمان، وتُعاد.
 *
 * `workerPing` ← رقم عمليةٍ ليس رقم الرئيسة · `workerCrash` (باب اختبار) ← يُرفض بـ«توقّف المعالج — جرّب ثانيةً»، ويُقيَّد في سجلّ
 * الأخطاء · والواجهة تعمل بعده (تنقّلٌ وقراءة شاشة) · و`workerPing` ثانيةً ← يُجيب برقم عمليةٍ جديد. والانتظار بالشرط وحده.
 * ويُشغَّل على التطوير وعلى بناء الاختبار (`npm run pack` ثم `DIWAN_EXE=release/test/win-unpacked/Diwan.exe`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const STOPPED = 'توقّف المعالج — جرّب ثانيةً';

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
      await wait(100);
    }
  };
  const ping = () => page.eval(`return window.diwan.app.workerPing().then((r) => r, (e) => ({ error: String(e?.message ?? e) }));`);

  const first = await ping();
  ok(`«أنا هنا» من العامل (${first?.pid}) والرئيسة (${first?.main})`, Number.isInteger(first?.pid) && Number.isInteger(first?.main) && first.pid > 0);
  ok('ورقم العامل ليس رقم العملية الرئيسة', first?.pid !== first?.main);
  const again = await ping();
  ok('وطلبٌ ثانٍ يُجاب من العملية نفسها', again?.pid === first?.pid);

  const crash = await page.eval(`return window.diwan.app.workerCrash().then(() => 'أُجيب', (e) => String(e?.message ?? e));`);
  // وبادئة Electron («Error invoking remote method…») تُنزع في الواجهة — وما بعدها الرسالة وحدها.
  ok(`السقوط يُرفض برسالته العربية وحدها: «${STOPPED}»`, String(crash).replace(/^Error invoking remote method '[^']+': Error: /, '') === STOPPED);

  const log = join(profile, 'logs', 'diwan-errors.log');
  ok('وقُيِّد في سجلّ الأخطاء [worker]', await until(() => existsSync(log) && readFileSync(log, 'utf8').includes('[worker]')));

  // والواجهة تعمل بعده: تنقّلٌ بين شاشتين وقراءتهما.
  await page.goto('templates-library-drafts');
  ok('والمكتبة تُفتح بعده', await until(() => page.eval(`return Boolean(document.querySelector('[data-act="new-blank"]'));`)));
  await page.goto('service-counter');
  ok('والشبّاك يُقرأ بعده', await until(async () => (await page.text()).length > 50 && !(await page.text()).includes('Error')));

  let fresh = null;
  ok('وطلبٌ بعده يُقلع العامل من جديد', await until(async () => {
    fresh = await ping();
    return Number.isInteger(fresh?.pid);
  }));
  ok(`برقمٍ جديد (${first?.pid} ← ${fresh?.pid})`, Number.isInteger(fresh?.pid) && fresh.pid !== first?.pid && fresh.pid !== fresh.main);
  return steps.join('\n');
}
