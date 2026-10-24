/**
 * سيناريو: مظهر ديوان الواحد (ر067) — «ب٢» منذ ر175 (D156).
 *
 * مساحة العمل فاتحة بنصٍّ بلون الحبر؛ والسكّة لوحٌ أبيض بنصٍّ رماديّ، ورأسها رمز «ديوان» واسمه و«MADA TECH»،
 * والمحدَّد فيها بتدرّج الفعل ونصٍّ أبيض؛ و«املأ» بالتدرّج؛ وفي الشبّاك علامةٌ خافتة؛ والورقة بيضاء؛ ولا اختيار للمظهر في الإعدادات.
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
  ok(`مساحة العمل فاتحة (${await style('body', 'backgroundColor')})`, (await style('body', 'backgroundColor')) === 'rgb(243, 245, 247)');
  ok(`ونصّها بلون الحبر (${await style('body', 'color')})`, (await style('body', 'color')) === 'rgb(36, 52, 61)');
  ok(`والسكّة لوحٌ أبيض (${await style('[data-rail-panel]', 'backgroundImage')})`,
    ((await style('[data-rail-panel]', 'backgroundImage')) ?? '').includes('rgb(255, 255, 255)'));
  const muted = await style('[data-sidebar="rail"] [data-dest]:not([aria-current]) span:last-child', 'color');
  ok(`ونصّ السكّة رماديّ (${muted})`, muted === 'rgb(86, 100, 110)');
  const head = await page.eval(`return document.querySelector('[data-act="sidebar-about"]')?.innerText ?? '';`);
  ok('رأس السكّة: شعار «ديوان» واسمه و«MADA TECH»', head.includes('ديوان') && head.includes('MADA TECH') && (await page.eval(`return Boolean(document.querySelector('[data-brand-mark] img'));`)));
  ok('والمحدَّد فيها بتدرّج الفعل ونصٍّ أبيض',
    ((await style('[data-dest][aria-current="page"]', 'backgroundImage')) ?? '').startsWith('linear-gradient') && (await style('[data-dest][aria-current="page"]', 'color')) === 'rgb(255, 255, 255)');
  const fill = await page.eval(`const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith('املأ')); return b ? getComputedStyle(b).backgroundImage : null;`);
  ok(`و«املأ» بالتدرّج${fill ? '' : ' (لا يظهر هنا — يُتخطّى)'}`, fill === null || fill.startsWith('linear-gradient'));
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
