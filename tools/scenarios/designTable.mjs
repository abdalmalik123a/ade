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
  await click('[data-design-tool="table"]');
  await page.eval(`const s=document.querySelector('[data-design]');const r=s.getBoundingClientRect();const o={bubbles:true,clientX:r.right-r.width*.08,clientY:r.top+r.height*.35};s.dispatchEvent(new MouseEvent('mousedown',o));document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup',o));return true;`);
  await click('[data-design-tool="select"]');
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
  // S20: المقابض الموجودة تقاسم الجارين، ولا تظهر للمقفل أو المخفي أو المدوّر.
  const count = () => page.eval(`return document.querySelectorAll('[data-table-grip]').length;`);
  ok('الجدول المستقيم له مقابض حدود',await count()>0);
  const widths = () => page.eval(`return [0,1,2].map(i=>Number(document.querySelector('[data-act="table-col-width-'+i+'"]').value));`);
  const before=await widths();
  await page.eval(`const g=document.querySelector('[data-table-grip="col-1"]');const r=g.getBoundingClientRect();g.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.x,clientY:r.y}));document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.x-10,clientY:r.y}));return true;`);await wait(120);
  await page.eval(`document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return true;`);await wait(150);
  const after=await widths();ok('سحب العمود يقاسم جاره ويحفظ الثالث',after[0]>before[0]&&after[1]<before[1]&&Math.abs(after[2]-before[2])<.2&&Math.abs(after[0]+after[1]-before[0]-before[1])<.3);
  await click('[data-layer-lock]');await wait(120);ok('المقفل بلا مقابض جدول',await count()===0);await click('[data-layer-lock]');await wait(120);
  await click('[data-layer-hide]');await wait(120);ok('المخفي بلا مقابض جدول',await count()===0);await click('[data-layer-hide]');await wait(120);
  await page.eval(`const g=document.querySelector('[data-grip="rotate"]');const r=g.getBoundingClientRect();const b=g.parentElement.getBoundingClientRect();g.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:b.x+b.width+30,clientY:b.y+b.height/2}));return true;`);await wait(120);
  await page.eval(`document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return true;`);await wait(120);
  ok('المدوّر بلا مقابض على محاور خاطئة',await count()===0);await click('[data-undo]');await wait(120);ok('التراجع عن التدوير يعيد المقابض',await count()>0);
  return steps.join('\n');
}
