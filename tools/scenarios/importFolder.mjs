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

  // تسمية حقلٍ استنتجه المحرّك بثقة ضعيفة
  const renamed = await page.eval(`
    const inputs = [...document.querySelectorAll('input[type="text"]')];
    const el = inputs.find((i) => i.value === 'التقدير');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'ملاحظة الختام');
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

  // ── التفتيش في القاعدة ─────────────────────────────────────────────
  const { templates, letterheads } = read();
  ok('حُفظت بطاقة واحدة — لا ثلاث نسخ', templates.length === 1);
  ok('وترويسة واحدة للجميع', letterheads.length === 1);
  ok('باسمها الذي اختاره المكتب', letterheads[0]?.name === 'مدرسة الصحوة الابتدائية');
  ok('والبطاقة مربوطة بها', Boolean(templates[0]?.lh));

  const doc = templates[0]?.docJson ? JSON.parse(templates[0].docJson) : null;
  ok('والوثيقة محفوظة كتلًا لا نصًّا', Boolean(doc?.blocks?.length));
  ok(
    'فيها فراغ التوقيع مسافةً رأسية',
    Boolean(doc?.blocks?.some((b) => b.kind === 'spacer'))
  );
  ok(
    'وحقولها بأسمائها وعروضها',
    Boolean(doc?.fields?.some((f) => f.label === 'اسم التلميذ' && f.width > 20))
  );
  ok('والاسم الذي غيّره الموظف محفوظ', Boolean(doc?.fields?.some((f) => f.label === 'ملاحظة الختام')));
  ok('والحقول تُملأ باليد بعد الطباعة', Boolean(doc?.fields?.every((f) => f.fillMode === 'hand')));

  if (shotsDir) await page.shot(join(shotsDir, 'import-plan-done.png'));

  rmSync(FOLDER, { recursive: true, force: true });
  return steps.join('\n');
}
