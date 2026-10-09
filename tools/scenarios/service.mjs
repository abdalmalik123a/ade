/**
 * سيناريو: الشبّاك — اختر واملأ وراجع واطبع، والزبون واقف.
 *
 * يستورد مجلد المكتب أولًا ليكون في المكتبة ما يُختار، ويسجّل مواطنًا ليُستورد
 * بـF2، ثم يمرّ بالخطوات الثلاث ويُصدر ورقتين، ثم يفتّش في القاعدة: معاملة
 * واحدة، ورقمان مستقلّان، وبصمتان.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'tests', 'fixtures', 'school-warning.docx');
const FOLDER = join(process.env.TEMP ?? '.', `diwan-service-${Date.now()}`);

export async function prepare() {
  rmSync(FOLDER, { recursive: true, force: true });
  mkdirSync(FOLDER, { recursive: true });
  copyFileSync(FIXTURE, join(FOLDER, 'انذار.docx'));
  copyFileSync(FIXTURE, join(FOLDER, 'تأييد.docx'));
  // «أعد الطبع» من ملفّ الزبون (د١): الطلب يُكتب سطرًا في السجلّ بدل الطابعة.
  return { DIWAN_TEST_OPEN_DIR: FOLDER, DIWAN_TEST_PRINT_LOG: join(FOLDER, 'print.log') };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const fill = async (label, value) => {
    const done = await page.eval(`
      const labels = [...document.querySelectorAll('label')];
      const l = labels.find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      const input = l?.querySelector('input') ?? l?.parentElement?.querySelector('input');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(150);
    return done;
  };

  // ── مكتبة تُملأ من مجلد، ومواطن يُسجَّل ─────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(600);
  await page.clickText('استورد مجلدي');
  await wait(4000);
  // البطاقتان متطابقتان، فالثانية مُنزوعة الاختيار — نقبلها لنختار منها في الشبّاك
  await page.eval(`
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
    boxes.forEach((b) => { if (!b.checked) b.click(); });
  `);
  await wait(400);
  await page.clickText('احفظ 2 بطاقة');
  await wait(2500);
  ok('امتلأت المكتبة من المجلد', (await page.text()).includes('حُفظت 2 بطاقة'));

  await page.goto('citizens-identity-records');
  await page.clickText('إضافة ملف مواطن');
  await wait(600);
  await fill('الاسم الرباعي واللقب', 'أحمد عادل كريم الموسوي');
  await fill('الرقم الوطني الموحد', '198421098312');
  await page.clickText('حفظ الملف');
  await wait(900);

  // ── الشبّاك ────────────────────────────────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  let text = await page.text();
  ok('فُتح الشبّاك بخطواته الثلاث', text.includes('اختر') && text.includes('املأ') && text.includes('راجع'));
  ok('وعُرضت بطاقات الاستمارات', text.includes('انذار'));

  // ١ — اختر ورقتين
  const chosen = await page.eval(`
    const cards = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('انذار'));
    cards.slice(0, 2).forEach((b) => b.click());
    return cards.length;
  `);
  await wait(400);
  ok('اختير أكثر من ورقة', chosen >= 2);
  ok('وعُدّت المختارات', (await page.text()).includes('2 ورقة مختارة'));

  await page.clickText('املأ (2)');
  await wait(1200);

  // ٢ — املأ مرّة واحدة
  text = await page.text();
  ok('انتقل إلى الملء', text.includes('بيانات صاحب العلاقة'));
  ok('وقال إن الملء مرّة واحدة للورقتين', text.includes('تُكتب مرّة وتملأ 2 أوراق'));

  const fieldCount = await page.eval(`
    return document.querySelectorAll('input[type="text"]').length;
  `);
  ok('وعُرض اتحاد الحقول بلا تكرار', fieldCount > 0 && fieldCount < 12);

  await page.clickText('هات الزبون');
  await wait(800);
  ok('انفتح البحث في الزبائن', await page.eval(`return Boolean(document.querySelector('input[placeholder="اسم المواطن أو رقمه"]'));`));
  await page.clickText('أحمد عادل كريم الموسوي', 'button');
  await wait(800);
  ok('استُوردت بيانات المواطن', (await page.text()).includes('استُوردت بيانات المواطن'));

  const filled = await page.eval(`
    return [...document.querySelectorAll('input[type="text"]')].map((i) => i.value).join(' | ');
  `);
  ok('ومُلئ اسم التلميذ من السجل', filled.includes('أحمد عادل كريم الموسوي'));

  await page.clickText('راجع الأوراق');
  await wait(1200);

  // ٣ — راجع ثم اطبع
  text = await page.text();
  ok('انتقل إلى المراجعة', text.includes('ورقة 1 من 2'));
  const sheets = await page.eval(`return document.querySelectorAll('.a4-sheet').length;`);
  ok('ورُسمت الورقتان بالكامل', sheets === 2);
  ok('والاسم ظاهر على الورقة', (await page.eval(`
    return document.querySelector('.a4-sheet')?.innerText ?? '';
  `)).includes('أحمد عادل كريم الموسوي'));

  if (shotsDir) await page.shot(join(shotsDir, 'service-review.png'));

  // والمال صامت (§١): لا خانة أجرةٍ في شريط القرار.
  ok('لا أجرة ولا رسوم في الشبّاك', !(await page.text()).includes('الأجرة'));

  await page.clickText('احفظ بلا طباعة');
  await wait(1500);
  const afterText = () => page.eval(`return document.querySelector('[data-after-print]')?.innerText ?? '';`);
  ok('حُفظت المعاملة، والشريط يقول ما خرج', (await afterText()).includes('حُفظت ورقتان بلا طباعة') && (await afterText()).includes('في السجلّ برقم'));
  ok('وعاد إلى الاختيار لزبون جديد', (await page.text()).includes('اختر'));

  // ── التفتيش في القاعدة ─────────────────────────────────────────────
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const tx = db.prepare('SELECT id, sheets, fee, citizen_name AS name FROM transactions').all();
  const docs = db
    .prepare('SELECT id, serial, sha256, transaction_id AS tx, citizen_name AS name, fee FROM documents ORDER BY id')
    .all();
  db.close();

  ok('قُيّدت معاملة واحدة', tx.length === 1);
  ok('بعدد أوراقها، والأجرة صفرٌ صامت', tx[0]?.sheets === 2 && tx[0]?.fee === 0);
  ok('وباسم صاحب العلاقة', tx[0]?.name === 'أحمد عادل كريم الموسوي');
  ok('وصدر كتابان', docs.length === 2);
  ok('لكلٍّ رقم صادره', docs[0]?.serial !== docs[1]?.serial);
  ok('ولكلٍّ بصمته', docs[0]?.sha256 !== docs[1]?.sha256);
  ok('وكلاهما تحت المعاملة نفسها', docs.length === 2 && docs.every((d) => d.tx === tx[0]?.id));
  ok('ولا أجرة على ورقة', docs.length === 2 && docs.every((d) => d.fee === 0));
  // ورقة الشبّاك تُحفظ علاماتٍ وتُرسم PDF عند الطلب من الأرشيف. والمرسومة فعلًا فيها
  // خطٌّ مضمَّن؛ وكانت تخرج بيضاء صالحة الترويسة (أنماط الطباعة تُخفي ما ليس ‎.print-sheet‎).
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  if (saveDir && docs[0]) {
    mkdirSync(saveDir, { recursive: true });
    const path = await page.eval(`return window.diwan.documents.exportPdf(${docs[0].id});`);
    ok('وورقته PDF من الأرشيف فيها نصّها', Boolean(path) && existsSync(path) && readFileSync(path, 'latin1').includes('/FontFile'));
  }

  // ── الدمج: كتاب لكل اسم ───────────────────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.eval(`
    const cards = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('انذار'));
    cards[0]?.click();
  `);
  await wait(400);
  await page.clickText('املأ (1)');
  await wait(1200);

  ok('عُرض خيار قائمة الأسماء', (await page.text()).includes('قائمة أسماء — ورقةٌ لكل اسم'));
  const merged = await page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
    const box = label && label.querySelector('input[type="checkbox"]');
    if (!box) return false;
    box.click();
    return true;
  `);
  ok('أُشعل الدمج', merged);
  await wait(400);

  // ثلاثة أسطر وفيها مكرَّر — القائمة تُهمل التكرار.
  const NAMES = ['سالم محمود جاسم', 'ليلى عبد الله حسن', 'سالم محمود جاسم'].join('\n');
  await page.eval(`
    const el = document.querySelector('textarea');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(NAMES)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(400);
  ok('حُسب الناتج وأُهمل المكرَّر', (await page.text()).includes('2 اسمًا × 1 ورقة'));

  await page.clickText('راجع الأوراق');
  await wait(1200);
  ok('قالت المراجعة إن الباقي مثلها', (await page.text()).includes('وبقيّة الأسماء 1 مثلها'));

  await page.clickText('احفظ بلا طباعة');
  // الرسالة تُعرض ثوانيَ ثم تختفي: يُنتظر ظهورها لا مدّةٌ ثابتة (كانت تفوت أحيانًا).
  let batchSaid = false;
  for (let i = 0; i < 30 && !batchSaid; i++) {
    await wait(200);
    batchSaid = (await afterText()).includes('ورقتان لـ2 اسمًا');
  }
  ok('صدرت الدفعة', batchSaid);

  const db2 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const txs = db2.prepare('SELECT id, citizen_name AS name FROM transactions ORDER BY id').all();
  const all = db2.prepare('SELECT citizen_name AS name, transaction_id AS tx, body_html AS body FROM documents ORDER BY id').all();
  db2.close();

  ok('لكل اسم معاملتُه لا معاملة واحدة للجميع', txs.length === 3);
  ok('وبأسمائهم', txs[1]?.name === 'سالم محمود جاسم' && txs[2]?.name === 'ليلى عبد الله حسن');
  ok('وورقة لكل اسم', all.length === 4);
  ok('واسم كلٍّ مرسوم في ورقته', all[2]?.body?.includes('سالم محمود جاسم') && all[3]?.body?.includes('ليلى عبد الله حسن'));
  ok('ولا يختلط اسمٌ بورقة غيره', !all[3]?.body?.includes('سالم محمود جاسم'));

  // ── F2 بالمفتاح، والمعاملة لا تضيع بالانتقال، والتعليق ───────────────
  const pickFirst = async () => {
    await page.eval(`
      const cards = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('انذار'));
      cards[0]?.click();
    `);
    await wait(400);
    await page.clickText('املأ (1)');
    await wait(1200);
  };
  /** خانة الاسم في ورقة الإدخال: التي عنوانها «اسم…» — لا أوّل خانة. */
  const NAME_INPUT = `[...document.querySelectorAll('label')]
      .filter((l) => (l.textContent ?? '').trim().startsWith('اسم') && l.querySelector('input[type="text"]'))
      .map((l) => l.querySelector('input[type="text"]'))[0]`;
  const typeFirst = (value) =>
    page.eval(`
      const input = ${NAME_INPUT};
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
  const firstValue = () => page.eval(`return (${NAME_INPUT})?.value ?? '';`);

  await page.goto('service-counter');
  await wait(800);
  await pickFirst();
  // «هات الزبون» زرٌّ بلا اختصار (ن١٥): F2 زال، والزرّ كما كان.
  await page.eval(`document.querySelector('[data-screen="service"] [data-act="pick-customer"]').click(); return true;`);
  await wait(600);
  ok('«هات الزبون» في الشبّاك يفتح البحث في الزبائن', await page.eval(`return Boolean(document.querySelector('input[placeholder="اسم المواطن أو رقمه"]'));`));
  await page.clickExact('إغلاق');
  await wait(300);

  await typeFirst('كريم حسن علي');
  await wait(300);
  await page.goto('citizens-identity-records');
  await wait(700);
  await page.goto('service-counter');
  await wait(900);
  ok('والمعاملة الجارية لا تضيع بالذهاب إلى المواطنين والعودة', (await firstValue()) === 'كريم حسن علي');

  await page.eval(`document.querySelector('[data-act="park"]').click(); return true;`);
  await wait(600);
  ok('«علّق المعاملة» تفتح الشبّاك لزبونٍ آخر', (await page.text()).includes('ماذا يطلب الزبون'));
  ok('والمعلّقة ظاهرةٌ باسم صاحبها', (await page.eval(`return document.querySelector('[data-parked]')?.innerText ?? '';`)).includes('كريم حسن علي'));
  // وتبقى بعد إغلاق البرنامج (تعميق الموجود ٥): الواجهة تُعاد من أوّلها، والمعلّقة من القاعدة.
  await page.eval(`setTimeout(() => location.reload(), 50); return true;`);
  await wait(3000);
  await page.goto('service-counter');
  await wait(1200);
  ok('وتبقى المعلّقة بعد إعادة البرنامج — من القاعدة لا من الذاكرة', (await page.eval(`return document.querySelector('[data-parked]')?.innerText ?? '';`)).includes('كريم حسن علي'));
  await page.eval(`document.querySelector('[data-act="resume"]').click(); return true;`);
  await wait(1500);
  ok('وتُستأنف من حيث تُركت — ونماذجها تُحمَّل من المكتبة', (await firstValue()) === 'كريم حسن علي');
  ok('والمستأنفة تخرج من المعلّقة المحفوظة', (await page.eval(`return (await window.diwan.service.parked()).length;`)) === 0);

  // ── زبونٌ جديد: يُعرض حفظه في السجل، وتُربط به كتبه ──────────────────
  await page.clickText('راجع الأوراق');
  await wait(1000);
  await page.clickText('احفظ بلا طباعة');
  await wait(1500);
  ok('حُفظت معاملة الزبون الجديد', (await afterText()).includes('ورقةٌ واحدة'));
  ok('وعُرض حفظه في سجل المواطنين', (await page.eval(`return document.querySelector('[data-new-citizen]')?.innerText ?? '';`)).includes('كريم حسن علي'));
  await page.eval(`document.querySelector('[data-act="save-new-citizen"]').click(); return true;`);
  await wait(900);
  ok('فحُفظ ورُبطت به كتبه', (await page.text()).includes('حُفظ «كريم حسن علي» في سجل المواطنين'));
  const db3 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const karim = db3.prepare("SELECT id FROM citizens WHERE full_name = 'كريم حسن علي'").get();
  const karimDocs = db3.prepare("SELECT citizen_id AS c FROM documents WHERE citizen_name = 'كريم حسن علي'").all();
  const lastDoc = db3.prepare("SELECT id FROM documents WHERE citizen_name = 'أحمد عادل كريم الموسوي' ORDER BY id LIMIT 1").get();
  db3.close();
  ok('في القاعدة: ملفٌّ جديد، وكتابه مربوطٌ به', Boolean(karim) && karimDocs.length === 1 && karimDocs[0]?.c === karim?.id);

  // ── الإطار الواحد (المرحلة ٥): أداةٌ تُفتح لزبون الشبّاك تقوله، و«شيءٌ آخر لنفس الزبون» يعود به ──
  await page.eval(`document.querySelector('[data-act="same-customer"]').click(); return true;`);
  await wait(500);
  // د٨: «طلبٌ يُسلَّم لاحقًا» لزبون الشبّاك الحاضر — طلبٌ جديد باسمه وملفّه، لا قائمة الطلبات.
  await page.eval(`document.querySelector('[data-screen="service"] [data-card="order"]').click(); return true;`);
  await wait(1500);
  const orderFor = await page.eval(`return { name: document.querySelector('input[data-order-customer]')?.value ?? '', linked: document.querySelector('[data-order-citizen]')?.innerText ?? '' };`);
  ok(`وبطاقة الطلب تفتح طلبًا جديدًا لزبون الشبّاك (${orderFor.name})`, orderFor.name === 'كريم حسن علي' && orderFor.linked.includes('كريم حسن علي'));
  await page.eval(`document.querySelector('[data-order-dialog] button')?.click(); return true;`);
  await wait(400);
  await page.goto('service-counter');
  await wait(900);
  await page.eval(`document.querySelector('[data-screen="service"] [data-card="photos"]')?.click(); return true;`);
  await wait(1200);
  const head = await page.eval(`return document.querySelector('[data-tool-customer]')?.innerText ?? '';`);
  ok(`الصور تُفتح للزبون: في رأسها اسمه (${head.trim().slice(0, 40)})`, head.includes('كريم حسن علي'));
  ok('وزرّ «في ملفّه» باسمه بدل «في ملف مواطن»', (await page.eval(`return document.querySelector('[data-act="link-citizen"]')?.innerText ?? '';`)).includes('كريم حسن علي'));
  ok('والطابعة مكتوبةٌ في شريط الإخراج', await page.eval(`return Boolean(document.querySelector('[data-tool-output="photos"] [data-printer-note="photos"]'));`));
  await page.eval(`document.querySelector('[data-act="tool-same-customer"]').click(); return true;`);
  await wait(900);
  await pickFirst();
  await wait(900);
  ok('و«شيءٌ آخر لنفس الزبون» يعود إلى الشبّاك فتُملأ حقوله من ملفّه', (await firstValue()) === 'كريم حسن علي');
  await page.eval(`document.querySelector('[data-act="park"]')?.click(); return true;`);
  await wait(500);

  // ── «كرّره» من الأرشيف: كتاب الشبّاك يعود إلى الشبّاك بقيمه ────────────
  await page.goto('transactions-archive-ledger');
  await wait(900);
  const repeated = await page.eval(`
    const btn = [...document.querySelectorAll('button[title^="كرّره"]')].pop();
    if (!btn) return false;
    btn.click();
    return true;
  `);
  await wait(1500);
  ok('زرّ «كرّره» في الأرشيف', repeated);
  ok('فيُفتح كتاب الشبّاك في الشبّاك لا في المحرّر', (await page.eval(`return document.querySelector('[data-screen="service"]')?.offsetParent !== null;`)) && (await page.text()).includes('بيانات صاحب العلاقة'));
  ok('بقيم معاملته الأولى ليبدّل ما يلزم', (await firstValue()) === 'أحمد عادل كريم الموسوي' && Boolean(lastDoc));

  // ── د٤: «نسخة عن …» و«وأبطل الأصل» — غير مؤشَّرة افتراضيًّا ────────────────
  const originalSerial = await page.eval(`return document.querySelector('[data-repeat-of]')?.getAttribute('data-repeat-of') ?? '';`);
  ok(`لافتة «نسخة عن ${originalSerial}» وخانة «وأبطل الأصل» غير مؤشَّرة`, Boolean(originalSerial) && (await page.eval(`return document.querySelector('[data-act="void-original"]')?.checked === false;`)));
  const statusOf = (serial) => {
    const c = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const r = c.prepare('SELECT status, void_reason AS reason FROM documents WHERE serial = ?').get(serial);
    c.close();
    return r;
  };
  // بلا الخانة: تصدر النسخة والأصل صحيحٌ كما هو.
  await page.clickText('راجع الأوراق');
  await wait(1000);
  await page.clickText('احفظ بلا طباعة');
  await wait(1500);
  ok('وبلا الخانة تصدر النسخة والأصل يبقى صحيحًا', statusOf(originalSerial)?.status === 'issued');
  // بالخانة وسببها: تصدر النسخة ثم يُبطَل الأصل بسببه.
  await page.goto('transactions-archive-ledger');
  await wait(900);
  await page.eval(`
    const row = [...document.querySelectorAll('[data-archive] tr')].find((r) => r.innerText.includes(${JSON.stringify(originalSerial)}));
    row.querySelector('button[title^="كرّره"]').click();
    return true;
  `);
  await wait(1500);
  await page.eval(`document.querySelector('[data-act="void-original"]').click(); return true;`);
  await wait(300);
  await page.eval(`
    const el = document.querySelector('[data-void-reason]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'الاسم كُتب خطأً');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  await page.clickText('راجع الأوراق');
  await wait(1000);
  await page.clickText('احفظ بلا طباعة');
  await wait(2000);
  const voided = statusOf(originalSerial);
  ok(`وبالخانة تصدر النسخة ويُبطَل الأصل بسببه (${voided?.status} · ${voided?.reason})`, voided?.status === 'void' && voided?.reason === 'الاسم كُتب خطأً');
  ok('وشريط ما خرج يقول الإبطال', (await page.eval(`return document.querySelector('[data-after-print]')?.innerText ?? '';`)).includes(`وأُبطل الأصل ${originalSerial}`));
  const check = await page.eval(`return await window.diwan.documents.verify();`);
  ok(`والأرشيف سليم بعد الإبطال (${check.checked} كتابًا)`, check.problems.length === 0);

  // ── د١: «كرّره» و«أعد الطبع» من ملفّ الزبون — الكتاب نفسه، لا ورقةٌ فارغة باسمه ──
  // طابعةٌ مباشرة لدور الكتب، فلا يُسأل عنها عند «أعد الطبع».
  await page.eval(`
    const s = await window.diwan.settings.get();
    await window.diwan.settings.set({ printRoles: { ...s.printRoles, documents: { normal: 'طابعة الاختبار', color: null, dialog: false } } });
    return true;
  `);
  await page.goto('citizens-identity-records');
  await wait(900);
  await page.clickText('كريم حسن علي');
  await wait(900);
  const rowButtons = await page.eval(`return [...document.querySelectorAll('[data-act="repeat-document"], [data-act="reprint-document"]')].map((b) => b.dataset.act).join(',');`);
  ok(`في ملفّ الزبون لكلّ كتابٍ «كرّره» و«أعد الطبع» (${rowButtons})`, rowButtons === 'repeat-document,reprint-document');
  const printsBefore = existsSync(join(FOLDER, 'print.log')) ? readFileSync(join(FOLDER, 'print.log'), 'utf8').split('\n').filter(Boolean).length : 0;
  await page.eval(`document.querySelector('[data-act="reprint-document"]').click(); return true;`);
  await wait(2500);
  const printsAfter = existsSync(join(FOLDER, 'print.log')) ? readFileSync(join(FOLDER, 'print.log'), 'utf8').split('\n').filter(Boolean).length : 0;
  ok(`و«أعد الطبع» يطبعه كما صدر (${printsBefore} ← ${printsAfter} طلب طباعة)`, printsAfter === printsBefore + 1 && (await page.text()).includes('أُعيدت طباعته'));
  await page.eval(`document.querySelector('[data-act="repeat-document"]').click(); return true;`);
  await wait(1500);
  ok('و«كرّره» يفتح كتابه في الشبّاك بقيمه — لا محرّرًا فارغًا', (await page.eval(`return document.querySelector('[data-screen="service"]')?.offsetParent !== null;`)) && (await firstValue()) === 'كريم حسن علي');
  await page.eval(`document.querySelector('[data-act="park"]')?.click(); return true;`);
  await wait(500);

  rmSync(FOLDER, { recursive: true, force: true });
  return steps.join('\n');
}
