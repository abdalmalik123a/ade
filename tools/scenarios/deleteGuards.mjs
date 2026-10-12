/**
 * سيناريو: كلّ حذفٍ نهائي يسأل، و«ألغِ المعاملة» يُتراجَع عنه (مراجعة ٧ ت١، ج٢).
 *
 * كانت أيقونة سلّة بجانب «حفظ» تمحو الترويسة ونسخها بنقرة، ومستمسكُ زبونٍ ممسوح، وورقةُ أسئلةٍ محفوظة، وكليشةٌ
 * وشعار — وفي الشبّاك «ألغِ المعاملة» ملاصقٌ لـ«علّق» و× المعلّقة، وطباعة «المحدّدة» حتى خمسمئة كتابٍ بنقرة.
 * فكلّها الآن تسأل (Esc والنقر خارج السؤال = «ألغِ»)، والشبّاك يُتراجَع عنه بثوانٍ، وفوق عشرة كتبٍ تسأل الطباعة.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PNG = join(HERE, '..', '..', 'tests', 'fixtures', 'card-back-fake.png');

export async function prepare() {
  return { DIWAN_TEST_SCAN_FILE: PNG };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = `
  const run = (text) => ({ kind: 'run', text });
  const ref = (key) => ({ kind: 'field', id: key, ref: key });
  await window.diwan.templates.save({
    id: null, code: null, title: 'تأييد دوام', subtitle: null, category: null, subjectLine: null,
    letterheadId: null, bodyHtml: 'نؤيد أن {الاسم} مستمر بالدوام.', variables: [],
    doc: {
      id: 'guard-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [run('نؤيد أن '), ref('الاسم'), run(' مستمر بالدوام.')] }],
      fields: [{ id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' }],
      meta: {}
    }
  });
  return true;
`;

/** يملأ الاسم في ورقة الإدخال. */
const NAME = (value) => `
  const label = [...document.querySelectorAll('[data-screen="service"] label')].find((l) => l.querySelector('span')?.textContent.trim().startsWith('الاسم'));
  const input = label?.querySelector('input');
  if (!input) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
`;
const NAME_VALUE = `
  const label = [...document.querySelectorAll('[data-screen="service"] label')].find((l) => l.querySelector('span')?.textContent.trim().startsWith('الاسم'));
  return label?.querySelector('input')?.value ?? '';
`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  /** السؤال المعروض الآن: عنوانه وخياراته، أو `null`. */
  const dialog = () =>
    page.eval(`
      const d = document.querySelector('[data-confirm]');
      return d ? { title: d.querySelector('[data-confirm-title]')?.innerText ?? '', choices: [...d.querySelectorAll('[data-choice]')].map((b) => b.dataset.choice) } : null;
    `);
  const choose = async (key) => {
    await page.eval(`document.querySelector('[data-confirm] [data-choice="${key}"]')?.click(); return true;`);
    await wait(500);
  };
  const click = async (selector, ms = 500) => {
    const found = await page.eval(`const el = document.querySelector(${JSON.stringify(selector)}); el?.click(); return Boolean(el);`);
    await wait(ms);
    return found;
  };

  // ── ١) الترويسة ───────────────────────────────────────────────────────
  await page.eval(`
    await window.diwan.letterheads.save({ id: null, name: 'ترويسة ألف', authorityId: null, layout: {}, category: null });
    await window.diwan.letterheads.save({ id: null, name: 'ترويسة باء', authorityId: null, layout: {}, category: null });
    return true;
  `);
  const letterheads = () => page.eval(`return (await window.diwan.letterheads.list()).map((l) => l.name);`);
  await page.goto('header-seal-configuration');
  await wait(900);
  await click('[data-act="delete-letterhead"]');
  let q = await dialog();
  ok(`حذف الترويسة يسأل باسمها (${q?.title})`, Boolean(q) && q.title.includes('ترويسة') && q.choices.join() === 'no,yes');
  await page.key('Escape');
  await wait(400);
  ok('وEsc يُلغي السؤال ولا يُحذف شيء', (await dialog()) === null && (await letterheads()).length === 2);
  await click('[data-act="delete-letterhead"]');
  await choose('no');
  ok('و«ألغِ» تُبقيها', (await dialog()) === null && (await letterheads()).length === 2);
  await click('[data-act="delete-letterhead"]');
  await choose('yes');
  ok('و«احذفها نهائيًّا» تحذفها', (await letterheads()).length === 1);

  // ── ٢) شعارٌ في المكتبة ─────────────────────────────────────────────
  await page.eval(`await window.diwan.seals.add({ name: 'شعار تجريبي', kind: 'شعار', imagePath: null }); return true;`);
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('header-seal-configuration');
  await wait(900);
  const clickSealDelete = () =>
    page.eval(`const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'حذف' && x.className.includes('text-error')); b?.click(); return Boolean(b);`);
  ok('زرّ حذف الشعار ظاهر', await clickSealDelete());
  await wait(400);
  q = await dialog();
  ok(`وحذفه يسأل (${q?.title})`, Boolean(q) && q.title.includes('شعار تجريبي'));
  await choose('no');
  ok('و«ألغِ» تُبقيه', (await page.eval(`return (await window.diwan.seals.list()).length;`)) === 1);
  await clickSealDelete();
  await wait(400);
  await choose('yes');
  ok('والتأكيد يحذفه', (await page.eval(`return (await window.diwan.seals.list()).length;`)) === 0);

  // ── ٣) كليشة ────────────────────────────────────────────────────────
  await page.eval(`await window.diwan.clips.save({ id: null, title: 'عبارة تجريبية', body: 'يرجى التفضل بالاطلاع', category: null, direction: null }); return true;`);
  // الشاشة تقرأ كليشاتها عند فتحها: تُفتح من جديد بعد إنشائها.
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('header-seal-configuration');
  await wait(900);
  await page.clickText('مكتبة الكليشات والعبارات');
  await wait(700);
  ok('زرّ حذف الكليشة ظاهر', await click('button[title="حذف الكليشة"]'));
  q = await dialog();
  ok(`وحذفها يسأل (${q?.title})`, Boolean(q) && q.title.includes('عبارة تجريبية'));
  await choose('no');
  ok('و«ألغِ» تُبقيها', (await page.eval(`return (await window.diwan.clips.list()).length;`)) === 1);
  await click('button[title="حذف الكليشة"]');
  await choose('yes');
  ok('والتأكيد يحذفها', (await page.eval(`return (await window.diwan.clips.list()).length;`)) === 0);

  // ── ٤) مستمسك زبون ──────────────────────────────────────────────────
  const citizenId = await page.eval(`return (await window.diwan.citizens.save({ id: null, fullName: 'زبون المستمسك', verified: false })).id;`);
  await page.eval(`await window.diwan.attachments.scan(${citizenId}, 'هوية', 300); return true;`);
  const attachments = () => page.eval(`return (await window.diwan.citizens.get(${citizenId})).attachments.length;`);
  ok('للزبون مستمسك', (await attachments()) === 1);
  await page.goto('citizens-identity-records');
  await wait(1200);
  ok('زرّ حذف المستمسك ظاهر', await click('button[title="حذف المستمسك"]'));
  q = await dialog();
  ok(`وحذفه يسأل باسم الزبون (${q?.title})`, Boolean(q) && q.title.includes('هوية'));
  await choose('no');
  ok('و«ألغِ» تُبقيه', (await attachments()) === 1);
  await click('button[title="حذف المستمسك"]');
  await choose('yes');
  await wait(600);
  ok('والتأكيد يحذفه', (await attachments()) === 0);

  // ── ٥) ورقة أسئلة محفوظة ──────────────────────────────────────────────
  await page.goto('exam-papers');
  await wait(800);
  await page.eval(`
    const el = document.querySelector('textarea[data-question-text]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'عرّف ما يأتي:');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  await click('button[data-act="save"]', 1500);
  const papers = () => page.eval(`return (await window.diwan.templates.list(null, 'print-only')).length;`);
  ok('حُفظت ورقة أسئلة', (await papers()) === 1);
  ok('زرّ حذف الورقة ظاهر', await click('button[title="احذف الورقة"]'));
  q = await dialog();
  ok(`وحذفها يسأل (${q?.title})`, Boolean(q) && q.title.includes('حذف الورقة'));
  await choose('no');
  ok('و«ألغِ» تُبقيها', (await papers()) === 1);
  await click('button[title="احذف الورقة"]');
  await choose('yes');
  ok('والتأكيد يحذفها', (await papers()) === 0);

  // ── ٦) الشبّاك: «ألغِ المعاملة» يُتراجَع عنه ──────────────────────────
  await page.eval(SEED);
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('تأييد دوام', '[data-template-card]');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1200);
  ok('كُتب اسم الزبون', await page.eval(NAME('كريم الاختبار')));
  await wait(300);
  await click('[data-screen="service"] [data-act="discard"]', 600);
  ok('«ألغِ المعاملة» تمحو فورًا (بلا سؤال يبطّئ الشبّاك)', (await dialog()) === null && (await page.text()).includes('ماذا يطلب الزبون'));
  ok('ويُعرض «تراجع»', await page.eval(`return Boolean(document.querySelector('[data-act="toast-action"]'));`));
  await click('[data-act="toast-action"]', 1500);
  ok('و«تراجع» تعيد المعاملة بما كُتب فيها', (await page.eval(NAME_VALUE)) === 'كريم الاختبار');

  // ── ٧) المعلّقة: × يُتراجَع عنه ───────────────────────────────────────
  await click('[data-screen="service"] [data-act="park"]', 800);
  const parked = () => page.eval(`return (await window.diwan.service.parked()).length;`);
  ok('عُلّقت المعاملة', (await parked()) === 1);
  await click('[data-parked] button[title="ألغِ المعاملة المعلّقة"]', 600);
  ok('× تحذف المعلّقة فورًا', (await parked()) === 0);
  ok('ويُعرض «تراجع»', await page.eval(`return Boolean(document.querySelector('[data-act="toast-action"]'));`));
  await click('[data-act="toast-action"]', 800);
  ok('و«تراجع» تعيدها إلى مكانها', (await parked()) === 1);

  // ── ٨) السجلّ: طباعة «المحدّدة» فوق عشرة كتب تسأل ──────────────────────
  await page.eval(`
    for (let i = 1; i <= 12; i++) {
      await window.diwan.documents.issue({ sheetHtml: '<div class="a4-sheet"><p>نؤيد ' + i + '</p></div>', templateId: null, citizenId: null, authorityId: null,
        citizenName: 'اسم ' + i, nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
        gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null }, false);
    }
    return true;
  `);
  await page.goto('transactions-archive-ledger');
  await wait(1200);
  await page.eval(`document.querySelector('thead input[type="checkbox"]')?.click(); return true;`);
  await wait(400);
  const printBtn = () => page.eval(`const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('طباعة المحددة')); return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;`);
  const pb = await printBtn();
  ok(`حُدّدت الكتب كلّها (${pb?.text})`, Boolean(pb) && pb.text.includes('12') && !pb.disabled);
  await page.clickText('طباعة المحددة');
  await wait(500);
  q = await dialog();
  ok(`وطباعتها تسأل بعددها (${q?.title})`, Boolean(q) && q.title.includes('١٢ كتابًا'));
  await choose('no');
  ok('و«ألغِ» لا تُرسل شيئًا', (await dialog()) === null && !(await page.eval(`return Boolean(document.querySelector('[data-print-chooser]'));`)));
  return steps.join('\n');
}
