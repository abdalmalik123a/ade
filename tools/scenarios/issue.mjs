/**
 * سيناريو: حلقة الإصدار كاملة على التطبيق الحقيقي.
 *
 * ترويسة تُبنى، ومواطن يُسجَّل، ثم كتاب يُكتب في المحرر ويُستورد له المواطن بـF2،
 * ثم يصدر ويُقيَّد — فيُفتَّش عنه في القاعدة: رقم الصادر والبصمة ورمز التحقق
 * والقيد في سجل الطباعة. ثم تُقرأ شاشتا الأرشيف والبحث للتأكّد أنه ظهر فيهما.
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

  /** نصّ الورقة وحدها — لا لوح الإدخال، فقيم الحقول ليست على الورقة. */
  const sheetText = () =>
    page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);

  /** يجد المدخل التابع لعنوان، ولو كان في صفّ تحته لا بجانبه. */
  const INPUT_OF_LABEL = `
    const labels = [...document.querySelectorAll('label')];
    const l = labels.find(x => x.textContent.trim().startsWith(LABEL));
    const box = l?.closest('div.flex-col') ?? l?.parentElement;
    const input = box?.querySelector('input, textarea');
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
  await page.goto(4);
  await page.type('input[placeholder^="مثال: مديرية"]', 'مديرية تربية بغداد / الرصافة الأولى');
  await typeLines('جمهورية العراق — وزارة التربية');
  await page.clickText('حفظ الترويسة');
  await wait(800);
  ok('بُنيت ترويسة وحُفظت', (await page.text()).includes('حُفظت الترويسة'));

  // ── مواطن يُسجَّل ليُستورد لاحقًا بـF2 ──────────────────────────────
  await page.goto(3);
  await page.clickText('إضافة ملف مواطن');
  await wait(500);
  await fill('الاسم الرباعي واللقب', 'أحمد عادل كريم الموسوي');
  await fill('الرقم الوطني الموحد', '198421098312');
  await fill('العنوان الوظيفي والدرجة', 'مدرس أول لغة عربية');
  await page.clickText('حفظ الملف');
  await wait(900);
  ok('سُجّل ملف مواطن', (await page.text()).includes('أحمد عادل كريم الموسوي'));

  // ── المحرر ─────────────────────────────────────────────────────────
  await page.goto(0);
  await wait(600);
  let text = await page.text();
  ok('فُتح المحرر', text.includes('محرر الكتب الرسمية الذكي'));
  ok('لا مسودة بعد', text.includes('الحفظ التلقائي: لا مسودة'));

  // الإصدار قبل ملء شيء يجب أن يُرفض
  await page.clickText('إصدار وطباعة الورقة الرسمية');
  await wait(400);
  ok('يرفض الإصدار بلا اسم', (await page.text()).includes('لا يصدر كتاب بلا اسم صاحب العلاقة'));

  // ترويسة الكتاب: تأتي من المحفوظة، وتُحرَّر مع الكتاب نفسه
  ok('حُمّلت الترويسة المحفوظة في الكتاب', (await sheetText()).includes('جمهورية العراق'));

  await page.clickText('تحرير الترويسة');
  await wait(600);
  ok('انفتح محرّر الترويسة', (await page.text()).includes('ترويسة هذا الكتاب'));

  await page.clickText('قسمان');
  await wait(300);
  // العدد والتاريخ موضعهما القسم الأخير من الترويسة، لا متن الكتاب
  await page.clickText('إظهار التاريخ والعدد', 'label');
  await wait(300);
  await page.clickText('القسم الثاني');
  await wait(200);
  await typeLines('قسم التعليم العام');
  await wait(200);

  // حقل رقم الصادر داخل الترويسة: يُملأ عند الإصدار لا قبله
  await page.clickText('حقل تلقائي');
  await wait(200);
  await page.eval(`
    const sel = [...document.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.textContent.includes('رقم الصادر')));
    const opt = [...sel.options].find(o => o.textContent.includes('رقم الصادر'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await wait(300);
  ok('وُسمت الترويسة بأنها خاصّة بهذا الكتاب', (await page.text()).includes('خاصّة بهذا الكتاب'));
  await page.clickExact('تم');
  await wait(400);
  const withSection = await sheetText();
  ok('ظهر القسم الثاني على الورقة', withSection.includes('قسم التعليم العام'));
  ok('وبقي القسم الأول معه', withSection.includes('جمهورية العراق'));

  // استيراد المواطن من السجل (F2)
  await page.clickText('استيراد (F2)');
  await wait(700);
  ok('انفتح حوار الاستيراد', (await page.text()).includes('استيراد من سجل المواطنين'));
  await page.clickText('أحمد عادل كريم الموسوي', 'button');
  await wait(600);
  // قيم الحقول ليست في نصّ الصفحة، فتُقرأ من الحقول نفسها.
  const fieldValue = (label) =>
    page.eval(`
      ${INPUT_OF_LABEL.replace('LABEL', JSON.stringify(label))}
      return input?.value ?? '';
    `);
  ok(
    'حُقنت بيانات المواطن في الحقول',
    (await fieldValue('الاسم الرباعي واللقب')) === 'أحمد عادل كريم الموسوي' &&
      (await fieldValue('الرقم الوطني / البطاقة الموحدة')) === '198421098312'
  );

  // رقم الصادر: اطّلاع لا يستهلك
  await page.clickText('توليد متسلسل');
  await wait(400);
  ok('عُرض رقم الاطّلاع', (await page.text()).includes('م/'));

  // الأصل أن يكتب العدد والتاريخ موظّفُ الاستلام بخطّه
  const serialNow = `م/${new Date().getFullYear()}/1`;
  /** سطر العدد والتاريخ داخل الترويسة — لا بقيّة الورقة. */
  const registry = () =>
    page.eval(`
      const el = document.querySelector('.a4-sheet [data-registry]');
      return el ? el.getAttribute('data-registry') + '|' + el.innerText : 'غائب';
    `);

  let line = await registry();
  ok('العدد والتاريخ في الترويسة', line.includes('العدد:') && line.includes('التاريخ:'));
  ok('والتاريخ فوق العدد', line.indexOf('التاريخ:') < line.indexOf('العدد:'));
  ok('وهو فراغ يُملأ باليد افتراضًا', line.startsWith('manual|') && !line.includes(serialNow));

  await page.clickText('تحرير الترويسة');
  await wait(500);
  await page.clickText('مطبوعان');
  await wait(300);
  await page.clickExact('تم');
  await wait(400);
  line = await registry();
  ok('اختيار «مطبوعان» يطبع الرقم في سطر العدد', line.startsWith('printed|') && line.includes(serialNow));

  await page.clickText('تحرير الترويسة');
  await wait(500);
  await page.clickText('فراغ يُملأ باليد');
  await wait(300);
  await page.clickExact('تم');
  await wait(400);
  line = await registry();
  ok('والعودة إلى الفراغ تُخفيه', line.startsWith('manual|') && !line.includes(serialNow));

  await page.clickText('ختم تاريخ اليوم');
  await wait(300);

  // حقول المعاملة: من الكتالوج الرسمي، وحقل يسمّيه المكتب بنفسه
  await page.clickText('إضافة حقل');
  await wait(500);
  ok('انفتح كتالوج الحقول', (await page.text()).includes('إضافة حقل إلى الكتاب'));
  ok('فيه مجموعات المعاملات', (await page.text()).includes('الأحوال المدنية والجنسية'));
  await page.clickText('العنوان الوظيفي', 'button');
  await wait(400);

  await page.clickText('إضافة حقل');
  await wait(500);
  await page.type('input[placeholder="مثال: رقم الإضبارة"]', 'رقم الإضبارة');
  await page.clickExact('إضافة');
  await wait(400);
  ok('أُضيف حقل مخصّص يسمّيه المكتب', (await page.text()).includes('رقم الإضبارة'));

  await fill('العنوان الوظيفي', 'مدرس أول لغة عربية');
  await fill('رقم الإضبارة', '1187/ت');
  await fill('الجهة الموجه إليها الكتاب', 'مصرف الرافدين — فرع الفردوس');
  await fill('الغرض من الكتاب', 'ترويج معاملة سلفة شخصية');
  await fill('سطر الموضوع (م /)', 'تأييد استمرار بالخدمة');
  await fill('نوع الوثيقة (للسجل)', 'تأييد استمرار بالخدمة');
  await fill('الموقّع والمخوّل بالتوقيع', 'المدير العام');
  await fill(
    'المتن الرسمي',
    'نؤيد لكم أن السيد {الاسم} الحامل للرقم الوطني {الرقم_الوطني} بصفة {العنوان_الوظيفي} ' +
      'وإضبارته {رقم_الإضبارة} مستمر بالخدمة الفعلية.'
  );
  await fill('نسخة منه إلى (سطر لكل جهة)', 'قسم الملاك والملفات الشخصية');
  await wait(400);

  // على الورقة وحدها: لوح الإدخال يعرض الوسوم أزرارًا، فلا يصلح للفحص
  const injected = await sheetText();
  ok('حُقن الاسم في متن الورقة', injected.includes('أحمد عادل كريم الموسوي'));
  ok('وحُقن الحقل المخصّص بوسمه', injected.includes('1187/ت'));
  ok('ولم يبقَ وسم غير محقون على الورقة', !injected.includes('{العنوان_الوظيفي}'));
  text = await page.text();
  ok('ظهر الموضوع على الورقة', text.includes('م / تأييد استمرار بالخدمة'));
  ok('ظهرت جهة النسخ', text.includes('نسخة منه إلى:'));

  // رمز التحقق يُرسم محليًا قبل الإصدار (معاينة)
  await page.clickText('رمز التحقق (QR)', 'label');
  await wait(400);
  ok(
    'رُسم رمز التحقق في المعاينة',
    await page.eval(`return !!document.querySelector('[data-slot="qr"] svg');`)
  );

  // الموقّع يكتب التاريخ بخطّه، فلا يُطبع تحت اسمه
  const withDate = await sheetText();
  ok(
    'لا يُطبع تاريخ تحت الموقّع',
    withDate.includes('المدير العام') && (withDate.match(/أيلول/g) ?? []).length === 0
  );

  // الحفظ التلقائي للمسودة
  await wait(4500);
  ok('حُفظت المسودة تلقائيًا', (await page.text()).includes('الحفظ التلقائي: حُفظت'));

  if (shotsDir) await page.shot(join(shotsDir, 'editor-before-issue.png'));

  // ── الإصدار ────────────────────────────────────────────────────────
  await page.clickText('إصدار وطباعة الورقة الرسمية');
  await wait(600);
  ok('انفتح حوار الإصدار', (await page.text()).includes('إصدار الكتاب الرسمي'));

  await fill('الرسوم (د.ع)', '1000');
  await fill('عدد النسخ', '2');
  await page.clickText('إصدار وقيد بلا طباعة');
  await wait(2500);

  text = await page.text();
  ok('أُعلن صدور الكتاب', text.includes('صدر الكتاب'));
  ok('عُرضت بصمة التوثيق', text.includes('بصمة التوثيق (SHA-256)'));
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
  ok('حُفظت الرسوم والنسخ', doc?.fee === 1000 && doc?.copies === 2);
  ok('حُفظ اسم صاحب العلاقة', doc?.citizen_name === 'أحمد عادل كريم الموسوي');
  ok('رُبط بملف المواطن', Number.isInteger(doc?.citizen_id));
  ok('الرقم النهائي حُقن في الورقة', (doc?.body_html ?? '').includes(doc?.serial ?? '—'));
  ok('لم يبقَ موضع محجوز في الورقة', !(doc?.body_html ?? '').includes('{{DIWAN_'));
  ok('رُسم رمز التحقق في المتن المحفوظ', (doc?.body_html ?? '').includes('<svg'));
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
  ok('وحقول المعاملة حُفظت معها', (doc?.values_json ?? '').includes('__fields'));
  ok('منها الحقل المخصّص بقيمته', (doc?.values_json ?? '').includes('رقم_الإضبارة'));
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
  await page.goto(2);
  await wait(900);
  text = await page.text();
  ok('ظهر الكتاب في سجل اليوم', text.includes(doc?.serial ?? '—'));
  ok('عُدّ في مؤشر اليوم', text.includes('1') && text.includes('الكتب الصادرة اليوم'));
  ok('ظهر الإيراد المستوفى', text.includes('1,000'));
  ok('ظهرت بصمة الكتاب للتدقيق', text.includes(doc?.sha256?.slice(0, 16) ?? '—'));

  // البحث داخل الأرشيف — متساهل مع الهمزة
  await page.type('input[placeholder^="ابحث برقم الصادر"]', 'احمد');
  await wait(700);
  ok('البحث المتساهل يجد الكتاب', (await page.text()).includes(doc?.serial ?? '—'));
  await page.type('input[placeholder^="ابحث برقم الصادر"]', 'لا وجود له');
  await wait(700);
  ok('البحث الخائب يبلّغ بصدق', (await page.text()).includes('لا كتاب يطابق البحث اليوم'));

  if (shotsDir) await page.shot(join(shotsDir, 'archive.png'));

  // ── البحث والتقارير ────────────────────────────────────────────────
  await page.goto(5);
  await wait(900);
  text = await page.text();
  ok('فُتحت شاشة التقارير', text.includes('نتائج البحث'));
  ok('عدّت الكتب الصادرة', text.includes('الكتب الصادرة'));
  ok('ظهر الكتاب في مدة اليوم', text.includes(doc?.serial ?? '—'));
  ok('ظهر توزيع أنواع الوثائق', text.includes('توزيع الكتب حسب نوع الوثيقة'));
  ok('عُدّت النسخ المطبوعة', text.includes('النسخ المطبوعة'));

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
    await page.goto(2);
    await wait(900);
    await page.clickText('حفظ نسخة PDF');
    await wait(3500);
    const pdfs = saved('.pdf');
    ok('حُفظ الكتاب PDF من الأرشيف', pdfs.length === 1);
    ok('ملف PDF صالح', pdfs.length === 1 && headerOf(pdfs[0], 4) === '%PDF');

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
    await page.goto(0);
    await wait(900);
    await page.clickText('استيراد (F2)');
    await wait(700);
    await page.clickText('أحمد عادل كريم الموسوي', 'button');
    await wait(500);
    await fill('المتن الرسمي', 'نؤيد لكم أن السيد {الاسم} مستمر بالخدمة الفعلية.');
    await wait(400);

    await page.clickText('تصدير Word');
    await wait(4000);
    const docx = saved('.docx');
    ok('صُدِّرت الورقة Word', docx.length === 1);
    ok(
      'ملف Word حزمة صالحة',
      docx.length === 1 && headerOf(docx[0], 2) === 'PK' && bytesOf(docx[0]) > 2000
    );

    await page.clickText('تصدير بدقة عالية');
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

  return steps.join('\n');
}
