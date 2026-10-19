/**
 * سيناريو: ملء الجنس المحفوظ مسبقًا في ملف الزبون مع إبقاء السؤال (ر150)،
 * وتصنيف «نعمة» كاسم ملتبس لا يُحسم تلقائيًّا ويُسأل عنه دائمًا (S03).
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ١. تجهيز نموذج يحتاج للجنس (فيه خيار الطالب/الطالبة)
  await page.eval(`
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'شهادة تقديرية للطلبة',
      subtitle: null,
      category: 'تربية',
      subjectLine: 'م/ تقدير',
      letterheadId: null,
      bodyHtml: 'تُشيد الإدارة بجهود {الطالب|الطالبة} {الاسم} وتتمنى ل{ـه|ـها} الموفقية والنجاح المستمر.',
      variables: [
        { token: 'الاسم', label: 'الاسم', source: 'fullName', required: true }
      ]
    });
    return true;
  `);

  // ٢. حفظ مواطنة في السجل مسجلة بجنس «أنثى»
  await page.eval(`
    await window.diwan.citizens.save({
      id: null,
      fullName: 'سلوى صباح هادي',
      gender: 'أنثى',
      verified: false
    });
    return true;
  `);

  // فتح الشبّاك واختيار النموذج
  await page.goto('templates-library-drafts');
  await wait(500);
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('شهادة تقديرية للطلبة', 'button');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1200);

  // اختيار المواطنة المسجلة مسبقًا عبر «هات الزبون»
  await page.eval(`document.querySelector('[data-screen="service"] [data-act="pick-customer"]')?.click(); return true;`);
  await wait(600);

  // اختيار المواطنة من نافذة البحث
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('سلوى صباح هادي'));
    if (btn) btn.click();
    return Boolean(btn);
  `);
  await wait(800);

  // التحقق من ملء الاسم والجنس المحفوظ مسبقًا
  const nameVal = await page.eval(`
    const input = document.querySelector('label input[type="text"]');
    return input?.value ?? '';
  `);
  ok('استُورد اسم المواطنة المسجلة', nameVal.includes('سلوى صباح هادي'));

  const genderVal = await page.eval(`
    const on = [...document.querySelectorAll('[data-gender-value]')].find((b) => b.className.includes('bg-secondary'));
    return on?.dataset.genderValue ?? '';
  `);
  ok('مُلئ جنس المواطنة المحفوظ مسبقًا (أنثى)', genderVal === 'أنثى');

  const questionVisible = await page.eval(`return Boolean(document.querySelector('[data-gender]'));`);
  ok('سؤال الجنس ظاهرٌ في الواجهة لم يُخفَ ولم يُتخطَّ (ر150)', questionVisible);

  // ٣. كتابة اسم «نعمة علي حسين» والتحقق من عدم حسمه وتوقف الشاشة عند السؤال
  await page.eval(`
    const input = document.querySelector('label input[type="text"]');
    if (input) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'نعمة علي حسين');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  `);
  await wait(500);

  // الانتقال إلى المراجعة
  await page.clickText('راجع الأوراق');
  await wait(1200);

  const unsureVisible = await page.eval(`return Boolean(document.querySelector('[data-gender-unsure]'));`);
  ok('الاسم «نعمة» ملتبس ولم يُحسم وتوقفت الشاشة عند السؤال في شريط القرار', unsureVisible);

  const unsureText = await page.eval(`return document.querySelector('[data-gender-unsure]')?.innerText ?? '';`);
  ok('السؤال يطلب تحديد جنس «نعمة» صراحةً', unsureText.includes('نعمة') && unsureText.includes('ذكرٌ أم أنثى'));

  // زر الإصدار ممنوع حتى يُجاب السؤال
  const issueDisabled = await page.eval(`
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('احفظ بلا طباعة') || b.textContent?.includes('اطبع'));
    return btn?.disabled ?? false;
  `);
  ok('الإصدار محجوبٌ حتى يُحسم جنس نعمة باليد', issueDisabled === true);

  // الموظف يحسم الجنس باليد بالنقر على خيار «ذكر»
  await page.eval(`document.querySelector('[data-gender-choose="ذكر"]')?.click(); return true;`);
  await wait(500);

  const resolved = await page.eval(`return !document.querySelector('[data-gender-unsure]');`);
  ok('زال السؤال بعد حسم الموظف لجنس نعمة', resolved);

  return steps.join('\n');
}
