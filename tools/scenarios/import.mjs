/**
 * سيناريو: استيراد كتاب Word قطعةً واحدة بتنسيقه — على التطبيق الحقيقي.
 *
 * يُستورد `tests/fixtures/warning-letter.docx` — كتاب إنذار حقيقي من مكتب، رأسه
 * أسطرٌ في أعلى المتن كما تكتبه المكاتب كلّها. فيُتحقّق أن المصمّم يُفتح على
 * الورقة كاملة بلا فصل ترويسة، بمقاس الصفحة وهوامشها وأحجامها وعمودَي رأسها
 * وخطّها الفاصل — ثم يُحفظ ويُستعمل في الشبّاك فتخرج ورقة الإصدار بالشكل نفسه.
 *
 * حوار فتح الملف لا يُضغط آليًا، فيُجاب عنه بـDIWAN_TEST_OPEN_FILE الذي لا
 * يوجد إلا تحت هذا المِقْود.
 */
import { join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';

/** يُمرَّر مسار الملف في بيئة التطبيق قبل إقلاعه. */
export async function prepare() {
  const file = process.env.DIWAN_TEST_OPEN_FILE ?? resolve('tests/fixtures/warning-letter.docx');
  process.env.DIWAN_TEST_OPEN_FILE = file; // ليقرأه السيناريو نفسه أيضًا
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const source = process.env.DIWAN_TEST_OPEN_FILE;
  ok('مِقْود الاستيراد مهيّأ', Boolean(source) && existsSync(source));
  if (!source) return steps.join('\n');

  // ── الاستيراد من مكتبة النماذج ──────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.clickText('استيراد نموذج');
  await wait(2500);

  let text = await page.text();
  ok('لا تُفصل ترويسة ولا يُسأل عنها — الملف قطعةٌ واحدة', !text.includes('وُجدت ترويسة في الملف'));
  ok('انفتح المصمّم بالنموذج المستورد', text.includes('نموذج مستورد'));

  const paper = await page.eval(`
    const block = document.querySelector('[data-block]');
    const sheet = block?.closest('div[style*="210mm"]');
    if (!sheet) return null;
    return {
      width: sheet.getBoundingClientRect().width,
      padding: getComputedStyle(sheet).paddingTop,
      text: sheet.innerText,
      columns: sheet.querySelectorAll('div[style*="flex:"]').length,
      hr: [...sheet.querySelectorAll('img')].some((i) => (i.src || '').startsWith('diwan://') && i.style.height === '10px'),
      bold: [...sheet.querySelectorAll('strong')].some((s) => s.textContent.includes('ادارة')),
      tab: [...sheet.querySelectorAll('[data-block]')].find((b) => b.textContent.includes('مدير المدرسة'))?.style.textIndent
    };
  `);
  ok('الورقة بعرض A4 الحقيقي (٢١٠ ملم)', paper && Math.abs(paper.width - 793.7) < 2);
  ok('وبهوامش الملف ١٢٫٧ ملم لا الثابتة', paper && Math.abs(parseFloat(paper.padding) - 48) < 1);
  ok('والرأس في أعلاها كما كُتب', paper && paper.text.includes('ادارة') && paper.text.includes('مدرسة الصحوة الابتدائية'));
  ok('وعمودا الرأس قائمان', paper && paper.columns >= 4 && paper.text.includes('العدد:'));
  ok('والرأس عريض', paper && paper.bold);
  ok('والخطّ الفاصل صورةٌ بارتفاعها', paper && paper.hr);
  ok('و«مدير المدرسة» في موضع جدولته', paper && paper.tab === '128.4mm');
  ok('والتمديد كما رسمه Word', paper && paper.text.includes('انـــ'));
  ok('والمتن كاملًا', paper && paper.text.includes('بالنظر لوصول غيابات التلميذ'));
  if (shotsDir) await page.shot(join(shotsDir, 'import-paper.png'));

  // ── الحفظ ──────────────────────────────────────────────────────────
  await page.clickText('حفظ النموذج');
  await wait(1800);

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, letterhead_id AS lh, doc_json AS docJson FROM templates').get();
  const heads = db.prepare('SELECT COUNT(*) AS n FROM letterheads').get();
  db.close();

  ok('حُفظ النموذج', Boolean(row));
  ok('بعنوانٍ من سطر موضوعه', row?.title?.includes('انذار'));
  ok('ولم تُحفظ ترويسةٌ منفصلة', heads.n === 0 && row?.lh === null);
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  ok('والوثيقة بهوامش الملف وبلا ترويسة فوقها', doc?.pageSetup?.margins?.top === 12.7 && doc?.pageSetup?.letterheadMode === 'none');
  ok('وعمودا الرأس محفوظان بأوزانهما', doc?.blocks?.some((b) => b.kind === 'columns' && b.widths?.length === 2));
  ok('والخطّ الفاصل في المخزن', readdirSync(join(profile, 'data', 'store', 'letterheads')).some((f) => f.endsWith('.gif')));

  // ── الشبّاك: ورقة الإصدار بالشكل نفسه ─────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('انذار', 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  await wait(1200);
  await page.clickText('راجع الأوراق', 'button');
  await wait(900);

  // موضع السطر من أعلى الورقة: به يُعرف أن فصل الرأس لم يزحزح شيئًا.
  const readSheet = () =>
    page.eval(`
    const s = document.querySelector('.a4-sheet [data-body]')?.closest('.a4-sheet');
    if (!s) return null;
    const top = s.getBoundingClientRect().top;
    const at = (t) => {
      const el = [...s.querySelectorAll('p, div')].reverse().find((e) => e.textContent.trim().startsWith(t));
      return el ? Math.round((el.getBoundingClientRect().top - top) * 10) / 10 : null;
    };
    return {
      padding: s.style.paddingTop,
      text: s.innerText,
      heads: (s.innerText.match(/ادارة/g) || []).length,
      pre: [...s.querySelectorAll('[data-body] p')].some((p) => p.style.whiteSpace === 'pre-wrap'),
      sheetHead: !!s.querySelector('[data-sheet-head]'),
      school: at('مدرسة الصحوة'),
      to: at('الى / ولي'),
      signer: at('مدير المدرسة')
    };
  `);
  const sheet = await readSheet();
  ok('ورقة الإصدار بهوامش الملف', sheet?.padding === '12.7mm');
  ok('وبرأسها مرّةً واحدة لا مرّتين', sheet?.heads === 1);
  ok('وبمسافاتها محفوظة', sheet?.pre === true);
  ok('وبمتنها كاملًا', sheet?.text?.includes('مدير المدرسة'));
  if (shotsDir) await page.shot(join(shotsDir, 'import-service.png'));

  // ── «احفظ أعلى الورقة ترويسةً» — اختياريٌّ بعد الاستيراد ─────────────
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('button[title="تعديل صيغ المتغيرات"]')?.click()`);
  await wait(1500);
  const offer = await page.eval(`
    const box = document.querySelector('[data-head-offer]');
    return box ? { name: box.querySelector('[data-head-name]').value } : null;
  `);
  ok('يُقترح فصل الرأس ترويسةً', Boolean(offer));
  ok('باسمٍ من نصّه بلا تمديد', offer?.name === 'ادارة مدرسة الصحوة الابتدائية للبنين');
  if (shotsDir) await page.shot(join(shotsDir, 'import-offer.png'));
  await page.eval(`document.querySelector('[data-act="save-head"]').click()`);
  await wait(900);
  const after = await page.eval(`
    const sheet = document.querySelector('[data-block]')?.closest('div[style*="210mm"]');
    return {
      offer: !!document.querySelector('[data-head-offer]'),
      head: !!sheet?.querySelector('[data-sheet-head]'),
      heads: (sheet?.innerText.match(/ادارة/g) || []).length,
      picked: [...document.querySelectorAll('select')]
        .find((s) => [...s.options].some((o) => o.textContent.includes('بلا ترويسة')))
        ?.selectedOptions[0]?.textContent
    };
  `);
  ok('وبعد الفصل يختفي الاقتراح', after && !after.offer);
  ok('والرأس على الورقة ترويسةً، مرّةً واحدة', after?.head && after.heads === 1);
  ok('والترويسة مختارةٌ للنموذج', after?.picked?.includes('مدرسة الصحوة'));
  await page.clickText('حفظ النموذج');
  await wait(1800);

  const db2 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const saved = db2.prepare('SELECT letterhead_id AS lh, doc_json AS docJson FROM templates').get();
  const head = db2.prepare('SELECT id, name, layout_json AS layout FROM letterheads').get();
  db2.close();
  const layout = head ? JSON.parse(head.layout) : null;
  const doc2 = saved?.docJson ? JSON.parse(saved.docJson) : null;
  ok('حُفظت الترويسة بكتل الرأس كما هي', layout?.sheet?.some((b) => b.kind === 'columns'));
  ok('والنموذج يشير إليها', saved?.lh === head?.id);
  ok('والورقة بلا رأسها', doc2 && !doc2.blocks.some((b) => b.kind === 'columns'));

  // الشبّاك يحفظ معاملته حين يُترك — فيُعاد إليها. تُلغى لتبدأ الورقة من جديد.
  await page.goto('service-counter');
  await wait(900);
  ok('والشبّاك عاد إلى المعاملة كما تُركت', await page.eval(`return Boolean(document.querySelector('[data-act="discard"]'));`));
  await page.eval(`document.querySelector('[data-act="discard"]').click(); return true;`);
  await wait(500);
  await page.clickText('انذار', 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  await wait(1200);
  await page.clickText('راجع الأوراق', 'button');
  await wait(900);
  const split = await readSheet();
  ok('ورقة الإصدار برأسها من الترويسة، مرّةً واحدة', split?.sheetHead && split.heads === 1);
  ok(
    `ولا يتزحزح سطر: المدرسة ${sheet?.school}→${split?.school}، «الى» ${sheet?.to}→${split?.to}، المدير ${sheet?.signer}→${split?.signer}`,
    split && sheet && ['school', 'to', 'signer'].every((k) => split[k] !== null && Math.abs(split[k] - sheet[k]) < 1)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'import-split.png'));

  return steps.join('\n');
}
