/**
 * سيناريو: لغة الورقة في الشبّاك — التذكير والتأنيث، والعدد كتابةً، والإملاء.
 *
 * نموذجٌ فيه «{الطالب|الطالبة}» و«مستمرّ{|ة}» و«الى المدرسه» وحقلا «الدرجة»
 * و«الدرجة_كتابة». يُكتب الاسم «زينب…» فيُقترح «أنثى»، وتُكتب الدرجة ٩٥ فتُكتب
 * «خمس وتسعون درجة» وحدها، ويُنبَّه على «الى» في نصّ النموذج، وعلى «,» فيما
 * كتبه الموظف ويُصلح بضغطة.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const fill = async (label, value) => {
    await page.eval(`
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      const input = l?.querySelector('input');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
  };

  await page.eval(`
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'تأييد استمرار طالب',
      subtitle: null,
      category: 'تربية',
      subjectLine: 'م/ تأييد',
      letterheadId: null,
      bodyHtml: 'تؤيد إدارة المدرسة أن {الطالب|الطالبة} {الاسم} مستمرّ{|ة} بالدوام الى المدرسه، ودرجت{ـه|ـها} {الدرجة} ({الدرجة_كتابة}).',
      variables: [
        { token: 'الاسم', label: 'الاسم', source: 'fullName', required: true },
        { token: 'الدرجة', label: 'الدرجة', source: 'manual', required: false },
        { token: 'الدرجة_كتابة', label: 'الدرجة كتابة', source: 'manual', required: false }
      ]
    });
    return true;
  `);

  // الشبّاك شاشةُ البدء فقد حمّل مكتبته قبل الحفظ — يُخرج منه ويُعاد إليه.
  await page.goto('templates-library-drafts');
  await wait(500);
  await page.goto('service-counter');
  await wait(900);
  await page.clickText('تأييد استمرار طالب', 'button');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1200);

  await fill('الاسم', 'زينب علي حسن, الموسوي');
  await fill('الدرجة', '95');
  await wait(400);

  const gender = await page.eval(`
    const on = [...document.querySelectorAll('[data-gender-value]')].find((b) => b.className.includes('bg-secondary'));
    return on?.dataset.genderValue ?? '';
  `);
  ok('ظهر خيار الجنس لأنّ في النموذج «{الطالب|الطالبة}»', gender !== '');
  ok('واقتُرح «أنثى» من اسم «زينب»', gender === 'أنثى');
  ok('وخانةُ الخيار نفسها لا تُعرض حقلًا يُملأ', !(await page.text()).includes('الطالب|الطالبة'));

  await page.clickText('راجع الأوراق');
  await wait(1200);
  let sheet = await page.eval(`return document.querySelector('[data-body]')?.innerText ?? '';`);
  ok('الورقة للمؤنّث: «الطالبة… مستمرّة… ودرجتها»', sheet.includes('الطالبة') && sheet.includes('مستمرّة') && sheet.includes('ودرجتها'));
  ok('والدرجة كتابةً من رقمها: «خمس وتسعون درجة»', sheet.includes('خمس وتسعون درجة'));

  const panels = await page.eval(`return [...document.querySelectorAll('[data-spelling]')].map((p) => p.innerText).join(' || ');`);
  ok('نُبّه على «الى» و«المدرسه» في نصّ النموذج', panels.includes('إلى') && panels.includes('المدرسة'));
  ok('ونُبّه على الفاصلة اللاتينية فيما كُتب', panels.includes('فاصلةٌ لاتينية'));

  await page.eval(`document.querySelector('[data-spelling] [data-act="fix-spelling"]')?.click(); return true;`);
  await wait(500);
  sheet = await page.eval(`return document.querySelector('[data-body]')?.innerText ?? '';`);
  ok('وأُصلحت بضغطة: «زينب علي حسن، الموسوي»', sheet.includes('زينب علي حسن، الموسوي'));

  // الموظف يقلب الجنس فيتبعه النصّ.
  await page.clickText('رجوع');
  await wait(600);
  await page.eval(`document.querySelector('[data-gender-value="ذكر"]')?.click(); return true;`);
  await wait(300);
  await page.clickText('راجع الأوراق');
  await wait(900);
  sheet = await page.eval(`return document.querySelector('[data-body]')?.innerText ?? '';`);
  ok('وقلبُ الجنس يقلب النصّ: «الطالب… مستمرّ… ودرجته»', sheet.includes('الطالب ') && sheet.includes('ودرجته'));

  return steps.join('\n');
}
