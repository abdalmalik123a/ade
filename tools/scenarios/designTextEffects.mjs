/**
 * سيناريو: تأثيرات النصّ (DESIGNS.md ١٫١٠) — في اللوحة البيضاء نصٌّ «مدرسة النور» يُظلَّل ويُحدّ بالأبيض ويُقوَّس كقوس
 * الباب، ثم كالابتسامة — والعربية على القوس موصولةٌ في منتصفه — ويُحفظ ذلك كلّه.
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
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await page.type('input[data-add-text]', 'مدرسة النور');
  await click('button[data-act="add"]');
  await wait(500);

  await click('input[data-act="text-shadow-on"]');
  await wait(300);
  ok('النصّ يُظلَّل', (await drawn()).includes('text-shadow:'));
  await setValue('input[data-act="text-shadow-blur"]', '0');
  await wait(300);
  ok('وظلّه حادٌّ بلا نعومة إن شاء', / 0\.00px #00000059/.test(await drawn()));
  await click('input[data-act="text-outline-on"]');
  await wait(300);
  ok('ويُحدّ بالأبيض تحت الملء', (await drawn()).includes('-webkit-text-stroke:') && (await drawn()).includes('paint-order:stroke fill'));

  await setValue('input[data-act="text-arc"]', '60');
  await wait(400);
  const arch = await drawn();
  ok('ويُقوَّس كقوس الباب: النصّ على مسارٍ في SVG', arch.includes('<textPath') && /A[\d.]+ [\d.]+ 0 [01] 1 /.test(arch));
  // العربية موصولةٌ في منتصف القوس: النصّ بطوله على المسار، ووسطه وسط الصندوق.
  const fit = await page.eval(`
    const svg = document.querySelector('[data-design] svg text textPath')?.closest('svg');
    const t = svg?.querySelector('text'); const b = t?.getBBox();
    return t ? { center: Math.round(b.x + b.width / 2), half: Math.round(+svg.getAttribute('width') / 2), chars: t.getNumberOfChars() } : null;`);
  ok(`والنصّ كلّه في منتصفه (${JSON.stringify(fit)})`, fit && fit.chars === 'مدرسة النور'.length && Math.abs(fit.center - fit.half) <= 2);
  await setValue('input[data-act="text-arc"]', '-40');
  await wait(400);
  ok('وكالابتسامة بالسالب', /A[\d.]+ [\d.]+ 0 [01] 0 /.test(await drawn()));

  await page.type('input[data-title]', 'ختم المدرسة');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list('تصاميم', 'print-only')).find((x) => x.title === 'ختم المدرسة');
    const el = t ? (await window.diwan.templates.doc(t.id)).canvas.elements.find((e) => e.kind === 'text') : null;
    return el ? { arc: el.arc, shadow: el.shadow, outline: el.outline } : null;`);
  ok(`ويُحفظ ذلك كلّه (${JSON.stringify(saved)})`, saved?.arc === -40 && saved?.shadow?.blur === 0 && saved?.outline?.color === '#ffffff');
  return steps.join('\n');
}
