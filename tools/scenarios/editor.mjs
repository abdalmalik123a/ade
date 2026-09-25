/**
 * سيناريو: التأليف على الورقة نفسها.
 *
 * يفتح مصمّم النماذج ويكتب سطرًا على الورقة، ويظلّل كلمةً فيحوّلها حقلًا بـF4،
 * ثم ينسّق: حجمًا لكلمة وتوسيطًا للسطر، ويفتح سطرًا بـEnter ويمحوه بـBackspace
 * ثم يفتحه ثانيةً ويكتب فيه، ويُدرج جدولًا بمقاسه ويعمل في خلاياه — توسيطًا
 * ودمجًا وفكًّا — و«نسخة منه إلى» (ولا توقيع ولا ختم في القائمة)، ويضع علامةً
 * مائية، ويحفظ كليشة ثم النموذج — ويفتّش في القاعدة.
 *
 * ثم يستعمل النموذج في الشبّاك: فالتنسيق الذي لا يصل الورقة التي تُصدَر وهمٌ.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

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

  /** يكتب في أوّل سطرٍ على الورقة ويُعلم المحرّر. */
  const writeBlock = async (text) => {
    const done = await page.eval(`
      const el = document.querySelector('[data-block]');
      if (!el) return false;
      el.focus();
      el.textContent = ${JSON.stringify(text)};
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return true;
    `);
    await wait(300);
    return done;
  };

  /** يظلّل مدًى في النصّ الأوّل من أوّل سطر — كما يظلّل الكاتب بالفأرة. */
  const select = async (from, to) => {
    await page.eval(`
      const el = document.querySelector('[data-block]');
      el.focus();
      const node = el.firstChild;
      const range = document.createRange();
      range.setStart(node, ${from});
      range.setEnd(node, ${to});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
  };

  /** يضع المؤشّر في آخر سطرٍ بعينه أو أوّله. */
  const caret = async (index, atEnd) => {
    await page.eval(`
      const el = document.querySelectorAll('[data-block]')[${index}];
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(${atEnd ? 'false' : 'true'});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(250);
  };

  // ── الورقة مساحة التأليف ───────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.clickText('نموذج جديد');
  await wait(900);

  let text = await page.text();
  ok('انفتح المصمّم', text.includes('تعريف النموذج'));
  ok('والورقة مساحة التأليف ولوحة المتغيّرات بجانبها', text.includes('ظلّل كلمةً واضغط F4'));

  await page.type('input[placeholder^="مثال: تأييد"]', 'تأييد استمرار بالخدمة');
  await wait(200);
  ok('كُتب السطر على الورقة', await writeBlock('نؤيد لكم أن السيد أحمد عادل موظف لدينا'));

  // ── F4: «أحمد عادل» تبدأ عند ١٨ وتنتهي عند ٢٧ ─────────────────────
  await select(18, 27);
  await page.key('F4');
  await wait(400);
  text = await page.text();
  ok('صار المظلَّل متغيّرًا', text.includes('المتغيّرات على الورقة (1)'));
  ok('ورُسم في السطر صندوقًا لا نصًّا', (await count('[data-block] [data-field]')) === 1);
  ok(
    'والصندوق لا يُحرَّر — فلا يُكسر بنصف مسح',
    await page.eval(`return document.querySelector('[data-field]')?.getAttribute('contenteditable') === 'false';`)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'editor-field.png'));

  // ── الحجم: «نؤيد» بحجم ٢٠ ──────────────────────────────────────────
  await select(0, 4);
  await click('[data-act="size"]');
  await wait(300);
  ok('فتحت أداة الحجم قائمتها', (await count('[data-size-opt]')) > 0);
  await click('[data-size-opt="20"]');
  await wait(400);
  ok(
    'وصار المظلَّل بحجم ٢٠ على الورقة',
    await page.eval(`
      const s = document.querySelector('[data-block] [data-size="20"]');
      return Boolean(s) && s.textContent === 'نؤيد';
    `)
  );

  // ── المحاذاة: توسيط السطر ──────────────────────────────────────────
  await click('[data-act="align-center"]');
  await wait(400);
  ok(
    'وتوسّط السطر',
    await page.eval(`return document.querySelector('[data-block]').style.textAlign === 'center';`)
  );

  // ── Enter سطرٌ جديد، وBackspace في أوّله يمحوه ─────────────────────
  await caret(0, true);
  await page.key('Enter');
  await wait(500);
  ok('فتح Enter سطرًا جديدًا', (await count('[data-block]')) === 2);
  ok(
    'والمؤشّر فيه لا في الأوّل',
    await page.eval(`
      const all = [...document.querySelectorAll('[data-block]')];
      return document.activeElement === all[1];
    `)
  );
  ok(
    'والسطر الأوّل بقي كما هو — لم يُبتلع ولم يُكرَّر',
    await page.eval(`
      const first = document.querySelector('[data-block]');
      return first.textContent.includes('نؤيد') && first.textContent.includes('موظف لدينا');
    `)
  );

  await page.key('Backspace');
  await wait(500);
  ok('ومحاه Backspace في أوّله فالتحق بما قبله', (await count('[data-block]')) === 1);

  await caret(0, true);
  await page.key('Enter');
  await wait(500);
  await page.eval(`
    const el = document.activeElement;
    el.textContent = 'والكتاب صادرٌ بناءً على طلبه';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  `);
  await wait(300);
  ok('وكُتب في السطر الجديد', (await page.text()).includes('والكتاب صادرٌ بناءً على طلبه'));

  // ── الجدول بمقاسه ──────────────────────────────────────────────────
  await click('[data-act="insert"]');
  await wait(400);
  await click('[data-act="ins-table"]');
  await wait(300);
  ok('فُتح منتقي المقاس', (await count('[data-grid]')) === 64);
  await click('[data-grid="3-3"]');
  await wait(500);
  ok('أُدرج جدول ٣×٣ بخلاياه التسع', (await count('table td [contenteditable="true"]')) === 9);
  ok('وخلاياه تُحرَّر كغيرها', (await page.text()).includes('صفّ عناوين يتكرّر'));

  // ── العمل في الخلايا: محاذاةٌ ودمجٌ وفكّ ───────────────────────────
  const inCell = (cell, text) =>
    page.eval(`
      const el = document.querySelector('[data-cell="${cell}"] [contenteditable]');
      if (!el) return false;
      el.focus();
      ${text === undefined ? '' : `el.textContent = ${JSON.stringify(text)}; el.dispatchEvent(new InputEvent('input', { bubbles: true }));`}
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      return true;
    `);
  await inCell('1-0', 'الاسم');
  await wait(300);
  await click('[data-act="align-center"]');
  await wait(300);
  ok(
    'الخليّة تُوسَّط بأداة الشريط نفسها',
    await page.eval(`return document.querySelector('[data-cell="1-0"] [contenteditable]').style.textAlign === 'center'`)
  );
  await inCell('0-0', 'البيانات');
  await wait(300);
  await click('[data-act="cell-merge"]');
  await wait(400);
  ok(
    'دُمجت الخليّة بجارتها فغطّت عمودين',
    (await count('[data-cell^="0-"]')) === 2 &&
      (await page.eval(`return document.querySelector('[data-cell="0-0"]').colSpan === 2`))
  );
  await inCell('0-0');
  await wait(300);
  await click('[data-act="cell-split"]');
  await wait(400);
  ok(
    'وفُكّ الدمج فعادت ثلاثًا وبقي ما كُتب',
    (await count('[data-cell^="0-"]')) === 3 &&
      (await page.eval(`return document.querySelector('[data-cell="0-0"]').textContent.includes('البيانات')`))
  );

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
  await wait(400);
  ok(
    'وظهرت العلامة المائية خلف المتن على الورقة',
    await page.eval(`
      const w = document.querySelector('[data-watermark]');
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
  const paras = (doc?.blocks ?? []).filter((b) => b.kind === 'paragraph');
  const textOf = (b) => b.inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');

  ok('وحقلها الذي صنعه F4', doc?.fields?.[0]?.label === 'أحمد عادل');
  ok(
    'والحجم محفوظٌ علامةً على النصّ',
    paras.some((b) => b.inlines.some((i) => i.kind === 'run' && i.text === 'نؤيد' && i.marks?.size === 20))
  );
  ok('والتوسيط محفوظٌ على السطر', paras[0]?.align === 'center');
  ok('والسطر الجديد سطرٌ مستقلّ لا ملتصق', paras.some((b) => textOf(b) === 'والكتاب صادرٌ بناءً على طلبه'));
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
  ok(
    'والتوسيط فيها',
    (await count('.a4-sheet [data-body] p[style*="text-align:center"]')) > 0
  );
  ok('والحجم فيها', (await count('.a4-sheet [data-body] span[style*="font-size:20px"]')) > 0);
  ok('والجدول فيها', (await count('.a4-sheet [data-body] table')) === 1);
  if (shotsDir) await page.shot(join(shotsDir, 'service-review.png'));

  return steps.join('\n');
}
