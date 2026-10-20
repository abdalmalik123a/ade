/**
 * سيناريو: توحيد تعريف «الطلب المتأخّر» (S05) وتنبيه الساعة الخاطئة عند الإصدار (S06) — D118.
 *
 * يتحقّق من:
 * ١ — إنشاء طلب جاهز للتسليم (status: 'ready') بتاريخ استحقاق ماضٍ (أمس).
 * ٢ — التأكّد من أن الطلب الجاهز لا يُحسب متأخّرًا في شارة السكّة ولا في جرس التنبيهات (overdue = 0).
 * ٣ — فتح الشبّاك وإصدار معاملة عند محاكاة ساعة جهاز غير مضبوطة (سنة تسبق 2026).
 * ٤ — التأكّد من ظهور تنبيه للموظف بشأن ساعة الجهاز مع إتمام التوثيق بلا منع قسري.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ١. تجهيز طلب جاهز للتسليم بتاريخ أمس
  const setup = await page.eval(`
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const order = await window.diwan.orders.save({
      id: null,
      clientId: null,
      customer: 'كريم حسن علي',
      title: 'طباعة بطاقات جاهزة',
      dueDate: yesterday
    });
    await window.diwan.orders.setStatus(order.id, 'ready');

    // تجهيز نموذج في المكتبة للاختبار في الشبّاك
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'استمارة تأييد طلب',
      subtitle: 'دائرة التربية',
      category: 'تأييدات',
      subjectLine: 'م/ تأييد',
      letterheadId: null,
      bodyHtml: 'نؤيد أن المواطن {الاسم} مسجل لدينا.',
      variables: [
        { token: 'الاسم', label: 'اسم المواطن', source: 'fullName', required: true }
      ]
    });

    const counts = await window.diwan.counts.sidebar();
    const agenda = await window.diwan.today.agenda();
    return {
      yesterday,
      sidebarOverdue: counts.orders.overdue,
      agendaOverdueCount: agenda.overdue.length,
      agendaReadyCount: agenda.ready.length
    };
  `);

  ok('طلبٌ جاهز بتاريخ أمس لا يزيد عدّاد overdue في إحصاءات الشريط (overdue = 0)', setup.sidebarOverdue === 0);
  ok('ولا يظهر كمتأخّر في قائمة الجرس والأجندة ويظهر في الجاهز للتسليم', setup.agendaOverdueCount === 0 && setup.agendaReadyCount >= 1);

  // ٢. فتح الشبّاك واختيار النموذج
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(800);

  // اختيار النموذج بالبحث وEnter
  await page.eval(`
    const input = document.querySelector('[data-screen="service"] input[data-counter-search]');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'تأييد طلب');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(500);
  await page.key('Enter');
  await wait(500);
  await page.key('Enter');
  await wait(600);

  // ملء اسم المواطن
  await page.eval(`
    const input = document.querySelector('[data-fill-form] input');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'سالم حسن كاظم');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(500);

  // الانتقال إلى المراجعة
  await page.clickText('راجع الأوراق', 'button');
  await wait(600);

  // ٣. محاكاة ساعة غير مضبوطة (سنة 2024 تسبق 2026)
  await page.eval(`
    const origDate = window.Date;
    window.__origDate = origDate;
    window.Date = class extends origDate {
      constructor(...args) {
        if (args.length === 0) super('2024-05-15T12:00:00Z');
        else super(...args);
      }
      static now() {
        return new origDate('2024-05-15T12:00:00Z').getTime();
      }
    };
  `);

  // الضغط على «احفظ بلا طباعة»
  await page.clickText('احفظ بلا طباعة', 'button');
  await wait(800);

  // التحقّق من ظهور تنبيه الساعة الخاطئة
  const toastText = await page.eval(`
    const toast = document.querySelector('.bg-error-container');
    return toast?.innerText ?? '';
  `);
  ok('ظهور تنبيه للموظف بشأن ساعة الجهاز غير المضبوطة عند الإصدار', toastText.includes('ساعة الجهاز'));

  // استعادة Date
  await page.eval(`
    if (window.__origDate) {
      window.Date = window.__origDate;
      delete window.__origDate;
    }
  `);

  // التحقّق من إتمام الحفظ والتوثيق بنجاح بلا منع قسري مع التنبيه
  await wait(800);
  const afterText = await page.text();
  ok('إتمام التوثيق والإصدار بنجاح بلا منع قسري مع التنبيه', afterText.includes('ورقة واحدة') || afterText.includes('م/'));

  return steps;
}
