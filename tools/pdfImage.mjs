/**
 * صور صفحات PDF ومقارنتها بصور المرجع (G30) — المبدأ ٤ في `docs/ARCHITECTURE.md` §٢: PDF واحدٌ هو الحقيقة، ويُختبر التطابق آليًّا.
 *
 * لا canvas في Node ولا مكتبة رسم: Chromium نفسه (`electron.exe` المحزوم للتطوير) يرسم بـ`pdfjs-dist` في نافذةٍ خفيّة
 * (`tools/pdfImage/`)، ويقارن هناك أيضًا فلا يُفكّ PNG هنا. وكلّ نداءٍ يقلع Electron مرّة (نحو ثانيتين).
 *
 *   pdfToImages(pdfPath, { dpi })                          → [{ page, width, height, png, ms }]
 *   comparePdf(pdfPath, refPrefix, { dpi, update })        → { ok, updated, problem, pages: [{ page, ok, ratio, count, max, diff }] }
 *   node tools/pdfImage.mjs --self-test                    فحص الأداة نفسها (خروجٌ ٠ أو ١)
 *
 * المرجع `<refPrefix>-<رقم الصفحة>.png`. و`update: true` أو `DIWAN_PDF_REF=update` يكتبه بدل المقارنة ويقول ذلك — وتحديثه قصدٌ يُذكر
 * في الإيداع. وصورة الفرق عند السقوط في `reports/pdf-diff/` (خارج git): المختلف أحمر على الأصل باهتًا.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * فرق البكسل الذي يُعدّ اختلافًا: أكثر من ٣٢ من ٢٥٥. تنعيم حوافّ الحروف والخطوط بين رسمين يتحرّك دونه بدرجاتٍ قليلة،
 * وحبرٌ ظهر أو غاب أو تحرّك يقلب البكسل من أبيض إلى داكن (فرقٌ بالمئات).
 */
export const PIXEL_DIFF = 32;
/**
 * نسبة البكسلات المختلفة التي تُسقط الصفحة: أكثر من ٠٫٥٪ (صفحة A4 بدقّة ٥٠ نحو ٢٤٢ ألف بكسل، فالحدّ نحو ١٢٠٠ بكسل).
 * دونها غبار تنعيمٍ متفرّق لا يراه الموظف؛ وفوقها تغيّرٌ يُرى: سطرٌ انزاح، أو كتلةٌ تحرّكت، أو تخطيطٌ تغيّر.
 */
export const MAX_RATIO = 0.005;
/** الدقّة الأصل: رماديٌّ منخفض يكفي لرؤية التخطيط ويُبقي صور المرجع صغيرة (سقفها في D35). */
export const DPI = 50;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON = join(ROOT, 'node_modules/electron/dist/electron.exe');
const MAIN = join(ROOT, 'tools/pdfImage/main.mjs');
const DIFF_DIR = join(ROOT, 'reports/pdf-diff');

const fromDataUrl = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

/** يقلع Electron بمهمّةٍ واحدة ويعيد نتيجتها — أو يرمي برسالته. */
function render(pdfPath, { dpi = DPI, refs = [], probe = [] } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'diwan-pdfimg-'));
  const jobFile = join(work, 'job.json');
  writeFileSync(jobFile, JSON.stringify({ pdf: resolve(pdfPath), refs, dpi, threshold: PIXEL_DIFF, probe }));
  const env = { ...process.env, DIWAN_PDF_JOB: jobFile, DIWAN_PDF_PROFILE: join(work, 'profile') };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((done, reject) => {
    const child = spawn(ELECTRON, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      rmSync(work, { recursive: true, force: true });
      const line = Buffer.concat(out).toString('utf8').split('\n').filter((l) => l.startsWith('{')).at(-1);
      if (code === 0 && line) return done(JSON.parse(line));
      const why = Buffer.concat(err).toString('utf8').split('\n').find((l) => l.includes('pdfImage:'));
      reject(new Error(why?.trim() ?? `تعذّر الرسم (خروج ${code})`));
    });
  });
}

/** صفحات PDF صورًا رمادية بدقّة `dpi`: PNG لكلّ صفحة بمقاسها وزمن رسمها. */
export async function pdfToImages(pdfPath, { dpi = DPI, probe } = {}) {
  const { pages } = await render(pdfPath, { dpi, probe });
  return pages.map((p, i) => ({ page: i + 1, width: p.w, height: p.h, png: fromDataUrl(p.png), ms: p.ms, probe: p.probe }));
}

/** صور المرجع الموجودة لـ`refPrefix`، بأرقام صفحاتها. */
function existingRefs(refPrefix) {
  const dir = dirname(refPrefix);
  const name = basename(refPrefix);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.png$`).exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/**
 * يقارن صفحات PDF بصور المرجع: العدد والمقاسات أوّلًا (اختلافها سقوطٌ بأرقامه)، ثم كلّ صفحة — تنجح ونسبة المختلف ≤ `MAX_RATIO`.
 * و`update` (أو `DIWAN_PDF_REF=update`) يكتب المرجع بدل المقارنة. `diffDir` لصور الفرق (الأصل `reports/pdf-diff/`).
 */
export async function comparePdf(pdfPath, refPrefix, { dpi = DPI, update = process.env.DIWAN_PDF_REF === 'update', diffDir = DIFF_DIR } = {}) {
  const prefix = resolve(refPrefix);
  const have = existingRefs(prefix);
  const refPath = (n) => `${prefix}-${n}.png`;

  if (update) {
    const pages = await pdfToImages(pdfPath, { dpi });
    mkdirSync(dirname(prefix), { recursive: true });
    for (const p of pages) writeFileSync(refPath(p.page), p.png);
    // ما زاد من مراجع قديمة لا يُمحى هنا — يُقال فيُزال بقصد، وإلا سقطت المقارنة التالية بعدد الصفحات.
    const stale = have.filter((n) => n > pages.length);
    console.log(`↻ كُتب المرجع (DIWAN_PDF_REF=update): ${basename(prefix)}-1…${pages.length}.png بدقّة ${dpi}`);
    return {
      ok: stale.length === 0,
      updated: true,
      problem: stale.length ? `مراجع زائدة من تشغيلٍ أقدم: ${stale.map(refPath).join('، ')}` : null,
      pages: pages.map((p) => ({ page: p.page, width: p.width, height: p.height, ok: true, ratio: 0, count: 0, max: 0, diff: null }))
    };
  }

  if (!have.length) return { ok: false, updated: false, problem: `لا مرجع لـ${basename(prefix)} — اكتبه أوّلًا بـDIWAN_PDF_REF=update`, pages: [] };
  const { pages } = await render(pdfPath, { dpi, refs: have.map(refPath) });
  if (pages.length !== have.length || have.at(-1) !== have.length) {
    return { ok: false, updated: false, problem: `عدد الصفحات ${pages.length} والمرجع ${have.length} (${have.join('، ')})`, pages: [] };
  }
  const wrongSize = pages.map((p, i) => ({ ...p, page: i + 1 })).filter((p) => p.w !== p.diff?.refW || p.h !== p.diff?.refH);
  if (wrongSize.length) {
    const sizes = wrongSize.map((p) => `صفحة ${p.page}: ${p.w}×${p.h} والمرجع ${p.diff?.refW}×${p.diff?.refH}`).join(' · ');
    return { ok: false, updated: false, problem: `المقاس تغيّر — ${sizes}`, pages: [] };
  }

  const results = pages.map((p, i) => {
    const page = i + 1;
    const ok = p.diff.ratio <= MAX_RATIO;
    let diff = null;
    if (!ok) {
      mkdirSync(diffDir, { recursive: true });
      diff = join(diffDir, `${basename(prefix)}-${page}.diff.png`);
      writeFileSync(diff, fromDataUrl(p.diff.png));
    }
    return { page, width: p.w, height: p.h, ok, ratio: p.diff.ratio, count: p.diff.count, max: p.diff.max, diff };
  });
  return { ok: results.every((r) => r.ok), updated: false, problem: null, pages: results };
}

// ── فحص الأداة نفسها ─────────────────────────────────────────────────────

/** PDF من صفحة A4 فيها مستطيلٌ ملوّن ونصّ (كـ`posterPdf` في `designPdf`) — والمستطيل يُزاح `shiftMm` إلى اليمين. */
function posterPdf(shiftMm = 0) {
  const x = 60 + (shiftMm / 25.4) * 72;
  const content = `1 0 0 RG 0.95 0.6 0.2 rg ${x.toFixed(2)} 500 480 260 re f\n0 0 0 rg BT /F1 36 Tf 90 420 Td (POSTER) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox [0 0 595.28 841.89]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-pdfimg-test-'));
  const lines = [];
  const ok = (label, value) => lines.push(`${value ? '✓' : '✗'} ${label}`);
  try {
    const poster = join(dir, 'poster.pdf');
    const shifted = join(dir, 'poster-shifted.pdf');
    writeFileSync(poster, posterPdf());
    writeFileSync(shifted, posterPdf(10));
    const ref = join(dir, 'ref', 'poster');

    // وسط المستطيل (٣٠٠ نقطة من يسار الصفحة و٦٣٠ من أسفلها) وخارجه (هامشها الأيسر) — بالملّيمتر من أعلى اليسار.
    const started = Date.now();
    const [page] = await pdfToImages(poster, { probe: [{ x: 105.8, y: 74.7 }, { x: 10, y: 280 }] });
    const wall = Date.now() - started;
    ok(`A4 بدقّة ${DPI} صورةٌ ${page.width}×${page.height} (المنتظر ٤١٣×٥٨٥ ±١)`, Math.abs(page.width - 413) <= 1 && Math.abs(page.height - 585) <= 1);
    ok(`الرماديّ داخل المستطيل ${page.probe[0]} غير خارجه ${page.probe[1]}`, page.probe[0] != null && page.probe[1] === 255 && page.probe[0] < 230);
    ok(`زمن رسم الصفحة ${page.ms} م.ث (والنداء كلّه بإقلاع Electron ${wall} م.ث)`, page.ms > 0);

    const written = await comparePdf(poster, ref, { update: true });
    ok('update يكتب المرجع ويقول ذلك', written.updated && existsSync(`${ref}-1.png`));
    const same = await comparePdf(poster, ref, { update: false, diffDir: dir });
    ok(`الملف مع مرجعه: فرقه ${same.pages[0]?.count} بكسلًا`, same.ok && same.pages[0]?.count === 0);
    const moved = await comparePdf(shifted, ref, { update: false, diffDir: dir });
    const m = moved.pages[0];
    ok(`المستطيل مزاحًا ١٠ ملم يسقط: ${((m?.ratio ?? 0) * 100).toFixed(2)}٪ مختلف (${m?.count} بكسلًا، وأكبر فرق ${m?.max})`, !moved.ok && m?.ratio > MAX_RATIO);
    ok('وصورة فرقه مكتوبة', Boolean(m?.diff && existsSync(m.diff)));
    const none = await comparePdf(poster, join(dir, 'ref', 'missing'), { update: false });
    ok(`بلا مرجع: سقوطٌ يقول السبب («${none.problem}»)`, !none.ok && /لا مرجع/.test(none.problem ?? ''));
  } catch (e) {
    ok(`تعذّر الفحص: ${e?.message ?? e}`, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(lines.join('\n'));
  process.exit(lines.every((l) => l.startsWith('✓')) ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href && process.argv.includes('--self-test')) await selfTest();
