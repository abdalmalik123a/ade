/**
 * سيناريو: مقارنة صور PDF (G30) — خمسة أنواعٍ بمحتوى ثابت تُخرَج من طرقها في الواجهة، وتُقارن صفحاتها بصور المرجع في
 * `tests/fixtures/pdf-ref/` بـ`tools/pdfImage.mjs`: فتغييرٌ غير مقصود في الرسم (تخطيطٌ انزاح، مقاسٌ تغيّر، كتلةٌ غابت) يسقط.
 *
 * الأنواع: كتابٌ من صفحتين بجدولٍ ورأسه (كـ`pagedLetter`) · دفعة تصميمٍ من ستّة أسماء (كـ`designs`) · نسخ هويةٍ على A4 (كـ`idSheet`) ·
 * صورٌ شخصية على ١٠×١٥ (كـ`photos`) · ورقة أسئلةٍ بثلاثة أسئلة («احفظ نسخة PDF» في `PaperOutput`).
 * المحتوى ثابتٌ بين تشغيلين: أسماءٌ مختلَقة، ولا تاريخٌ ولا رقمٌ يتغيّر يُطبع.
 *
 * تحديث المراجع بقصدٍ يُذكر في الإيداع: `DIWAN_PDF_REF=update node tools/drive.mjs tools/scenarios/pdfCompare.mjs`.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePdf } from '../pdfImage.mjs';

const REF_DIR = fileURLToPath(new URL('../../tests/fixtures/pdf-ref/', import.meta.url));
const HEAD = 'مدرسة النور الابتدائية';
const NAMES = ['زينب علي حسن', 'سالم حسن', 'مريم جاسم', 'كريم سالم', 'هدى عمر', 'نور باسم'];
const PUPILS = NAMES.flatMap((n) => [`${n}`, `${n.split(' ')[0]} علي`]);
const FILLER = 'نرجو التفضّل بالاطّلاع على قائمة التلاميذ أدناه واتّخاذ ما يلزم بشأن توزيعهم على الصفوف للعام الدراسي القادم مع التقدير.';

/** كتابٌ بترويسته: فقرات، ثم جدولٌ بصفّ عناوين واثني عشر اسمًا، ثم فقراتٌ تمدّه إلى صفحةٍ ثانية. */
function bookDoc() {
  const p = (id, text) => ({ id, kind: 'paragraph', align: 'right', inlines: [{ kind: 'run', text }] });
  const cell = (id, text) => ({ id, blocks: [p(`${id}-p`, text)] });
  const rows = [['الاسم', 'الصفّ'], ...PUPILS.map((n, i) => [n, i % 2 ? 'السادس' : 'الخامس'])].map((r, i) => ({
    id: `r${i}`,
    cells: [cell(`r${i}a`, r[0]), cell(`r${i}b`, r[1])]
  }));
  return {
    id: 'مقارنة الكتاب',
    schemaVersion: 1,
    kind: 'flow',
    issuing: 'registered',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      letterheadMode: 'print',
      repeatLetterhead: true,
      pageNumbers: true,
      numerals: 'arabic'
    },
    blocks: [
      p('a', 'إلى / مديرية التربية — قسم التعليم الابتدائي'),
      p('b', 'م / قائمة التلاميذ'),
      p('c', FILLER),
      { id: 't', kind: 'table', columns: [2, 1], header: true, rows },
      ...Array.from({ length: 14 }, (_, i) => p(`z${i}`, FILLER))
    ],
    fields: [],
    meta: {}
  };
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-pdfcompare-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  // صورة الزبون تُرسم في الصفحة قبل فتحها (فلا يُكرَّر صانع PNG هنا) — المسار وحده يُعطى الآن.
  const env = { DIWAN_TEST_OPEN_FILE: join(dir, 'customer.png'), DIWAN_TEST_SAVE_DIR: join(dir, 'save') };
  Object.assign(process.env, env); // ليقرأه السيناريو نفسه أيضًا
  return env;
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  /** الزرّ الظاهر من بين ما يطابق المحدِّد — الشاشات المخفيّة تبقى مركّبة. */
  const clickShown = (sel) =>
    page.eval(`const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => b.offsetParent); el?.click(); return Boolean(el);`);
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  const work = join(saveDir, '..');

  /** ينتظر PDF كُتب بعد `since` ويحفظ نسخته باسم نوعه — فلا يكتب فوقه حفظٌ لاحقٌ بالاسم نفسه. */
  const savedPdf = async (since, kind) => {
    for (let i = 0; i < 40; i++) {
      await wait(300);
      const f = readdirSync(saveDir).find((n) => n.toLowerCase().endsWith('.pdf') && statSync(join(saveDir, n)).mtimeMs >= since);
      if (f) {
        await wait(500); // يكتمل الملف
        const copy = join(work, `${kind}.pdf`);
        copyFileSync(join(saveDir, f), copy);
        return copy;
      }
    }
    return null;
  };
  const files = {};

  // ── (أ) كتابٌ من صفحتين: ترويسةٌ ونموذجٌ بالجسر، والإصدار بالمحرّر، والحفظ من الأرشيف ──
  await page.eval(`
    const lh = await window.diwan.letterheads.save({ id: null, name: ${JSON.stringify(HEAD)}, authorityId: null, category: null,
      layout: { sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: ${JSON.stringify(HEAD)}, align: 'center', size: 14, bold: true }] }] } });
    await window.diwan.templates.save({ id: null, code: null, title: 'مقارنة الكتاب', subtitle: null, category: 'اختبار', subjectLine: null,
      letterheadId: lh.id, bodyHtml: '<p>قائمة</p>', variables: [], doc: ${JSON.stringify(bookDoc())} });
    return true;
  `);
  await page.goto('templates-library-drafts');
  await wait(900);
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('فتح في المحرر'));
    btn?.click();
    return Boolean(btn);
  `);
  await wait(1500);
  await page.type('[data-editor-owner]', 'زينب علي حسن');
  await wait(300);
  await click('[data-act="issue"]');
  await wait(700);
  await page.clickText('احفظ بلا طباعة');
  await wait(3000);
  ok('الكتاب: صدر بلا طباعة', (await page.text()).includes('صدر الكتاب'));
  await page.clickExact('تم');
  await wait(500);
  await page.goto('transactions-archive-ledger');
  await wait(900);
  let since = Date.now();
  await page.clickText('حفظ نسخة PDF');
  files.book = await savedPdf(since, 'book');

  // ── (ج) نسخ الهوية على A4: مواطنٌ بمستمسكاته الأربعة بالجسر، والورقة من ملفّه ──
  await page.eval(`
    const shot = (color, label) => { const c = document.createElement('canvas'); c.width = 428; c.height = 270;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 428, 270);
      g.fillStyle = '#fff'; g.fillRect(24, 24, 120, 150); g.fillStyle = '#000'; g.font = 'bold 40px Arial'; g.fillText(label, 180, 120);
      return c.toDataURL('image/png'); };
    const c = await window.diwan.citizens.save({ id: null, fullName: 'سالم حسن الربيعي', verified: false });
    for (const [type, color, label] of [['البطاقة الوطنية الموحدة — الوجه', '#c33', 'ID-1'], ['البطاقة الوطنية الموحدة — الظهر', '#3c3', 'ID-2'],
        ['بطاقة السكن — الوجه', '#33c', 'RS-1'], ['بطاقة السكن — الظهر', '#cc3', 'RS-2']])
      await window.diwan.attachments.addFromDataUrl(c.id, type, shot(color, label));
    return true;
  `);
  await page.goto('citizens-identity-records');
  await wait(600);
  await page.eval(`document.querySelector('[data-global-search]').focus(); return true;`);
  await page.type('[data-global-search]', 'الربيعي');
  await wait(900);
  await click('[data-search-results] [data-search-citizen]');
  await wait(1200);
  await click('[data-act="citizen-id-sheet"]');
  await wait(1200);
  ok('نسخ الهوية: الخانات الأربع ممتلئة', await page.eval(`return [...document.querySelectorAll('[data-id-sheet] [data-doc]')].filter((s) => s.querySelector('img')).length === 4;`));
  since = Date.now();
  await click('[data-act="sheet-pdf"]');
  files.idsheet = await savedPdf(since, 'idsheet');
  await click('[data-act="id-sheet-close"]');
  await wait(300);

  // ── (ب) دفعة تصميمٍ من ستّة أسماء: الهوية من المعرض، والقائمة، ثم «راجع الأوراق» ← PDF ──
  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="student-id"]');
  await wait(900);
  await page.eval(`document.querySelector('[data-design-panel="fill"]')?.click(); return true;`);
  await wait(200);
  await page.type('textarea[data-batch-text]', ['الاسم\tالصف\tالرقم', ...NAMES.map((n, i) => `${n}\tالخامس\t2026-${String(i + 1).padStart(4, '0')}`)].join('\n'));
  await wait(600);
  ok('التصميم: الدفعة ستّة أسماء', (await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`)).includes('٦'));
  await click('button[data-act="sheets"]');
  await wait(1500);
  since = Date.now();
  await clickShown('[data-sheets] button[data-act="pdf"]');
  files.design = await savedPdf(since, 'design');
  await page.key('Escape');
  await wait(400);

  // ── (هـ) صورٌ شخصية على ١٠×١٥: رأسٌ وكتفان داكنان على خلفيةٍ فاتحة، ٣٫٥×٤٫٥ ──
  const portrait = await page.eval(`
    const c = document.createElement('canvas'); c.width = 600; c.height = 800;
    const g = c.getContext('2d'); g.fillStyle = 'rgb(220,220,240)'; g.fillRect(0, 0, 600, 800);
    g.fillStyle = 'rgb(60,60,80)'; g.beginPath(); g.arc(300, 304, 108, 0, Math.PI * 2); g.fill(); g.fillRect(90, 496, 420, 304);
    return c.toDataURL('image/png');
  `);
  writeFileSync(process.env.DIWAN_TEST_OPEN_FILE, Buffer.from(portrait.split(',')[1], 'base64'));
  await page.goto('passport-photos');
  await wait(700);
  await click('[data-act="open-photo"]');
  // الخلفية تُزال آليًّا بعد الفتح ثم يُقصّ على الرأس: يُنتظر انتهاؤها لا مهلةٌ — وإلا رُسمت الورقة قبلها مرّةً وبعدها مرّة.
  let cutout = '';
  for (let i = 0; i < 100 && cutout !== 'done'; i++) {
    await wait(300);
    cutout = await page.eval(`return document.querySelector('[data-photo-frame]')?.dataset.cutout ?? '';`);
  }
  ok('الصور الشخصية: أُزيلت الخلفية قبل المراجعة', cutout === 'done');
  await click('[data-size-key="35x45"]');
  await click('[data-paper="photo"]');
  await wait(300);
  await click('[data-act="review-photos"]');
  await wait(1200);
  ok('الصور الشخصية: ستٌّ على ورقة', await page.eval(`return document.querySelectorAll('[data-sheets] .print-page img').length === 6;`));
  since = Date.now();
  await click('[data-sheets] [data-act="pdf"]');
  files.photos = await savedPdf(since, 'photos');
  await page.key('Escape');
  await wait(400);

  // ── (د) ورقة أسئلة بثلاثة أسئلة: الرأس كلّه بقيمٍ ثابتة (والتاريخ منها) ──
  await page.goto('exam-papers');
  await wait(800);
  for (const [key, value] of [['المحافظة', 'بغداد / الرصافة الأولى'], ['القضاء', 'الأعظمية'], ['المدرسة', 'مدرسة النور الابتدائية'], ['المادة', 'الرياضيات'],
    ['الصف', 'الخامس الابتدائي'], ['الزمن', 'ساعة واحدة'], ['التاريخ', '2026/1/12'], ['نوع الامتحان', 'نصف السنة'], ['العام الدراسي', '2025 - 2026']]) {
    await page.type(`input[data-head="${key}"]`, value);
  }
  const fill = (sel, proto, n, value) =>
    page.eval(`
      const el = [...document.querySelectorAll(${JSON.stringify(sel)})][${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
  const questions = [['عرّف العدد الأولي.', 30], ['حلّ ما يأتي: ٢٤ ÷ ٦ =', 30], ['اكتب جدول ضرب العدد سبعة.', 40]];
  for (let i = 0; i < questions.length; i++) {
    if (i > 0) {
      await page.clickText('أضف سؤالًا');
      await wait(400);
    }
    await fill('textarea[data-question-text]', 'HTMLTextAreaElement', i, questions[i][0]);
    await fill('input[title="درجة السؤال"]', 'HTMLInputElement', i, questions[i][1]);
    await wait(250);
  }
  await wait(500);
  ok('ورقة الأسئلة: ثلاثة أسئلة ومجموعها ١٠٠', (await page.text()).includes('المجموع 100') && (await page.eval(`return document.querySelector('[data-paper]')?.innerText ?? '';`)).includes('س3:'));
  since = Date.now();
  await clickShown('button[data-act="pdf"][title="احفظ نسخة PDF"]');
  files.paper = await savedPdf(since, 'paper');

  // ── المقارنة بصور المرجع ──
  for (const kind of ['book', 'design', 'idsheet', 'paper', 'photos']) {
    const file = files[kind];
    ok(`${kind}: حُفظ PDF`, Boolean(file));
    if (!file) continue;
    const r = await comparePdf(file, join(REF_DIR, kind), { dpi: 50 });
    if (r.updated) ok(`${kind}: كُتب المرجع (${r.pages.length} صفحة، ${r.pages.map((p) => `${p.width}×${p.height}`).join(' ')})${r.problem ? ` — ${r.problem}` : ''}`, r.ok);
    else if (r.problem) ok(`${kind}: ${r.problem}`, false);
    else
      for (const p of r.pages)
        ok(`${kind} صفحة ${p.page}: ${(p.ratio * 100).toFixed(3)}٪ مختلف (${p.count} بكسلًا، وأكبر فرق ${p.max})${p.diff ? ` — الفرق: ${p.diff}` : ''}`, p.ok);
  }
  return steps.join('\n');
}
