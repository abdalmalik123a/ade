/**
 * سيناريو: مظهر ديوان الواحد (المرحلة ٦ من UPGRADE.md — مظهرٌ واحد بقرار المالك ٤ تشرين الأول).
 *
 * مساحة العمل فاتحة بنصٍّ بلون الحبر؛ والسكّة كحليّة بنصٍّ فاتح، ورأسها علامة MT و«ديوان» و«MADA TECH»،
 * والمحدَّد فيها بلون الفعل؛ وفي الشبّاك علامةٌ خافتة؛ والورقة بيضاء؛ ولا اختيار للمظهر في الإعدادات.
 * وتُلتقط الشاشات إن طُلبت (SHOT_DIR).
 */
import { join } from 'node:path';

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const style = (sel, prop) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); return el ? getComputedStyle(el)[${JSON.stringify(prop)}] : null;`);

  await page.goto('service-counter');
  await wait(900);
  ok(`مساحة العمل فاتحة (${await style('body', 'backgroundColor')})`, (await style('body', 'backgroundColor')) === 'rgb(241, 243, 247)');
  ok(`ونصّها بلون الحبر (${await style('body', 'color')})`, (await style('body', 'color')) === 'rgb(24, 32, 47)');
  ok(`والسكّة كحليّة (${await style('[data-sidebar="rail"]', 'backgroundColor')})`, (await style('[data-sidebar="rail"]', 'backgroundColor')) === 'rgb(22, 34, 63)');
  ok('ونصّ السكّة فاتح', ((await style('[data-sidebar="rail"] [data-dest]:not([aria-current]) span:last-child', 'color')) ?? '') === 'rgb(179, 190, 214)');
  const head = await page.eval(`return document.querySelector('[data-act="sidebar-about"]')?.innerText ?? '';`);
  ok('رأس السكّة: شعار «ديوان» واسمه و«MADA TECH»', head.includes('ديوان') && head.includes('MADA TECH') && (await page.eval(`return Boolean(document.querySelector('[data-brand-mark] img'));`)));
  ok(`والمحدَّد فيها بلون الفعل بلا تدرّج (${await style('[data-dest][aria-current="page"]', 'backgroundColor')})`,
    (await style('[data-dest][aria-current="page"]', 'backgroundColor')) === 'rgb(62, 102, 219)' && (await style('[data-dest][aria-current="page"]', 'backgroundImage')) === 'none');
  ok('وفي الشبّاك علامةٌ خافتة', Number(await style('[data-watermark]', 'opacity')) <= 0.1);
  if (shotsDir) await page.shot(join(shotsDir, 'theme-counter.png'));

  await page.goto('templates-library-drafts');
  await wait(800);
  if (shotsDir) await page.shot(join(shotsDir, 'theme-library.png'));
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1500);
  ok(`والورقة بيضاء (${await style('.paper', 'backgroundColor')})`, (await style('.paper', 'backgroundColor')) === 'rgb(255, 255, 255)');
  if (shotsDir) await page.shot(join(shotsDir, 'theme-editor.png'));
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return true;`);
  await wait(500);

  await page.goto('office-settings');
  await wait(900);
  ok('ولا اختيار للمظهر في الإعدادات — مظهرٌ واحد', !(await page.eval(`return Boolean(document.querySelector('[data-theme-setting], [data-theme-option]'));`)));
  if (shotsDir) await page.shot(join(shotsDir, 'theme-settings.png'));
  return steps.join('\n');
}
