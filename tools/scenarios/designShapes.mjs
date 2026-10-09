/**
 * سيناريو: قصّ الصورة بشكلٍ مع إطارها (DESIGNS.md ١٫١) — صورة الطالب في هويّته تُقصّ درعًا بحلقتين، فتُرسم في اللوحة
 * مقصوصةً بإطارها، وتُحفظ وتُفتح كما هي، ويخرج PDF بقصّها متّجهًا؛ و«بلا قصّ» يعيدها كما كانت.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.env.TEMP ?? '.', `diwan-shapes-${Date.now()}`);
const PHOTO = join(OUT, 'طالب.png');
/** صورةٌ ١×١ — تكفي صورةً للطالب. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

export function prepare() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(PHOTO, Buffer.from(PIXEL, 'base64'));
  return { DIWAN_TEST_SAVE_DIR: OUT, DIWAN_TEST_OPEN_FILE: PHOTO };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
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
  await click('button[data-kind="student-id"]');
  await wait(1000);
  await click('button[data-photo]');
  await wait(1000);
  // صورة الطالب: العنصر الذي يملؤه حقل الصورة.
  const photoId = await page.eval(`
    const btn = [...document.querySelectorAll('[data-layer]')].find((b) => /صورة|الصورة/.test(b.innerText));
    btn?.click();
    return btn?.dataset.layer ?? null;`);
  await wait(500);
  ok('صورة الطالب تُحدَّد، ولوحة شكلها تظهر', Boolean(photoId) && (await has('[data-panel="image-shape"]')));

  await click('[data-image-shape="shield"]');
  await wait(300);
  await setValue('select[data-act="image-frame"]', '2');
  await wait(300);
  await setValue('input[data-act="image-frame-width"]', '0.8');
  await wait(400);
  const drawn = await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  ok('تُرسم مقصوصةً بشكلها', drawn.includes("clip-path:path('M"));
  ok('وبحلقتين على حدّه', (drawn.match(/<path d="M[^"]*" fill="none" stroke=/g) ?? []).length >= 2);

  await page.type('input[data-title]', 'هوية بصورة درع');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const list = await window.diwan.templates.list('تصاميم', 'print-only');
    const t = list.find((x) => x.title === 'هوية بصورة درع');
    const doc = t ? await window.diwan.templates.doc(t.id) : null;
    const el = doc?.canvas?.elements.find((e) => e.id === ${JSON.stringify(photoId)});
    return el ? { shape: el.shape, frame: el.frame } : null;`);
  ok(`ويُحفظ بشكله وإطاره (${JSON.stringify(saved)})`, saved?.shape === 'shield' && saved?.frame?.rings === 2 && saved?.frame?.width === 0.8);

  // PDF: القصّ والإطار متّجهان (تجربة ٠٫١٠).
  await click('button[data-act="print"]');
  await wait(1500);
  await click('[data-sheets] [data-act="pdf"]');
  let pdf = null;
  for (let i = 0; i < 40 && !pdf; i++) {
    await wait(500);
    pdf = readdirSync(OUT).find((f) => f.endsWith('.pdf')) ?? null;
  }
  const bytes = pdf ? readFileSync(join(OUT, pdf)).toString('latin1') : '';
  ok('وPDF يخرج بها', bytes.startsWith('%PDF'));
  await click('[data-sheets] button[title="رجوع (Esc)"]');
  await wait(400);

  await click('[data-image-shape="none"]');
  await setValue('select[data-act="image-frame"]', '0');
  await wait(400);
  const plain = await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  ok('و«بلا قصّ» و«بلا إطار» يعيدانها كما كانت', !plain.includes('clip-path:path(') && !plain.includes('fill="none" stroke='));
  return steps.join('\n');
}
