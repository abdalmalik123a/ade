/**
 * سيناريو: «استورد مجلدي» — من مجلد ملفات Word إلى مكتبة، بمراجعة الموظف.
 *
 * يبني مجلد مكتب من نسخ ورقة حقيقية، ثم يفتح الشاشة ويضغط الزرّ، ويتفقّد ما
 * عرضه البرنامج: كم بطاقة، وأيّها نسخة، وأي ترويسة تتكرّر — ثم يحفظ ويفتّش في
 * القاعدة.
 *
 * حوار اختيار المجلد لا يُضغط آليًا، فله بابٌ محصور: DIWAN_TEST_OPEN_DIR.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';

/** حدُّ العادة — هو نفسه في `services/learning.ts`، فلا عتبتان تختلفان. */
const HABIT = 3;

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'tests', 'fixtures', 'school-warning.docx');
const FOLDER = join(process.env.TEMP ?? '.', `diwan-folder-${Date.now()}`);

/** مجلد مكتب: ثلاث نسخ بأسماء مختلفة — كما تتكاثر ملفات Word فعلًا. */
export async function prepare() {
  rmSync(FOLDER, { recursive: true, force: true });
  mkdirSync(FOLDER, { recursive: true });
  for (const name of ['انذار.docx', 'انذار2.docx', 'انذار نهائي.docx']) {
    copyFileSync(FIXTURE, join(FOLDER, name));
  }
  writeFileSync(join(FOLDER, 'ملاحظات.txt'), 'ليس مستندًا', 'utf8');
  // هـ١: أرشيفٌ فيه Word القديم وExcel ومجلّدٌ فرعيّ — يُعدّ ما لا يُنقل ويُقال (ولا ملفّ .docx في الفرعيّ: فالبطاقات ثلاثٌ كما كانت).
  writeFileSync(join(FOLDER, 'قديم.doc'), 'Word قديم', 'utf8');
  writeFileSync(join(FOLDER, 'كشف.xls'), 'Excel قديم', 'utf8');
  mkdirSync(join(FOLDER, 'أرشيف 2025'));
  writeFileSync(join(FOLDER, 'أرشيف 2025', 'تأييد قديم.doc'), 'Word قديم', 'utf8');
  return { DIWAN_TEST_OPEN_DIR: FOLDER };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto('templates-library-drafts');
  await wait(700);
  ok('فُتحت مكتبة النماذج', (await page.text()).includes('مكتبة النماذج'));

  await page.clickText('استورد مجلدي');
  await wait(4000);

  let text = await page.text();
  ok('انفتحت شاشة المراجعة', text.includes('مراجعة ما وجدناه في مجلدك'));
  ok('وعدّت الملفات والبطاقات', text.includes('3 ملفًا') && text.includes('3 بطاقة'));
  ok('ونبّهت على النسخ المتشابهة', text.includes('تُركت نسخةً'));
  ok('ولم تُحتسب الملفات التي ليست Word', !text.includes('ملاحظات.txt'));
  const skipped = await page.eval(`return document.querySelector('[data-import-skipped]')?.textContent ?? ''`);
  ok('وقالت ما لم يُنقل: Word القديم من المجلّد وفرعيّه بعدده وما يُفعل له (هـ١)', skipped.includes('2 ملفّ Word بصيغةٍ قديمة') && skipped.includes('احفظه .docx'));
  ok('وExcel وما ليس Word بعدديهما', skipped.includes('1 ملفّ Excel') && skipped.includes('1 ملفّ ليس Word'));
  ok('وكشفت الترويسة المتكرّرة', text.includes('ترويسة واحدة تتكرّر في 3'));
  // أسماء الحقول في مدخلات تُحرَّر، لا في نصّ الصفحة.
  const fieldLabels = await page.eval(`
    return [...document.querySelectorAll('input[type="text"]')].map((i) => i.value).join(' | ');
  `);
  ok('وعرضت الحقول المستنتجة بأسمائها', fieldLabels.includes('اسم التلميذ'));
  ok('وقالت لماذا استنتجتها', text.includes('اسمُ شخص'));
  ok('والمقترح حفظه واحدة لا ثلاث', text.includes('سيُحفظ 1 من 3'));

  if (shotsDir) await page.shot(join(shotsDir, 'import-plan.png'));

  // لا شيء في القاعدة قبل الضغط على الحفظ
  const dbPath = join(profile, 'data', 'diwan.db');
  const read = () => {
    const db = new Database(dbPath, { readonly: true });
    const templates = db.prepare('SELECT title, doc_json AS docJson, letterhead_id AS lh FROM templates').all();
    const letterheads = db.prepare('SELECT name FROM letterheads').all();
    db.close();
    return { templates, letterheads };
  };
  ok('ولا شيء في القاعدة قبل القبول', read().templates.length === 0);

  // تسمية حقلٍ استنتجه المحرّك بثقة ضعيفة: «نقص» من «لذا تقرر نقص ......».
  const renamed = await page.eval(`
    const inputs = [...document.querySelectorAll('input[type="text"]')];
    const el = inputs.find((i) => i.value === 'نقص');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'الدرجات المنقوصة');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('سُمّي حقلٌ في المراجعة', renamed);
  await wait(300);

  await page.type('input[placeholder="اسم الترويسة"]', 'مدرسة الصحوة الابتدائية');
  await page.type('input[placeholder="مدارس"]', 'مدارس');
  await wait(300);

  await page.clickText('احفظ 1 بطاقة');
  await wait(2500);

  text = await page.text();
  ok('أكّد الحفظ وقال ما تُرك', text.includes('حُفظت 1 بطاقة') && text.includes('وتُركت 2'));
  ok('وقال في النتيجة ما لم يُنقل من المجلّد (هـ١)', text.includes('ولم يُنقل من المجلّد') && text.includes('2 ملفّ Word بصيغةٍ قديمة'));
  await wait(3500);
  ok('ورسالته باقيةٌ بعد ثلاث ثوانٍ حتى تُغلق', (await page.text()).includes('ولم يُنقل من المجلّد'));
  await page.eval(`document.querySelector('[data-act="toast-close"]')?.click()`);
  await wait(300);
  ok('و«أغلق» يغلقها', !(await page.text()).includes('ولم يُنقل من المجلّد'));

  // ── التفتيش في القاعدة ─────────────────────────────────────────────
  const { templates, letterheads } = read();
  ok('حُفظت بطاقة واحدة — لا ثلاث نسخ', templates.length === 1);
  ok('وترويسة واحدة للجميع', letterheads.length === 1);
  ok('باسمها الذي اختاره المكتب', letterheads[0]?.name === 'مدرسة الصحوة الابتدائية');
  ok('والبطاقة مربوطة بها', Boolean(templates[0]?.lh));

  const doc = templates[0]?.docJson ? JSON.parse(templates[0].docJson) : null;
  ok('والوثيقة محفوظة كتلًا لا نصًّا', Boolean(doc?.blocks?.length));
  // وكانت تُبنى من نصّ الملفّ: لا وسطَ ولا حجم ولا هوامش Word.
  ok(
    'وبتنسيقها: «م/ انذار» وسطٌ بحجمه، وهوامش Word نفسها',
    Boolean(
      doc?.blocks?.some((b) => b.kind === 'paragraph' && b.align === 'center' && b.size > 20 && b.inlines.some((i) => i.kind === 'run' && i.text.includes('م/'))) &&
        doc?.pageSetup?.margins?.top === 12.7
    )
  );
  ok('والرأس صار الترويسة فلا يُطبع مرّتين', !JSON.stringify(doc?.blocks ?? []).includes('مدرسة الصحوة'));
  ok(
    'وحقولها بأسمائها وعروضها',
    Boolean(doc?.fields?.some((f) => f.label === 'اسم التلميذ' && f.width > 20))
  );
  ok('والاسم الذي غيّره الموظف محفوظ', Boolean(doc?.fields?.some((f) => f.label === 'الدرجات المنقوصة')));
  ok('والحقول تُملأ باليد بعد الطباعة', Boolean(doc?.fields?.every((f) => f.fillMode === 'hand')));

  if (shotsDir) await page.shot(join(shotsDir, 'import-plan-done.png'));

  // ── الذكاء المحلي: يتعلّم من تصحيح الموظف ─────────────────────────
  const corrections = () => {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT kind, input, suggested, chosen FROM corrections').all();
    db.close();
    return rows;
  };
  const taughtRows = corrections();
  ok('قُيّد ما غيّره الموظف لا ما قبِله', taughtRows.length === 1);
  ok(
    'بما اقترحه البرنامج وما اختاره هو',
    taughtRows[0]?.kind === 'fieldName' &&
      taughtRows[0]?.suggested === 'نقص' &&
      taughtRows[0]?.chosen === 'الدرجات المنقوصة'
  );

  const clickImportFolder = async () => {
    await page.eval(`
      const b = document.querySelector('[data-act="empty-import-folder"]') || document.querySelector('[data-act="new-folder"]');
      if (b) b.click();
    `);
  };

  // مرّةٌ واحدة لا تبلغ حدّ العادة، فيُعلَّم حتى يبلغها.
  for (let i = 1; i < HABIT; i++) {
    await page.goto('templates-library-drafts');
    await wait(600);
    await clickImportFolder();
    await wait(3000);
    await page.eval(`
      const inputs = [...document.querySelectorAll('input[type="text"]')];
      const el = inputs.find((i) => i.value === 'نقص');
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'الدرجات المنقوصة');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(400);
    await page.clickText('احفظ 1 بطاقة');
    await wait(2500);
  }
  ok('وتراكمت التصحيحات حتى بلغت العادة', corrections().length === HABIT);

  // واستيرادٌ رابع: أيقترح البرنامج اسمَ المكتب من نفسه؟
  await page.goto('templates-library-drafts');
  await wait(600);
  await clickImportFolder();
  await wait(3000);

  const taught = await page.eval(`
    const el = document.querySelector('[data-taught]');
    return el ? el.textContent.trim() : '';
  `);
  ok('ويُعرض ما تعلّمه — فالتعلّم لا يكون صامتًا', taught.includes('تعلّم من مكتبك'));
  ok('ويقول كم عادةً رسخت', taught.includes('عادة'));

  const suggestedNow = await page.eval(`
    const inputs = [...document.querySelectorAll('input[type="text"]')];
    return inputs.some((i) => i.value === 'الدرجات المنقوصة');
  `);
  ok('والبرنامج يقترح اسمَ مكتبك من نفسه', suggestedNow);

  const reasons = await page.eval(`
    return [...document.querySelectorAll('span[title]')]
      .map((e) => e.getAttribute('title'))
      .filter(Boolean)
      .join(' || ');
  `);
  ok('ويقول لماذا — عدٌّ يُعلَّل لا وزنٌ في شبكة', reasons.includes('اعتاده مكتبك'));

  rmSync(FOLDER, { recursive: true, force: true });
  return steps.join('\n');
}
