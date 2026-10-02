/**
 * سيناريو: أدوار الطابعات وطباعة الشبّاك (خطة Production، المرحلة ٢).
 *
 * لا ورق ولا طابعة: المِقْود يكتب كلّ طلب طباعةٍ في سجلّ (`DIWAN_TEST_PRINT_LOG`)، وطابعةٌ اسمها
 * «تتوقّف…» تقف مرّةً عند ورقتها الثالثة. فيُصدر الشبّاك دفعةً من ثلاثة أسماء على دورٍ له طابعتان:
 * أيُسأل «عادي أم ملوّن؟» مرّةً واحدة؟ أيقول «طُبعت ٢ من ٣» حين تقف، ويُكمل من الثالثة لا من
 * الأولى؟ وإلغاء السؤال لا يُصدر شيئًا، وإعادة الطبع من الأرشيف تذهب إلى طابعة الدور بأنماط الكتاب.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'tests', 'fixtures', 'school-warning.docx');
const STAMP = Date.now();
const FOLDER = join(process.env.TEMP ?? '.', `diwan-roles-${STAMP}`);
const LOG = join(process.env.TEMP ?? '.', `diwan-print-log-${STAMP}.jsonl`);

const LASER = 'تتوقّف — ليزر المكتب';
const COLOR = 'ملوّنة المكتب';
const NAMES = ['سالم محمود جاسم', 'ليلى عبد الله حسن', 'أحمد عادل كريم'];

export async function prepare() {
  rmSync(FOLDER, { recursive: true, force: true });
  mkdirSync(FOLDER, { recursive: true });
  copyFileSync(FIXTURE, join(FOLDER, 'انذار.docx'));
  rmSync(LOG, { force: true });
  return { DIWAN_TEST_OPEN_DIR: FOLDER, DIWAN_TEST_PRINT_LOG: LOG };
}

const printed = () =>
  existsSync(LOG)
    ? readFileSync(LOG, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  const setRoles = (roles) => page.eval(`return window.diwan.settings.set({ printRoles: ${JSON.stringify(roles)} }).then(() => true);`);

  /** الشبّاك: «انذار» بقائمة أسماء، حتى المراجعة. */
  const counterWith = async (names) => {
    await page.goto('service-counter');
    await wait(900);
    await page.eval(`
      const cards = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('انذار'));
      cards[0]?.click();
    `);
    await wait(400);
    await page.clickText('املأ (1)');
    await wait(1200);
    await page.eval(`
      const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
      const box = label && label.querySelector('input[type="checkbox"]');
      if (box && !box.checked) box.click();
    `);
    await wait(400);
    await page.eval(`
      const el = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(names.join('\n'))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await wait(400);
    await page.clickText('راجع الأوراق');
    await wait(1200);
  };

  // ── مكتبةٌ فيها «انذار» ─────────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(600);
  await page.clickText('استورد مجلدي');
  await wait(4000);
  await page.eval(`[...document.querySelectorAll('input[type="checkbox"]')].forEach((b) => { if (!b.checked) b.click(); });`);
  await wait(400);
  await page.clickText('احفظ 1 بطاقة');
  await wait(2500);

  // ── الأدوار في الإعدادات ────────────────────────────────────────────
  await setRoles({ documents: { normal: LASER, color: COLOR, dialog: false } });
  await page.goto('office-settings');
  await wait(1000);
  const ui = await page.eval(`
    const normal = [...document.querySelectorAll('[data-print-roles] select[data-role-slot="normal"]')];
    const doc = document.querySelector('[data-print-roles] select[data-role="documents"][data-role-slot="normal"]');
    const color = document.querySelector('[data-print-roles] select[data-role="documents"][data-role-slot="color"]');
    return { rows: normal.length, value: doc?.value, label: doc?.selectedOptions[0]?.textContent ?? '', color: color?.value };
  `);
  ok('الإعدادات تعرض الأدوار الخمسة: لكلٍّ «عادي» و«ملوّن» و«اسأل»', ui.rows === 5);
  ok('وطابعةٌ محفوظة غير مثبّتة تبقى ظاهرةً «غير مثبّتة» لا تُمحى', ui.value === LASER && ui.label.includes('غير مثبّتة') && ui.color === COLOR);

  // ── الشبّاك: طابعتان للكتب ← سؤالٌ واحد ─────────────────────────────
  await counterWith(NAMES);
  await page.clickText('اطبع 3 ورقة');
  await wait(700);
  const chooser = await page.eval(`
    const c = document.querySelector('[data-print-chooser="documents"]');
    return c ? { choices: [...c.querySelectorAll('[data-print-choice]')].map((b) => b.innerText), text: c.innerText } : null;
  `);
  ok('للدور طابعتان: يُسأل «عادي أم ملوّن؟» في نافذة البرنامج', chooser?.choices.length === 2 && chooser.text.includes(LASER) && chooser.text.includes(COLOR));
  ok('ولم يصدر شيءٌ قبل الجواب', db((d) => d.prepare('SELECT COUNT(*) AS n FROM documents').get().n) === 0);

  await page.eval(`document.querySelector('[data-print-choice="normal"]').click(); return true;`);
  await wait(5000);
  const stopped = await page.eval(`
    const b = document.querySelector('[data-print-run]');
    return b ? { state: b.dataset.printRun, sent: Number(b.dataset.printSent), total: Number(b.dataset.printTotal), text: b.innerText } : null;
  `);
  ok('الطابعة وقفت عند الثالثة: «توقّفت الطباعة: طُبعت 2 من 3 — نفد الورق»', stopped?.state === 'stopped' && stopped.sent === 2 && stopped.total === 3 && stopped.text.includes('نفد الورق'));
  const first = printed().filter((l) => l.printer === LASER);
  ok('ثلاثة طلبات إلى «عادي» وحده، بلا نافذة ويندوز لكلّ ورقة', first.length === 3 && first.every((l) => l.silent) && !printed().some((l) => l.printer === COLOR));
  ok('وبأنماط الكتب يوم صدرت', first.every((l) => l.style));
  const issued = db((d) => d.prepare(`SELECT d.citizen_name AS name, p.printer FROM documents d JOIN document_prints p ON p.document_id = d.id ORDER BY d.id`).all());
  ok('صدرت الثلاثة وقُيّدت طبعتها الأولى على الطابعة المختارة', issued.length === 3 && issued.every((r) => r.printer === LASER));
  ok('والدفعة في السجلّ على القرص — تُستأنف ولو أُغلق البرنامج', (await page.eval(`return (await window.diwan.output.pendingJobs()).map((j) => j.sent);`)).join() === '2');

  await page.eval(`document.querySelector('[data-act="print-resume"]').click(); return true;`);
  await wait(3000);
  const after = printed().filter((l) => l.printer === LASER);
  ok('«أكمل الطباعة» أرسل الثالثة وحدها', after.length === 4 && after[3].text.includes(NAMES[2]) && !after[3].text.includes(NAMES[0]));
  ok('وقال «طُبعت 3 من 3» وأغلق الشريط', !(await page.eval(`return Boolean(document.querySelector('[data-print-run]'));`)) && (await page.text()).includes('طُبعت 3 من 3'));
  ok('ولم يبقَ ما يُستأنف', (await page.eval(`return (await window.diwan.output.pendingJobs()).length;`)) === 0);

  // ── «اسأل عند كل طباعة»: الإلغاء لا يُصدر، والاختيار يطبع عليه ──────
  await setRoles({ documents: { normal: LASER, color: null, dialog: true } });
  await counterWith(['محمد علي حسين']);
  await page.clickText('اطبع 1 ورقة');
  await wait(1200);
  const list = await page.eval(`return [...document.querySelectorAll('[data-print-chooser="documents"] [data-print-printer]')].map((b) => b.dataset.printPrinter);`);
  ok('«اسأل» يعرض طابعات ويندوز المثبّتة للاختيار', list.length > 0);
  await page.eval(`document.querySelector('[data-act="print-cancel"]').click(); return true;`);
  await wait(800);
  ok('والإلغاء لا يُصدر شيئًا ويبقى في المراجعة', db((d) => d.prepare('SELECT COUNT(*) AS n FROM documents').get().n) === 3 && (await page.text()).includes('اطبع 1 ورقة'));
  await page.clickText('اطبع 1 ورقة');
  await wait(1200);
  await page.eval(`
    document.querySelector('[data-print-chooser] [data-print-printer="${list[0]?.replace(/"/g, '\\"')}"]').click();
    document.querySelector('[data-act="print-confirm"]').click();
    return true;
  `);
  await wait(3000);
  const picked = printed().filter((l) => l.printer === list[0]);
  ok('والطابعة المختارة تطبع الورقة صامتةً — نافذة البرنامج كانت السؤال', picked.length === 1 && picked[0].silent);

  // ── إعادة الطبع من الأرشيف: طابعة الدور وأنماط الكتاب ───────────────
  await setRoles({ documents: { normal: 'ليزر الأرشيف', color: null, dialog: false } });
  await page.goto('transactions-archive-ledger');
  await wait(1200);
  await page.eval(`document.querySelector('button[title="إعادة طباعة طبق الأصل"]').click(); return true;`);
  await wait(2000);
  const reprinted = printed().filter((l) => l.printer === 'ليزر الأرشيف');
  ok('طابعةٌ واحدة للدور: إعادة الطبع تذهب إليها مباشرةً بلا سؤال', reprinted.length === 1 && reprinted[0].silent);
  ok('وبأنماط الكتاب المحفوظة معه', reprinted[0]?.style === true);

  // ── خطٌّ لم يُحمَّل لا يُرسم بديله (٢٫٥) ─────────────────────────────
  // سجلّ الطباعة يتجاوز الرسم، وPDF يمرّ به: تُكسر روابط خطوط الأنماط المحفوظة فيُطلب PDF الكتاب.
  const docId = db((d) => d.prepare('SELECT id FROM documents ORDER BY id LIMIT 1').get().id);
  const w = new Database(join(profile, 'data', 'diwan.db'));
  w.prepare("UPDATE sheet_styles SET css = replace(css, 'url(./assets/', 'url(./missing/')").run();
  w.close();
  const fontErr = await page.eval(`
    try { await window.diwan.documents.exportPdf(${docId}); return 'no-error'; }
    catch (e) { return String(e?.message ?? e); }
  `);
  ok('خطٌّ لم يُحمَّل يُقال باسمه ولا تخرج الورقة بخطٍّ بديل', fontErr.includes('خطّ الورقة لم يُحمَّل'));

  rmSync(FOLDER, { recursive: true, force: true });
  rmSync(LOG, { force: true });
  return steps.join('\n');
}
