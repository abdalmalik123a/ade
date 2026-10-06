/**
 * سيناريو: حزم الجهات الجاهزة (البرومت الأول من خطة الحزم) على التطبيق الحقيقي.
 *
 * الخطوات:
 * ١) ملف شخصي جديد يفتح على التطبيق.
 * ٢) من المكتبة: فتح حوار «حزم الجهات الجاهزة» من قائمة استورد.
 * ٣) استيراد حزمة التربية والمدارس والتحقق من العدد في التنبيه وفهرس الحزم.
 * ٤) إعادة استيراد الحزمة والتحقق من عدم تكرار أي عنصر.
 * ٥) من الشبّاك: اختيار نموذج من الحزمة («تأييد استمرار بالدوام»).
 * ٦) استيراد بيانات مواطن اختباري (كرار حيدر علي) بـ «هات الزبون».
 * ٧) ملء الخانات الإلزامية ومراجعة الورقة بصيغة المذكّر والتحقق من صياغة النص.
 * ٨) «احفظ بلا طباعة» والتأكد من قيد المعاملة في السجل برقم رسمي.
 * ٩) اختبار التبديل إلى المؤنث («أنثى») والتأكد من انقلاب الكلمات تلقائيًا:
 *    (الطالبة، مستمرة، زُوّدت، طلبها).
 * ١٠) التقاط صور للقطات المهمة في shotsDir لعرضها على المالك.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  const toast = () => page.eval(`return document.body.innerText;`);

  const fill = async (label, value) => {
    const done = await page.eval(`
      const labels = [...document.querySelectorAll('label')];
      const l = labels.find((x) => x.textContent.trim().includes(${JSON.stringify(label)}));
      const input = l?.querySelector('input[type="text"]') ?? l?.parentElement?.querySelector('input[type="text"]');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(150);
    return done;
  };

  // ١) إضافة مواطن اختباري في السجل لاستخدامه بـ «هات الزبون»
  await page.eval(`
    await window.diwan.citizens.save({
      id: null,
      fullName: 'كرار حيدر علي',
      phone: '07701234567',
      nationalId: '199812345678',
      motherName: 'فاطمة حسن',
      gender: 'ذكر',
      verified: true
    });
    return true;
  `);

  // ٢) المكتبة: استعراض واستيراد الحزمة المشحونة
  await page.goto('templates-library-drafts');
  await wait(800);

  // الضغط على «حزمة جهةٍ أو مكتب» يفتح حوار الحزم الجاهزة
  await page.eval(`document.querySelector('[data-act="content-import"]').click(); return true;`);
  await wait(600);

  ok('انفتح حوار حزم الجهات الجاهزة', await page.eval(`return Boolean(document.querySelector('[data-packs-modal]'));`));
  const modalText = await page.eval(`return document.querySelector('[data-packs-modal]')?.innerText ?? '';`);
  ok('الحزم الست معروضة في القائمة',
    modalText.includes('التربية والمدارس') &&
    modalText.includes('الجامعات والتعليم العالي') &&
    modalText.includes('الأحوال المدنية والبطاقة الوطنية') &&
    modalText.includes('السكن وبطاقة السكن والمخاتير') &&
    modalText.includes('المحاكم والعرائض الشرعية') &&
    modalText.includes('الاستدعاءات والطلبات العامة')
  );

  if (shotsDir) await page.shot(join(shotsDir, 'packs-modal.png'));

  // ٣) استيراد الحزمة
  await page.eval(`document.querySelector('[data-act="import-bundled-education"]').click(); return true;`);
  await wait(1500);

  const t1 = await toast();
  ok('استُوردت حزمة التربية بالعدد الكامل (٦ نماذج، ٤ كليشات)', t1.includes('أُضيف 6 نموذجًا') && t1.includes('4 كليشة'));
  ok('عُلّمت الحزمة كمستوردة في الواجهة', await page.eval(`return Boolean(document.querySelector('[data-pack-imported="education"]'));`));

  // ٤) إعادة استيراد الحزمة لا تكرر شيئًا
  await page.eval(`document.querySelector('[data-act="import-bundled-education"]').click(); return true;`);
  await wait(1500);

  const t2 = await toast();
  ok('إعادة الاستيراد تترك ما في المكتب ولا تكرّر (أُضيف 0)', t2.includes('أُضيف 0 نموذجًا') && t2.includes('موجودٌ في المكتب'));

  const initialCounts = db((d) => ({
    t: d.prepare('SELECT COUNT(*) AS n FROM templates').get().n,
    c: d.prepare('SELECT COUNT(*) AS n FROM clips').get().n
  }));
  ok('والقاعدة فيها ٦ نماذج و٤ كليشات بالضبط', initialCounts.t === 6 && initialCounts.c === 4);

  // إغلاق حوار الحزم
  await page.key('Escape');
  await wait(500);

  if (shotsDir) await page.shot(join(shotsDir, 'packs-library.png'));
  ok('ظهرت نماذج التربية في المكتبة', (await page.text()).includes('تأييد استمرار بالدوام'));

  // ٥) الشبّاك: اختيار نموذج من الحزمة واستخدام بيانات الزبون
  await page.goto('service-counter');
  await wait(900);

  ok('فُتح الشبّاك ونماذج التربية ظاهرة للاختيار', (await page.text()).includes('تأييد استمرار بالدوام'));

  // اختيار نموذج «تأييد استمرار بالدوام»
  const clickedCard = await page.eval(`
    const cards = [...document.querySelectorAll('[data-template-card]')];
    const card = cards.find(c => c.querySelector('.font-headline-sm')?.textContent?.trim() === 'تأييد استمرار بالدوام');
    if (card) {
      card.click();
      return true;
    }
    return false;
  `);
  ok('تم النقر على بطاقة النموذج', clickedCard);
  await wait(400);

  await page.clickText('املأ');
  await wait(1200);

  ok('انتقل إلى خطوة التعبئة', (await page.text()).includes('بيانات صاحب العلاقة'));

  // استيراد بيانات الزبون
  await page.clickText('هات الزبون');
  await wait(800);
  await page.clickText('كرار حيدر علي', 'button');
  await wait(800);

  const fillValues = await page.eval(`
    return [...document.querySelectorAll('input[type="text"]')].map((i) => i.value).join(' | ');
  `);
  ok('«هات الزبون» ملأ اسم الطالب من السجل', fillValues.includes('كرار حيدر علي'));

  // ملء الحقول الإلزامية المتبقية
  await fill('الجهة المرسل إليها', 'دائرة الرعاية الاجتماعية');
  await fill('العام الدراسي', '2025-2026');
  await fill('الصف والشعبة', 'الرابع العلمي - أ');

  // التأكد من اختيار الجنس «ذكر»
  await page.eval(`document.querySelector('[data-gender-value="ذكر"]')?.click(); return true;`);
  await wait(300);

  // ٦) مراجعة الورقة بصيغة المذكّر
  await page.clickText('راجع الأوراق');
  await wait(1200);

  let sheetText = await page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);
  ok('الورقة رُسمت ببيانات الزبون', sheetText.includes('كرار حيدر علي') && sheetText.includes('دائرة الرعاية الاجتماعية'));
  ok('صيغة المذكّر صحيحة: الطالب، مستمر، زُوّد، طلبه',
    sheetText.includes('الطالب') &&
    !sheetText.includes('الطالبة') &&
    sheetText.includes('مستمر') &&
    sheetText.includes('زُوّد') &&
    sheetText.includes('طلبه') &&
    !sheetText.includes('طلبها')
  );

  if (shotsDir) await page.shot(join(shotsDir, 'packs-review-male.png'));

  // ٧) «احفظ بلا طباعة» والتأكد من قيدها في السجل
  await page.clickText('احفظ بلا طباعة');
  await wait(1500);

  const txCount = db((d) => d.prepare('SELECT COUNT(*) AS n FROM transactions').get().n);
  const docCount = db((d) => d.prepare('SELECT COUNT(*) AS n FROM documents').get().n);
  ok('حُفظت المعاملة في السجل وخرجت وثيقة رسمية', txCount === 1 && docCount === 1);

  // ٨) اختبار التذكير والتأنيث: تجربة صيغة المؤنّث (أنثى)
  // إغلاق شريط ما بعد الطباعة
  await page.eval(`document.querySelector('[data-act="after-close"]')?.click(); return true;`);
  await wait(500);

  const clickedFemaleCard = await page.eval(`
    const cards = [...document.querySelectorAll('[data-template-card]')];
    const card = cards.find(c => c.querySelector('.font-headline-sm')?.textContent?.trim() === 'تأييد استمرار بالدوام');
    if (card) {
      card.click();
      return true;
    }
    return false;
  `);
  ok('اختير النموذج للمرة الثانية', clickedFemaleCard);
  await wait(500);

  await page.clickText('املأ');
  await wait(1200);

  await fill('اسم الطالب', 'زينب كاظم جاسم');
  await fill('الجهة المرسل إليها', 'الجامعة المستنصرية');
  await fill('العام الدراسي', '2025-2026');
  await fill('الصف والشعبة', 'السادس الأدبي');

  // اختيار «أنثى»
  await page.eval(`document.querySelector('[data-gender-value="أنثى"]')?.click(); return true;`);
  await wait(300);

  await page.clickText('راجع الأوراق');
  await wait(1200);

  sheetText = await page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);
  ok('صيغة المؤنّث صحيحة: الطالبة، مستمرة، زُوّدت، طلبها',
    sheetText.includes('الطالبة') &&
    sheetText.includes('مستمرة') &&
    sheetText.includes('زُوّدت') &&
    sheetText.includes('طلبها')
  );

  if (shotsDir) await page.shot(join(shotsDir, 'packs-review-female.png'));

  // حفظ المعاملة الثانية والتأكد من قيدها في السجل
  await page.clickText('احفظ بلا طباعة');
  await wait(1500);

  const finalTxCount = db((d) => d.prepare('SELECT COUNT(*) AS n FROM transactions').get().n);
  ok('حُفظت معاملة الطالبة وبلغ السجل معاملتين', finalTxCount === 2);

  // ٩) «مخاطبات المدارس الرسمية» (الموجة ٢): ٤٥ كتابًا من برنامج مخاطبات مدرسةٍ في Excel — وكتابٌ منها في الشبّاك
  //    برأسه أعمدةً، وموضع الشعار فارغ، والخطّ الفاصل من البرنامج.
  await page.eval(`document.querySelector('[data-act="after-close"]')?.click(); return true;`);
  await page.goto('templates-library-drafts');
  await wait(800);
  await page.eval(`document.querySelector('[data-act="content-import"]').click(); return true;`);
  await wait(600);
  ok('وحزمة «مخاطبات المدارس الرسمية» في القائمة', (await page.eval(`return document.querySelector('[data-packs-modal]')?.innerText ?? '';`)).includes('مخاطبات المدارس الرسمية'));
  await page.eval(`document.querySelector('[data-act="import-bundled-school-letters"]').click(); return true;`);
  await wait(2500);
  ok('واستُوردت بكتبها الخمسة والأربعين', (await toast()).includes('أُضيف 45 نموذجًا'));
  ok('والقاعدة فيها ٥١ نموذجًا (٦ + ٤٥)', db((d) => d.prepare('SELECT COUNT(*) AS n FROM templates').get().n) === 51);
  await page.key('Escape');
  await wait(400);

  await page.goto('service-counter');
  await wait(900);
  const clickedSchool = await page.eval(`
    const card = [...document.querySelectorAll('[data-template-card]')].find((c) => c.querySelector('.font-headline-sm')?.textContent?.trim() === 'تبليغ');
    if (!card) return false;
    card.click();
    return true;
  `);
  ok('«تبليغ» من الحزمة في الشبّاك', clickedSchool);
  await wait(400);
  await page.clickText('املأ');
  await wait(1200);
  await fill('اسم المدرسة', 'مدرسة النور');
  await fill('جنس المدرسة', 'للبنين');
  await fill('المحافظة', 'بغداد');
  await fill('اسم مدير المدرسة', 'سالم حسن');
  await fill('اسم السيد', 'كرار حيدر علي');
  await page.clickText('راجع الأوراق');
  await wait(1200);
  sheetText = await page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);
  ok('والورقة بالمدرسة ومحافظتها ومديرها والمبلَّغ', ['مدرسة النور', 'للبنين', 'لتربية بغداد', 'سالم حسن', 'كرار حيدر علي'].every((s) => sheetText.includes(s)));
  ok('وبلا صورة — والخطّ الفاصل من البرنامج', await page.eval(`
    const sheet = document.querySelector('.a4-sheet');
    return Boolean(sheet) && !sheet.querySelector('img') && Boolean(sheet.querySelector('[data-rule]'));
  `));
  if (shotsDir) await page.shot(join(shotsDir, 'packs-school-letter.png'));

  return steps.join('\n');
}
