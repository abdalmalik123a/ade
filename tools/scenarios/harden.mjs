/**
 * سيناريو: تحصين النافذة و«عن البرنامج» (خطة Production، ٦٫١ و٦٫٤–٦٫٥).
 *
 * الواجهة في صندوقٍ بلا Node، ولا تغادر صفحة البرنامج ولو طُلب منها (رابطٌ إلى ملفٍّ على القرص)، ولا
 * تفتح نافذةً، وما سقط منها يُعاد. و«عن البرنامج» من رأس الشريط: الإصدار والمطوّر ورقمه والشعار
 * والإشعارات القانونية.
 */
import { join } from 'node:path';

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  if (shotsDir) await page.shot(join(shotsDir, 'header.png'));
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const href = () => page.eval(`return location.href;`);

  ok('الواجهة في صندوق: لا require ولا process فيها', await page.eval(`return typeof require === 'undefined' && typeof process === 'undefined';`));
  ok('والجسر وحده يكلّم البرنامج', await page.eval(`return typeof window.diwan?.settings?.get === 'function';`));

  const home = await href();
  await page.eval(`location.href = 'file:///C:/Windows/win.ini'; return true;`);
  await wait(1200);
  ok('ولا تغادر صفحة البرنامج إلى ملفٍّ على القرص', (await href()) === home);
  ok('ولا تفتح نافذةً', await page.eval(`return window.open('file:///C:/') === null;`));

  // «عن البرنامج» من رأس الشريط.
  await page.eval(`document.querySelector('[data-act="sidebar-about"]').click(); return true;`);
  await wait(600);
  const about = await page.eval(`return document.querySelector('[data-about]')?.innerText ?? '';`);
  ok('«عن البرنامج» من رأس الشريط: الإصدار والمطوّر بالعربية والإنكليزية ورقمه', /الإصدار \d+\.\d+\.\d+/.test(about) && about.includes('عبدالملك عواد ابو جنيد') && about.includes('Abdulmalik') && about.includes('+964 781 915 4368'));
  ok('وشعار MADA TECH وأيقونة البرنامج صورتان محمّلتان', await page.eval(`return [...document.querySelectorAll('[data-about] img')].filter((i) => i.complete && i.naturalWidth > 0).length === 2;`));
  await page.eval(`document.querySelector('[data-act="about-legal"]').click(); return true;`);
  await wait(300);
  if (shotsDir) await page.shot(join(shotsDir, 'about.png'));
  const notices = await page.eval(`return [...document.querySelectorAll('[data-about-notices] li')].map((l) => l.innerText);`);
  ok(`والإشعارات القانونية لما فيه من عمل غيرنا (${notices.length})`, notices.length >= 20 && notices.some((n) => n.includes('electron')) && notices.some((n) => n.includes('OFL-1.1')));

  // واجهةٌ تسقط تُعاد.
  await page.send('Page.crash').catch(() => undefined);
  await wait(4000);
  let back = false;
  for (let i = 0; i < 5 && !back; i++) {
    back = await page.eval(`return Boolean(document.querySelector('aside a[data-path]'));`).catch(() => false);
    if (!back) await wait(1000);
  }
  ok('وواجهةٌ سقطت تُعاد تحميلًا لا تبقى بيضاء', back);
  return steps.join('\n');
}
