/**
 * سيناريو: الشكل الحرّ ومكتبته (DESIGNS.md ١٫٢) — موجةٌ سفلية وإطار قوسٍ من «موجات وأشرطة وإطارات» يُدرجان في
 * الشهادة، ويُلوَّنان ويُقلبان، ويُحفظان ويُفتحان كما هما، ويخرج PDF بهما.
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.env.TEMP ?? '.', `diwan-paths-${Date.now()}`);

export function prepare() {
  mkdirSync(OUT, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: OUT };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
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
  await click('button[data-kind="thanks"]');
  await wait(1000);
  await click('[data-add="shapes"]');
  await wait(400);
  ok('«موجات وأشرطة وإطارات» تعرض المكتبة بمجموعاتها', (await page.eval(`return document.querySelectorAll('[data-panel="shape-library"] [data-preset]').length;`)) >= 15);

  await click('[data-preset="wave-bottom"]');
  await wait(500);
  ok('الموجة السفلية تُدرج وتُرسم متمدّدةً مع صندوقها', (await drawn()).includes('preserveAspectRatio="none"') && (await has('[data-layer]')));
  ok('وتُسمّى باسمها في الطبقات', (await page.eval(`return [...document.querySelectorAll('[data-layer]')].some((b) => b.innerText.includes('موجة سفلية'));`)));
  ok('ولوحة خصائصها تظهر', await has('[data-panel="path"]'));

  await setValue('input[data-act="paint-fill-color"]', '#c9a45c');
  await wait(300);
  await click('[data-act="path-flip-y"]');
  await wait(300);
  const wave = await drawn();
  ok('وتُلوَّن', wave.includes('fill="#c9a45c"'));
  ok('وتُقلب رأسيًّا (فتصير علوية)', wave.includes('scale(1 -1)'));

  await click('[data-add="shapes"]');
  await wait(300);
  await click('[data-preset="arch-outline"]');
  await wait(500);
  ok('وإطار القوس حدٌّ لا يتمدّد سُمكه', (await drawn()).includes('vector-effect="non-scaling-stroke"'));

  await page.type('input[data-title]', 'شهادة بموجة');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list('تصاميم', 'print-only')).find((x) => x.title === 'شهادة بموجة');
    const doc = t ? await window.diwan.templates.doc(t.id) : null;
    return (doc?.canvas?.elements ?? []).filter((e) => e.kind === 'path').map((e) => ({ preset: e.preset, fill: e.fill, flipY: e.flipY, stroke: e.stroke }));`);
  ok(`ويُحفظان بما فيهما (${JSON.stringify(saved)})`, saved.length === 2 && saved.some((p) => p.preset === 'wave-bottom' && p.fill === '#c9a45c' && p.flipY) && saved.some((p) => p.preset === 'arch-outline' && p.stroke));

  await click('button[data-act="print"]');
  await wait(1500);
  await click('[data-sheets] [data-act="pdf"]');
  let pdf = null;
  for (let i = 0; i < 40 && !pdf; i++) {
    await wait(500);
    pdf = readdirSync(OUT).find((f) => f.endsWith('.pdf')) ?? null;
  }
  ok('وPDF يخرج بهما', pdf ? readFileSync(join(OUT, pdf)).toString('latin1').startsWith('%PDF') : false);
  return steps.join('\n');
}
