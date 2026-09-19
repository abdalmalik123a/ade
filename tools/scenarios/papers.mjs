/**
 * سيناريو: الأسئلة — قسمٌ قائمٌ بذاته.
 *
 * يفتح «الأسئلة» من الشريط، ويملأ متغيّرات الرأس الثابت، ثم يؤلّف على الترتيب
 * الذي طلبه المدرّس: سؤالٌ فدرجةٌ فنصٌّ ففرعٌ فسؤالٌ ثانٍ. ثم يتفقّد المعاينة
 * والمجموع وورقة المصحّح، ويحفظ — ويفتّش في القاعدة: الورقة `print-only`،
 * ومكتبة الكتب لم ترها.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** يكتب في خانةٍ من خانات الرأس الثابت. */
  const head = (key, value) => page.type(`input[data-head="${key}"]`, value);

  /** يكتب نصّ السؤال أو الفرع رقم `n` (بترتيب ظهورها على الشاشة). */
  const question = async (n, text) => {
    const ok = await page.eval(`
      const boxes = [...document.querySelectorAll('textarea[data-question-text]')];
      const el = boxes[${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return ok;
  };

  /** يكتب درجة السؤال رقم `n`. */
  const score = async (n, value) => {
    const ok = await page.eval(`
      const boxes = [...document.querySelectorAll('input[title="درجة السؤال"]')];
      const el = boxes[${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return ok;
  };

  /** يضغط «أضف فرعًا» تحت السؤال رقم `n`. */
  const branch = async (n) => {
    const ok = await page.eval(`
      const els = [...document.querySelectorAll('button[title="أضف فرعًا"]')];
      const el = els[${n}];
      if (!el) return false;
      el.click();
      return true;
    `);
    await wait(350);
    return ok;
  };

  const paper = () => page.eval(`return document.querySelector('[data-paper]')?.innerText ?? '';`);

  // ── الشاشة قائمةٌ بذاتها ───────────────────────────────────────────
  await page.goto('exam-papers');
  await wait(700);

  let text = await page.text();
  ok('للأسئلة شاشةٌ في الشريط', text.includes('الأسئلة — أوراق الامتحانات'));
  ok('ورقةٌ تُطبع ولا تُقيَّد', text.includes('لا رقم صادر ولا بصمة'));
  ok('والرأس ثابتٌ لا يُحرَّر', text.includes('الرأس ثابت'));

  // ولا محرّرَ كتلٍ ولا قائمةَ «/» ولا كليشة — فهذا ليس كتابًا.
  const noBlocks = await page.eval(`
    return document.querySelectorAll('[contenteditable="true"]').length === 0;
  `);
  ok('ولا محرّرَ كتلٍ فيها', noBlocks);
  ok('ولا كليشة', !text.includes('كليشة'));

  // ── الرأس: تُملأ متغيّراتُه وحدها ──────────────────────────────────
  await head('المحافظة', 'بغداد / الرصافة الأولى');
  await head('القضاء', 'الأعظمية');
  await head('المدرسة', 'ثانوية الرشيد للبنين');
  await head('المادة', 'الرياضيات');
  await head('الصف', 'الثالث المتوسط');
  await head('الزمن', 'ساعتان');
  await head('التاريخ', '2026/1/12');
  await head('نوع الامتحان', 'نصف السنة');
  await head('العام الدراسي', '2025 - 2026');
  await wait(400);

  let sheet = await paper();
  ok('الثابت مطبوعٌ في المعاينة', sheet.includes('المديرية العامة لتربية'));
  ok('والمتغيّر معه', sheet.includes('ثانوية الرشيد للبنين') && sheet.includes('الرياضيات'));
  ok('وعنوان الامتحان يُركَّب', sheet.includes('أسئلة امتحان نصف السنة للعام الدراسي'));
  ok('والشعبة لا تُطبع خانةً فارغة', !sheet.includes('الشعبة'));

  // ── المتن: سؤال ← درجة ← نصّ ← فرع ← سؤال ثانٍ ────────────────────
  ok('بدأت الورقة بسؤالٍ واحدٍ جاهز', (await page.text()).includes('س1:'));

  ok('كُتبت درجة السؤال الأول', await score(0, 60));
  ok('وكُتب نصّه', await question(0, 'عرّف ما يأتي:'));

  ok('وأُضيف فرعٌ تحته', await branch(0));
  ok('بترقيم مستواه', (await page.text()).includes('أ)'));
  ok('وكُتب نصّ الفرع', await question(1, 'العدد الأولي'));

  await page.clickText('أضف سؤالًا');
  await wait(400);
  ok('وأُضيف سؤالٌ ثانٍ برقمه', (await page.text()).includes('س2:'));
  ok('بدرجته', await score(2, 40));
  ok('ونصّه', await question(2, 'حلّ ما يأتي:'));

  await wait(500);
  ok('والمجموع يُحسب ويُعلن', (await page.text()).includes('المجموع 100'));

  sheet = await paper();
  ok('والأسئلة في المعاينة بترقيمها', sheet.includes('س1:') && sheet.includes('س2:'));
  ok('والدرجة يمين السؤال', sheet.includes('(60 درجة)'));

  if (shotsDir) await page.shot(join(shotsDir, 'papers-compose.png'));

  // ── ورقة المصحّح ───────────────────────────────────────────────────
  await page.clickText('ورقة المصحّح', 'label');
  await wait(400);
  const answered = await page.eval(`
    const el = document.querySelector('input[data-answer]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'عددٌ لا يقبل القسمة إلا على نفسه وعلى الواحد');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(400);
  ok('وخانةُ الإجابة تظهر بورقة المصحّح', answered);
  ok('والإجابة تُطبع فيها', (await paper()).includes('الإجابة:'));

  // ── الحفظ ──────────────────────────────────────────────────────────
  // «حفظ» وحدها تصيب «حفظ مسودة» في الشريط العلوي — فالنقر بالسمة لا بالنصّ.
  await page.eval(`document.querySelector('button[data-act="save"]').click();`);
  await wait(1500);
  ok('حُفظت الورقة', (await page.text()).includes('حُفظت الورقة في قسم الأسئلة'));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db
    .prepare('SELECT title, issuing, doc_json AS docJson FROM templates')
    .get();
  db.close();

  ok('وقُيّدت في المكتبة', Boolean(row));
  ok('بحكمٍ يفصلها عن الكتب', row?.issuing === 'print-only');
  ok('وعنوانٍ مشتقٍّ من مادّتها', row?.title === 'أسئلة الرياضيات — الثالث المتوسط — نصف السنة');

  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  ok('والرأس محفوظٌ قيمًا لا كتلًا مجمَّدة', doc?.meta?.head?.['المدرسة'] === 'ثانوية الرشيد للبنين');

  const list = doc?.blocks?.find((b) => b.kind === 'list');
  ok('والأسئلة قائمةً بثلاثة مستويات', list?.styles?.join(',') === 'question,arabicLetter,number');
  ok('بدرجاتها', list?.items?.[0]?.score === 60 && list?.items?.[1]?.score === 40);
  ok('وبفرعها', list?.items?.[0]?.items?.length === 1);
  // خانةُ الإجابة الأولى هي إجابةُ السؤال الأول نفسه — والفرع تحته له خانته.
  ok('وبإجابتها النموذجية', Array.isArray(list?.items?.[0]?.answer));

  // ── والمكتبة لم ترها ───────────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(900);
  const library = await page.text();
  ok('ومكتبة الكتب لا تُري ورقة الأسئلة', !library.includes('أسئلة الرياضيات'));

  // ── وتُفتح فتعود القيم إلى خاناتها ────────────────────────────────
  await page.goto('exam-papers');
  await wait(900);
  const listed = await page.eval(`
    const els = [...document.querySelectorAll('button')];
    const el = els.find((e) => (e.textContent || '').includes('أسئلة الرياضيات'));
    if (!el) return false;
    el.click();
    return true;
  `);
  ok('والورقة المحفوظة معروضةٌ في قسمها', listed);
  await wait(900);
  const reopened = await page.eval(`
    return document.querySelector('input[data-head="المدرسة"]')?.value ?? '';
  `);
  ok('وتُفتح فيعود رأسها إلى خاناته', reopened === 'ثانوية الرشيد للبنين');
  ok('وأسئلتها', (await paper()).includes('عرّف ما يأتي:'));

  if (shotsDir) await page.shot(join(shotsDir, 'papers-sheet.png'));
  return steps.join('\n');
}
