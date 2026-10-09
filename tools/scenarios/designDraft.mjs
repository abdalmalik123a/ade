/**
 * سيناريو: لا يضيع تصميم (DESIGNS.md ٠٫٦).
 *
 * تصميمٌ يُعدَّل ثم يُنتقل عنه فورًا (قبل مهلة الحفظ) فيُحفظ مسودّةً في «قيد العمل»، ويُكمَل منها كما تُرك؛ والحفظ التلقائي
 * يكتب في المسودّة نفسها، و«احفظ» يمحوها ولا يعيدها. وتعديلٌ على محفوظ يُسأل عنه حين يُفتح المحفوظ ثانيةً، ويُكمَل من رأس
 * المعرض. والاستيراد من المعرض تصميمٌ جديد لا يحلّ في المفتوح قبله. وآخره: تعديلٌ ثم إغلاقٌ فوري للبرنامج.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.env.TEMP ?? '.', `diwan-design-draft-${Date.now()}`);
const PNG = join(ROOT, 'خلفية.png');
/** صورةٌ ١×١ بلا دقّة — تكفي خلفيةً، ويُسأل عن مقاسها. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

export function prepare() {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(PNG, Buffer.from(PIXEL, 'base64'));
  return { DIWAN_TEST_OPEN_FILE: PNG };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const designDrafts = (page) =>
  page.eval(`
    return (await window.diwan.drafts.list())
      .filter((d) => d.valuesJson.includes('"__design"'))
      .map((d) => ({ id: d.id, title: d.title, templateId: d.templateId, json: d.valuesJson }));
  `);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const field = (key) => has(`input[data-value="${key}"]`);
  const addField = async (key) => {
    await page.type('input[data-add-text]', `{${key}}`);
    await wait(150);
    await click('button[data-act="add"]');
    await wait(300);
  };

  // ── تعديلٌ ثم انتقالٌ فوري ─────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(600);
  await click('button[data-kind="student-id"]');
  await wait(800);
  ok('تصميمٌ من المعرض لم يُعدَّل: لا مسودّة', (await designDrafts(page)).length === 0);
  await page.type('input[data-title]', 'هوية المسودّة');
  await addField('الصف');
  await page.goto('orders-board');
  await wait(1200);
  let drafts = await designDrafts(page);
  ok('تعديلٌ ثم انتقالٌ فوري: حُفظ مسودّةً', drafts.length === 1 && drafts[0].title === 'هوية المسودّة' && drafts[0].json.includes('الصف'));
  ok('وتظهر في «قيد العمل» تصميمًا لم يُحفظ', (await has('[data-pending="resume-design-draft"]')) && (await page.text()).includes('تصميمٌ لم يُحفظ'));
  ok('ولا تظهر مسودّةَ كتاب', !(await has('[data-pending="resume-draft"]')));

  // ── يُكمَل كما تُرك ────────────────────────────────────────────────
  await click('[data-act="resume-design-draft"]');
  await wait(1500);
  ok('«أكمله» يفتحه في التصاميم بعنوانه وحقله', (await page.eval(`return document.querySelector('input[data-title]')?.value ?? '';`)) === 'هوية المسودّة' && (await field('الصف')));
  await wait(4800);
  ok('وفتحُه لا يكتب مسودّةً ثانية', (await designDrafts(page)).length === 1);
  await addField('الشعبة');
  await wait(5000);
  drafts = await designDrafts(page);
  ok('والحفظ التلقائي يكتب في المسودّة نفسها', drafts.length === 1 && drafts[0].json.includes('الشعبة'));
  ok('ويُقال في الشريط إنّها حُفظت', await has('[data-status="design-draft"]'));

  // ── «احفظ» يمحوها ولا يعيدها ───────────────────────────────────────
  await click('button[data-act="save"]');
  await wait(1500);
  ok('حُفظ التصميم', (await page.text()).includes('حُفظ التصميم'));
  ok('ومُحيت مسودّته', (await designDrafts(page)).length === 0);
  await wait(5000);
  ok('ولا تعود بعد مهلة الحفظ', (await designDrafts(page)).length === 0);
  const savedId = await page.eval(`return (await window.diwan.templates.list('تصاميم', 'print-only')).find((t) => t.title === 'هوية المسودّة')?.id ?? null;`);

  // ── تعديلٌ على محفوظ ───────────────────────────────────────────────
  await addField('المرحلة');
  await page.goto('orders-board');
  await wait(1200);
  drafts = await designDrafts(page);
  ok('تعديلٌ على المحفوظ ثم انتقال: مسودّةٌ مربوطةٌ به', drafts.length === 1 && drafts[0].templateId === savedId && drafts[0].json.includes('المرحلة'));
  ok('وتُوصف تعديلًا عليه', (await page.text()).includes('تعديلٌ على «هوية المسودّة»'));

  await page.goto('designed-documents');
  await wait(900);
  ok('ورأس المعرض يذكرها', (await has('[data-panel="design-drafts"]')) && (await page.text()).includes('لم يُحفظ بعد'));
  await click(`[data-saved-thumb="${savedId}"]`);
  await wait(900);
  const asked = await page.eval(`return document.querySelector('[data-confirm] [data-confirm-title]')?.innerText ?? '';`);
  ok('فتحُ المحفوظ يسأل عن تعديلاته', asked.includes('تعديلاتٌ لم تُحفظ'));
  await click('[data-confirm] [data-choice="saved"]');
  await wait(900);
  ok('«افتح المحفوظ» يفتحه بلا التعديل', (await field('الشعبة')) && !(await field('المرحلة')));
  ok('والمسودّة باقية', (await designDrafts(page)).length === 1);

  await click('[data-act="gallery"]');
  await wait(700);
  await click('[data-panel="design-drafts"] [data-act="resume-design-draft"]');
  await wait(1200);
  ok('ومن رأس المعرض يعود التعديل', await field('المرحلة'));

  // ── الاستيراد من المعرض تصميمٌ جديد ────────────────────────────────
  ok('(المفتوح الآن تعديلٌ على محفوظ: «حفظ التعديلات»)', await has('button[data-act="save-copy"]'));
  await click('[data-act="gallery"]');
  await wait(700);
  await click('button[data-act="background"]');
  await wait(1500);
  ok(
    'خلفيةٌ من المعرض تصميمٌ جديد — لا تحلّ في المفتوح فيكتب «احفظ» فوقه',
    !(await has('button[data-act="save-copy"]')) && (await page.eval(`return document.querySelector('input[data-title]')?.value ?? '';`)) === '' && !(await field('المرحلة'))
  );
  drafts = await designDrafts(page);
  ok('والمفتوح قبله باقٍ في مسودّته', drafts.length === 1 && drafts[0].json.includes('المرحلة'));

  // ── تعديلٌ ثم إغلاقٌ فوري ─────────────────────────────────────────
  await page.type('input[data-title]', 'تصميم الإغلاق');
  await page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50); 1' });
  await wait(4000);
  return steps.join('\n');
}

export async function afterRestart(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const drafts = await designDrafts(page);
  ok('تعديلٌ ثم إغلاقٌ فوري: حُفظ مسودّةً قبل أن يُغلق', drafts.some((d) => d.title === 'تصميم الإغلاق'));
  ok('والمسودّة السابقة باقية', drafts.some((d) => d.json.includes('المرحلة')));

  await page.goto('orders-board');
  await wait(900);
  await page.eval(`document.querySelector('[data-pending="resume-design-draft"] [data-act="delete-draft"]')?.click(); return true;`);
  await wait(500);
  const message = await page.eval(`return document.querySelector('[data-confirm]')?.innerText ?? '';`);
  ok('وحذفها يسأل بلغة التصميم', message.includes('ولا يُمسّ التصميم المحفوظ'));
  await page.eval(`document.querySelector('[data-confirm] [data-choice="yes"]')?.click(); return true;`);
  await wait(800);
  ok('وتُحذف', (await designDrafts(page)).length === drafts.length - 1);
  return steps.join('\n');
}
