/**
 * سيناريو: سجل المواطنين والمستمسكات — كل زرّ، على التطبيق الحقيقي.
 * ما لا يُقاد آليًا: حوارات النظام (استعراض ملف، تصدير Excel/ZIP) والماسح
 * الضوئي (لا جهاز موصول) — وهي مغطّاة باختبارات الخدمة.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto(3);
  let text = await page.text();
  ok('فُتح سجل المواطنين', text.includes('سجل المواطنين والمستمسكات الرسمية'));
  ok('الدليل فارغ', text.includes('الدليل فارغ'));
  ok('لا ملف مفتوح', text.includes('لم يُفتح أي ملف'));
  ok('العدّادات صفر', text.includes('لم يُسجَّل أي مواطن بعد'));

  // ── فحص الماسح الضوئي ────────────────────────────────────────────
  await page.clickText('فحص الماسح الضوئي');
  await wait(3000);
  text = await page.text();
  ok(
    'فحص الماسح يبلّغ بصدق',
    text.includes('لا يوجد ماسح ضوئي موصول') || text.includes('الماسح متصل')
  );

  // ── إضافة ملف مواطن ──────────────────────────────────────────────
  await page.clickText('إضافة ملف مواطن');
  await wait(500);
  ok('انفتح نموذج الإضافة', (await page.text()).includes('إضافة ملف مواطن'));

  await page.clickText('حفظ الملف');
  await wait(400);
  ok('يرفض الحفظ بلا اسم', (await page.text()).includes('اسم المواطن مطلوب'));

  const fill = async (label, value) => {
    await page.eval(`
      const labels = [...document.querySelectorAll('label')];
      const l = labels.find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      const input = l?.parentElement?.querySelector('input');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(120);
  };

  await fill('الاسم الرباعي واللقب', 'أحمد عادل كريم الموسوي');
  await fill('الرقم الوطني الموحد', '198421098312');
  await fill('العنوان الوظيفي والدرجة', 'مدرس أول لغة عربية');
  await fill('مكان العمل', 'إعدادية المنصور المهنية');
  await fill('رقم هاتف الاتصال', '07701849201');
  await fill('التصنيف', 'تربية وتعليم');

  await page.clickText('حفظ الملف');
  await wait(900);
  text = await page.text();
  ok('حُفظ الملف', text.includes('حُفظ ملف المواطن'));
  ok('ظهر في الدليل', text.includes('أحمد عادل كريم الموسوي'));
  ok('فُتح ملفه تلقائيًا', text.includes('مدرس أول لغة عربية'));
  ok('ظهر التصنيف كمرشّح', text.includes('تربية وتعليم (1)'));
  ok('الخزنة فارغة', text.includes('لا مستمسكات لهذا الملف'));
  ok('لا كتب صادرة له', text.includes('لم يصدر أي كتاب لهذا المواطن بعد'));

  if (shotsDir) await page.shot(join(shotsDir, 'citizens-file.png'));

  // ── منع تكرار الرقم الوطني ───────────────────────────────────────
  await page.clickText('إضافة ملف مواطن');
  await wait(500);
  await fill('الاسم الرباعي واللقب', 'شخص آخر');
  await fill('الرقم الوطني الموحد', '198421098312');
  await page.clickText('حفظ الملف');
  await wait(700);
  ok('يمنع تكرار الرقم الوطني', (await page.text()).includes('مسجَّل لمواطن آخر'));
  await page.clickText('إلغاء');
  await wait(400);

  // ── البحث العربي المطبَّع ────────────────────────────────────────
  await page.type('input[placeholder^="ابحث بالاسم"]', 'احمد');
  await wait(600);
  ok('يجد «أحمد» بكتابة «احمد»', (await page.text()).includes('أحمد عادل كريم الموسوي'));

  await page.type('input[placeholder^="ابحث بالاسم"]', 'لا يوجد اسم كهذا');
  await wait(600);
  ok('البحث الفارغ يعلن ذلك', (await page.text()).includes('لا نتائج مطابقة'));

  await page.type('input[placeholder^="ابحث بالاسم"]', '198421');
  await wait(600);
  ok('يبحث بالرقم الوطني', (await page.text()).includes('أحمد عادل كريم الموسوي'));

  await page.type('input[placeholder^="ابحث بالاسم"]', '');
  await wait(600);

  // ── أزرار الملف ──────────────────────────────────────────────────
  ok('زرّ الإدراج في المحرر ظاهر', (await page.text()).includes('إدراج في محرر الكتب'));
  ok('زرّ التعديل ظاهر',
    await page.eval(`return !!document.querySelector('button[title="تعديل بيانات المواطن"]')`));
  ok('زرّ تصدير Excel ظاهر',
    await page.eval(`return !!document.querySelector('button[title="تصدير السجل كملف Excel"]')`));
  ok('زرّ الحذف ظاهر',
    await page.eval(`return !!document.querySelector('button[title="حذف ملف المواطن"]')`));
  ok('زرّ نسخ الحقل ظاهر',
    await page.eval(`return !!document.querySelector('button[title="نسخ"]')`));

  // التعديل يفتح النموذج معبّأً
  await page.eval(`document.querySelector('button[title="تعديل بيانات المواطن"]')?.click()`);
  await wait(600);
  text = await page.text();
  ok('التعديل يفتح النموذج معبّأً', text.includes('تعديل بيانات المواطن'));
  const v = await page.eval(`
    const labels = [...document.querySelectorAll('label')];
    const l = labels.find(x => x.textContent.trim().startsWith('الاسم الرباعي واللقب'));
    return l?.parentElement?.querySelector('input')?.value ?? '';
  `);
  ok('حُمّل الاسم في النموذج', v === 'أحمد عادل كريم الموسوي');
  await page.clickText('إلغاء');
  await wait(400);

  // ── خزنة المستمسكات ─────────────────────────────────────────────
  ok('زرّ الاستعراض من الحاسوب ظاهر', (await page.text()).includes('استعراض من الحاسوب'));
  ok('زرّ المسح الضوئي ظاهر', (await page.text()).includes('مسح ضوئي فوري'));
  ok('زرّ تصدير ZIP معطّل بلا مستمسكات',
    await page.eval(`
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('تصدير الكل ZIP'));
      return b ? b.disabled : false;
    `));

  // المسح بلا ماسح يجب أن يبلّغ بصدق لا أن ينهار
  await page.clickText('مسح ضوئي فوري');
  // الإشعار يدوم 3.4 ثانية — نستطلع بدل الانتظار الأعمى.
  let scanMsg = '';
  for (let i = 0; i < 12; i++) {
    await wait(400);
    scanMsg = await page.eval(`
      const el = [...document.querySelectorAll('div')].find(d =>
        typeof d.className === 'string' && d.className.includes('fixed bottom-6'));
      return el ? el.innerText : '';
    `);
    if (scanMsg) break;
  }
  ok('المسح بلا ماسح يبلّغ بصدق',
    scanMsg.includes('لا يوجد ماسح ضوئي موصول') || scanMsg.includes('الماسح الضوئي غير متاح'));
  ok('رسالة الخطأ عربية خالصة بلا تسرّب إنجليزي',
    Boolean(scanMsg) && !/Error|invoking|remote method/i.test(scanMsg));

  // ── الحذف بتأكيد ────────────────────────────────────────────────
  await page.eval(`document.querySelector('button[title="حذف ملف المواطن"]')?.click()`);
  await wait(600);
  ok('الحذف يطلب تأكيدًا', (await page.text()).includes('تأكيد؟'));
  await page.clickText('تراجع');
  await wait(400);
  ok('التراجع يُبقي الملف', (await page.text()).includes('أحمد عادل كريم الموسوي'));

  await page.eval(`document.querySelector('button[title="حذف ملف المواطن"]')?.click()`);
  await wait(600);
  await page.clickText('نعم، احذف');
  await wait(900);
  text = await page.text();
  ok('حُذف الملف', text.includes('حُذف ملف المواطن'));
  ok('عاد الدليل فارغًا', text.includes('الدليل فارغ'));

  // ── التحقّق من القرص ────────────────────────────────────────────
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const n = db.prepare('SELECT COUNT(*) AS n FROM citizens').get();
  const a = db.prepare('SELECT COUNT(*) AS n FROM attachments').get();
  db.close();
  ok('القاعدة خالية من المواطنين', n.n === 0);
  ok('لا مستمسكات يتيمة', a.n === 0);

  return steps.join('\n');
}
