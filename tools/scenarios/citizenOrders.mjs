/** S32: ملفان بالاسم نفسه، وطلب حر، وكل الحالات؛ الربط بالمعرّف وحده. بيانات مصنوعة. */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const ids = await page.eval(`
    const a = await window.diwan.citizens.save({ id: null, fullName: 'سالم حسن علي', verified: false });
    const b = await window.diwan.citizens.save({ id: null, fullName: 'سالم حسن علي', verified: false });
    const c = await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', verified: false });
    const due = new Date(); due.setDate(due.getDate() - 2);
    const date = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0');
    const statuses = ['new', 'waiting', 'working', 'ready', 'delivered', 'cancelled'];
    const orders = [];
    for (const status of statuses) orders.push(await window.diwan.orders.save({ id: null, clientId: null,
      citizenId: a.id, customer: a.fullName, title: 'طلب مصنوع ' + status, dueDate: date, status }));
    const other = await window.diwan.orders.save({ id: null, clientId: null, citizenId: b.id, customer: b.fullName, title: 'طلب الملف الثاني' });
    const free = await window.diwan.orders.save({ id: null, clientId: null, customer: a.fullName, title: 'طلب حر بالاسم نفسه' });
    const client = await window.diwan.clients.save({ id: null, name: 'مدرسة النور', kind: 'مدرسة' });
    const school = await window.diwan.orders.save({ id: null, clientId: client.id, title: 'طلب الجهة المصنوع', status: 'delivered' });
    return { a: a.id, b: b.id, c: c.id, orders: orders.map(o => o.id), other: other.id, free: free.id, school: school.id };
  `);
  await page.goto('citizens-identity-records');
  const select = async (id) => {
    if (!await page.until(`return Boolean(document.querySelector('[data-citizen-id="${id}"]'));`, 8000)) throw new Error('ملف غير ظاهر');
    await page.eval(`document.querySelector('[data-citizen-id="${id}"]').click(); return true;`);
    if (!await page.until(`return Boolean(document.querySelector('[data-citizen-orders="${id}"]')) && !document.querySelector('[data-citizen-orders] [role="status"]');`, 8000)) throw new Error('قائمة لم تصل');
    return page.eval(`return { ids: [...document.querySelectorAll('[data-citizen-orders] [data-order-id]')].map(e => Number(e.dataset.orderId)), text: document.querySelector('[data-citizen-orders]').innerText };`);
  };
  const first = await select(ids.a);
  ok('كل طلبات الملف الأول الستة وحدها', first.ids.length === 6 && ids.orders.every(id => first.ids.includes(id)));
  ok('لا طلب للملف الآخر المساوي بالاسم', !first.ids.includes(ids.other));
  ok('ولا طلب حر بالاسم نفسه', !first.ids.includes(ids.free));
  ok('ولا طلب الجهة', !first.ids.includes(ids.school));
  for (const label of ['جديد', 'بانتظار الزبون', 'قيد العمل', 'جاهز للتسليم', 'سُلِّم', 'أُلغي']) ok(`تظهر حالة ${label}`, first.text.includes(label));
  const row = (id) => page.eval(`return document.querySelector('[data-citizen-orders] [data-order-id="${id}"]').innerText;`);
  ok('المفتوح يذكر التأخّر', (await row(ids.orders[0])).includes('متأخّر يومين'));
  for (const i of [3, 4, 5]) ok(`حالة ${i} بلا تأخّر مضلل`, !(await row(ids.orders[i])).includes('متأخّر'));
  const second = await select(ids.b);
  ok('التبديل إلى الآخر يعرض طلبه وحده', second.ids.length === 1 && second.ids[0] === ids.other);
  const empty = await select(ids.c);
  ok('الملف الخالي لا يعرض طلبات السابق', empty.ids.length === 0 && empty.text.includes('لا طلبات مرتبطة بهذا الملف'));
  ok('ويشرح ربط الطلب من السجلّ', empty.text.includes('باختيار الزبون من السجلّ'));
  const again = await select(ids.a);
  ok('العودة تجلب الستة الصحيحة', again.ids.length === 6 && ids.orders.every(id => again.ids.includes(id)));
  await page.goto('clients-directory');
  await page.clickText('مدرسة النور');
  ok('والجهة تستخدم الصف المشترك وحالة التسليم', await page.until(`return [...document.querySelectorAll('[data-order-id]')].some(e => Number(e.dataset.orderId) === ${ids.school} && e.innerText.includes('سُلِّم'));`, 8000));
  return steps.join('\n');
}
