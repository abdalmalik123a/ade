/**
 * سيناريو: «مكتبة العناصر» (DESIGNS.md ٠٫٨) — SVG وPNG يُستوردان (والـSVG يُعقَّم) ويُحفظان داخل ديوان، ويُدرجان في
 * التصميم بنسبة أبعادهما، ويُحذفان من المكتبة؛ ويبقيان بعد إعادة التشغيل.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.env.TEMP ?? '.', `diwan-elements-${Date.now()}`);
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const FRAME = join(ROOT, 'إطار ذهبي.svg');
const STAR = join(ROOT, 'نجمة.png');
const PAGE = join(ROOT, 'صفحة.svg');

export function prepare() {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(
    FRAME,
    `<?xml version="1.0"?><svg viewBox="0 0 200 100" onload="alert(1)" xmlns="http://www.w3.org/2000/svg"><script>alert(2)</script>` +
      `<rect x="5" y="5" width="190" height="90" fill="none" stroke="#c9a45c" stroke-width="6"/><image href="https://example.com/track.png"/></svg>`
  );
  writeFileSync(STAR, Buffer.from(PIXEL, 'base64'));
  writeFileSync(PAGE, '<html><body>ليست رسمة</body></html>');
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  return { DIWAN_TEST_OPEN_FILES: [FRAME, STAR, PAGE].join('|'), DIWAN_TEST_SAVE_DIR: join(ROOT, 'out') };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);

  // ── المكتبة ← العناصر ─────────────────────────────────────────────
  await page.goto('diwan-elements');
  await wait(600);
  ok('«المكتبة ← العناصر» برسومات ديوان', (await page.eval(`return document.querySelectorAll('[data-elements="bundled"] [data-element]').length;`)) > 5);
  await page.eval(`
    const s = document.querySelector('select[data-act="elements-category"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'إطارات');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await click('[data-act="elements-import"]');
  await wait(1500);
  const said = await page.text();
  ok('SVG وPNG يُستوردان إلى صنفهما', said.includes('أُضيف عنصران') && (await has('[data-elements="imported"] [data-element="إطار ذهبي"]')) && (await has('[data-element="نجمة"]')));
  ok('وما ليس رسمةً يُرفض باسمه وسببه', said.includes('صفحة.svg') && said.includes('ليس رسمةً متّجهة'));

  const stored = await page.eval(`
    const list = await window.diwan.elements.list();
    const frame = list.find((e) => e.name === 'إطار ذهبي');
    return { frame, text: await (await fetch('diwan://store/' + frame.file)).text() };
  `);
  ok('والرسمة محفوظةٌ معقَّمة: لا شيفرة ولا رابطٌ خارجي', !/script|onload|example\.com/.test(stored.text) && stored.text.includes('stroke="#c9a45c"'));
  ok('وبأبعادها وصنفها', stored.frame.width === 200 && stored.frame.height === 100 && stored.frame.category === 'إطارات');
  await wait(500);
  ok('وتُرسم من المخزن', await page.eval(`const img = document.querySelector('[data-element="إطار ذهبي"] img'); return Boolean(img && img.complete && img.naturalWidth > 0);`));
  const backup = await page.eval(`return (await window.diwan.backup.create(null))?.path ?? null;`);
  const zip = backup ? readFileSync(backup).toString('latin1') : '';
  ok('وتنتقل في النسخة الاحتياطية (ملفّاها في مخزنها)', zip.includes(`store/${stored.frame.file}`) && /store\/elements\/[0-9a-f]{32}\.png/.test(zip));

  // ── في التصميم: من «رسومات» ← ما أضافه المكتب ──────────────────────
  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(900);
  await click('[data-add="clipart"]');
  await wait(800);
  ok('«رسومات» في التصميم تعرض ما أضافه المكتب', await has('[data-act="insert-element"][data-element="إطار ذهبي"]'));
  await click('[data-act="insert-element"][data-element="إطار ذهبي"]');
  await wait(800);
  const placed = await page.eval(`
    const img = [...document.querySelectorAll('[data-design] img')].find((i) => i.src.includes('/elements/'));
    return img ? { w: parseFloat(img.style.width), h: parseFloat(img.style.height), loaded: img.complete && img.naturalWidth > 0 } : null;
  `);
  ok('ويُدرج بمساره في المخزن ويُرسم', Boolean(placed?.loaded));
  ok(`وبنسبة أبعاده لا ممطوطًا (${placed ? (placed.w / placed.h).toFixed(2) : '—'})`, Boolean(placed) && Math.abs(placed.w / placed.h - 2) < 0.02);

  // ── الحذف من المكتبة ───────────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(500);
  await page.goto('diwan-elements');
  await wait(700);
  await click('[data-element="نجمة"] [data-act="element-remove"]');
  await wait(500);
  ok('الحذف يسأل', (await page.eval(`return document.querySelector('[data-confirm]')?.innerText ?? '';`)).includes('أتحذف «نجمة»'));
  await click('[data-confirm] [data-choice="yes"]');
  await wait(900);
  ok('ويُحذف من المكتبة', !(await has('[data-element="نجمة"]')) && (await has('[data-element="إطار ذهبي"]')));
  return steps.join('\n');
}

export async function afterRestart(page) {
  const names = await page.eval(`return (await window.diwan.elements.list()).map((e) => e.name);`);
  return `${names.length === 1 && names[0] === 'إطار ذهبي' ? '✓' : '✗'} المكتبة باقيةٌ بعد إعادة التشغيل (${names.join('، ')})`;
}
