/**
 * سيناريو: «سلّة النماذج» في الشبّاك (D157، ر175 — مظهر «ب٢»).
 *
 * المختار في السلّة **بترتيب اختياره** (الرابع ثم الأوّل) برقمه الهنديّ وتصنيفه، و«املأ (ن)» فيها · ✕ يُزيل من السلّة ويُلغي علامة بطاقته ·
 * فارغةً: سطرٌ إرشاديّ و«املأ» معطَّل · «املأ» ينقل إلى خطوة «املأ» · «علّق المعاملة» ثم «اختر»: «معاملات معلّقة: …» في السلّة و«استأنف» يعيدها ·
 * ولا علامة مائية ولا «المختار:» في شريط الخطوات · وعلى ١٣٦٦×٧٦٨ و١٢٨٠×٧٢٠: «املأ» داخل الشاشة بلا تمرير، وأوّل بطاقة نموذجٍ تبدأ فوق أسفلها.
 * وتُلتقط الشاشة بالمقاسين إن طُلب (SHOT_DIR).
 */
import { join } from 'node:path';

const TITLES = ['إفادة سكن السلة', 'تأييد دوام السلة', 'طلب نقل السلة', 'كتاب شكر السلة'];

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const size = (w, h) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const basket = () =>
    page.eval(`return [...document.querySelectorAll('[data-basket] [data-basket-item]')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim());`);
  const fill = () =>
    page.eval(`const b = [...document.querySelectorAll('[data-basket] button')].find((x) => x.innerText.trim().startsWith('املأ')); return b ? { text: b.innerText.trim(), disabled: b.disabled } : null;`);
  const cardOn = (title) =>
    page.eval(`const c = [...document.querySelectorAll('[data-template-card]')].find((x) => x.innerText.includes(${JSON.stringify(title)})); return c ? c.innerText.includes('check') : null;`);

  await page.eval(`
    const cats = ['السكن', 'اختبار', null, 'شكر'];
    const titles = ${JSON.stringify(TITLES)};
    for (let i = 0; i < titles.length; i++) {
      await window.diwan.templates.save({ id: null, code: null, title: titles[i], subtitle: null, category: cats[i],
        subjectLine: null, letterheadId: null, bodyHtml: 'نؤيد بأن {الاسم} من سكنة المحلة.',
        variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }] });
    }
    return true;
  `);
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(900);

  // ── الترتيب ترتيب الاختيار: الرابع ثم الأوّل ──
  ok('السلّة ظاهرة في «اختر»', await page.eval(`return Boolean(document.querySelector('[data-basket]')) && document.querySelector('[data-basket]').innerText.includes('سلّة النماذج');`));
  await page.clickText(TITLES[3], 'button[data-template-card]');
  await page.clickText(TITLES[0], 'button[data-template-card]');
  let items = await basket();
  ok(`في السلّة بترتيب الاختيار وبرقميهما (${items.join(' | ')})`, items.length === 2 && items[0].startsWith('١') && items[0].includes(TITLES[3]) && items[1].startsWith('٢') && items[1].includes(TITLES[0]));
  ok('وبتصنيفيهما', items[0].includes('شكر') && items[1].includes('السكن'));
  ok(`و«املأ (٢)» فيها (${(await fill())?.text})`, (await fill())?.text === 'املأ (2)');
  ok('والعدد على رأسها بالبرتقاليّ', (await page.eval(`return document.querySelector('[data-basket-count]')?.innerText.trim();`)) === '٢');

  // ── ✕ يزيل من السلّة ويُلغي علامة البطاقة ──
  await page.eval(`document.querySelector('[data-basket] button[aria-label="أزل ${TITLES[3]} من السلّة"]').click(); return true;`);
  await wait(300);
  items = await basket();
  ok(`✕ الأوّل: يزول من السلّة ويصير الباقي ١ (${items.join(' | ')})`, items.length === 1 && items[0].startsWith('١') && items[0].includes(TITLES[0]));
  ok('وتُلغى علامته على بطاقته', (await cardOn(TITLES[3])) === false && (await cardOn(TITLES[0])) === true);
  ok('و«املأ (١)»', (await fill())?.text === 'املأ (1)');
  await page.eval(`document.querySelector('[data-basket] button[aria-label^="أزل "]').click(); return true;`);
  await wait(300);
  const empty = await page.eval(`return document.querySelector('[data-basket]').innerText;`);
  ok('فارغةً: السطر الإرشاديّ', empty.includes('انقر نموذجًا ليُضاف هنا بترتيبه.') && (await basket()).length === 0);
  ok('و«املأ» معطَّل', (await fill())?.disabled === true && (await fill())?.text === 'املأ');

  // ── لا علامة مائية ولا «المختار:» ──
  ok('لا علامة مائية في الشبّاك', !(await page.eval(`return Boolean(document.querySelector('[data-watermark]'));`)));
  await page.clickText(TITLES[1], 'button[data-template-card]');
  ok('ولا «المختار:» في شريط الخطوات (السلّة تقوله)', !(await page.eval(`return document.querySelector('[data-steps]').innerText;`)).includes('المختار'));

  // ── المقاسان: «املأ» داخل الشاشة بلا تمرير، وأوّل بطاقة نموذجٍ فوق أسفلها ──
  for (const [w, h] of [
    [1366, 768],
    [1280, 720]
  ]) {
    await size(w, h);
    await wait(500);
    const r = await page.eval(`
      const b = [...document.querySelectorAll('[data-basket] button')].find((x) => x.innerText.trim().startsWith('املأ')).getBoundingClientRect();
      const c = document.querySelector('[data-template-card]').getBoundingClientRect();
      const k = document.querySelector('[data-basket]').getBoundingClientRect();
      return { fillBottom: Math.round(b.bottom), fillTop: Math.round(b.top), card: Math.round(c.top), basketBottom: Math.round(k.bottom), H: innerHeight };
    `);
    ok(`${w}×${h}: «املأ» داخل الشاشة بلا تمرير (${r.fillTop}–${r.fillBottom} من ${r.H})`, r.fillTop >= 0 && r.fillBottom <= r.H && r.basketBottom <= r.H);
    ok(`${w}×${h}: وأوّل بطاقة نموذجٍ تبدأ فوق أسفلها (${r.card})`, r.card < r.H);
    if (shotsDir) await page.shot(join(shotsDir, `counterBasket-${w}x${h}.png`));
  }
  await page.send('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  // ── «املأ» ينقل إلى «املأ»، والتعليق والاستئناف من السلّة ──
  await page.clickText('املأ (1)', '[data-basket] button');
  await wait(1200);
  const current = () => page.eval(`return document.querySelector('[data-steps] [aria-current="step"]')?.innerText ?? '';`);
  ok('«املأ» ينقل إلى خطوة «املأ» والسلّة تغيب', (await current()).includes('املأ') && !(await page.eval(`return Boolean(document.querySelector('[data-basket]'));`)));
  await page.eval(`document.querySelector('[data-act="park"]').click(); return true;`);
  await wait(900);
  const parkedText = await page.eval(`return document.querySelector('[data-basket] [data-parked]')?.innerText ?? '';`);
  ok(`«علّق المعاملة» ثم «اختر»: المعلّقة في السلّة (${parkedText.replace(/\s+/g, ' ').trim()})`, (await current()).includes('اختر') && parkedText.includes('معاملات معلّقة:') && parkedText.includes('استأنف'));
  await page.eval(`document.querySelector('[data-basket] [data-act="resume"]').click(); return true;`);
  await wait(1200);
  ok('و«استأنف» يعيدها إلى «املأ»', (await current()).includes('املأ'));
  return steps.join('\n');
}
