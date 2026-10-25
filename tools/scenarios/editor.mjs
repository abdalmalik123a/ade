/**
 * سيناريو: التأليف على الورقة نفسها — بالمحرّر الوحيد (ProseMirror).
 *
 * يفتح مصمّم النماذج ويكتب سطرًا على الورقة، ويظلّل كلمةً فيحوّلها حقلًا بـF4،
 * ثم ينسّق: حجمًا لكلمة وتوسيطًا للسطر، ويفتح سطرًا بـEnter ويمحوه بـBackspace
 * ثم يفتحه ثانيةً ويكتب فيه، ويُدرج جدولًا بمقاسه ويعمل في خلاياه — توسيطًا
 * ودمجًا وفكًّا — و«نسخة منه إلى» (ولا توقيع ولا ختم في القائمة)، ويضع علامةً
 * مائية، ويحفظ كليشة ثم النموذج — ويفتّش في القاعدة.
 *
 * ثم يستعمل النموذج في الشبّاك: فالتنسيق الذي لا يصل الورقة التي تُصدَر وهمٌ. ثم الكشيدة (D183) في المحرّر: فقرةٌ مضبوطة
 * بكشيدةٍ متوسّطة تُحفظ PDF ممدودةً، والمسودّة والبحث بلا تطويل، وWord بمستواها — وبلا كشيدة لا تطويل.
 * (وكان يختبر المحرّر الأوّل حتى حُذف — الموجة ١، المجموعة ج.)
 */
import { mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { strFromU8, unzipSync } from 'fflate';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (selector) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    `);
  const count = (selector) =>
    page.eval(`return document.querySelectorAll(${JSON.stringify(selector)}).length;`);
  const ED = '[data-page-editor]';

  /** يضع المؤشّر في فقرةٍ من الورقة (بترتيبها) — في آخرها أو أوّلها. */
  const caret = async (index, atEnd) => {
    await page.eval(`
      const ed = document.querySelector('${ED}');
      ed.focus();
      const el = ed.querySelectorAll(':scope > p')[${index}];
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(${atEnd ? 'false' : 'true'});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
  };
  /** يكتب حيث المؤشّر كما تكتب لوحة المفاتيح. */
  const type = async (text) => {
    await page.send('Input.insertText', { text });
    await wait(300);
  };
  /** يظلّل مدًى في النصّ الأوّل من أوّل سطر — كما يظلّل الكاتب بالفأرة. */
  const select = async (from, to) => {
    await page.eval(`
      const ed = document.querySelector('${ED}');
      ed.focus();
      const p = ed.querySelector(':scope > p');
      const node = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
      const range = document.createRange();
      range.setStart(node, ${from});
      range.setEnd(node, ${to});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
  };
  /** يختار قيمةً من قائمة الأدوات عبر مُعيِّن React. */
  const choose = async (selector, value) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await wait(350);
  };
  const paras = () => count(`${ED} > p`);

  // ── الورقة مساحة التأليف ───────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1200);

  let text = await page.text();
  ok('انفتح المصمّم', text.includes('تعريف النموذج'));
  ok('والورقة مساحة التأليف ولوحة المتغيّرات بجانبها', text.includes('ظلّل كلمةً واضغط F4'));

  await page.type('input[placeholder^="مثال: تأييد"]', 'تأييد استمرار بالخدمة');
  await wait(200);
  await caret(0, true);
  await type('نؤيد لكم أن السيد أحمد عادل موظف لدينا');
  ok('كُتب السطر على الورقة', (await page.eval(`return document.querySelector('${ED} > p')?.textContent ?? '';`)) === 'نؤيد لكم أن السيد أحمد عادل موظف لدينا');

  // ── F4: «أحمد عادل» تبدأ عند ١٨ وتنتهي عند ٢٧ ─────────────────────
  await select(18, 27);
  await page.key('F4');
  await wait(400);
  text = await page.text();
  ok('صار المظلَّل متغيّرًا', text.includes('المتغيّرات على الورقة (1)'));
  ok('ورُسم في السطر صندوقًا لا نصًّا', (await count(`${ED} > p [data-field]`)) === 1);
  ok(
    'والصندوق لا يُحرَّر — فلا يُكسر بنصف مسح',
    await page.eval(`return document.querySelector('${ED} [data-field]')?.getAttribute('contenteditable') === 'false';`)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'editor-field.png'));

  // ── الحجم: «نؤيد» بحجم ١٨ نقطة كما في Word (د٥) — ٢٤ بكسلًا مخزَّنًا ─────────────
  await select(0, 4);
  await choose('[data-act="size"]', '18');
  ok(
    'وصار المظلَّل بحجم ١٨ نقطة على الورقة',
    await page.eval(`
      const s = document.querySelector('${ED} > p [data-size="24"]');
      return Boolean(s) && s.textContent === 'نؤيد';
    `)
  );
  ok('والمنتقي يقول «18» بالنقطة', (await page.eval(`return document.querySelector('[data-act="size"]').value;`)) === '18');

  // ── المحاذاة: توسيط السطر ──────────────────────────────────────────
  await click('[data-act="align-center"]');
  await wait(400);
  ok('وتوسّط السطر', await page.eval(`return document.querySelector('${ED} > p').style.textAlign === 'center';`));

  // ── Enter سطرٌ جديد، وBackspace في أوّله يمحوه ─────────────────────
  await caret(0, true);
  await page.key('Enter');
  await wait(500);
  ok('فتح Enter سطرًا جديدًا', (await paras()) === 2);
  ok(
    'والمؤشّر فيه لا في الأوّل',
    await page.eval(`
      const ps = document.querySelectorAll('${ED} > p');
      return ps[1].contains(window.getSelection().anchorNode) || window.getSelection().anchorNode === ps[1];
    `)
  );
  ok(
    'والسطر الأوّل بقي كما هو — لم يُبتلع ولم يُكرَّر',
    await page.eval(`
      const first = document.querySelector('${ED} > p');
      return first.textContent.includes('نؤيد') && first.textContent.includes('موظف لدينا');
    `)
  );

  await page.key('Backspace');
  await wait(500);
  ok('ومحاه Backspace في أوّله فالتحق بما قبله', (await paras()) === 1);

  await caret(0, true);
  await page.key('Enter');
  await wait(500);
  await type('والكتاب صادرٌ بناءً على طلبه');
  ok('وكُتب في السطر الجديد', (await page.text()).includes('والكتاب صادرٌ بناءً على طلبه'));

  // ── الجدول بمقاسه ──────────────────────────────────────────────────
  await click('[data-act="insert"]');
  await wait(400);
  await click('[data-act="ins-table"]');
  await wait(300);
  ok('فُتح منتقي المقاس', (await count('[data-grid]')) === 64);
  await click('[data-grid="3-3"]');
  await wait(600);
  ok('أُدرج جدول ٣×٣ بخلاياه التسع', (await count(`${ED} table td`)) === 9);

  // ── العمل في الخلايا: محاذاةٌ ودمجٌ وفكّ ───────────────────────────
  const T = `document.querySelector('${ED} table')`;
  /** المؤشّر في خليّة (صفّ، عمود) — وفي آخرها، وكتابةٌ فيها إن أُعطيت. */
  const inCell = async (r, c, value) => {
    await page.eval(`
      document.querySelector('${ED}').focus();
      const p = ${T}.rows[${r}].cells[${c}].querySelector('p');
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
    if (value !== undefined) await type(value);
  };
  /** يسحب الفأرة من خليّةٍ إلى أخرى فتُحدَّد الخلايا بينهما — والجدول في وسط ما يُرى (المصمّم نافذةٌ تُمرَّر). */
  const dragCells = async (from, to) => {
    await page.eval(`${T}.scrollIntoView({ block: 'center' }); return true;`);
    await wait(300);
    const at = (r, c) => page.eval(`const b = ${T}.rows[${r}].cells[${c}].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 };`);
    const a = await at(...from);
    const b = await at(...to);
    // مهلةٌ بين الحركات كما تتحرّك يدٌ حقيقية — متلاحقةً بلا مهلة لا يلحق المحرّر ببدء التحديد.
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, button: 'left' });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'left' });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await wait(300);
  };
  await inCell(1, 0, 'الاسم');
  ok('وخلاياه تُحرَّر كغيرها، وأدوات الجدول تظهر فيه', (await page.eval(`return ${T}.rows[1].cells[0].textContent;`)) === 'الاسم' && (await count('[data-act="table-header"]')) === 1);
  await click('[data-act="align-center"]');
  await wait(300);
  ok('الخليّة تُوسَّط بأداة الشريط نفسها', await page.eval(`return ${T}.rows[1].cells[0].querySelector('p').style.textAlign === 'center';`));
  await inCell(0, 0, 'البيانات');
  await dragCells([0, 0], [0, 1]);
  await click('[data-act="merge"]');
  await wait(400);
  ok('دُمجت الخليّة بجارتها فغطّت عمودين', await page.eval(`return ${T}.rows[0].cells.length === 2 && ${T}.rows[0].cells[0].colSpan === 2;`));
  await inCell(0, 0);
  await click('[data-act="split"]');
  await wait(400);
  ok('وفُكّ الدمج فعادت ثلاثًا وبقي ما كُتب', await page.eval(`return ${T}.rows[0].cells.length === 3 && ${T}.rows[0].cells[0].textContent.includes('البيانات');`));

  // ── «نسخة منه إلى» — ولا توقيع ولا ختم في القائمة ────────────────
  await click('[data-act="insert"]');
  await wait(400);
  ok(
    'لا توقيع ولا ختم يُدرج — يضعهما صاحبهما بيده بعد الطباعة',
    (await count('[data-act="ins-signature"]')) === 0 &&
      !(await page.eval(`return [...document.querySelectorAll('[data-act^="ins-"]')].some((b) => /ختم|توقيع/.test(b.textContent))`))
  );
  await click('[data-act="ins-copies"]');
  await wait(500);
  ok('أُدرجت «نسخة منه إلى»', (await page.text()).includes('نسخة منه إلى'));

  // ── العلامة المائية ────────────────────────────────────────────────
  await click('[data-act="wm-text"]');
  await wait(800);
  ok(
    'وظهرت العلامة المائية خلف المتن على الورقة',
    await page.eval(`
      const w = document.querySelector('[data-doc-editor] [data-watermark]');
      return Boolean(w) && w.textContent.includes('مسودة');
    `)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'editor-formatted.png'));

  // ── الكليشة ────────────────────────────────────────────────────────
  await page.clickText('حفظ ككليشة');
  await wait(900);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const clips = db.prepare('SELECT title, body FROM clips').all();
  db.close();
  ok('حُفظت الكليشة في مكتبتها', clips.length === 1);
  ok('بمتنها', clips[0]?.body?.includes('نؤيد لكم أن السيد'));

  // ── الحفظ: كل ما رُئي محفوظٌ في الوثيقة ────────────────────────────
  await page.clickText('حفظ النموذج');
  await wait(1800);

  const db2 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db2.prepare('SELECT title, doc_json AS docJson, body_html AS body FROM templates').get();
  db2.close();
  ok('حُفظ النموذج وقُيّد في المكتبة', Boolean(row));

  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  const ps = (doc?.blocks ?? []).filter((b) => b.kind === 'paragraph');
  const textOf = (b) => b.inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');

  ok('وحقلها الذي صنعه F4', doc?.fields?.[0]?.label === 'أحمد عادل');
  ok(
    'والحجم محفوظٌ علامةً على النصّ — بالبكسل كما كان (١٨ نقطة = ٢٤)',
    ps.some((b) => b.inlines.some((i) => i.kind === 'run' && i.text === 'نؤيد' && i.marks?.size === 24))
  );
  ok('والتوسيط محفوظٌ على السطر', ps[0]?.align === 'center');
  ok('والسطر الجديد سطرٌ مستقلّ لا ملتصق', ps.some((b) => textOf(b) === 'والكتاب صادرٌ بناءً على طلبه'));
  const table = doc?.blocks?.find((b) => b.kind === 'table');
  ok('والجدول بصفوفه الثلاثة وأعمدته', table?.rows?.length === 3 && table?.columns?.length === 3);
  ok('وتوسيط الخليّة محفوظٌ على فقرتها', table?.rows?.[1]?.cells?.[0]?.blocks?.[0]?.align === 'center');
  const order = (doc?.blocks ?? []).map((b) =>
    b.kind === 'table' ? 'table' : b.kind === 'paragraph' && textOf(b).startsWith('نسخة منه إلى') ? 'copies' : ''
  );
  ok('و«نسخة منه إلى» بعد الجدول الذي أُدرج قبلها', order.indexOf('table') >= 0 && order.indexOf('table') < order.indexOf('copies'));
  ok('والعلامة المائية من ضبط الورقة', doc?.pageSetup?.watermark?.text === 'مسودة');
  ok('وظلُّها النصّي للبحث', (row?.body ?? '').includes('نؤيد لكم أن السيد'));

  // ── الشبّاك: ما نُسِّق يصل الورقة التي تُصدَر ───────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('تأييد استمرار بالخدمة', 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  await wait(1200);
  await page.clickText('راجع الأوراق', 'button');
  await wait(900);

  ok(
    'العلامة المائية على ورقة الإصدار',
    await page.eval(`
      const w = document.querySelector('.a4-sheet [data-watermark]');
      return Boolean(w) && w.textContent.includes('مسودة');
    `)
  );
  ok('والتوسيط فيها', (await count('.a4-sheet [data-body] p[style*="text-align:center"]')) > 0);
  ok('والحجم فيها', (await count('.a4-sheet [data-body] span[style*="font-size:24px"]')) > 0);
  ok('والجدول فيها', (await count('.a4-sheet [data-body] table')) === 1);
  if (shotsDir) await page.shot(join(shotsDir, 'service-review.png'));

  // ── الكشيدة في الضبط (S13، D183): تُطبع ممدودةً، والوثيقة والبحث بلا تطويل ─────
  await click('[data-act="discard"]');
  await wait(600);
  await page.goto('smart-editor-a4-preview');
  await wait(1200);
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  /** ينتظر ملفًّا جديدًا بامتداده في مجلّد الحفظ. */
  const savedNew = async (ext, before) => {
    for (let t = 0; t < 60; t++) {
      await wait(250);
      const f = readdirSync(saveDir).find((n) => n.endsWith(ext) && !before.has(n));
      if (f) return (await wait(400), join(saveDir, f));
    }
    return null;
  };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfText = async (path) => {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) out += (await (await pdf.getPage(i)).getTextContent()).items.map((it) => it.str ?? '').join('');
    return out;
  };
  const tatweels = (s) => (s.match(/ـ/g) ?? []).length;
  const LONG = 'نرجو التفضّل بالاطّلاع على قائمة التلاميذ أدناه واتّخاذ ما يلزم بشأن توزيعهم على الصفوف للعام الدراسي القادم مع التقدير. ';
  await caret(0, true);
  await type(LONG.repeat(3).trim());
  ok('«الكشيدة» لا تظهر لفقرةٍ غير مضبوطة', (await count('[data-act="kashida"]')) === 0);
  await click('[data-act="align-justify"]');
  await wait(400);
  ok('وتظهر مع «ضبط الطرفين»', (await count('[data-act="kashida"]')) === 1);
  await choose('[data-act="kashida"]', 'medium');
  ok('واختيرت «الكشيدة: متوسّطة» للفقرة', (await page.eval(`return document.querySelector('${ED} > p')?.dataset.kashida ?? '';`)) === 'medium');

  let before = new Set(readdirSync(saveDir));
  await click('[data-act="export-pdf"]');
  const kashidaPdf = await savedNew('.pdf', before);
  const withK = kashidaPdf ? tatweels(await pdfText(kashidaPdf)) : 0;
  ok(`PDF الفقرة المضبوطة بالكشيدة فيه التطويل (${withK} حرف تطويل)`, withK > 0);
  if (shotsDir) await page.shot(join(shotsDir, 'editor-kashida.png'));

  await click('[data-act="save"]');
  await wait(1200);
  const db3 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const draftRow = db3.prepare('SELECT values_json AS v FROM drafts ORDER BY id DESC').get();
  db3.close();
  // الوثيقة في المسودّة نصٌّ داخل القيم (`letterValues`: `__doc`).
  const draftDoc = draftRow ? (JSON.parse(draftRow.v).__doc ?? '') : '';
  ok(
    'والوثيقة المحفوظة تحمل المستوى بلا تطويلٍ في نصّها',
    draftDoc.includes('"kashida":"medium"') && draftDoc.includes('توزيعهم') && !draftDoc.includes('ـ')
  );

  await click('[data-act="find"]');
  await wait(400);
  await page.type('[data-find-input]', 'التلاميذ');
  await wait(500);
  ok('والبحث في المحرّر يجد الكلمة', /^[1-9]\d* في الكتاب$/.test(await page.eval(`return document.querySelector('[data-find-count]')?.textContent ?? '';`)));
  await click('[data-act="find"]');
  await wait(300);

  before = new Set(readdirSync(saveDir));
  await click('[data-act="export-word"]');
  const kashidaDocx = await savedNew('.docx', before);
  const wordXml = kashidaDocx ? strFromU8(unzipSync(new Uint8Array(readFileSync(kashidaDocx)))['word/document.xml'] ?? new Uint8Array()) : '';
  ok('وWord المصدَّر فيه «mediumKashida»', wordXml.includes('w:val="mediumKashida"'));

  // الضدّ: الفقرة نفسها مضبوطةً بلا كشيدة — والملفّ الأوّل يُنقل فلا يُكتب فوقه.
  if (kashidaPdf) renameSync(kashidaPdf, join(saveDir, 'kashida-medium.pdf'));
  await choose('[data-act="kashida"]', '');
  before = new Set(readdirSync(saveDir));
  await click('[data-act="export-pdf"]');
  const plainPdf = await savedNew('.pdf', before);
  const plainText = plainPdf ? await pdfText(plainPdf) : '';
  ok(`وPDF الفقرة المضبوطة بلا كشيدة لا تطويل فيه (${tatweels(plainText)})`, Boolean(plainPdf) && plainText.length > 50 && tatweels(plainText) === 0);

  return steps.join('\n');
}
