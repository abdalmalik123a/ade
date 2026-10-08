/**
 * سيناريو: «اترك بلا حفظ؟» (مراجعة ٧ ت١، ج٣) — وما تحرسه مسودّةٌ أو معلّقة لا يُسأل عنه.
 *
 * الترويسة، وأوراق الأسئلة، وملف PDF، ومصمّم النماذج: عملٌ لا مسودّة له، فالانتقال في الشريط، و«ورقة جديدة»، و«ترويسة
 * جديدة»، و× و«إلغاء»، وإغلاق البرنامج — كلّها تسأل: ابقَ · اترك بلا حفظ · احفظ ثم اترك. والمحرّر (مسودّةٌ تلقائية) والشبّاك
 * (يُعلَّق عند الإغلاق) لا يسألان: ما كُتب فيهما محفوظ. وتبديل النموذج في المحرّر فوق كتابٍ مكتوبٍ يسأل.
 * وآخر ما يُجرَّب إغلاق البرنامج بالترويسة غير محفوظة: «ابقَ» ثم «أغلق».
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const ROOT = join(process.env.TEMP ?? '.', `diwan-leave-${Date.now()}`);
const A = join(ROOT, 'أ.pdf');
const B = join(ROOT, 'ب.pdf');

export async function prepare() {
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  for (const [file, label] of [[A, 'A'], [B, 'B']]) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([595.28, 841.89]).drawText(`FILE ${label} PAGE 1`, { x: 40, y: 790, size: 20, font });
    doc.addPage([595.28, 841.89]).drawText(`FILE ${label} PAGE 2`, { x: 40, y: 790, size: 20, font });
    writeFileSync(file, await doc.save());
  }
  return {
    DIWAN_TEST_OPEN_FILES: [A, B].join('|'),
    DIWAN_TEST_SAVE_DIR: join(ROOT, 'out'),
    // إغلاق البرنامج بعمل غير محفوظ: أوّل سؤالٍ «ابقَ»، وما بعده «أغلق».
    DIWAN_TEST_CLOSE_ANSWER: 'stay,leave'
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = (title) => `
  const run = (text) => ({ kind: 'run', text });
  await window.diwan.templates.save({
    id: null, code: null, title: ${JSON.stringify(title)}, subtitle: null, category: null, subjectLine: null,
    letterheadId: null, bodyHtml: 'نؤيد أن الطالب مستمر بالدوام.', variables: [],
    doc: {
      id: 'leave-' + ${JSON.stringify(title)}, schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [run('نؤيد أن الطالب مستمر بالدوام.')] }],
      fields: [], meta: {}
    }
  });
  return true;
`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  const dialog = () =>
    page.eval(`
      const d = document.querySelector('[data-confirm]');
      return d ? { title: d.querySelector('[data-confirm-title]')?.innerText ?? '', choices: [...d.querySelectorAll('[data-choice]')].map((b) => b.dataset.choice) } : null;
    `);
  const choose = async (key) => {
    await page.eval(`document.querySelector('[data-confirm] [data-choice="${key}"]')?.click(); return true;`);
    await wait(700);
  };
  const click = async (selector, ms = 500) => {
    const found = await page.eval(`const el = document.querySelector(${JSON.stringify(selector)}); el?.click(); return Boolean(el);`);
    await wait(ms);
    return found;
  };
  const has = (text) => page.text().then((t) => t.includes(text));
  /** يضع قيمةً في عنصر React (حقلٌ أو مربّع نصّ أو قائمة). */
  const setValue = (selector, value, tag = 'Input') =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTML${tag}Element.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(${JSON.stringify(tag === 'Select' ? 'change' : 'input')}, { bubbles: true }));
      return true;
    `);

  // ── ١) الترويسة ───────────────────────────────────────────────────────
  const dirtyLetterhead = async (name, second = 'وزارة التربية') => {
    await setValue('textarea[placeholder^="جمهورية العراق"]', `جمهورية العراق\n${second}`, 'TextArea');
    await setValue('input[placeholder^="مثال: مديرية"]', name);
    await wait(300);
  };
  const letterheads = () => page.eval(`return (await window.diwan.letterheads.list()).map((l) => l.name);`);

  await page.goto('header-seal-configuration');
  await wait(900);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  ok('ترويسةٌ لم تُمسّ: الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));

  await page.goto('header-seal-configuration');
  await wait(900);
  await dirtyLetterhead('ترويسة المغادرة');
  ok('عُدِّلت فظهرت «غير محفوظة»', await has('غير محفوظة'));
  await page.goto('transactions-archive-ledger');
  await wait(600);
  let q = await dialog();
  ok(`الانتقال بتعديلٍ لم يُحفظ يسأل: ابقَ · اترك · احفظ (${q?.title})`, Boolean(q) && q.title.includes('الترويسة') && q.choices.join() === 'stay,discard,save');
  await choose('stay');
  ok('«ابقَ» تُبقيه على الترويسة وتعديله باقٍ', (await has('مصمّم الترويسات')) && (await has('غير محفوظة')) && !(await has('الأرشيف والبحث')));

  await page.goto('transactions-archive-ledger');
  await wait(600);
  await choose('discard');
  ok('«اترك بلا حفظ» تنتقل — ولم يُحفظ شيء', (await has('الأرشيف والبحث')) && (await letterheads()).length === 0);

  await page.goto('header-seal-configuration');
  await wait(900);
  ok('وتعود الترويسة نظيفةً بلا التعديل الضائع', !(await has('غير محفوظة')));
  await dirtyLetterhead('ترويسة المغادرة');
  await page.goto('transactions-archive-ledger');
  await wait(600);
  await choose('save');
  ok('«احفظ ثم اترك» تحفظ وتنتقل', (await has('الأرشيف والبحث')) && (await letterheads()).join() === 'ترويسة المغادرة');

  // داخل الشاشة نفسها: ترويسةٌ أخرى، وترويسةٌ جديدة
  await page.goto('header-seal-configuration');
  await wait(900);
  await dirtyLetterhead('ترويسة المغادرة', 'وزارة التعليم العالي');
  await page.clickText('ترويسة جديدة');
  await wait(500);
  q = await dialog();
  ok('«+ ترويسة جديدة» بتعديلٍ لم يُحفظ تسأل', Boolean(q) && q.title.includes('الترويسة'));
  await choose('stay');
  ok('و«ابقَ» تُبقي التعديل', await has('غير محفوظة'));
  await page.clickText('ترويسة جديدة');
  await wait(500);
  await choose('discard');
  ok('و«اترك بلا حفظ» تفتح ترويسةً جديدة نظيفة', !(await has('غير محفوظة')));

  // ── ٢) المحرّر والشبّاك: محفوظان بمسودّتهما ومعلّقتهما — فلا سؤال ──────
  await page.eval(SEED('نموذج أ'));
  await page.eval(SEED('نموذج ب'));
  await page.goto('smart-editor-a4-preview');
  await wait(900);
  await page.type('[data-editor-owner]', 'كتابٌ في المحرّر');
  await wait(500);
  await page.goto('transactions-archive-ledger');
  await wait(800);
  ok('المحرّر بكتابٍ مكتوب: الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));
  ok('لأنّ مسودّته حُفظت', (await page.eval(`return (await window.diwan.drafts.list()).length;`)) === 1);

  // ── ٣) تبديل النموذج في المحرّر فوق كتابٍ مكتوب ─────────────────────────
  await page.goto('smart-editor-a4-preview');
  await wait(900);
  const templates = await page.eval(`return (await window.diwan.templates.list()).map((t) => ({ id: t.id, title: t.title }));`);
  const tpl = (title) => templates.find((t) => t.title === title)?.id;
  // ورقةٌ لم يُكتب عليها شيء: التبديل بلا سؤال
  await page.goto('transactions-archive-ledger');
  await wait(500);
  await page.eval(`const d = await window.diwan.drafts.list(); for (const x of d) await window.diwan.drafts.delete(x.id); return true;`);
  await page.goto('smart-editor-a4-preview');
  await wait(900);
  await setValue('[data-editor-template]', String(tpl('نموذج أ')), 'Select');
  await wait(900);
  ok('ورقةٌ لم يُكتب عليها شيء: تبديل النموذج بلا سؤال', (await dialog()) === null && (await has('فُتح النموذج «نموذج أ»')));
  // كُتب عليها: يسأل
  await page.type('[data-editor-owner]', 'كريم الاختبار');
  await wait(400);
  await setValue('[data-editor-template]', String(tpl('نموذج ب')), 'Select');
  await wait(600);
  q = await dialog();
  ok(`وإن كُتب عليها شيءٌ تسأل (${q?.title})`, Boolean(q) && q.title.includes('استبدال'));
  await choose('no');
  ok('«ألغِ» تُبقي الكتاب والنموذج', (await page.eval(`return document.querySelector('[data-editor-owner]')?.value ?? '';`)) === 'كريم الاختبار' && (await page.eval(`return document.querySelector('[data-editor-template]')?.value ?? '';`)) === String(tpl('نموذج أ')));
  await setValue('[data-editor-template]', String(tpl('نموذج ب')), 'Select');
  await wait(600);
  await choose('yes');
  await wait(900);
  ok('و«استبدله» يفتح النموذج الآخر', await has('فُتح النموذج «نموذج ب»'));

  // الشبّاك: معاملةٌ في وسطها والانتقال بلا سؤال، وتعود كما تُركت
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('نموذج أ', '[data-template-card]');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1000);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  ok('الشبّاك بمعاملةٍ في وسطها: الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));
  await page.goto('service-counter');
  await wait(800);
  ok('وتعود المعاملة كما تُركت', await page.eval(`return Boolean(document.querySelector('[data-screen="service"] [data-act="discard"]'));`));
  await click('[data-screen="service"] [data-act="discard"]', 600);

  // ── ٤) أوراق الأسئلة ──────────────────────────────────────────────────
  await page.goto('exam-papers');
  await wait(900);
  await setValue('textarea[data-question-text]', 'عرّف ما يأتي:', 'TextArea');
  await wait(400);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  q = await dialog();
  ok(`الأسئلة بسؤالٍ مكتوب: الانتقال يسأل (${q?.title})`, Boolean(q) && q.title.includes('أوراق الأسئلة') && q.choices.join() === 'stay,discard,save');
  await choose('stay');
  ok('«ابقَ» تُبقي السؤال المكتوب', (await page.eval(`return document.querySelector('textarea[data-question-text]')?.value ?? '';`)) === 'عرّف ما يأتي:');
  await page.clickText('ورقة جديدة');
  await wait(500);
  q = await dialog();
  ok('و«ورقة جديدة» تسأل', Boolean(q) && q.title.includes('أوراق الأسئلة'));
  await choose('discard');
  ok('و«اترك بلا حفظ» تبدأ ورقةً نظيفة', (await page.eval(`return document.querySelector('textarea[data-question-text]')?.value ?? 'غائب';`)) === '');
  await setValue('textarea[data-question-text]', 'حلّ ما يأتي:', 'TextArea');
  await wait(300);
  await click('button[data-act="save"]', 1500);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  ok('وبعد حفظ الورقة الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));
  await page.goto('exam-papers');
  await wait(900);
  await click('button[title="احذف الورقة"]', 400);
  await choose('yes');
  await page.clickText('ورقة جديدة');
  await wait(400);

  // ── ٥) مصمّم النماذج ──────────────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(900);
  await page.clickText('ورقة فارغة', '[data-act$="new-blank"]');
  await wait(600);
  ok('انفتح المصمّم', await has('مصمّم النماذج والمُعاملات'));
  await page.clickText('إلغاء');
  await wait(500);
  ok('مصمّمٌ لم يُمسّ: «إلغاء» تغلقه بلا سؤال', (await dialog()) === null && !(await has('مصمّم النماذج والمُعاملات')));
  await page.clickText('ورقة فارغة', '[data-act$="new-blank"]');
  await wait(600);
  await page.type('input[placeholder^="مثال: تأييد"]', 'نموذج لم يُحفظ');
  await wait(300);
  await page.clickText('إلغاء');
  await wait(500);
  q = await dialog();
  ok(`وبعنوانٍ كُتب: «إلغاء» تسأل (${q?.title})`, Boolean(q) && q.title.includes('مصمّم النماذج'));
  await choose('stay');
  ok('«ابقَ» تُبقيه مفتوحًا', await has('مصمّم النماذج والمُعاملات'));
  await click('button[title="إغلاق"]', 500);
  ok('و× تسأل أيضًا', Boolean(await dialog()));
  await choose('discard');
  ok('و«اترك بلا حفظ» تغلقه', !(await has('مصمّم النماذج والمُعاملات')));

  // ── ٦) ملف PDF ───────────────────────────────────────────────────────
  const openBoth = async () => {
    await click('[data-act="pdf-open"]', 500);
    let n = 0;
    for (let i = 0; i < 40 && n < 4; i++) {
      await wait(300);
      n = await page.eval(`return [...document.querySelectorAll('[data-pdf-page] img')].length;`);
    }
    return n;
  };
  await page.goto('pdf-tools');
  await wait(700);
  const thumbs = await openBoth();
  ok(`ملفّان فُتحا معًا (${thumbs} صفحات)`, thumbs === 4);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  ok('فُتحا ولم يُمسّا: الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));
  // الشاشة تُفكّ بالانتقال فتبدأ الجلسة فارغة: يُعاد فتح الملفّين.
  await page.goto('pdf-tools');
  await wait(700);
  await openBoth();
  await page.eval(`document.querySelector('[data-pdf-check="2"]')?.click(); return true;`);
  await wait(200);
  await click('[data-act="pdf-delete"]', 500);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  q = await dialog();
  ok(`وبصفحةٍ حُذفت يسأل (${q?.title})`, Boolean(q) && q.title.includes('ملف PDF') && q.choices.join() === 'stay,discard,save');
  await choose('stay');
  ok('«ابقَ» تُبقي الجلسة', (await page.eval(`return document.querySelectorAll('[data-pdf-page]').length;`)) === 3);
  await click('[data-act="pdf-save"]', 2000);
  await page.goto('transactions-archive-ledger');
  await wait(600);
  ok('وبعد الحفظ الانتقال بلا سؤال', (await dialog()) === null && (await has('الأرشيف والبحث')));
  await page.goto('pdf-tools');
  await wait(700);
  await openBoth();
  await page.eval(`document.querySelector('[data-pdf-check="1"]')?.click(); return true;`);
  await wait(200);
  await click('[data-act="pdf-delete"]', 500);
  await click('[data-act="pdf-reset"]', 500);
  q = await dialog();
  ok('و«أغلق الملف وابدأ من جديد» بعد تعديلٍ يسأل', Boolean(q) && q.title.includes('ملف PDF'));
  await choose('discard');
  ok('وتبدأ الجلسة نظيفة', await page.eval(`return Boolean(document.querySelector('[data-pdf-empty]'));`));

  // ── ٧) إغلاق البرنامج بعملٍ غير محفوظ: «ابقَ» ثم «أغلق» ──────────────────
  await page.goto('header-seal-configuration');
  await wait(900);
  await dirtyLetterhead('ترويسة الإغلاق');
  await page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50); 1' });
  await wait(2500);
  const alive = await Promise.race([page.eval(`return document.body.innerText.includes('غير محفوظة');`).catch(() => null), wait(3000).then(() => null)]);
  ok('إغلاق البرنامج بترويسةٍ غير محفوظة يسأل: جواب «ابقَ» يُبقيه مفتوحًا وعملُه باقٍ', alive === true);
  await page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50); 1' });
  await wait(7000);
  const gone = await Promise.race([page.eval(`return 1;`).then(() => false, () => true), wait(3000).then(() => true)]);
  ok('وجواب «أغلق» يُغلقه', gone === true);
  return steps.join('\n');
}
