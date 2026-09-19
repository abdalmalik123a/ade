/**
 * سيناريو: المحرّر الكامل — التأليف من الصفر كتلًا.
 *
 * يفتح مصمّم النماذج، ويكتب متنًا في كتلة، ويظلّل كلمةً فيحوّلها حقلًا بـF4،
 * ويُدرج جدولًا من قائمة `/`، ويحفظ كليشة ويُدرجها — ثم يفتّش في القاعدة:
 * الوثيقة محفوظة كتلًا بحقولها، والكليشة في مكتبتها.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** يكتب في أوّل كتلة قابلة للتحرير ويُعلم المحرّر. */
  const writeBlock = async (text) => {
    const done = await page.eval(`
      const el = document.querySelector('[contenteditable="true"]');
      if (!el) return false;
      el.focus();
      el.textContent = ${JSON.stringify(text)};
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return true;
    `);
    await wait(300);
    return done;
  };

  /** يظلّل مدًى في أوّل كتلة، ثم يضغط F4. */
  const fieldify = async (from, to) => {
    await page.eval(`
      const el = document.querySelector('[contenteditable="true"]');
      const node = el.firstChild;
      const range = document.createRange();
      range.setStart(node, ${from});
      range.setEnd(node, ${to});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    `);
    await wait(200);
    await page.key('F4');
    await wait(400);
  };

  await page.goto('templates-library-drafts');
  await wait(700);
  await page.clickText('نموذج جديد');
  await wait(900);

  let text = await page.text();
  ok('انفتح المصمّم', text.includes('متن الكتاب'));
  ok('والوضع الأصل كتل', text.includes('ظلّل كلمةً واضغط F4'));

  await page.type('input[placeholder^="مثال: تأييد"]', 'تأييد استمرار بالخدمة');
  await wait(200);

  ok('كُتب المتن في كتلة', await writeBlock('نؤيد لكم أن السيد أحمد عادل موظف لدينا'));

  // «أحمد عادل» تبدأ عند ١٨ وتنتهي عند ٢٧
  await fieldify(18, 27);
  text = await page.text();
  ok('صارت الكلمة المظلَّلة حقلًا', text.includes('أحمد عادل'));
  ok('وظهرت في لوحة الحقول', text.includes('الحقول (1)'));

  const fieldChip = await page.eval(`
    return document.querySelectorAll('[data-field]').length;
  `);
  ok('ورُسمت في المتن صندوقًا لا نصًّا', fieldChip === 1);

  const notEditable = await page.eval(`
    const chip = document.querySelector('[data-field]');
    return chip?.getAttribute('contenteditable') === 'false';
  `);
  ok('والصندوق لا يُحرَّر — فلا يُكسر بنصف مسح', notEditable);

  if (shotsDir) await page.shot(join(shotsDir, 'editor-field.png'));

  // ── قائمة `/`: جدول ─────────────────────────────────────────────────
  await page.clickText('+ فقرة');
  await wait(400);
  const opened = await page.eval(`
    const blocks = [...document.querySelectorAll('[contenteditable="true"]')];
    const el = blocks[blocks.length - 1];
    if (!el) return false;
    el.focus();
    el.textContent = '/';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  `);
  await wait(600);
  const menuOpen = await page.eval(`
    return Boolean(document.querySelector('input[placeholder*="كليشة"]'));
  `);
  ok('فتحت «/» قائمة الإدراج', opened && menuOpen);

  await page.clickText('جدول');
  await wait(600);
  const cells = await page.eval(`
    const table = document.querySelector('td [contenteditable="true"]')?.closest('table');
    return table ? table.querySelectorAll('td').length : 0;
  `);
  ok('أُدرج جدول بخلاياه التسع', cells === 9);
  ok('وخلاياه تُحرَّر كغيرها', (await page.text()).includes('صفّ عناوين يتكرّر'));

  // ── الكليشة ────────────────────────────────────────────────────────
  await page.clickText('اجعلها كليشة');
  await wait(900);

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const clips = db.prepare('SELECT title, body FROM clips').all();
  db.close();
  ok('حُفظت الكليشة في مكتبتها', clips.length === 1);
  ok('بمتنها', clips[0]?.body?.includes('نؤيد لكم أن السيد'));

  // ── الحفظ ──────────────────────────────────────────────────────────
  await page.clickText('حفظ النموذج');
  await wait(1800);
  ok('حُفظ النموذج', !(await page.text()).includes('متن النموذج فارغ'));

  const db2 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db2.prepare('SELECT title, doc_json AS docJson, body_html AS body FROM templates').get();
  db2.close();

  ok('وقُيّد في المكتبة', Boolean(row));
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  ok('والوثيقة محفوظة كتلًا', Boolean(doc?.blocks?.length));
  ok('فيها الجدول الذي أُدرج', Boolean(doc?.blocks?.some((b) => b.kind === 'table')));
  ok('وحقلها الذي صنعه F4', doc?.fields?.[0]?.label === 'أحمد عادل');
  ok('وعرضه من طول ما كان مكتوبًا', (doc?.fields?.[0]?.width ?? 0) >= 9);
  ok('وظلُّها النصّي للبحث', (row?.body ?? '').includes('نؤيد لكم أن السيد'));

  // ── الأسئلة: ترقيمٌ يُحسب ودرجاتٌ تُجمع ───────────────────────────
  await page.goto('templates-library-drafts');
  await wait(600);
  await page.clickText('نموذج جديد');
  await wait(900);
  await page.type('input[placeholder^="مثال: تأييد"]', 'أسئلة نصف السنة');
  await wait(200);

  // «/» ثم «أسئلة»
  await page.eval(`
    const el = document.querySelector('[contenteditable="true"]');
    el.focus();
    el.textContent = '/';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  `);
  await wait(600);
  await page.clickText('أسئلة');
  await wait(700);
  ok('أُدرجت قائمة أسئلة من «/»', (await page.text()).includes('+ سؤال'));
  ok('وعلامتها محسوبة لا مكتوبة', (await page.text()).includes('س1:'));

  await page.clickText('+ سؤال');
  await wait(400);
  ok('وأُضيف سؤال ثانٍ برقمه', (await page.text()).includes('س2:'));

  // نصّ السؤالين — وبلا نصّ لا يُحفظ النموذج، وهو تصرّفٌ صحيح.
  const wrote = await page.eval(`
    const boxes = [...document.querySelectorAll('[data-placeholder="نصّ السؤال"]')];
    if (boxes.length < 2) return false;
    const write = (el, text) => {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    };
    write(boxes[0], 'عرّف ما يأتي:');
    write(boxes[1], 'حلّ ما يأتي:');
    return true;
  `);
  ok('وكُتب نصّ السؤالين', wrote);
  await wait(500);

  // درجتان: ٦٠ و٤٠
  const scored = await page.eval(`
    const boxes = [...document.querySelectorAll('input[title="درجة السؤال"]')];
    if (boxes.length < 2) return false;
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(boxes[0], '60');
    set(boxes[1], '40');
    return true;
  `);
  ok('كُتبت الدرجات', scored);
  await wait(600);
  ok('والمجموع يُعرض ويُنبَّه', (await page.text()).includes('المجموع 100'));

  // فرعٌ تحت السؤال الأول
  const branched = await page.eval(`
    const el = [...document.querySelectorAll('button[title="أضف فرعًا"]')][0];
    if (!el) return false;
    el.click();
    return true;
  `);
  ok('وأُضيف فرعٌ تحت السؤال', branched);
  await wait(500);
  ok('بترقيم مستواه', (await page.text()).includes('أ)'));

  ok('ولوحة الرموز حاضرة', (await page.text()).includes('√'));

  if (shotsDir) await page.shot(join(shotsDir, 'editor-questions.png'));

  await page.clickText('حفظ النموذج');
  await wait(1800);

  const db3 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const papers = db3.prepare('SELECT title, doc_json AS docJson FROM templates').all();
  db3.close();
  const paper = papers.find((r) => r.title.includes('أسئلة'));
  const pdoc = paper ? JSON.parse(paper.docJson) : null;
  const list = pdoc?.blocks?.find((b) => b.kind === 'list');

  ok('حُفظت ورقة الأسئلة كتلًا', Boolean(list));
  ok('بأنماط ترقيمها الثلاثة', list?.styles?.join(',') === 'question,arabicLetter,number');
  ok('وبدرجاتها', list?.items?.[0]?.score === 60 && list?.items?.[1]?.score === 40);
  ok('وبفرعها', Array.isArray(list?.items?.[0]?.items) && list.items[0].items.length === 1);

  if (shotsDir) await page.shot(join(shotsDir, 'editor-table.png'));
  return steps.join('\n');
}
