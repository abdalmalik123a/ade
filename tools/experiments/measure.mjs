/**
 * قياس الأداء على الجهاز المرجعي (G06 G07، D37) — بالبرنامج الحقيقي، وأهدافه في `docs/QUALITY.md` §٨:
 *
 * أ. **الإقلاع البارد**: في `prepare` قبل أن يقلع المِقْود برنامجه — `electron.exe` بملفّ تعريفٍ فارغ على منفذٍ آخر، من `spawn` حتى
 *    ظهور `[data-screen="service"]` (عبر CDP، بلا مهلات `drive`).
 * ب. **وثيقةٌ من نحو ١٣٤ صفحة** (فقراتٌ بالجسر): زمن فتحها في المحرّر حتى يظهر آخرها، ثم حتى يقول عدد صفحاتها؛ ووسيط زمن الحرف لمئة
 *    `Input.insertText` في أوّلها (حتى إطارين — أسوأ الحالات: كلّ حرفٍ يعيد ترقيم ما بعده). ونصف فقراتها مضبوطةٌ بكشيدةٍ متوسّطة (D184)،
 *    والأولى منها — فالحرف يُكتب في فقرةٍ تُمحى زخرفتها، والمحرّر يحسب ما ظهر بعد السكون.
 * ج. **تصميمٌ بمئتي عنصر** بالجسر: زمن فتحه حتى تُرسم مقابضه المئتان، ووسيط خطوة السحب لعشرين حركة فأرة.
 * د. **الذاكرة** بعد (ب) وبعد (ج).
 * هـ. **«أزل الخلفية»** بنموذج الأشياء الحقيقي (BiRefNet، L21) على صورةٍ ٣٨٤×٣٨٤ كما في `objectCutout.test.ts`: مرّتين، الأولى بتحميل النموذج.
 *
 *   node tools/drive.mjs tools/experiments/measure.mjs
 *
 * تجربةٌ لا سيناريو (لا ✓ ولا ✗، ولا تدخل الجولة): كلّ تشغيلٍ يكتب أرقامه في `reports/قياس-G06-G07/` (خارج git)، والوسيط من ثلاثة تشغيلات.
 */
import { execSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPORT = join(process.cwd(), 'reports', 'قياس-G06-G07');
const ELECTRON = resolve('node_modules/electron/dist/electron.exe');
const COLD_PORT = 9224;
/** فقراتٌ تبلغ بها الوثيقة نحو ١٣٤ صفحة A4 (أوّل تشغيلٍ بـ١١٥٠ أعطى ١٥١ صفحة). */
const PARAGRAPHS = 1020;
const ELEMENTS = 200;
const FILLER = 'نرجو التفضّل بالاطّلاع على قائمة التلاميذ أدناه واتّخاذ ما يلزم بشأن توزيعهم على الصفوف للعام الدراسي القادم مع التقدير.';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
/** ذاكرة عمليّات البرنامج كلّها بالميغابايت (كما في `designs-0.10.mjs`). */
function memoryMb() {
  try {
    const csv = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV /NH', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const kb = [...csv.matchAll(/"([\d,.\s]+) K"/g)].map((m) => Number(m[1].replace(/[^\d]/g, '')));
    return { total: Math.round(kb.reduce((a, b) => a + b, 0) / 1024), largest: Math.round(Math.max(0, ...kb) / 1024), processes: kb.length };
  } catch {
    return { total: 0, largest: 0, processes: 0 };
  }
}

// ── أ. الإقلاع البارد — قبل المِقْود ──────────────────────────────────
let cold = null;

async function coldStart() {
  const profile = mkdtempSync(join(process.env.TEMP ?? tmpdir(), 'diwan-cold-'));
  const t0 = performance.now();
  const child = spawn(ELECTRON, ['.', `--remote-debugging-port=${COLD_PORT}`, `--user-data-dir=${profile}`], {
    stdio: 'ignore',
    env: { ...process.env, DIWAN_TEST_SCAN_FILE: 'none' }
  });
  try {
    let target = null;
    while (!target && performance.now() - t0 < 60_000) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${COLD_PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page') ?? null;
      } catch {
        /* لم يبدأ الاستماع بعد */
      }
      if (!target) await wait(25);
    }
    if (!target) return null;
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    let id = 0;
    const evaluate = (expression) =>
      new Promise((res) => {
        const my = ++id;
        const on = (m) => {
          const msg = JSON.parse(m.data);
          if (msg.id !== my) return;
          ws.removeEventListener('message', on);
          res(msg.result?.result?.value);
        };
        ws.addEventListener('message', on);
        ws.send(JSON.stringify({ id: my, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      });
    let shown = false;
    while (!shown && performance.now() - t0 < 60_000) {
      shown = Boolean(await evaluate(`Boolean(document.querySelector('[data-screen="service"]'))`));
      if (!shown) await wait(25);
    }
    const ms = Math.round(performance.now() - t0);
    ws.close();
    return shown ? ms : null;
  } finally {
    if (child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await wait(1500);
    rmSync(profile, { recursive: true, force: true });
  }
}

export async function prepare() {
  cold = await coldStart();
  return {};
}

// ── ب ج د هـ ─────────────────────────────────────────────────────────
export default async function experiment(page) {
  mkdirSync(REPORT, { recursive: true });
  const out = { at: new Date().toISOString(), coldStartMs: cold };
  const lines = [`أ. الإقلاع البارد حتى الشبّاك: ${cold ?? '—'} م.ث`];
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const frames = () => page.eval(`await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return true;`);
  const poll = async (expr, timeout = 120_000, step = 20) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = await page.eval(expr);
      if (v) return v;
      await wait(step);
    }
    return null;
  };
  const discard = () => click('[data-confirm] [data-choice="discard"]');

  // ب. وثيقةٌ طويلة: نموذجٌ بالجسر، ويُفتح في المحرّر كما يفتحه الموظف.
  const p = (id, text) => ({ id, kind: 'paragraph', align: 'right', inlines: [{ kind: 'run', text }] });
  const k = (id, text) => ({ ...p(id, text), align: 'justify', kashida: 'medium' });
  const doc = {
    id: 'وثيقة طويلة',
    schemaVersion: 1,
    kind: 'flow',
    issuing: 'registered',
    pageSetup: { size: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 }, letterheadMode: 'print', pageNumbers: true, numerals: 'arabic' },
    blocks: Array.from({ length: PARAGRAPHS }, (_, i) => (i % 2 ? p : k)(`p${i}`, `${i + 1}. ${FILLER} ${FILLER} ${FILLER}`)),
    fields: [],
    meta: {}
  };
  await page.eval(`
    await window.diwan.templates.save({ id: null, code: null, title: 'وثيقة طويلة', subtitle: null, category: 'قياس', subjectLine: null,
      letterheadId: null, bodyHtml: '<p>طويلة</p>', variables: [], doc: ${JSON.stringify(doc)} });
    return true;`);
  await page.goto('templates-library-drafts');
  await wait(900);
  const last = `${PARAGRAPHS}. ${FILLER.slice(0, 12)}`;
  const t0 = Date.now();
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.innerText.includes('فتح في المحرر'))?.click(); return true;`);
  await poll(`return (document.querySelector('[data-screen="editor"] [data-page-editor]')?.innerText ?? '').includes(${JSON.stringify(last)});`);
  out.docOpenMs = Date.now() - t0;
  await page.type('[data-editor-owner]', 'زينب علي حسن');
  const issueText = await poll(`const t = document.querySelector('[data-screen="editor"] [data-act="issue"]')?.innerText ?? ''; return /[0-9٠-٩]/.test(t) ? t : null;`);
  out.docPagesMs = Date.now() - t0;
  out.docPages = issueText ? Number(issueText.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, '')) : null;
  lines.push(`ب. وثيقة ${PARAGRAPHS} فقرة («${issueText?.trim() ?? '—'}»): ظهر آخرها في ${out.docOpenMs} م.ث، وقال عدد صفحاتها في ${out.docPagesMs} م.ث (بعد كتابة صاحب العلاقة)`);

  // الحرف: في أوّل الوثيقة — كلّ حرفٍ يُعيد ترقيم ما بعده من الصفحات.
  await page.eval(`
    const root = document.querySelector('[data-screen="editor"] [data-page-editor]');
    root.focus();
    const first = root.querySelector('p')?.firstChild;
    const range = document.createRange();
    range.setStart(first, 0);
    range.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return true;`);
  await wait(500);
  const keys = [];
  for (let i = 0; i < 100; i++) {
    const k0 = performance.now();
    await page.send('Input.insertText', { text: 'ب' });
    await frames();
    keys.push(performance.now() - k0);
  }
  out.keyMedianMs = Math.round(median(keys));
  out.keyMaxMs = Math.round(Math.max(...keys));
  await wait(1500);
  out.memoryAfterDoc = memoryMb();
  lines.push(`   الحرف: الوسيط ${out.keyMedianMs} م.ث، وأبطؤه ${out.keyMaxMs} م.ث (مئة حرف) · الذاكرة بعدها ${out.memoryAfterDoc.total} م.ب في ${out.memoryAfterDoc.processes} عمليات (أكبرها ${out.memoryAfterDoc.largest})`);

  // ج. تصميمٌ بمئتي عنصر: نصوصٌ في شبكةٍ على A4، يُفتح من «تصاميمي».
  const elements = Array.from({ length: ELEMENTS }, (_, i) => ({
    kind: 'text',
    id: `m${i}`,
    box: { x: 0.005 + (i % 10) * 0.1, y: 0.005 + Math.floor(i / 10) * 0.05, w: 0.09, h: 0.045 },
    z: i + 1,
    size: 9,
    inlines: [{ kind: 'run', text: `عنصر ${i + 1}` }]
  }));
  const designId = await page.eval(`
    const saved = await window.diwan.templates.save({ id: null, code: null, title: 'تصميم بمئتي عنصر', subtitle: null, category: 'تصاميم', subjectLine: null,
      bodyHtml: '', letterheadId: null, variables: [],
      doc: { id: 'm200', schemaVersion: 2, kind: 'canvas', issuing: 'print-only', blocks: [], fields: [], meta: { title: 'تصميم بمئتي عنصر', category: 'تصاميم' },
        canvas: { size: { w: 210, h: 297 }, bleed: 0, cropMarks: false, background: { kind: 'none' }, elements: ${JSON.stringify(elements)} } } });
    return saved.id;`);
  await page.goto('designed-documents');
  await wait(400);
  await discard();
  await wait(1200);
  const d0 = Date.now();
  await click(`[data-saved-thumb="${designId}"]`);
  await poll(`return document.querySelectorAll('[data-design] [data-handle]').length === ${ELEMENTS};`);
  await frames();
  out.designOpenMs = Date.now() - d0;
  await wait(800);
  const at = await page.eval(`const r = document.querySelector('[data-handle="m55"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  const steps = [];
  for (let i = 1; i <= 20; i++) {
    const s0 = performance.now();
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x - i * 4, y: at.y + i * 3, button: 'left' });
    await frames();
    steps.push(performance.now() - s0);
  }
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x - 80, y: at.y + 60, button: 'left', clickCount: 1 });
  const moved = await page.eval(`const r = document.querySelector('[data-handle="m55"]').getBoundingClientRect(); return Math.round(Math.hypot(r.left + r.width / 2 - ${at.x}, r.top + r.height / 2 - ${at.y}));`);
  out.dragMedianMs = Math.round(median(steps));
  out.dragMaxMs = Math.round(Math.max(...steps));
  out.dragMovedPx = moved;
  await wait(1500);
  out.memoryAfterDesign = memoryMb();
  lines.push(`ج. تصميم ${ELEMENTS} عنصر: فُتح ورُسمت مقابضه في ${out.designOpenMs} م.ث · خطوة السحب: الوسيط ${out.dragMedianMs} م.ث وأبطؤها ${out.dragMaxMs} (تحرّك العنصر ${moved} بكسلًا)`);
  lines.push(`د. الذاكرة بعد التصميم: ${out.memoryAfterDesign.total} م.ب في ${out.memoryAfterDesign.processes} عمليات (أكبرها ${out.memoryAfterDesign.largest})`);

  // هـ. «أزل الخلفية» بالنموذج الحقيقي، مرّتين — الأولى تحمّله.
  const cut = await page.eval(`
    const size = 384, px = new Uint8Array(size * size * 4);
    let seed = 7;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, inside = Math.hypot(x - size / 2, y - size * 0.56) < size * 0.27;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const n = (seed / 0x7fffffff - 0.5) * 30;
      px[i] = inside ? 200 : 150 + (y / size) * 60 + n; px[i + 1] = inside ? 30 : 160 - (x / size) * 40 + n; px[i + 2] = inside ? 35 : 120 + n; px[i + 3] = 255;
    }
    const runs = [];
    for (let k = 0; k < 2; k++) {
      const t0 = performance.now();
      const r = await window.diwan.photos.cutoutObject({ pixels: px, width: size, height: size });
      runs.push({ wall: Math.round(performance.now() - t0), model: Math.round(r.ms) });
    }
    return runs;`);
  out.cutout = cut;
  lines.push(`هـ. «أزل الخلفية» ٣٨٤×٣٨٤: الأولى ${cut[0].wall} م.ث (النموذج ${cut[0].model}، بتحميله) · الثانية ${cut[1].wall} م.ث (النموذج ${cut[1].model})`);

  writeFileSync(join(REPORT, `measure-${Date.now()}.json`), `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  return lines.join('\n');
}
