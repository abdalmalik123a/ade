/**
 * سيناريو: الحفظ التلقائي لمعاملة الشبّاك ولورقة الأسئلة بلا ضياع عند انقطاع الكهرباء (D115 — S02)، ولا يُكتب فوق المحفوظ (D134).
 *
 * كان الحفظ التلقائي يكتب فوق ورقة الأسئلة المفتوحة بلا نسخةٍ سابقة: تُفتح ورقةٌ محفوظة («الأصل») وتُعدَّل بلا «حفظ» فيضيع أصلها.
 * واليوم يكتب مسودّةً: (أ) المحفوظة كما هي ونسخها صفر · (ب) بعد قتلٍ فجائي تُستعاد المعدّلة بقولها · (ج) «حفظ» يكتبها بنسخةٍ سابقة
 * فيها «الأصل» ويمحو المسودّة · (د) والمعاملة الجارية في الشبّاك تُستعاد فيه، ولا تُعرض «معلّقةً» في قيد العمل ولا تُعدّ في «التنبيهات» ·
 * (هـ) و«اترك بلا حفظ» يمحو مسودّة الورقة.
 * والأسئلة لا تُبلغ إلا من بطاقات الشبّاك (خطوة الاختيار، وفيها تُمحى الجارية بـ«رجوع»): فتُعاد الجارية قبل القتل كما كتبها الشبّاك نفسه.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** نصّ ورقةٍ محفوظة: سؤالها الأوّل كما في وثيقتها، ونسخها السابقة بنصوصها. */
const paperState = (page) =>
  page.eval(`
    const [paper] = await window.diwan.templates.list(null, 'print-only');
    if (!paper) return null;
    const doc = JSON.stringify(await window.diwan.templates.doc(paper.id));
    const revs = await window.diwan.revisions.list('template', paper.id);
    const older = await Promise.all(revs.map((r) => window.diwan.revisions.get('template', paper.id, r.revision)));
    const papers = (await window.diwan.templates.list(null, 'print-only')).length;
    const draft = await window.diwan.papers.draft();
    return {
      id: paper.id, papers, revs: revs.length,
      original: doc.includes('الأصل: ما وحدة قياس القوة'), edited: doc.includes('معدَّل: ما وحدة قياس الشغل'),
      olderOriginal: older.some((p) => (p?.docJson ?? '').includes('الأصل: ما وحدة قياس القوة')),
      draft: draft ? { paperId: draft.paperId, edited: JSON.stringify(draft.items).includes('معدَّل') } : null
    };
  `);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  // تخطّي شاشة الترحيب وحفظ الإعدادات
  await page.eval(`
    await window.diwan.settings.set({ onboarded: true });
    document.querySelector('[data-act="onboarding-skip"]')?.click();
    return true;
  `);
  await wait(400);

  // ١ — حفظ نموذج في المكتبة
  await page.eval(`
    const list = await window.diwan.templates.list();
    if (!list.some((t) => t.title.includes('تأييد استمرار طالب'))) {
      await window.diwan.templates.save({
        id: null,
        code: 'TPL01',
        title: 'تأييد استمرار طالب',
        subtitle: 'المدرسة المركزية',
        category: 'تأييدات',
        subjectLine: 'تأييد استمرار',
        bodyHtml: 'نؤيد بأن الطالب {اسم_الطالب} مستمر بالدوام.',
        letterheadId: null,
        variables: [{ token: 'اسم_الطالب', label: 'اسم الطالب', source: 'manual', required: true }]
      });
    }
    return true;
  `);
  await wait(400);

  // ٢ — معاملةٌ جارية في الشبّاك
  await page.goto('service-counter');
  await wait(1000);
  const cardSelected = await page.eval(`
    const target = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('تأييد استمرار طالب'));
    target?.click();
    return Boolean(target);
  `);
  ok('تم اختيار بطاقة النموذج', cardSelected);
  await wait(400);
  await page.clickText('املأ');
  await wait(800);
  await page.type('label input[type="text"]', 'زينب علي حسن');
  ok('تم إدخال اسم الطالب في الشبّاك', true);
  // انتظار مؤقت الحفظ التلقائي للشبّاك (~1.8 ثانية)
  await wait(2500);

  // (د) قيد العمل: المعاملة الجارية مسودّة الشبّاك لا معلّقة
  await page.goto('orders-board');
  await wait(1200);
  const board = await page.eval(`
    const stored = await window.diwan.service.parked();
    const agenda = await window.diwan.today.agenda();
    return {
      running: stored.filter((p) => p.autosave).length,
      resume: document.querySelectorAll('[data-act="resume-parked"]').length,
      open: document.querySelector('[data-open-count]')?.getAttribute('data-open-count') ?? null,
      parked: agenda.parked
    };
  `);
  ok(`(د) المعاملة الجارية محفوظةٌ في القاعدة (${board.running})`, board.running === 1);
  ok(`(د) قيد العمل بلا «استأنف» (${board.resume}) و«مفتوح» صفر (${board.open})`, board.resume === 0 && board.open === '0');
  ok(`(د) و«التنبيهات» لا تعدّها معلّقة (${board.parked})`, board.parked === 0);
  const running = await page.eval(`return await window.diwan.service.parked();`);

  // ٣ — ورقة أسئلة تُحفظ «الأصل» ثم تُفتح وتُعدَّل بلا «حفظ» (والطريق إليها بطاقة الشبّاك)
  await page.goto('service-counter');
  await wait(600);
  await page.clickText('رجوع');
  await wait(600);
  await page.goto('exam-papers');
  await wait(800);
  await page.type('input[data-head="المدرسة"]', 'مدرسة النور');
  await page.type('input[data-head="المادة"]', 'الفيزياء');
  await page.type('textarea[data-question-text]', 'الأصل: ما وحدة قياس القوة؟');
  await page.eval(`document.querySelector('[data-act="save"]')?.click(); return true;`);
  await wait(1200);
  let state = await paperState(page);
  ok('حُفظت الورقة «الأصل»', Boolean(state?.original));

  await page.clickText('ورقة جديدة');
  await wait(600);
  const opened = await page.eval(`
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('أسئلة الفيزياء'));
    b?.click();
    return Boolean(b);
  `);
  await wait(800);
  const shown = await page.eval(`return document.querySelector('textarea[data-question-text]')?.value ?? '';`);
  ok('فُتحت المحفوظة بسؤالها', opened && shown.includes('الأصل'));
  await page.type('textarea[data-question-text]', 'معدَّل: ما وحدة قياس الشغل؟');
  await wait(3000);
  state = await paperState(page);
  ok('(أ) بعد ٣ ث بلا «حفظ»: المحفوظة كما هي («الأصل»)', Boolean(state?.original) && !state?.edited);
  ok(`(أ) ونسخها السابقة صفر (${state?.revs})`, state?.revs === 0);
  ok('(أ) والمعدّلة في مسودّةٍ على ورقتها', state?.draft?.edited === true && state?.draft?.paperId === state?.id);

  // الجارية كما كتبها الشبّاك في (د)، ثم يُقتل البرنامج فجأةً.
  await page.eval(`await window.diwan.service.setParked(${JSON.stringify(running)}); return true;`);
  await wait(300);
  return steps.join('\n');
}

export async function afterRestart(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  // تخطي معالج البداية إن ظهر بعد القتل
  await wait(1000);
  await page.eval(`
    document.querySelector('[data-act="onboarding-skip"]')?.click();
    return true;
  `);
  await wait(1200);

  // ١ — معاملة الشبّاك تُستعاد في خطوة الملء بعد الإغلاق الفجائي
  const counterVal = await page.eval(`
    const inputs = [...document.querySelectorAll('input')];
    return inputs.map((i) => i.value).find((v) => v.includes('زينب علي حسن')) || '';
  `);
  ok('استرجاع بيانات معاملة الشبّاك بعد الإغلاق الفجائي', counterVal.includes('زينب علي حسن'));

  // (ب) ورقة الأسئلة المعدّلة تُستعاد بقولها (والطريق إليها بطاقة الشبّاك)
  await page.clickText('رجوع');
  await wait(600);
  await page.goto('exam-papers');
  await wait(1200);
  const paper = await page.eval(`
    return {
      school: document.querySelector('input[data-head="المدرسة"]')?.value ?? '',
      question: document.querySelector('textarea[data-question-text]')?.value ?? '',
      said: document.body.innerText.includes('استُعيدت ورقةٌ لم تُحفظ')
    };
  `);
  ok('(ب) بعد القتل الفجائي تُستعاد الورقة المعدّلة برأسها', paper.school.includes('مدرسة النور') && paper.question.includes('معدَّل'));
  ok('(ب) ويُقال «استُعيدت ورقةٌ لم تُحفظ»', paper.said);
  let state = await paperState(page);
  ok('(ب) والمحفوظة ما زالت «الأصل» بلا نسخ', Boolean(state?.original) && state?.revs === 0);

  // (ج) «حفظ» يكتبها فوق ورقتها بنسخةٍ سابقة فيها «الأصل»، ويمحو المسودّة
  await page.eval(`document.querySelector('[data-act="save"]')?.click(); return true;`);
  await wait(1200);
  state = await paperState(page);
  ok('(ج) «حفظ» يكتب المعدّلة فوق ورقتها لا ورقةً جديدة', Boolean(state?.edited) && state?.papers === 1);
  ok(`(ج) ونسخةٌ سابقة واحدة فيها «الأصل» (${state?.revs})`, state?.revs === 1 && state?.olderOriginal === true);
  ok('(ج) والمسودّة مُحيت', state?.draft === null);

  // (هـ) تعديلٌ يُكتب مسودّةً، ثم المغادرة بـ«اترك بلا حفظ» تمحوها والمحفوظة كما حُفظت
  await page.type('textarea[data-question-text]', 'معدَّل ثانٍ: ما وحدة قياس القدرة؟');
  await wait(2500);
  const drafted = await page.eval(`return Boolean(await window.diwan.papers.draft());`);
  await page.goto('service-counter');
  await wait(600);
  const asked = await page.eval(`const b = document.querySelector('[data-confirm] [data-choice="discard"]'); b?.click(); return Boolean(b);`);
  await wait(800);
  state = await paperState(page);
  ok('(هـ) المسودّة مكتوبة، والمغادرة تسأل «اترك بلا حفظ»', drafted && asked);
  ok('(هـ) و«اترك بلا حفظ» يمحوها، والمحفوظة كما حُفظت', state?.draft === null && Boolean(state?.edited) && state?.revs === 1);

  return steps.join('\n');
}
