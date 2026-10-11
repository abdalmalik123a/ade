/**
 * سيناريو: الشبّاك واليوم الأوّل (محادثة «الشبّاك واليوم الأوّل» — البنود ١١ و٧ و١٠ و٢١ من IMPROVEMENTS.md).
 *
 * ١١ — معالج البداية: الطابعة المختارة بعلامة ✓ وكلمة «المختارة» (كانت ظلًّا باهتًا)، وطابعة الملفّ (PDF) بعد طابعات المكتب
 *      ومكتوبٌ عليها أنّها لا تطبع على ورق، وتحذيرٌ إن اختيرت والطابعة الحقيقية موصولة. (بطابعات هذا الجهاز كما هي.)
 * ٢١ — «آخر ما وصل»: زرٌّ يخفي أسماء الملفّات («ملفّ PDF» مكانها)، ويبقى الاختيار بعد مغادرة الشبّاك، وزرٌّ يُظهرها.
 * ٧  — مكتبٌ بلا نماذج: لا اقتراح موسمٍ يبحث فلا يجد؛ والبحث «تأييد» لا يُخلي الشاشة: «اكتبه على ورقة فارغة» و«استورد نماذج»،
 *      وكلٌّ يفتح مكانه؛ ونموذجٌ يُضاف فيُقترح، وبحثٌ لا يجد يقول ذلك بالزرّين.
 * ١٠ — كتابٌ يُكتب ويُترك: كلمةٌ عابرة «حُفظ ما كتبته في قيد العمل» بعنوانه من موضوعه، و«افتحه» يعيده؛ والمسودّة بعنوانها في
 *      القاعدة — وما كُتب قبل المغادرة بلحظة فيها.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PDFDocument } from 'pdf-lib';

/** يفحص المعالج نفسه — فلا يتخطّاه المِقْود. */
export const keepOnboarding = true;

const FILE = 'هوية سالم حسن.pdf';

export async function prepare() {
  const downloads = join(process.env.TEMP, 'first-day', 'downloads');
  mkdirSync(downloads, { recursive: true });
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  writeFileSync(join(downloads, FILE), await pdf.save());
  return { DIWAN_TEST_INBOX: `downloads=${downloads}` };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };

  // ── ١١: الطابعة في المعالج ───────────────────────────────────────────
  await wait(600);
  await page.type('input[data-onboarding-office]', 'مكتب النور للاستنساخ');
  await click('[data-act="onboarding-next"]');
  await wait(400);
  const rows = () =>
    page.eval(`return [...document.querySelectorAll('[data-onboarding] [data-printer]')].map((b) => ({
      name: b.dataset.printer, file: b.hasAttribute('data-file-printer'), on: b.hasAttribute('data-selected'), text: b.innerText }));`);
  let list = await rows();
  const real = list.filter((r) => !r.file);
  const files = list.filter((r) => r.file);
  if (!list.length) ok('لا طابعة في هذا الجهاز — فحص المختارة يُتخطّى', true);
  else {
    const chosen = list.filter((r) => r.on);
    ok(
      `المختارة واحدة، بعلامة ✓ وكلمة «المختارة» (${chosen[0]?.name ?? 'لا شيء'})`,
      chosen.length <= 1 && chosen.every((r) => r.text.includes('check_circle') && r.text.includes('المختارة')) && list.filter((r) => !r.on).every((r) => !r.text.includes('المختارة'))
    );
    const other = list.find((r) => !r.on);
    if (other) {
      await page.eval(`[...document.querySelectorAll('[data-onboarding] [data-printer]')].find((b) => b.dataset.printer === ${JSON.stringify(other.name)}).click(); return true;`);
      await wait(250);
      list = await rows();
      const now = list.filter((r) => r.on);
      ok(
        `والضغط على أخرى ينقل إليها العلامة ✓ وكلمة «المختارة» (${other.name})`,
        now.map((r) => r.name).join() === other.name && now[0].text.includes('check_circle') && now[0].text.includes('المختارة') && list.filter((r) => !r.on).every((r) => !r.text.includes('المختارة'))
      );
    }
    if (files.length) {
      const order = list.map((r) => r.file);
      ok(`طابعة الملفّ بعد طابعات المكتب، ومكتوبٌ عليها أنّها لا تطبع على ورق (${files.map((r) => r.name).join('، ')})`, order.indexOf(true) >= real.length && files.every((r) => r.text.includes('تحفظ ملفًّا ولا تطبع على ورق')));
      if (real.length) {
        await page.eval(`document.querySelector('[data-onboarding] [data-file-printer]').click(); return true;`);
        await wait(250);
        ok('واختيارها والطابعة الحقيقية موصولة يُنبَّه عليه', await has('[data-file-printer-warning]'));
        await page.eval(`document.querySelector('[data-onboarding] [data-printer]:not([data-file-printer])').click(); return true;`);
        await wait(250);
        ok('واختيار طابعة المكتب يرفع التنبيه', !(await has('[data-file-printer-warning]')));
      }
    } else ok('لا طابعة ملفٍّ في هذا الجهاز — فحص تمييزها يُتخطّى', true);
  }
  if (shotsDir) await page.shot(join(shotsDir, 'first-day-printer.png'));
  await click('[data-act="onboarding-next"]');
  await wait(300);
  await click('[data-act="onboarding-next"]');
  await wait(300);
  await click('[data-onboarding-go="service"]');
  await wait(1200);
  await click('[data-act="overview-skip"]');
  await wait(800);
  ok('أُغلق المعالج إلى الشبّاك', !(await has('[data-onboarding]')) && (await has('[data-screen="service"] [data-cards]')));

  // ── ٢١: أسماء الملفّات في «آخر ما وصل» ───────────────────────────────
  const inbox = () => page.eval(`return [...document.querySelectorAll('[data-screen="service"] [data-inbox-file]')].map((r) => r.innerText).join(' | ');`);
  ok(`«آخر ما وصل» بالأسماء أوّلًا (${await inbox()})`, (await inbox()).includes(FILE));
  ok('والعمر بأرقامٍ هندية', !/[0-9]/.test((await inbox()).replace(FILE, '')));
  await click('[data-screen="service"] [data-act="inbox-names"]');
  await wait(300);
  ok(`زرٌّ يخفي الأسماء: «ملفّ PDF» مكانها (${await inbox()})`, !(await inbox()).includes('سالم') && (await inbox()).includes('ملفّ PDF') && !(await page.eval(`return document.querySelector('[data-screen="service"] [data-inbox-file] [title]')?.title ?? '';`)).includes('سالم'));
  await page.goto('templates-library-drafts');
  await page.goto('service-counter');
  await wait(600);
  ok('ويبقى الاختيار بعد مغادرة الشبّاك', !(await inbox()).includes('سالم') && (await page.eval(`return document.querySelector('[data-screen="service"] [data-act="inbox-names"]').getAttribute('aria-pressed');`)) === 'true');
  await click('[data-screen="service"] [data-act="inbox-names"]');
  await wait(300);
  ok('وزرٌّ يُظهرها', (await inbox()).includes(FILE));

  // ── ٧: مكتبٌ بلا نماذج ───────────────────────────────────────────────
  const seasonSearch = () => page.eval(`return [...document.querySelectorAll('[data-screen="service"] [data-season-item="search"]')].map((b) => b.innerText.trim());`);
  ok('لا اقتراح موسمٍ يبحث في مكتبةٍ فارغة', (await seasonSearch()).length === 0);
  await page.type('[data-counter-search]', 'تأييد');
  await wait(400);
  const empty = () => page.eval(`const e = document.querySelector('[data-screen="service"] [data-counter-empty]'); return e ? { kind: e.dataset.counterEmpty, text: e.innerText } : null;`);
  let e = await empty();
  ok(`البحث «تأييد» في مكتبةٍ فارغة لا يترك سطرًا بلا زرّ («${e?.text.split('\n')[0] ?? ''}»)`, e?.kind === 'library' && e.text.includes('لا نماذج في المكتبة بعد'));
  ok('بل زرّان: «اكتبه على ورقة فارغة» و«استورد نماذج»', (await has('[data-screen="service"] [data-act="counter-blank"]')) && (await has('[data-screen="service"] [data-act="counter-import"]')));
  if (shotsDir) await page.shot(join(shotsDir, 'first-day-empty.png'));
  await click('[data-screen="service"] [data-act="counter-import"]');
  await wait(900);
  ok('«استورد نماذج» يفتح المكتبة بطرق الاستيراد', await has('[data-new-template] [data-act="import-menu"]'));
  await page.goto('service-counter');
  await click('[data-screen="service"] [data-act="counter-blank"]');
  await wait(1200);
  ok('و«اكتبه على ورقة فارغة» يفتح المحرّر', await has('[data-screen="editor"] [data-page-editor]'));

  // ── ١٠: يُكتب ويُترك ─────────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-screen="editor"] [data-page-editor]').focus(); return true;`);
  await page.send('Input.insertText', { text: 'إلى / مديرية تربية بغداد' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'م / تأييد استمرار بالدوام' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'نؤيد لكم بأن' });
  await wait(5000);
  const status = await page.eval(`return [...document.querySelectorAll('[data-screen="editor"] [data-editor-print] div')].map((d) => d.innerText).find((t) => t.includes('المسودة')) ?? '';`);
  ok(`الحفظ التلقائي يقول أين صار («${status}»)`, status.includes('حُفظت المسودة') && status.includes('في «قيد العمل»'));
  // ثم كلمةٌ ومغادرةٌ فورًا — قبل أن يحين الحفظ التلقائي.
  await page.send('Input.insertText', { text: ' زينب علي حسن' });
  await page.goto('service-counter');
  await wait(1500);
  const note = await page.eval(`return document.querySelector('[data-notice]')?.innerText ?? '';`);
  ok(`المغادرة تقول إنّه في «قيد العمل» بعنوانه («${note.replace(/\s+/g, ' ').trim()}»)`, note.includes('حُفظ ما كتبته في «قيد العمل»') && note.includes('تأييد استمرار بالدوام') && note.includes('افتحه'));
  const drafts = db((d) => d.prepare('SELECT title, body_html AS body FROM drafts ORDER BY id').all());
  ok(`مسودّةٌ واحدة بعنوان موضوعها، وفيها ما كُتب قبل المغادرة بلحظة (${drafts.map((r) => r.title).join('، ')})`, drafts.length === 1 && drafts[0].title === 'تأييد استمرار بالدوام' && drafts[0].body.includes('زينب علي حسن'));
  if (shotsDir) await page.shot(join(shotsDir, 'first-day-notice.png'));
  await click('[data-notice] [data-act="notice-action"]');
  await wait(1500);
  ok('و«افتحه» يعيده إلى المحرّر كما تُرك', (await page.eval(`return document.querySelector('[data-screen="editor"] [data-page-editor]')?.innerText ?? '';`)).includes('زينب علي حسن') && !(await has('[data-notice]')));
  await page.goto('service-counter');
  await wait(1200);
  await page.eval(`document.querySelector('[data-notice] button[aria-label="أغلق"]')?.click(); return true;`);

  // ── ٧: نموذجٌ يُضاف فيُقترح ──────────────────────────────────────────
  await page.eval(`
    const run = (text) => ({ kind: 'run', text });
    await window.diwan.templates.save({
      id: null, code: null, title: 'تأييد استمرار بالدوام', subtitle: null, category: null, subjectLine: null,
      letterheadId: null, bodyHtml: 'نؤيد استمراره بالدوام.', variables: [],
      doc: { id: 'first-day-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
        blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [run('نؤيد استمراره بالدوام.')] }], fields: [], meta: {} }
    });
    return true;
  `);
  await page.eval(`document.querySelector('[data-screen="service"] [data-act="search-clear"]')?.click(); return true;`);
  await page.goto('templates-library-drafts');
  await page.goto('service-counter');
  await wait(800);
  const month = new Date().getMonth() + 1;
  const searchSeason = [9, 10, 11, 12, 1].includes(month);
  if (searchSeason) ok(`ونموذجٌ في المكتبة تجده كلمة الموسم: يُقترح (${(await seasonSearch()).join('، ')})`, (await seasonSearch()).includes('تأييد استمرار بالدوام'));
  else ok('موسمٌ بلا اقتراحٍ يبحث في هذا الشهر — فحص الاقتراح يُتخطّى', true);
  await page.type('[data-counter-search]', 'تأييد');
  await wait(400);
  ok('والبحث يجده بطاقةً لا حالًا فارغة', (await has('[data-screen="service"] [data-template-card]')) && !(await empty()));
  await page.type('[data-counter-search]', 'كفالة');
  await wait(400);
  e = await empty();
  ok(`وبحثٌ لا يجد يقول ذلك بالزرّين («${e?.text.split('\n')[0] ?? ''}»)`, e?.kind === 'search' && e.text.includes('لا نموذج بهذا الاسم') && (await has('[data-screen="service"] [data-act="counter-blank"]')));

  return steps;
}
