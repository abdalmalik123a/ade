/**
 * سيناريو: مكتبة النماذج والمسودات — كل زرّ، على التطبيق الحقيقي.
 * ما لا يُقاد آليًا هنا هو حوارا الاستيراد والنسخ الاحتياطي (حوارات نظام)،
 * وهما مغطّيان باختبارات الخدمة.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── الحالة الفارغة ───────────────────────────────────────────────
  await page.goto(1);
  let text = await page.text();
  ok('فُتحت مكتبة النماذج', text.includes('مكتبة النماذج والمسودات') || text.includes('مكتبة النماذج فارغة'));
  ok('تعلن أنها فارغة', text.includes('مكتبة النماذج فارغة'));
  ok('العدّادات صفر', text.includes('لم يُعتمد أي نموذج بعد'));

  // ── فتح المصمّم ──────────────────────────────────────────────────
  await page.clickText('فتح مصمّم النماذج والمُعاملات');
  await wait(400);
  text = await page.text();
  ok('انفتح مصمّم النماذج', text.includes('مصمّم النماذج والمُعاملات'));
  ok('لا متغيّرات بعد', text.includes('لا متغيّرات بعد'));

  // الحفظ بلا عنوان يُرفض
  await page.clickText('حفظ النموذج');
  await wait(300);
  ok('يرفض الحفظ بلا عنوان', (await page.text()).includes('عنوان النموذج مطلوب'));

  // تعبئة التعريف
  await page.type('input[placeholder^="مثال: تأييد"]', 'تأييد استمرار بالخدمة');
  await page.type('input[placeholder^="لمن يوجَّه"]', 'موجَّه إلى المصارف ودوائر الإسكان');
  await page.type('input[placeholder="اختياري"]', 'DIW-EDU-1');
  await page.type('input[placeholder^="تصنيف"]', 'كتب التأييد');

  // المتن فارغ يُرفض
  await page.clickText('حفظ النموذج');
  await wait(300);
  ok('يرفض الحفظ بمتن فارغ', (await page.text()).includes('متن النموذج فارغ'));

  // كتابة المتن بحقن المتغيّرات من الأزرار
  await page.type(
    'textarea[placeholder^="نؤيد لكم"]',
    'نؤيد لكم بأن السيد {الاسم} الحامل للرقم الوطني {الرقم_الوطني} مستمر بالخدمة حتى {التاريخ_الميلادي}.'
  );
  await wait(400);
  text = await page.text();
  ok('اكتُشفت ثلاثة متغيّرات من المتن', text.includes('3 متغيّر'));
  ok('صُنّف {الاسم} كحقل مواطن', text.includes('من ملف المواطن'));
  ok('صُنّف {التاريخ_الميلادي} كحقل محرّك', text.includes('يملؤه المحرّك'));

  // حقن متغيّر إضافي بالضغط على زرّ
  await page.clickText('مكان العمل', 'button');
  await wait(400);
  ok('حقن زرّ «مكان العمل» وسمه في المتن', (await page.text()).includes('4 متغيّر'));

  if (shotsDir) await page.shot(join(shotsDir, 'tpl-designer.png'));

  await page.clickText('حفظ النموذج');
  await wait(900);
  text = await page.text();
  ok('أُغلق المصمّم بعد الحفظ', !text.includes('المتغيّرات المكتشَفة'));
  ok('أكّد الحفظ', text.includes('حُفظ النموذج'));
  ok('ظهر النموذج في الشبكة', text.includes('تأييد استمرار بالخدمة'));
  ok('ظهر كوده', text.includes('DIW-EDU-1'));
  ok('ظهر تصنيفه كمرشّح', text.includes('كتب التأييد (1)'));
  ok('ظهرت متغيّراته على البطاقة', text.includes('[الاسم]'));

  if (shotsDir) await page.shot(join(shotsDir, 'tpl-grid.png'));

  // ── منع تكرار الكود ─────────────────────────────────────────────
  await page.clickText('فتح مصمّم النماذج والمُعاملات');
  await wait(400);
  await page.type('input[placeholder^="مثال: تأييد"]', 'نموذج ثانٍ');
  await page.type('input[placeholder="اختياري"]', 'DIW-EDU-1');
  await page.type('textarea[placeholder^="نؤيد لكم"]', 'متن قصير');
  await page.clickText('حفظ النموذج');
  await wait(600);
  ok('يمنع تكرار الكود', (await page.text()).includes('مستعمل في نموذج آخر'));
  await page.clickText('إلغاء');
  await wait(300);

  // ── البحث والترشيح ──────────────────────────────────────────────
  await page.type('input[placeholder^="ابحث في النماذج"]', 'لا يوجد هذا');
  await wait(300);
  ok('البحث يرشّح', (await page.text()).includes('لا نتائج مطابقة'));
  await page.type('input[placeholder^="ابحث في النماذج"]', '');
  await wait(300);
  ok('مسح البحث يعيد النتائج', (await page.text()).includes('تأييد استمرار بالخدمة'));

  // ── المعاينة بالحجم الكامل ──────────────────────────────────────
  await page.eval(`document.querySelector('button[title="معاينة بالحجم الكامل A4"]')?.click()`);
  await wait(500);
  ok('انفتحت المعاينة الكاملة', await page.eval(`return !!document.querySelector('.a4-sheet')`));
  if (shotsDir) await page.shot(join(shotsDir, 'tpl-preview.png'));
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  await wait(400);
  ok('أُغلقت المعاينة بـ Esc', !(await page.text()).includes('فتح في المحرر\nإغلاق'));

  // ── سجل المسودات ────────────────────────────────────────────────
  await page.clickText('سجل مسودات');
  await wait(400);
  text = await page.text();
  ok('انتقل إلى سجل المسودات', text.includes('سجل المسودات'));
  ok('السجل فارغ', text.includes('لا مسودات محفوظة'));
  await page.clickText('A4 مصغر');
  await wait(400);
  ok('عاد إلى شبكة A4', (await page.text()).includes('تأييد استمرار بالخدمة'));

  // ── تعديل المتغيّرات ────────────────────────────────────────────
  await page.eval(`document.querySelector('button[title="تعديل صيغ المتغيرات"]')?.click()`);
  await wait(600);
  text = await page.text();
  ok('انفتح المصمّم على النموذج القائم', text.includes('تعديل النموذج'));
  ok('حمّل متغيّرات النموذج', text.includes('4 متغيّر'));

  // ── الحذف بتأكيد ────────────────────────────────────────────────
  await page.clickText('حذف النموذج');
  await wait(300);
  ok('يطلب تأكيد الحذف', (await page.text()).includes('تأكيد الحذف؟'));
  await page.clickText('نعم، احذف');
  await wait(900);
  text = await page.text();
  ok('حُذف النموذج', text.includes('مكتبة النماذج فارغة'));
  ok('أكّد الحذف', text.includes('حُذف النموذج'));

  // ── التحقّق من القرص ────────────────────────────────────────────
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const count = db.prepare('SELECT COUNT(*) AS n FROM templates').get();
  const vars = db.prepare('SELECT COUNT(*) AS n FROM template_variables').get();
  db.close();
  ok('القاعدة خالية من النماذج بعد الحذف', count.n === 0);
  ok('لم تبقَ متغيّرات يتيمة', vars.n === 0);

  return steps.join('\n');
}
