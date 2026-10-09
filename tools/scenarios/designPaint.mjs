/**
 * سيناريو: التدرّج والشفافية والخطّ المنقّط (DESIGNS.md ١٫٣) — في الشهادة: العنوان يُدرَّج ذهبيًّا ويشفّ، وزاويةٌ مائلة
 * تُملأ بتدرّج، وخطٌّ يُنقَّط سطرًا للكتابة — ويُحفظ ذلك كلّه ويُفتح كما هو.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  const setValue = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1000);

  // العنوان: أوّل نصٍّ في الطبقات باسمه.
  const title = await page.eval(`
    const b = [...document.querySelectorAll('[data-layer]')].find((x) => /شكر|تقدير/.test(x.innerText));
    b?.click();
    return b?.innerText.trim() ?? null;`);
  await wait(400);
  await click('input[data-act="text-gradient-on"]');
  await wait(400);
  ok(`العنوان («${title}») يُدرَّج: التدرّج مقصوصٌ بحروفه`, (await drawn()).includes('background-clip:text'));
  await setValue('input[data-act="opacity"]', '60');
  await wait(300);
  ok('ويشفّ ٦٠٪', (await drawn()).includes('opacity:0.6'));

  await click('[data-add="shapes"]');
  await wait(300);
  await click('[data-preset="corner"]');
  await wait(400);
  await setValue('select[data-act="paint-fill"]', 'gradient');
  await wait(400);
  const corner = await drawn();
  ok('والزاوية المائلة تُملأ بتدرّجٍ متّجه', corner.includes('<linearGradient id="fill-') && /fill="url\(#fill-/.test(corner));

  await click('[data-add="shape"]');
  await wait(400);
  await setValue('select[data-act="paint-dash"]', 'dotted');
  await wait(300);
  ok('والحدّ يُنقَّط', (await drawn()).includes('dotted'));

  await page.type('input[data-title]', 'شهادة ذهبية');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list('تصاميم', 'print-only')).find((x) => x.title === 'شهادة ذهبية');
    const els = t ? (await window.diwan.templates.doc(t.id)).canvas.elements : [];
    return {
      gradientText: els.some((e) => e.kind === 'text' && e.gradient && e.opacity === 0.6),
      gradientPath: els.some((e) => e.kind === 'path' && typeof e.fill === 'object' && e.fill.stops.length === 2),
      dotted: els.some((e) => e.kind === 'shape' && e.dash === 'dotted')
    };`);
  ok(`ويُحفظ ذلك كلّه (${JSON.stringify(saved)})`, saved.gradientText && saved.gradientPath && saved.dotted);
  return steps.join('\n');
}
