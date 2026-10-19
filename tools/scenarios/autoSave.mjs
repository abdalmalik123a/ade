/**
 * سيناريو: الحفظ التلقائي لمعاملة الشبّاك ولورقة الأسئلة بلا ضياع عند انقطاع الكهرباء (D115 — S02).
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // ٢ — الانتقال إلى قسم الأسئلة من بطاقته في الشبّاك
  await page.goto('exam-papers');
  await wait(800);

  await page.type('input[data-head="المدرسة"]', 'ثانوية المتميزين للبنات');
  await page.type('textarea', 'سؤال: ما هي عاصمة العراق؟');
  ok('تم إدخال اسم المدرسة وسؤال في ورقة الأسئلة', true);

  // انتظار مؤقت الحفظ التلقائي لورقة الأسئلة (~1.8 ثانية)
  await wait(2500);

  // ٣ — العودة إلى الشبّاك عبر السكّة الرئيسية
  await page.goto('service-counter');
  await wait(1000);

  // اختيار بطاقة النموذج
  const cardSelected = await page.eval(`
    const btns = [...document.querySelectorAll('button')];
    const target = btns.find((b) => b.textContent?.includes('تأييد استمرار طالب'));
    if (target) {
      target.click();
      return true;
    }
    return false;
  `);
  ok('تم اختيار بطاقة النموذج', cardSelected);
  await wait(400);

  // الضغط على زر «املأ» للدخول إلى خطوة تعبئة الحقول
  await page.clickText('املأ');
  await wait(800);

  // كتابة اسم الطالب في حقل الإدخال
  await page.type('label input[type="text"]', 'زينب علي حسن');
  ok('تم إدخال اسم الطالب في الشبّاك', true);

  // انتظار مؤقت الحفظ التلقائي للشبّاك (~1.8 ثانية)
  await wait(2500);

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

  // ١ — التحقق من استرجاع معاملة الشبّاك في خطوة fill بعد الإغلاق الفجائي
  const counterVal = await page.eval(`
    const inputs = [...document.querySelectorAll('input')];
    return inputs.map((i) => i.value).find((v) => v.includes('زينب علي حسن')) || '';
  `);
  ok('استرجاع بيانات معاملة الشبّاك بعد الإغلاق الفجائي', counterVal.includes('زينب علي حسن'));

  // ٢ — النقر على زر «رجوع» للعودة إلى بطاقات الشبّاك ومنها لـ exam-papers
  await page.eval(`
    const btns = [...document.querySelectorAll('button')];
    const back = btns.find((b) => b.textContent?.trim() === 'رجوع');
    if (back) back.click();
  `);
  await wait(600);

  await page.goto('exam-papers');
  await wait(1500);

  const paperHead = await page.eval(`
    const inp = document.querySelector('input[data-head="المدرسة"]');
    return inp?.value || '';
  `);
  const paperQuestion = await page.eval(`
    const ta = document.querySelector('textarea');
    return ta?.value || '';
  `);

  ok(
    'استرجاع رأس ورقة الأسئلة ونص السؤال بعد الإغلاق الفجائي',
    paperHead.includes('ثانوية المتميزين للبنات') && paperQuestion.includes('عاصمة العراق')
  );

  return steps.join('\n');
}
