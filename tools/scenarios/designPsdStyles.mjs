/**
 * سيناريو: Photoshop بدقّة أعلى (DESIGNS.md ٢٫١) — هويّةٌ مختلَقة (`tests/fixtures/psd-styles.psd`، يكتبها
 * `makePsdFixture.test.ts`) تُستورد فيظهر: الاسم بظلّه وحدّه، والعنوان على قوس، وحلقة صورة الموظف فوقها، والتوقيع صورةً
 * تُستبدل، والاسم والوظيفة مجموعةً تُحدَّد معًا ونقرتان تختاران أحدهما — و«ما جرى في الاستيراد» يقول النتوء باسم طبقته.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../../tests/fixtures/psd-styles.psd', import.meta.url));

export function prepare() {
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page, { profile } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  const selected = () => page.eval(`return document.querySelectorAll('[data-handle].outline-primary').length;`);

  const ping = await page.eval(`return window.diwan.app.workerPing().then((r) => r, (e) => ({ error: String(e?.message ?? e) }));`);
  ok(`محرّك PSD يعمل ورقمه (${ping?.psd}) قبل الاستيراد`, typeof ping?.psd === 'string' && /^\d+\.\d+\.\d+/.test(ping.psd));
  /** مقبض العنصر الذي يُرسم تحته نصٌّ فيه `text` — بالعقدة الأخيرة (لا غلافٌ فيه نصوص اللوحة كلّها). */
  const handleOf = (text) => `
    const handles = [...document.querySelectorAll('[data-handle]')];
    const h = handles.find((el) => {
      const r = el.getBoundingClientRect();
      return document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).some((n) => n.closest('[data-design]') && n.childElementCount === 0 && (n.textContent ?? '').includes(${JSON.stringify(text)}));
    });`;
  const press = (text, type) =>
    page.eval(`${handleOf(text)}
      if (!h) return false;
      const r = h.getBoundingClientRect();
      const at = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      ${type === 'dbl' ? "h.dispatchEvent(new MouseEvent('dblclick', at));" : "h.dispatchEvent(new MouseEvent('mousedown', at)); document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup', at));"}
      return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-act="import"]');
  for (let i = 0; i < 20; i++) {
    await wait(400);
    if (await page.eval(`return Boolean(document.querySelector('[data-import-notes]') || document.querySelector('[data-layer-fields]'));`)) break;
  }
  // إن سُئل عن حقولٍ من أسماء الطبقات: تبقى نصوصًا.
  await page.eval(`[...document.querySelectorAll('[data-layer-fields] button')].find((b) => b.textContent.includes('اتركها نصوصًا'))?.click(); return true;`);
  await wait(500);

  const notes = await page.eval(`return [...document.querySelectorAll('[data-import-note]')].map((n) => n.textContent);`);
  ok(`«ما جرى في الاستيراد من Photoshop» كلّه في لوح (${notes.length} أسطر)`, notes.length >= 2);
  ok('والنتوء يُقال باسم طبقته', notes.some((n) => n.includes('نتوءٌ ونقش (Bevel)') && n.includes('Line 1')));

  const html = await drawn();
  ok('الاسم بظلّه وحدّه حول الحروف', html.includes('text-shadow:') && html.includes('-webkit-text-stroke:'));
  ok('والعنوان على قوس', html.includes('<textPath'));
  ok('وحلقة صورة الموظف فوقها بلونها', html.toLowerCase().includes('#2ea043'));

  await press('سالم', 'down');
  await wait(300);
  const together = await selected();
  await press('سالم', 'dbl');
  await wait(300);
  const alone = await selected();
  const value = await page.eval(`return document.querySelector('[data-element-text]')?.value ?? null;`);
  ok(`الاسم والوظيفة مجموعة: نقرةٌ تحدّدهما (${together})، ونقرتان الاسم وحده فيُحرَّر (${alone}، «${value}»)`, together === 2 && alone === 1 && value === 'سالم حسن');

  // التوقيع: العنصر الذي فيه «استبدل الصورة» (صورة الموظف حقلٌ يُملأ فلا يُستبدل هكذا).
  const sign = await page.eval(`
    for (const h of document.querySelectorAll('[data-handle]')) {
      const r = h.getBoundingClientRect();
      const at = { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 };
      h.dispatchEvent(new MouseEvent('mousedown', at));
      document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup', at));
      await new Promise((res) => setTimeout(res, 150));
      if (document.querySelector('[data-act="replace-image"]')) return h.dataset.handle;
    }
    return null;`);
  ok('والتوقيع صورةٌ فيها «استبدل الصورة»', Boolean(sign));
  const before = await page.eval(`return [...document.querySelectorAll('[data-design] img')].map((i) => decodeURIComponent(i.getAttribute('src') ?? '')).join('|');`);
  await click('[data-act="replace-image"]');
  await wait(1200);
  const after = await page.eval(`return [...document.querySelectorAll('[data-design] img')].map((i) => decodeURIComponent(i.getAttribute('src') ?? '')).join('|');`);
  ok('و«استبدل الصورة» يضع ما اختير مكانها', before !== after && /designs\/[0-9a-f]{32}\.psd/.test(after));

  await click('[data-act="import-notes-close"]');
  await wait(200);
  ok('واللوح يُغلق', !(await page.eval(`return Boolean(document.querySelector('[data-import-notes]'));`)));

  if (profile) {
    const errLog = join(profile, 'logs', 'diwan-errors.log');
    const hasNativeError = existsSync(errLog) && readFileSync(errLog, 'utf8').includes('[native]');
    ok('ولا سطر [native] في سجلّ أخطاء الملفّ الشخصي بعده', !hasNativeError);
  }

  return steps.join('\n');
}
