/**
 * سيناريو: حلقة الإصدار كاملة على التطبيق الحقيقي.
 *
 * ترويسة تُبنى، ومواطن يُسجَّل، ثم كتاب يُكتب **على الورقة نفسها** في المحرّر —
 * سطرٌ وحقولٌ من كتالوج المعاملات وحقلٌ يسمّيه المكتب — ويُستورد له المواطن بـF2،
 * ثم يصدر ويُقيَّد — فيُفتَّش عنه في القاعدة: رقم الصادر والبصمة والقيد في سجل
 * الطباعة، وأن لا ختم ولا توقيع ولا رمز تحقّق على الورقة. ثم تُقرأ شاشتا الأرشيف والبحث للتأكّد أنه ظهر فيهما.
 *
 * ثم تُضغط أدوات الإخراج كلها — Word و300 نقطة/إنش وPDF وتقرير Excel والنسخ
 * الاحتياطي — ويُفتَّش عن ملفاتها على القرص. حوار الحفظ يُجاب عنه بمتغيّر البيئة
 * DIWAN_TEST_SAVE_DIR الذي لا يوجد إلا تحت هذا المِقْود.
 *
 * ما لا يُقاد آليًا: حوار الطباعة نفسه (نافذة نظام) — فالإصدار هنا يجري بخيار
 * «إصدار وقيد بلا طباعة»، وهو الفرع نفسه في القيد، ومحرّك الرسم مُتحقَّق منه
 * بنسخة PDF المؤرشفة التي تخرج من الطريق نفسه.
 */
import { join } from 'node:path';
import { existsSync, statSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { strFromU8, unzipSync } from 'fflate';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  /** ينتظر ظهور نصّ — رسائل التطبيق تختفي بعد ثوانٍ، فلا تصلح مهلة ثابتة. */
  const awaitText = async (needle, tries = 14) => {
    for (let i = 0; i < tries; i++) {
      if ((await page.text()).includes(needle)) return true;
      await new Promise((r) => setTimeout(r, 700));
    }
    return false;
  };
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  if (saveDir) mkdirSync(saveDir, { recursive: true });
  const saved = (ext) =>
    saveDir ? readdirSync(saveDir).filter((f) => f.toLowerCase().endsWith(ext)) : [];
  const bytesOf = (name) => statSync(join(saveDir, name)).size;
  const headerOf = (name, len) =>
    readFileSync(join(saveDir, name), { encoding: 'latin1' }).slice(0, len);
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** نصّ الورقة التي تُطبع — المرسومة خارج الشاشة بقيمها، لا ورقة التحرير. */
  const sheetText = () =>
    page.eval(`return document.querySelector('[data-screen="editor"] .a4-sheet')?.innerText ?? '';`);

  /** يجد المدخل التابع لعنوان، ولو كان في صفّ تحته لا بجانبه. */
  const INPUT_OF_LABEL = `
    const labels = [...document.querySelectorAll('label')];
    const l = labels.find(x => x.textContent.trim().startsWith(LABEL));
    const box = l?.closest('div.flex-col') ?? l?.parentElement;
    const input = l?.querySelector('input, textarea') ?? box?.querySelector('input, textarea');
  `;

  const fill = async (label, value) => {
    const done = await page.eval(`
      ${INPUT_OF_LABEL.replace('LABEL', JSON.stringify(label))}
      if (!input) return false;
      const proto = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(120);
    return done;
  };

  /** أسطر القسم الجاري في صندوق النصّ — سطرٌ لكل سطر. */
  const typeLines = async (value) => {
    await page.eval(`
      const el = document.querySelector('textarea[placeholder^="جمهورية العراق"]');
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(250);
  };

  // ── ترويسة يبنيها المكتب أولًا ──────────────────────────────────────
  await page.goto('header-seal-configuration');
  await page.type('input[placeholder^="مثال: مديرية"]', 'مديرية تربية بغداد / الرصافة الأولى');
  await typeLines('جمهورية العراق — وزارة التربية');
  await page.clickText('حفظ الترويسة');
  await wait(800);
  ok('بُنيت ترويسة وحُفظت', (await page.text()).includes('حُفظت الترويسة'));

  // ── مواطن يُسجَّل ليُستورد لاحقًا بـF2 ──────────────────────────────
  await page.goto('citizens-identity-records');
  await page.clickText('إضافة ملف مواطن');
  await wait(500);
  await fill('الاسم الرباعي واللقب', 'أحمد عادل كريم الموسوي');
  await fill('الرقم الوطني الموحد', '198421098312');
  await fill('العنوان الوظيفي والدرجة', 'مدرس أول لغة عربية');
  await page.clickText('حفظ الملف');
  await wait(900);
  ok('سُجّل ملف مواطن', (await page.text()).includes('أحمد عادل كريم الموسوي'));

  // ── المحرّر: الكتابة على الورقة نفسها ──────────────────────────────
  await page.goto('smart-editor-a4-preview');
  await wait(900);
  let text = await page.text();
  ok('فُتح المحرّر بورقته ولوحه', text.includes('النموذج والترويسة') && text.includes('قبل الإصدار'));
  ok('لا مسودة بعد', text.includes('لا مسودة'));

  // الإصدار قبل ملء شيء يُرفض بما يمنعه — من قائمة التحقّق
  await page.eval(`document.querySelector('[data-act="issue"]').click(); return true;`);
  await wait(400);
  ok('يرفض الإصدار بلا اسم صاحب العلاقة', (await page.eval(`return document.querySelector('[data-editor-error]')?.innerText ?? '';`)).includes('اسم صاحب العلاقة'));

  ok('حُمّلت الترويسة المحفوظة في الكتاب', (await sheetText()).includes('جمهورية العراق'));

  await page.clickText('تحرير الترويسة');
  await wait(600);
  ok('انفتح محرّر الترويسة', (await page.text()).includes('ترويسة هذا الكتاب'));
  await page.clickText('قسمان');
  await wait(300);
  await page.clickText('إظهار التاريخ والعدد', 'label');
  await wait(300);
  await page.clickText('القسم الثاني');
  await wait(200);
  await typeLines('قسم التعليم العام');
  await wait(200);
  // حقل «العدد على الكتاب» داخل الترويسة: يُكتب في خانته، لا رقم المكتب (§١)
  await page.clickText('حقل تلقائي');
  await wait(200);
  await page.eval(`
    const sel = [...document.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.textContent.includes('العدد على الكتاب')));
    const opt = [...sel.options].find(o => o.textContent.includes('العدد على الكتاب'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await wait(300);
  await page.clickExact('تم');
  await wait(400);
  ok('وُسمت الترويسة بأنها خاصّة بهذا الكتاب', (await page.text()).includes('خاصّةٌ بهذا الكتاب'));
  const withSection = await sheetText();
  ok('ظهر القسم الثاني على الورقة', withSection.includes('قسم التعليم العام'));
  ok('وبقي القسم الأول معه', withSection.includes('جمهورية العراق'));

  /** يكتب في آخر سطرٍ من الورقة — والمؤشّر في آخره، كما يكتب الموظف. */
  const typeAtEnd = async (value) => {
    await page.eval(`
      const blocks = [...document.querySelectorAll('[data-screen="editor"] [data-block]')];
      const el = blocks[blocks.length - 1];
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, ${JSON.stringify(value)});
      return true;
    `);
    await wait(250);
  };
  /** حقلٌ من كتالوج المعاملات يُدرج حيث وقف المؤشّر. */
  const catalogField = async (label) => {
    await page.eval(`document.querySelector('[data-act="add-field"]').click(); return true;`);
    await wait(400);
    await page.clickText(label, 'button');
    await wait(400);
  };

  await typeAtEnd('م / تأييد استمرار بالخدمة');
  await page.key('Enter');
  await wait(300);
  await typeAtEnd('نؤيد لكم أن السيد ');
  await page.eval(`document.querySelector('[data-act="add-field"]').click(); return true;`);
  await wait(400);
  let picker = await page.text();
  ok('انفتح كتالوج الحقول', picker.includes('أضف حقلًا إلى الكتاب'));
  ok('وفيه صاحب العلاقة ومجموعات المعاملات', picker.includes('صاحب العلاقة') && picker.includes('الأحوال المدنية والجنسية'));
  await page.clickText('الاسم الرباعي واللقب', 'button');
  await wait(400);
  await typeAtEnd(' الحامل للرقم الوطني ');
  await catalogField('الرقم الوطني / البطاقة الموحدة');
  await typeAtEnd(' بصفة ');
  await catalogField('العنوان الوظيفي');
  await typeAtEnd(' وإضبارته ');
  // حقلٌ يسمّيه المكتب بنفسه
  await page.eval(`document.querySelector('[data-act="add-field"]').click(); return true;`);
  await wait(400);
  await page.type('input[placeholder^="حقلٌ تسمّيه بنفسك"]', 'رقم الإضبارة');
  await page.clickExact('أضف');
  await wait(400);
  await typeAtEnd(' مستمر بالخدمة الفعلية.');
  await page.key('Enter');
  await wait(300);
  await typeAtEnd('المدير العام');
  const fieldsNow = await page.eval(`return [...document.querySelectorAll('[data-value-of]')].map((el) => el.getAttribute('data-value-of'));`);
  ok('الحقول على الورقة وقيمها في اللوح', fieldsNow.length === 4 && fieldsNow.includes('رقم الإضبارة'));
  ok('والحقل على ورقة التحرير صندوقٌ باسمه قبل أن يُملأ', (await page.eval(`return document.querySelector('[data-screen="editor"] [data-block] [data-field]')?.innerText ?? '';`)).includes('الاسم الرباعي'));

  // استيراد المواطن من السجل (F2)
  await page.clickText('استيراد (F2)');
  await wait(700);
  ok('انفتح حوار الاستيراد', (await page.text()).includes('استيراد من سجل المواطنين'));
  await page.clickText('أحمد عادل كريم الموسوي', 'button');
  await wait(700);
  const valueOf = (key) =>
    page.eval(`return document.querySelector('[data-value-of=${JSON.stringify(key)}] input')?.value ?? '';`);
  ok(
    'حُقنت بيانات المواطن في قيم حقوله',
    (await valueOf('الاسم الرباعي واللقب')) === 'أحمد عادل كريم الموسوي' &&
      (await valueOf('الرقم الوطني / البطاقة الموحدة')) === '198421098312' &&
      (await valueOf('العنوان الوظيفي')) === 'مدرس أول لغة عربية'
  );
  ok('والحقل على ورقة التحرير يُظهر قيمته حيث كُتب', (await page.eval(`return document.querySelector('[data-screen="editor"] [data-filled]')?.innerText ?? '';`)).length > 0);
  await page.type('[data-value-of="رقم الإضبارة"] input', '1187/ت');

  // العدد على الكتاب: ما أعطاه الزبون — ورقم المكتب لا يُولَّد فيه ولا يُطبع (§١)
  ok('لا «توليد متسلسل» لرقم المكتب', !(await page.text()).includes('توليد متسلسل'));
  await page.type('[data-editor-number]', '٤٥١٢');
  await wait(300);

  const serialNow = `م/${new Date().getFullYear()}/`;
  /** سطر العدد والتاريخ داخل الترويسة — في الورقة التي تُطبع. */
  const registry = () =>
    page.eval(`
      const el = document.querySelector('[data-screen="editor"] .a4-sheet [data-registry]');
      return el ? el.getAttribute('data-registry') + '|' + el.innerText : 'غائب';
    `);
  let line = await registry();
  ok('العدد والتاريخ في الترويسة', line.includes('العدد:') && line.includes('التاريخ:'));
  ok('والتاريخ فوق العدد', line.indexOf('التاريخ:') < line.indexOf('العدد:'));
  ok('وهو فراغ يُملأ باليد افتراضًا', line.startsWith('manual|') && !line.includes('٤٥١٢'));

  await page.clickText('تحرير الترويسة');
  await wait(500);
  await page.clickText('مطبوعان');
  await wait(300);
  await page.clickExact('تم');
  await wait(400);
  line = await registry();
  ok('اختيار «مطبوعان» يطبع العدد الذي أعطاه الزبون', line.startsWith('printed|') && line.includes('٤٥١٢'));
  ok('ولا يطبع رقم المكتب أبدًا', !line.includes(serialNow));

  await page.clickText('تحرير الترويسة');
  await wait(500);
  await page.clickText('فراغ يُملأ باليد');
  await wait(300);
  await page.clickExact('تم');
  await wait(400);
  line = await registry();
  ok('والعودة إلى الفراغ تُخفيه', line.startsWith('manual|') && !line.includes('٤٥١٢'));

  await page.clickText('تاريخ اليوم (ميلادي وهجري)');
  await wait(300);
  await page.type('input[placeholder="مثال: تأييد استمرار بالخدمة"]', 'تأييد استمرار بالخدمة');

  // «نسخة منه إلى» من قائمة الإدراج — على الورقة نفسها
  await page.eval(`document.querySelector('[data-screen="editor"] [data-act="insert"]').click(); return true;`);
  await wait(400);
  await page.eval(`document.querySelector('[data-act="ins-copies"]').click(); return true;`);
  await wait(400);

  const injected = await sheetText();
  ok('الاسم في متن الورقة التي تُطبع', injected.includes('أحمد عادل كريم الموسوي'));
  ok('والحقل المخصّص بقيمته', injected.includes('1187/ت'));
  ok('ولا وسمٌ غير محقون ولا اسم حقل بين قوسين', !injected.includes('{') && !injected.includes('[ '));
  ok('والموضوع سطرٌ على الورقة', injected.includes('م / تأييد استمرار بالخدمة'));
  ok('و«نسخة منه إلى» من قائمة الإدراج', injected.includes('نسخة منه إلى'));

  text = await page.text();
  ok(
    'لا ختم ولا توقيع ولا رمز تحقّق يُضاف إلى الورقة',
    !text.includes('رمز التحقق (QR)') &&
      !text.includes('إظهار الختم الرسمي') &&
      !text.includes('صورة التوقيع') &&
      !(await page.eval(`return !!document.querySelector('[data-slot="qr"]');`))
  );
  ok('لا يُطبع تاريخ تحت الموقّع', injected.includes('المدير العام') && (injected.match(/أيلول|تشرين|كانون/g) ?? []).length === 0);

  // قائمة التحقّق: لا ما يمنع، وقياس الترويسة من الورقة
  const checks = await page.eval(`return [...document.querySelectorAll('[data-check]')].map((li) => li.getAttribute('data-check') + '|' + li.innerText);`);
  ok('قائمة التحقّق: لا شيء يمنع الإصدار', checks.length > 0 && !checks.some((c) => c.startsWith('block|')));
  ok('وتقيس الترويسة من الورقة', checks.some((c) => c.includes('الترويسة تشغل')));

  // «جرّبها»: المعاينة بقيمٍ وهمية للفارغ، والإصدار بالحقيقية
  await page.eval(`document.querySelector('[data-view="preview"]').click(); return true;`);
  await wait(400);
  ok('المعاينة كما تُطبع', await page.eval(`return Boolean(document.querySelector('[data-preview] .a4-sheet'));`));
  await page.eval(`document.querySelector('[data-view="edit"]').click(); return true;`);
  await wait(400);

  // الحفظ التلقائي للمسودة
  await wait(4500);
  ok('حُفظت المسودة تلقائيًا', (await page.text()).includes('حُفظت المسودة'));

  if (shotsDir) await page.shot(join(shotsDir, 'editor-before-issue.png'));

  // ── الإصدار ────────────────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-act="issue"]').click(); return true;`);
  await wait(600);
  ok('انفتح حوار الإصدار', (await page.text()).includes('إصدار الكتاب'));

  // والمال صامت (§١): لا خانة رسومٍ في حوار الإصدار.
  ok('ولا رسوم فيه', !(await page.text()).includes('الرسوم'));
  await fill('عدد النسخ', '2');
  await page.clickText('إصدار وقيد بلا طباعة');
  await wait(2500);

  text = await page.text();
  ok('أُعلن صدور الكتاب', text.includes('صدر الكتاب'));
  ok('عُرضت بصمة التوثيق', text.includes('البصمة:'));
  if (shotsDir) await page.shot(join(shotsDir, 'issued.png'));
  await page.clickExact('تم');
  await wait(500);

  // ── التفتيش في القاعدة، لا في الشاشة ───────────────────────────────
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const doc = db.prepare('SELECT * FROM documents').get();
  const prints = db.prepare('SELECT reason, copies FROM document_prints').all();
  const drafts = db.prepare('SELECT COUNT(*) AS n FROM drafts').get();
  const counter = db.prepare("SELECT last_value AS v FROM counters WHERE scope='outgoing'").get();
  const audit = db.prepare("SELECT action FROM audit_log WHERE entity='document'").all();
  db.close();

  ok('قُيّد الكتاب في سجل الصادر', Boolean(doc));
  ok('حمل رقم صادر متسلسلًا', doc?.serial === `م/${new Date().getFullYear()}/1`);
  ok('استُهلك رقم واحد لا أكثر', counter?.v === 1);
  ok('حُفظت البصمة كاملة', /^[0-9a-f]{64}$/.test(doc?.sha256 ?? ''));
  ok('حُفظت النسخ، والرسوم صفرٌ صامت', doc?.fee === 0 && doc?.copies === 2);
  ok('حُفظ اسم صاحب العلاقة', doc?.citizen_name === 'أحمد عادل كريم الموسوي');
  ok('رُبط بملف المواطن', Number.isInteger(doc?.citizen_id));
  ok('ورقم المكتب لم يُطبع على الكتاب — قيدٌ في الأرشيف وحده', !(doc?.body_html ?? '').includes(doc?.serial ?? '—'));
  ok('والعدد الذي أعطاه الزبون على الكتاب', (doc?.body_html ?? '').includes('٤٥١٢'));
  ok('لم يبقَ موضع محجوز في الورقة', !(doc?.body_html ?? '').includes('{{DIWAN_'));
  ok('ولا رمز تحقّق في الورقة المحفوظة', !(doc?.body_html ?? '').includes('data-slot="qr"'));
  ok('كُتبت صورة البحث المطبَّعة', (doc?.search_fold ?? '').includes('احمد'));
  ok('قُيّدت الطباعة الأولى', prints.length === 1 && prints[0]?.reason === 'إصدار أول');
  ok('دُوّن الإصدار في سجل التدقيق', audit.length === 1);
  ok('حُذفت المسودة بعد الإصدار', drafts?.n === 0);
  ok('العدد والتاريخ خرجا فراغًا منقوطًا في الترويسة',
    (doc?.body_html ?? '').includes('العدد:') &&
      (doc?.body_html ?? '').includes('التاريخ:') &&
      (doc?.body_html ?? '').includes('dotted'));
  ok('والرقم مقيَّد في السجل على كل حال', /^م\/\d{4}\/1$/.test(doc?.serial ?? ''));
  ok('ترويسة الكتاب حُفظت مع قيمه', (doc?.values_json ?? '').includes('__letterhead'));
  ok('وورقته كتلًا حُفظت معها', (doc?.values_json ?? '').includes('__doc'));
  ok('منها الحقل المخصّص بقيمته', (doc?.values_json ?? '').includes('رقم الإضبارة') && (doc?.values_json ?? '').includes('1187/ت'));
  ok('وقسماها ظهرا في الورقة المحفوظة',
    (doc?.body_html ?? '').includes('قسم التعليم العام') &&
      (doc?.body_html ?? '').includes('جمهورية العراق'));

  // نسخة PDF المؤرشفة — وهي محرّك الرسم نفسه الذي تستعمله الطباعة
  const pdfPath = doc?.rendered_path ? join(profile, 'data', 'store', doc.rendered_path) : null;
  ok('قُيّد مسار النسخة المؤرشفة', Boolean(doc?.rendered_path));
  ok('كُتب ملف PDF على القرص', Boolean(pdfPath && existsSync(pdfPath)));
  if (pdfPath && existsSync(pdfPath)) {
    ok('الملف PDF صالح وله حجم', readFileSync(pdfPath, { encoding: 'latin1', flag: 'r' }).startsWith('%PDF') && statSync(pdfPath).size > 5000);
  }

  // ── الأرشيف ────────────────────────────────────────────────────────
  await page.goto('transactions-archive-ledger');
  await wait(900);
  text = await page.text();
  ok('ظهر الكتاب في سجل اليوم', text.includes(doc?.serial ?? '—'));
  ok('عُدّ في مؤشر اليوم', text.includes('1') && text.includes('الكتب الصادرة اليوم'));
  ok('ولا إيراد ولا رسوم في الأرشيف', !text.includes('الإيراد') && !text.includes('د.ع'));
  ok('ظهرت بصمة الكتاب للتدقيق', text.includes(doc?.sha256?.slice(0, 16) ?? '—'));

  // البحث داخل الأرشيف — متساهل مع الهمزة
  await page.type('input[placeholder^="ابحث برقم الصادر"]', 'احمد');
  await wait(700);
  ok('البحث المتساهل يجد الكتاب', (await page.text()).includes(doc?.serial ?? '—'));
  await page.type('input[placeholder^="ابحث برقم الصادر"]', 'لا وجود له');
  await wait(700);
  ok('البحث الخائب يبلّغ بصدق', (await page.text()).includes('لا كتاب يطابق البحث اليوم'));

  if (shotsDir) await page.shot(join(shotsDir, 'archive.png'));

  // ── التقارير: في الأرشيف نفسه (د١٠) — سطرُ أرقامٍ لا بطاقات ────────────
  await page.type('input[placeholder^="ابحث برقم الصادر"]', '');
  await wait(700);
  text = await page.text();
  ok('الأرشيف والبحث شاشةٌ واحدة', text.includes('الأرشيف والبحث') && !text.includes('البحث والتقارير الدورية'));
  ok('عدّت الكتب الصادرة', text.includes('من الكتب الصادرة'));
  ok('ظهر الكتاب في مدة اليوم', text.includes(doc?.serial ?? '—'));
  ok('ظهر توزيع أنواع الوثائق', text.includes('توزيع الكتب حسب نوع الوثيقة'));
  ok('عُدّت النسخ المطبوعة', text.includes('من النسخ المطبوعة'));
  ok('ولا بطاقات أرقامٍ كبيرة', !(await page.eval(`return Boolean(document.querySelector('[data-archive] .font-headline-xl'));`)));

  await page.clickText('هذه السنة');
  await wait(800);
  ok('مدّة السنة تشمل الكتاب', (await page.text()).includes(doc?.serial ?? '—'));

  await page.clickText('مدة مخصّصة');
  await wait(600);
  ok('ظهر حدّا المدة المخصّصة', (await page.text()).includes('من'));

  if (shotsDir) await page.shot(join(shotsDir, 'reports.png'));

  // ── أدوات الإخراج: تُضغط ويُفتَّش عن ملفاتها على القرص ────────────────
  if (saveDir) {
    // تقرير المدة Excel من شاشة التقارير
    await page.clickText('هذه السنة');
    await wait(700);
    await page.clickText('تصدير التقرير Excel');
    await wait(3000);
    const xlsx = saved('.xlsx');
    ok('صُدِّر تقرير Excel', xlsx.length === 1);
    ok(
      'ملف Excel حزمة صالحة',
      xlsx.length === 1 && headerOf(xlsx[0], 2) === 'PK' && bytesOf(xlsx[0]) > 3000
    );
    ok('أعلن التطبيق مسار التقرير', (await page.text()).includes('حُفظ التقرير'));

    // حفظ الكتاب PDF من شاشة الأرشيف
    await page.goto('transactions-archive-ledger');
    await wait(900);
    await page.clickText('حفظ نسخة PDF');
    await wait(3500);
    const pdfs = saved('.pdf');
    ok('حُفظ الكتاب PDF من الأرشيف', pdfs.length === 1);
    ok('ملف PDF صالح', pdfs.length === 1 && headerOf(pdfs[0], 4) === '%PDF');
    // خطٌّ مضمَّن = نصٌّ رُسم فعلًا؛ الورقة البيضاء صالحةُ الترويسة أيضًا ولا خطّ فيها.
    ok('وفيه نصّ الكتاب لا ورقة بيضاء', pdfs.length === 1 && readFileSync(join(saveDir, pdfs[0]), 'latin1').includes('/FontFile'));

    // النسخ الاحتياطي الكامل
    await page.clickText('نسخ احتياطي فوري');
    const backupAnnounced = await awaitText('حُفظت نسخة احتياطية');
    const zips = saved('.zip');
    ok('أُنشئت نسخة احتياطية', zips.length === 1);
    ok(
      'الأرشيف حزمة صالحة وفيه القاعدة',
      zips.length === 1 &&
        headerOf(zips[0], 2) === 'PK' &&
        readFileSync(join(saveDir, zips[0]), { encoding: 'latin1' }).includes('diwan.db')
    );
    ok('أعلن التطبيق حجم النسخة', backupAnnounced);

    // تصدير الورقة الجارية Word ثم صورة 300 نقطة/إنش — من المحرر
    await page.goto('smart-editor-a4-preview');
    await wait(900);
    await typeAtEnd('نؤيد لكم أن السيد أحمد عادل كريم الموسوي مستمر بالخدمة الفعلية.');
    await wait(400);

    // أوّل سطرٍ في ترويسة الورقة المطبوعة — ليُبحث عنه في Word.
    const headLine = await page.eval(`
      const h = document.querySelector('[data-letter-sheet] [data-letterhead]');
      return h ? h.innerText.split(String.fromCharCode(10)).map((s) => s.trim()).find((s) => s.length > 3) ?? null : null;
    `);
    await page.eval(`document.querySelector('[data-act="export-word"]').click(); return true;`);
    await wait(4000);
    const docx = saved('.docx');
    ok('صُدِّرت الورقة Word', docx.length === 1);
    ok(
      'ملف Word حزمة صالحة',
      docx.length === 1 && headerOf(docx[0], 2) === 'PK' && bytesOf(docx[0]) > 2000
    );
    if (docx.length === 1) {
      // تعميق الموجود ٩: من الوثيقة بتنسيقها لا من علامات الورقة نصًّا مسطَّحًا.
      const files = unzipSync(new Uint8Array(readFileSync(join(saveDir, docx[0]))));
      const x = strFromU8(files['word/document.xml']) + Object.keys(files).filter((k) => /^word\/header\d*\.xml$/.test(k)).map((k) => strFromU8(files[k])).join('');
      ok('في Word نصّ الكتاب', x.includes('مستمر بالخدمة الفعلية'));
      ok(`وترويسته كما في الورقة (${headLine ?? 'بلا ترويسة'})`, !headLine || x.includes(headLine));
      ok('والفقرات عربيّةٌ من اليمين، بلا علامات HTML', x.includes('<w:bidi/>') && !/&lt;(p|div|span|strong)/.test(x));
    }

    await page.eval(`document.querySelector('[data-act="export-png"]').click(); return true;`);
    await wait(9000);
    const pngs = saved('.png');
    ok('صُدِّرت صورة بدقة عالية', pngs.length === 1);
    if (pngs.length === 1) {
      const head = readFileSync(join(saveDir, pngs[0]));
      const width = head.readUInt32BE(16);
      const height = head.readUInt32BE(20);
      const phys = head.indexOf('pHYs', 0, 'latin1');
      const perMetre = phys > 0 ? head.readUInt32BE(phys + 4) : 0;
      ok('الصورة PNG صالحة', head.slice(1, 4).toString('latin1') === 'PNG');
      ok(`مقاسها A4 عند 300 نقطة/إنش (${width}×${height})`, width === 2480 && height >= 3506);
      ok(`الدقّة مكتوبة في الصورة (${Math.round(perMetre * 0.0254)} نقطة/إنش)`, perMetre === 11811);
    }
  }

  // ── البحث الشامل (د٢): الكتاب ومعه ملف المواطن ────────────────────────
  await page.goto('service-counter');
  await wait(500);
  await page.type('[data-global-search]', 'الموسوي');
  await wait(1000);
  // النتائج في مكانها تحت الحقل (خطة Production، ٣٫٤)، وEnter يفتحها كلّها في الأرشيف.
  ok('البحث الشامل يعرض الكتاب تحت الحقل', await page.eval(`return [...document.querySelectorAll('[data-search-results] [data-search-doc]')].some((b) => b.dataset.searchDoc === ${JSON.stringify(doc?.serial ?? '—')});`));
  await page.eval(`document.querySelector('[data-global-search]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true;`);
  await wait(1000);
  ok('وEnter يصل إلى الأرشيف', await page.eval(`return Boolean(document.querySelector('[data-archive]'));`));
  ok('ويجد الكتاب في الأرشيف كلّه', (await page.text()).includes(doc?.serial ?? '—'));
  ok('ومعه ملف المواطن', await page.eval(`return [...document.querySelectorAll('[data-search-others] [data-act="open-citizen"]')].some((b) => b.innerText.includes('أحمد عادل كريم الموسوي'));`));
  await page.eval(`document.querySelector('[data-search-others] [data-act="open-citizen"]').click(); return true;`);
  await wait(900);
  ok('وضغطةٌ عليه تفتح ملفّه', (await page.text()).includes('أحمد عادل كريم الموسوي') && (await page.eval(`return location.hash || document.querySelector('[aria-current="page"]')?.getAttribute('data-path') || '';`)).includes('citizens'));
  await page.type('[data-global-search]', '');
  await wait(300);

  // ── الإبطال بسببه (د٣): يبقى برقمه ولا يُعاد طبعه ─────────────────────
  await page.goto('transactions-archive-ledger');
  await wait(900);
  await page.eval(`document.querySelector('[data-inspect] [data-act="void"]').click(); return true;`);
  await wait(300);
  await page.type('[data-void-reason]', 'صدر باسمٍ خاطئ');
  await page.eval(`document.querySelector('[data-act="void-confirm"]').click(); return true;`);
  await wait(900);
  text = await page.text();
  ok('أُبطل الكتاب وقيل ذلك', text.includes(`أُبطل ${doc?.serial}`));
  ok('ويبقى في الأرشيف برقمه وسببه', await page.eval(`return document.querySelector('[data-row-status="void"]')?.innerText.includes(${JSON.stringify(doc?.serial ?? '')}) ?? false;`) && text.includes('مُبطَل: صدر باسمٍ خاطئ'));
  ok('ولا يُعاد طبعه', await page.eval(`return document.querySelector('[data-row-status="void"] button[title^="مُبطَل"]')?.disabled ?? false;`));
  ok('وتاريخه في السجلّ: صدر ثم أُبطل', await page.eval(`const h = document.querySelector('[data-history]')?.innerText ?? ''; return h.indexOf('صدر') >= 0 && h.indexOf('أُبطل') > h.indexOf('صدر');`));
  const voided = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const vrow = voided.prepare('SELECT status, void_reason AS reason, serial FROM documents WHERE id = ?').get(doc?.id ?? 0);
  voided.close();
  ok('وفي القاعدة: الحال والسبب، والرقم كما هو', vrow?.status === 'void' && vrow?.reason === 'صدر باسمٍ خاطئ' && vrow?.serial === doc?.serial);

  // ── سجلّ التدقيق وسلامة الأرشيف (د٤ ود٥) ─────────────────────────────
  await page.goto('audit-log-integrity');
  await wait(900);
  ok('سجلّ التدقيق: الإصدار والإبطال بمن فعلهما', await page.eval(`return Boolean(document.querySelector('[data-audit-row="document/issue"]')) && Boolean(document.querySelector('[data-audit-row="document/void"]'));`));
  await page.eval(`document.querySelector('[data-act="verify-archive"]').click(); return true;`);
  await wait(1200);
  ok('والأرشيف سليم: بصمةٌ من كل متن، وسلسلةٌ متّصلة', await page.eval(`return document.querySelector('[data-check-result]')?.getAttribute('data-check-result') === 'ok';`));
  ok('وبصمة آخر السلسلة تُعرض لتُحفظ خارج الجهاز', /^[0-9a-f]{64}$/.test(await page.eval(`return document.querySelector('[data-chain-head]')?.innerText.trim() ?? '';`)));

  return steps.join('\n');
}
