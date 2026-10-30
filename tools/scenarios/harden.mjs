/**
 * سيناريو: تحصين النافذة و«عن البرنامج» (خطة Production، ٦٫١ و٦٫٤–٦٫٥).
 *
 * الواجهة في صندوقٍ بلا Node، ولا تغادر صفحة البرنامج ولو طُلب منها (رابطٌ إلى ملفٍّ على القرص)، ولا
 * تفتح نافذةً، وما سقط منها يُعاد. و«عن البرنامج» من رأس الشريط: الإصدار والمطوّر ورقمه والشعار
 * والإشعارات القانونية. والمسارات عند الباب (A04، D69): ما أعطته الرئيسة وحده، وما في المخزن وحده.
 */
import { join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export default async function scenario(page, { shotsDir, profile }) {
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
  ok('إشعار القاط يصف غياب الصور المدمجة بلا ادعاء مصدر مفتوح', notices.some((n) => n.includes('لا صور قاط مدمجة')) && !notices.some((n) => n.includes('من مكتبةٍ مفتوحة المصدر')));
  ok(`والإشعارات القانونية لما فيه من عمل غيرنا (${notices.length})`, notices.length >= 20 && notices.some((n) => n.includes('electron')) && notices.some((n) => n.includes('OFL-1.1')));
  const aboutChannels = await page.eval(`return [...document.querySelectorAll('[data-about] [data-channel]')].map((a) => a.dataset.channel);`);
  ok('و«قنواتنا» الأربع فيه', aboutChannels.join() === 'telegram,youtube,whatsapp,facebook');
  await page.eval(`document.querySelector('[data-about] button[title="إغلاق"]').click(); return true;`);
  await wait(300);

  // «قنواتنا» من أسفل الشريط: روابطها كما أعطاها المالك، تُفتح في المتصفّح (لا تُضغط هنا).
  await page.eval(`document.querySelector('[data-act="open-channels"]').click(); return true;`);
  await wait(300);
  const links = await page.eval(`return [...document.querySelectorAll('[data-channels-menu] a')].map((a) => [a.dataset.channel, a.href, a.target]);`);
  ok(
    '«قنواتنا» من أسفل الشريط: تيليجرام ويوتيوب وقناة واتساب وفيسبوك',
    links.length === 4 &&
      links.every(([, href, target]) => href.startsWith('https://') && target === '_blank') &&
      links[0][1] === 'https://t.me/MadaTechDev' &&
      links[1][1] === 'https://www.youtube.com/@MadaTechDev' &&
      links[2][1].startsWith('https://whatsapp.com/channel/') &&
      links[3][1].includes('facebook.com/profile.php?id=61595170464546')
  );
  await page.eval(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true;`);
  await wait(200);
  ok('وتُغلق قائمتها بالنقر خارجها', !(await page.eval(`return Boolean(document.querySelector('[data-channels-menu]'));`)));

  // ── و٥: صورة Word الملصوقة ملفٌّ محلّيّ في المجلّد المؤقّت وحده، والمخزن لا يُخرج منه ──
  const clipDir = join(tmpdir(), `msohtmlclip-diwan-${Date.now()}`);
  mkdirSync(clipDir, { recursive: true });
  const clip = join(clipDir, 'clip_image001.png');
  copyFileSync(join(import.meta.dirname, '..', '..', 'tests', 'fixtures', 'card-back-fake.png'), clip);
  const stored = await page.eval(`return window.diwan.files.storeImageUrl(${JSON.stringify(pathToFileURL(clip).href)});`);
  ok(`صورة Word من المجلّد المؤقّت تُحفظ في المخزن («${stored}»)`, typeof stored === 'string' && stored.startsWith('images/'));
  const refused = await page.eval(`return Promise.all(['file://server/share/x.png', 'file:////server/share/x.png', 'file:///C:/Windows/win.ini'].map((u) => window.diwan.files.storeImageUrl(u)));`);
  ok('ورابطٌ بمضيف أو مسار شبكة أو ملفٌّ خارج المؤقّت يُرفض', refused.every((r) => r === null));
  const served = await page.eval(`return fetch('diwan://store/${stored}').then((r) => r.status, () => 'خطأ');`);
  const escaped = await page.eval(`return fetch('diwan://store/..%5Cdata%5Cdiwan.db').then((r) => r.status, () => 'خطأ');`);
  ok(`والمخزن يعطي ملفّه (${served}) ولا يُخرج منه (${escaped})`, served === 200 && escaped === 403);
  rmSync(clipDir, { recursive: true, force: true });

  // ── A04 (D69): مسارٌ مطلقٌ لم تعطه الرئيسة يُرفض قبل أن يُلمس، وصورة الشعار والختم من المخزن وحده ──
  const preUpdate = join(profile, 'data', 'pre-update-backups');
  const preCount = () => (existsSync(preUpdate) ? readdirSync(preUpdate).length : 0);
  const preBefore = preCount();
  const winIni = JSON.stringify('C:\\Windows\\win.ini');
  const doors = await page.eval(`
    const msg = (p) => p.then(() => 'قُبل', (e) => String(e?.message ?? e));
    return { inspect: await msg(window.diwan.backup.inspect(${winIni}, null)), install: await msg(window.diwan.update.install(${winIni})) };`);
  ok(`وفحص نسخةٍ بمسارٍ لم تعطه الرئيسة يُرفض برسالته («…${doors.inspect.slice(-32)}»)`, doors.inspect.includes('اختر الملفّ من ديوان ثانيةً'));
  ok(`وتثبيت تحديثٍ بمسارٍ لم يُعطَ يُرفض ولا تُكتب نسخة ما قبل التحديث (${preBefore} ← ${preCount()})`, doors.install.includes('اختر الملفّ من ديوان ثانيةً') && preCount() === preBefore);
  const seal = await page.eval(`return window.diwan.seals.add({ name: 'ختم تجريبي', kind: 'شعار', imagePath: '../diwan.db' }).then(() => 'قُبل', (e) => String(e?.message ?? e));`);
  ok('وختمٌ صورته «../diwan.db» يُرفض: الصورة خارج مخزن ديوان', seal.includes('الصورة خارج مخزن ديوان'));
  const logo = await page.eval(`
    const c = await window.diwan.clients.save({ id: null, name: 'مدرسة النور' });
    const done = await window.diwan.clients.setLogo(c.id, ${JSON.stringify(stored)});
    return done.logo ?? null;`);
  ok(`وشعار الجهة بمسار المخزن الصحيح يُحفظ كما في designBrandKit («${logo}»)`, logo === stored);

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
