/**
 * سيناريو: صفحات PDF ورقة الأسئلة (D132) — كلّ ورقةٍ صفحةٌ مستقلّة، بلا تراكبٍ ولا صفحاتٍ بيضاء.
 *
 * كانت أنماط التطبيق عند الطباعة تجعل كلّ ‎.print-sheet‎ ‎position:absolute; inset:0‎، فتتراكب الأوراق في الصفحة الأولى:
 * ورقةٌ بوجهين ← PDF صفحةٌ واحدة هي الوجه الثاني، والنموذجان ← «ب» وحده (أو صفحاتٌ بيضاء بعدد النسخ).
 * والـPDF هنا حقيقيّ من زرّ «PDF»، يُعدّ بـpdf-lib (كـ`pdfChunks`) وتُرسم صفحاته بـ`tools/pdfImage.mjs`:
 * (أ) ورقةٌ بوجهين قسرًا بسؤالين ← صفحتان، لا بيضاء، ومختلفتان ·
 * (ب) النموذجان بنسختين ← صفحتان «أ» و«ب» مختلفتان (وبثلاث نسخ صفحتان أيضًا: PDF النموذجين لا بعدد النسخ) ·
 * (ج) ورقةٌ بوجهٍ واحد ← صفحةٌ واحدة.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { pdfToImages } from '../pdfImage.mjs';

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** حجم محتوى الصفحة: مجرى واحد أو مصفوفة مجارٍ. */
function contentSize(doc, c) {
  if (!c) return 0;
  if (typeof c.getContentsSize === 'function') return c.getContentsSize();
  if (typeof c.asArray === 'function') return c.asArray().reduce((n, ref) => n + contentSize(doc, doc.context.lookup(ref)), 0);
  return 0;
}

async function inspectPdf(filePath) {
  const doc = await PDFDocument.load(readFileSync(filePath));
  const sizes = doc.getPages().map((p) => contentSize(doc, p.node.Contents()));
  const med = median(sizes);
  return { count: doc.getPageCount(), sizes, hasBlank: Math.min(...sizes) < 0.5 * med };
}

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  const work = join(saveDir, '..');

  const setValue = async (selector, n, value) => {
    const done = await page.eval(`
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})][${n}];
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return done;
  };
  const checkbox = async (act, on) => {
    await page.eval(`const el = document.querySelector('input[data-act="${act}"]'); if (el && el.checked !== ${on}) el.click(); return el?.checked;`);
    await wait(500);
  };

  /** يضغط «PDF» ويعيد نسخةً من الملف الذي حُفظ بعد الضغط. */
  const pdf = async (kind) => {
    const since = Date.now();
    await page.eval(`const el = [...document.querySelectorAll('button[data-act="pdf"]')].find((b) => b.offsetParent); el?.click(); return Boolean(el);`);
    for (let i = 0; i < 60; i++) {
      await wait(500);
      const f = readdirSync(saveDir).find((n) => n.toLowerCase().endsWith('.pdf') && statSync(join(saveDir, n)).mtimeMs >= since);
      if (f) {
        await wait(800);
        const copy = join(work, `${kind}.pdf`);
        copyFileSync(join(saveDir, f), copy);
        return copy;
      }
    }
    return null;
  };

  /** صفحات PDF صورًا: بصمة كلّ صفحة، وتُحفظ في مجلّد اللقطات إن أُعطي (لتُرى). */
  const fingerprints = async (file, kind) => {
    const images = await pdfToImages(file);
    if (shotsDir) for (const im of images) writeFileSync(join(shotsDir, `exam-print-${kind}-${im.page}.png`), im.png);
    return images.map((im) => createHash('sha1').update(im.png).digest('hex'));
  };

  await page.goto('exam-papers');
  await wait(800);
  await setValue('input[data-head="المدرسة"]', 0, 'مدرسة النور');
  await setValue('input[data-head="المادة"]', 0, 'الفيزياء');
  await setValue('input[data-head="الصف"]', 0, 'السادس العلمي');
  await setValue('input[data-head="نوع الامتحان"]', 0, 'النهائي');

  // (أ) ورقةٌ بوجهين قسرًا بسؤالين
  await checkbox('duplex', true);
  await page.clickText('أضف سؤالًا');
  await wait(400);
  await setValue('input[title="درجة السؤال"]', 0, 50);
  await setValue('textarea[data-question-text]', 0, 'السؤال الأول: اشرح ظاهرة الحث الكهرومغناطيسي، واذكر قانون فاراداي.');
  await setValue('input[title="درجة السؤال"]', 1, 50);
  await setValue('textarea[data-question-text]', 1, 'السؤال الثاني: ما تطبيقات الخلايا الكهروضوئية؟ اذكر ثلاثًا منها.');
  await wait(600);
  const faces = await page.eval(`return document.querySelectorAll('[data-sheet-page]').length;`);
  ok(`(أ) المعاينة وجهان (${faces})`, faces === 2);

  const duplexPdf = await pdf('duplex');
  ok('(أ) حُفظ PDF الورقة بوجهين', Boolean(duplexPdf));
  if (duplexPdf) {
    const info = await inspectPdf(duplexPdf);
    ok(`(أ) PDF الوجهين صفحتان (${info.count})`, info.count === 2);
    ok(`(أ) لا صفحة بيضاء — محتوى كلّ صفحة ≥ نصف الوسيط (${info.sizes.join('، ')})`, !info.hasBlank);
    const prints = await fingerprints(duplexPdf, 'duplex');
    ok('(أ) الصفحتان مختلفتان (بصمة الصورة)', prints.length === 2 && prints[0] !== prints[1]);
  }

  // (ب) النموذجان بنسختين — بوجهٍ واحد
  await checkbox('duplex', false);
  await checkbox('versions', true);
  await setValue('input[title="عدد النسخ"]', 0, 2);
  const versionsPdf = await pdf('versions');
  ok('(ب) حُفظ PDF النموذجين', Boolean(versionsPdf));
  if (versionsPdf) {
    const info = await inspectPdf(versionsPdf);
    ok(`(ب) PDF النموذجين بنسختين صفحتان «أ» و«ب» (${info.count})`, info.count === 2);
    ok(`(ب) لا صفحة بيضاء (${info.sizes.join('، ')})`, !info.hasBlank);
    const prints = await fingerprints(versionsPdf, 'versions');
    ok('(ب) صفحتا «أ» و«ب» مختلفتان (بصمة الصورة)', prints.length === 2 && prints[0] !== prints[1]);
  }
  await setValue('input[title="عدد النسخ"]', 0, 3);
  const threePdf = await pdf('versions-3');
  if (threePdf) {
    const info = await inspectPdf(threePdf);
    ok(`(ب) وبثلاث نسخ صفحتان أيضًا — PDF النموذجين لا بعدد النسخ (${info.count})`, info.count === 2);
  } else ok('(ب) حُفظ PDF النموذجين بثلاث نسخ', false);

  // (ج) ورقةٌ بوجهٍ واحد
  await checkbox('versions', false);
  const singlePdf = await pdf('single');
  ok('(ج) حُفظ PDF الورقة بوجهٍ واحد', Boolean(singlePdf));
  if (singlePdf) {
    const info = await inspectPdf(singlePdf);
    ok(`(ج) PDF الوجه الواحد صفحةٌ واحدة (${info.count})`, info.count === 1);
  }

  return steps.join('\n');
}
