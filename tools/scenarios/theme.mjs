/**
 * سيناريو: هوية «منتصف الليل» (المرحلة ٦ من UPGRADE.md).
 *
 * الليليّ افتراضيّ بخلفيّته الكحليّة؛ ورأس السكّة علامة MT و«ديوان» و«MADA TECH»؛ وفي الشبّاك علامةٌ
 * خافتة ومربّعات الأيقونات بتدرّج MADA؛ والورقة بيضاء في الليليّ؛ و«المظهر ← نهاري» من الإعدادات يُرى
 * فورًا ويُحفظ. وتُلتقط الشاشات في المظهرين إن طُلبت (SHOT_DIR).
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const style = (sel, prop) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); return el ? getComputedStyle(el)[${JSON.stringify(prop)}] : null;`);

  await page.goto('service-counter');
  await wait(900);
  ok('الليليّ افتراضيّ', (await page.eval(`return document.documentElement.dataset.theme;`)) === 'dark');
  ok(`وخلفيّته الكحليّة (${await style('body', 'backgroundColor')})`, (await style('body', 'backgroundColor')) === 'rgb(6, 11, 26)');
  ok(`والنصّ فاتح (${await style('body', 'color')})`, (await style('body', 'color')) === 'rgb(238, 243, 255)');
  const head = await page.eval(`return document.querySelector('[data-act="sidebar-about"]')?.innerText ?? '';`);
  ok('رأس السكّة: علامة MT و«ديوان» و«MADA TECH»', head.includes('ديوان') && head.includes('MADA TECH') && (await page.eval(`return Boolean(document.querySelector('[data-brand-mark] img'));`)));
  ok('والمحدَّد في السكّة بتدرّج MADA', ((await style('[data-dest][aria-current="page"]', 'backgroundImage')) ?? '').includes('linear-gradient'));
  ok('وفي الشبّاك علامةٌ خافتة', Number(await style('[data-watermark]', 'opacity')) <= 0.1);
  ok('ومربّعات الأيقونات بتدرّج MADA', ((await style('[data-screen="service"] [data-card] .icon-tile', 'backgroundImage')) ?? '').includes('linear-gradient'));
  if (shotsDir) await page.shot(join(shotsDir, 'theme-dark-counter.png'));

  // الورقة بيضاء في الليليّ: صفحة المحرّر.
  await page.goto('templates-library-drafts');
  await wait(800);
  if (shotsDir) await page.shot(join(shotsDir, 'theme-dark-library.png'));
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1500);
  ok(`والورقة بيضاء في الليليّ (${await style('.paper', 'backgroundColor')})`, (await style('.paper', 'backgroundColor')) === 'rgb(255, 255, 255)');
  if (shotsDir) await page.shot(join(shotsDir, 'theme-dark-editor.png'));
  await page.eval(`document.querySelector('[data-act="designer-close"], button[title="إغلاق"]')?.click(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return true;`);
  await wait(500);

  // النهاريّ من الإعدادات: يُرى فورًا ويُحفظ.
  await page.goto('office-settings');
  await wait(900);
  await page.eval(`document.querySelector('[data-theme-option="light"]').click(); return true;`);
  await wait(800);
  ok('«نهاري» من الإعدادات يُرى فورًا', (await page.eval(`return document.documentElement.dataset.theme;`)) === 'light' && (await style('body', 'backgroundColor')) === 'rgb(238, 243, 252)');
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const saved = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get();
  db.close();
  ok('ويُحفظ', saved?.value === 'light');
  if (shotsDir) await page.shot(join(shotsDir, 'theme-light-settings.png'));
  await page.goto('service-counter');
  await wait(800);
  ok(`والنصّ في النهاريّ كحليّ (${await style('body', 'color')})`, (await style('body', 'color')) === 'rgb(11, 22, 51)');
  if (shotsDir) await page.shot(join(shotsDir, 'theme-light-counter.png'));
  return steps.join('\n');
}
