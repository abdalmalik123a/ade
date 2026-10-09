/**
 * سيناريو: اختيار الخطّ في التصاميم من «خطوط ديوان» (DESIGNS.md ١٫٥) — عنوان الشهادة يُختار خطّه من المحزوم، ثم من خطٍّ
 * أضافه المكتب من Windows، وخطّ الجدول كذلك؛ وتصميمٌ بخطٍّ غائب يُقال اسمه حين يُختار نصّه.
 *
 * والخطّ المضاف «Amirx»: أميري المحزوم باسمٍ آخر في مجلّد خطوط Windows يُعدّه السيناريو (كما في `fonts.mjs`).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const WIN = join(process.env.TEMP ?? '.', `diwan-design-fonts-${Date.now()}`);

/** أميري (WOFF) ← TTF بالاسم «Amirx». */
function amirx() {
  const w = readFileSync(join(process.cwd(), 'node_modules', '@fontsource', 'amiri', 'files', 'amiri-arabic-400-normal.woff'));
  const n = w.readUInt16BE(12);
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(w.readUInt32BE(4), 0);
  head.writeUInt16BE(n, 4);
  let offset = head.length;
  const bodies = [];
  for (let i = 0; i < n; i++) {
    const at = 44 + i * 20;
    const tag = w.subarray(at, at + 4);
    const raw = w.subarray(w.readUInt32BE(at + 4), w.readUInt32BE(at + 4) + w.readUInt32BE(at + 8));
    let data = w.readUInt32BE(at + 8) < w.readUInt32BE(at + 12) ? inflateSync(raw) : Buffer.from(raw);
    if (tag.toString('latin1') === 'name') {
      const be = (s) => Buffer.from(s, 'utf16le').swap16().toString('latin1');
      data = Buffer.from(data.toString('latin1').split(be('Amiri')).join(be('Amirx')).split('Amiri').join('Amirx'), 'latin1');
    }
    tag.copy(head, 12 + i * 16);
    head.writeUInt32BE(offset, 12 + i * 16 + 8);
    head.writeUInt32BE(data.length, 12 + i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  }
  return Buffer.concat([head, ...bodies]);
}

export function prepare() {
  mkdirSync(WIN, { recursive: true });
  writeFileSync(join(WIN, 'amirx.ttf'), amirx());
  return { DIWAN_TEST_WINDOWS_FONTS: WIN };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  const choose = (sel, value) =>
    page.eval(`
      const s = document.querySelector(${JSON.stringify(sel)});
      if (!s) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)});
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`);
  const selectTitle = () =>
    page.eval(`
      const b = [...document.querySelectorAll('[data-layer]')].find((x) => /شكر|تقدير/.test(x.innerText));
      b?.click();
      return Boolean(b);`);

  // ── المحزوم ──────────────────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1000);
  await selectTitle();
  await wait(400);
  const options = await page.eval(`return [...document.querySelectorAll('select[data-act="element-font"] option')].map((o) => o.value);`);
  ok('خطّ النصّ يُختار من «خطوط ديوان»', options.includes('Aref Ruqaa') && options.includes('Noto Naskh Arabic'));
  await choose('select[data-act="element-font"]', 'Amiri');
  await wait(400);
  ok('ويُرسم العنوان بالأميري', (await drawn()).includes("font-family:'Amiri', serif"));

  // ── خطٌّ أضافه المكتب من Windows ──────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('diwan-fonts');
  await wait(600);
  await click('[data-act="fonts-windows"]');
  await wait(1500);
  await click('[data-windows-font="Amirx"] [data-act="font-add"]');
  await wait(1500);
  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1000);
  await selectTitle();
  await wait(400);
  await choose('select[data-act="element-font"]', 'Amirx');
  await wait(500);
  ok('وما أضافه المكتب يُختار ويُرسم به', (await drawn()).includes("font-family:'Amirx', serif"));
  ok('ويُرسم فعلًا (لا بديل)', await page.eval(`await document.fonts.load("16px 'Amirx'", 'شكر'); return [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Amirx' && f.status === 'loaded');`));

  // ── الجدول ───────────────────────────────────────────────────────
  await click('[data-add="table"]');
  await wait(500);
  await choose('select[data-act="table-font"]', 'Cairo');
  await wait(400);
  ok('وخطّ الجدول من المكتبة', (await drawn()).includes("'Cairo', sans-serif"));

  // ── تصميمٌ بخطٍّ غائب ───────────────────────────────────────────
  const id = await page.eval(`
    const saved = await window.diwan.templates.save({
      id: null, code: null, title: 'تصميم بخطٍّ غائب', subtitle: null, category: 'تصاميم', subjectLine: null, bodyHtml: '', letterheadId: null, variables: [],
      doc: { id: 'gone', schemaVersion: 2, kind: 'canvas', issuing: 'print-only', blocks: [], fields: [], meta: { title: 'تصميم بخطٍّ غائب', category: 'تصاميم' },
        canvas: { size: { w: 90, h: 50 }, bleed: 0, cropMarks: false, background: { kind: 'none' },
          elements: [{ kind: 'text', id: 'gone-text', box: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, z: 1, inlines: [{ kind: 'run', text: 'نصٌّ بخطٍّ غائب' }], font: "'Gone Font', serif" }] } }
    });
    return saved.id;`);
  await page.goto('templates-library-drafts');
  await wait(400);
  await click('[data-confirm] [data-choice="discard"]');
  await page.goto('designed-documents');
  await wait(800);
  await click(`[data-saved-thumb="${id}"]`);
  await wait(1000);
  await page.eval(`[...document.querySelectorAll('[data-layer]')].find((x) => x.innerText.includes('غائب'))?.click(); return true;`);
  await wait(800);
  ok('وتصميمٌ بخطٍّ غائب يُقال اسمه حين يُختار نصّه', await has('[data-missing-font="Gone Font"]'));
  return steps.join('\n');
}
