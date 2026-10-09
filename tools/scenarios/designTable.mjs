/**
 * سيناريو: الجدول (DESIGNS.md ١٫٩) — جدولٌ في التصميم بأسطرٍ أفقية وحدها، ثم بلا عناوين، وصفٌّ بلونه وعرضه — ويُحفظ ذلك.
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
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(800);
  await click('[data-add="table"]');
  await wait(500);
  ok('الجدول يُضاف بحدوده الكاملة', (await drawn()).includes('<td style="border:1px solid'));

  await setValue('select[data-act="table-borders"]', 'rows');
  await wait(300);
  ok('وبأسطرٍ أفقية وحدها', (await drawn()).includes('border:none;border-bottom:'));
  await click('input[data-act="table-header"]');
  await wait(300);
  ok('وبلا صفّ العناوين', !(await drawn()).includes('<thead>'));

  await setValue('input[data-row-bg="1"]', '#fde68a');
  await wait(300);
  await click('[data-row-bold="1"]');
  await wait(300);
  const html = await drawn();
  ok('والصفّ الثاني بلونه وعرضه', /<tr style="background:#fde68a;">(<td[^>]*font-weight:700;[^>]*>[^<]*<\/td>)+/.test(html));

  await page.type('input[data-title]', 'جدول المنيو');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list('تصاميم', 'print-only')).find((x) => x.title === 'جدول المنيو');
    const table = t ? (await window.diwan.templates.doc(t.id)).canvas.elements.find((e) => e.kind === 'table') : null;
    return table ? { borders: table.borders, hideHeader: table.hideHeader, row: table.rowStyles?.[1] } : null;`);
  ok(`ويُحفظ ذلك (${JSON.stringify(saved)})`, saved?.borders === 'rows' && saved?.hideHeader === true && saved?.row?.bg === '#fde68a' && saved?.row?.bold === true);
  return steps.join('\n');
}
