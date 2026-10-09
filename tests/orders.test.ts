import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { deleteClient, getClient, listClients, prepareClients, saveClient, setClientLogo } from '../src/main/services/clients';
import { deleteOrder, listOrders, orderCounts, saveOrder, setOrderStatus } from '../src/main/services/orders';
import { dueLabel, statusOf } from '../src/shared/orders';
import { localToday } from '../src/shared/dates';
import { deleteCitizen, ensureSearchColumn, saveCitizen } from '../src/main/services/citizens';
import type { CitizenInput } from '../src/shared/api';

describe('الجهات', () => {
  it('تُحفظ بهاتفها ولونها، والاسم لا يتكرّر ولو اختلفت همزته', () => {
    const db = freshDb();
    const c = saveClient(db, { id: null, name: 'مدرسة الرافدين', kind: 'مدرسة', phone: '0770', color: '#1f3a8a' });
    expect(c).toMatchObject({ name: 'مدرسة الرافدين', kind: 'مدرسة', phone: '0770', color: '#1f3a8a', logo: null });
    expect(() => saveClient(db, { id: null, name: 'مدرسه الرافدين' })).toThrow('موجودة');
    expect(() => saveClient(db, { id: null, name: ' ' })).toThrow('مطلوب');
    expect(() => saveClient(db, { id: c.id, name: 'x', color: 'أزرق' })).toThrow('اللون');
  });

  it('وملفّ المدرسة يُحفظ — وحفظٌ لا يرسله (والخيار مطفأ) لا يمحوه', () => {
    const db = freshDb();
    const c = saveClient(db, { id: null, name: 'مدرسة النور', kind: 'مدرسة', schoolGender: 'المختلطة', governorate: 'بابل', principal: 'سالم حسن' });
    expect(c).toMatchObject({ schoolGender: 'المختلطة', governorate: 'بابل', principal: 'سالم حسن' });
    // شاشةٌ لا تعرف ملفّ المدرسة تحفظ الهاتف وحده.
    expect(saveClient(db, { id: c.id, name: 'مدرسة النور', kind: 'مدرسة', phone: '0770' })).toMatchObject({ phone: '0770', principal: 'سالم حسن' });
    // ويُمحى حين يُرسل فارغًا.
    expect(saveClient(db, { id: c.id, name: 'مدرسة النور', principal: ' ' }).principal).toBeNull();
  });

  it('وشعارها شعارٌ مربوطٌ بها يحلّ محلّ سابقه', () => {
    const db = freshDb();
    const c = saveClient(db, { id: null, name: 'ثانوية المتميزين' });
    setClientLogo(db, c.id, 'seals/a.png');
    expect(setClientLogo(db, c.id, 'seals/b.png').logo).toBe('seals/b.png');
    const seals = db.prepare("SELECT image_path FROM seals WHERE kind = 'شعار'").all();
    expect(seals).toEqual([{ image_path: 'seals/b.png' }]);
  });

  it('ويُبحث فيها بلا همزات', () => {
    const db = freshDb();
    saveClient(db, { id: null, name: 'إعدادية الأمين' });
    saveClient(db, { id: null, name: 'مدرسة النور' });
    expect(listClients(db, 'اعداديه').map((c) => c.name)).toEqual(['إعدادية الأمين']);
  });

  it('وحذفها لا يحذف طلباتها — يبقى اسمها عليها', () => {
    const db = freshDb();
    const c = saveClient(db, { id: null, name: 'مدرسة النور' });
    const o = saveOrder(db, { id: null, clientId: c.id, title: 'هويّات' });
    deleteClient(db, c.id);
    expect(getClient(db, c.id)).toBeNull();
    expect(listOrders(db).find((x) => x.id === o.id)).toMatchObject({ clientId: null, customer: 'مدرسة النور' });
  });

  it('وقاعدة المكتب القائمة بلا الأعمدة الجديدة تقوم', () => {
    // المخطط الأصلي بلا الأعمدة الجديدة — وهي حال كل مكتبٍ قائم.
    const db = freshDb();
    const cols = () => (db.prepare('PRAGMA table_info(authorities)').all() as { name: string }[]).map((c) => c.name);
    expect(cols()).not.toContain('phone');
    expect(listClients(db)).toEqual([]);
    expect(cols()).toEqual(expect.arrayContaining(['phone', 'address', 'color', 'notes']));
    prepareClients(db);
    expect(saveClient(db, { id: null, name: 'جهة', phone: '1' }).phone).toBe('1');
  });
});

describe('الطلبات — بلا مبالغ', () => {
  it('طلب جهةٍ باسمها وشعارها، وطلب زبونٍ فردٍ باسمه', () => {
    const db = freshDb();
    const c = saveClient(db, { id: null, name: 'مدرسة الرافدين', phone: '0770' });
    setClientLogo(db, c.id, 'seals/r.png');
    const a = saveOrder(db, { id: null, clientId: c.id, title: '٤٠٠ هويّة', quantity: 400, dueDate: '2026-10-01' });
    expect(a).toMatchObject({ customer: 'مدرسة الرافدين', clientLogo: 'seals/r.png', phone: '0770', status: 'new', quantity: 400 });
    const b = saveOrder(db, { id: null, clientId: null, customer: 'أبو علي', phone: '0780', title: 'شهادة شكر' });
    expect(b).toMatchObject({ customer: 'أبو علي', phone: '0780', clientId: null });
    expect(getClient(db, c.id)!.openOrders).toBe(1);
    const cols = (db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((x) => x.name);
    expect(cols.some((n) => /price|fee|amount|paid|deposit/.test(n))).toBe(false);
  });

  it('ويُرفض بلا عنوانٍ أو بلا صاحب', () => {
    const db = freshDb();
    expect(() => saveOrder(db, { id: null, clientId: null, customer: 'x', title: '' })).toThrow('اكتب ما طُلب');
    expect(() => saveOrder(db, { id: null, clientId: null, title: 'هويّات' })).toThrow('لمن الطلب');
  });

  it('والحالة تسير، والتسليم يُختم بوقته ويُمحى بالرجوع', () => {
    const db = freshDb();
    const o = saveOrder(db, { id: null, clientId: null, customer: 'x', title: 'ملصقات' });
    expect(setOrderStatus(db, o.id, 'working').deliveredAt).toBeNull();
    const done = setOrderStatus(db, o.id, 'delivered');
    expect(done.deliveredAt).not.toBeNull();
    expect(setOrderStatus(db, o.id, 'ready').deliveredAt).toBeNull();
    expect(statusOf('working').next).toBe('ready');
  });

  it('المفتوحة بموعدها الأقرب، وما بلا موعدٍ آخرها', () => {
    const db = freshDb();
    for (const [title, due] of [['ج', null], ['ب', '2026-10-05'], ['أ', '2026-10-02']] as const)
      saveOrder(db, { id: null, clientId: null, customer: 'x', title, dueDate: due });
    const delivered = saveOrder(db, { id: null, clientId: null, customer: 'x', title: 'د' });
    setOrderStatus(db, delivered.id, 'delivered');
    expect(listOrders(db, { status: 'open' }).map((o) => o.title)).toEqual(['أ', 'ب', 'ج']);
    expect(listOrders(db, { status: 'delivered' }).map((o) => o.title)).toEqual(['د']);
    deleteOrder(db, delivered.id);
    expect(listOrders(db, { status: 'delivered' })).toEqual([]);
  });

  it('والعدّادات: المفتوح وما موعده اليوم والمتأخّر', () => {
    const db = freshDb();
    saveOrder(db, { id: null, clientId: null, customer: 'x', title: '1', dueDate: '2026-09-20' });
    saveOrder(db, { id: null, clientId: null, customer: 'x', title: '2', dueDate: '2026-09-25' });
    saveOrder(db, { id: null, clientId: null, customer: 'x', title: '3', dueDate: '2026-09-30' });
    expect(orderCounts(db, '2026-09-25')).toEqual({ open: 3, dueToday: 1, overdue: 1 });
  });

  it('وما تركه الزبون عندنا يُحفظ لوصله — وحفظٌ لا يرسله (والوصل مطفأ) لا يمحوه', () => {
    const db = freshDb();
    const o = saveOrder(db, { id: null, clientId: null, customer: 'سالم حسن', title: 'هويّة', received: ' هوية موحّدة و٤ صور ' });
    expect(o.received).toBe('هوية موحّدة و٤ صور');
    expect(saveOrder(db, { id: o.id, clientId: null, customer: 'سالم حسن', title: 'هويّة ملوّنة' }).received).toBe('هوية موحّدة و٤ صور');
    expect(saveOrder(db, { id: o.id, clientId: null, customer: 'سالم حسن', title: 'هويّة', received: '' }).received).toBeNull();
  });

  it('ورقم الوصل وحده يجد طلبه — بالأرقام العربية والهندية وبعلامة #', () => {
    const db = freshDb();
    saveOrder(db, { id: null, clientId: null, customer: 'زينب', title: 'صور' });
    const o = saveOrder(db, { id: null, clientId: null, customer: 'سالم حسن', title: 'هويّة', received: 'جواز السفر' });
    for (const q of [String(o.id), `#${o.id}`, String(o.id).replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[Number(x)]!)])
      expect(listOrders(db, { status: 'open', query: q }).map((x) => x.id)).toEqual([o.id]);
    // وما تركه يُبحث فيه كذلك
    expect(listOrders(db, { status: 'open', query: 'جواز' }).map((x) => x.id)).toEqual([o.id]);
  });

  it('والطلب يُربط بملفّ الزبون (د٨): يبقى ما لم يُرسل، والجهة تفكّه، وحذف الزبون يفكّه ولا يحذف الطلب', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    const c = saveCitizen(db, { id: null, fullName: 'سالم حسن علي', phone: '07700000000', verified: false } as CitizenInput);
    const o = saveOrder(db, { id: null, clientId: null, citizenId: c.id, customer: 'سالم حسن علي', phone: '07700000000', title: 'صور شخصية' });
    expect(o.citizenId).toBe(c.id);
    expect(listOrders(db, { citizenId: c.id }).map((x) => x.id)).toEqual([o.id]);
    // حفظٌ لا يرسل الزبون (من مكانٍ لا يعرفه) لا يفكّه.
    expect(saveOrder(db, { id: o.id, clientId: null, customer: 'سالم حسن علي', phone: '07700000000', title: 'صور شخصية ٤' }).citizenId).toBe(c.id);
    // وحذف الزبون يفكّ الربط — والطلب باقٍ باسمه وهاتفه.
    deleteCitizen(db, c.id);
    const after = listOrders(db, { status: 'open' }).find((x) => x.id === o.id);
    expect(after).toMatchObject({ citizenId: null, customer: 'سالم حسن علي', phone: '07700000000' });
    // وطلبٌ صار لجهةٍ لا يبقى مربوطًا بشخص.
    const c2 = saveCitizen(db, { id: null, fullName: 'زينب علي', verified: false } as CitizenInput);
    const school = saveClient(db, { id: null, name: 'مدرسة النور' });
    const o2 = saveOrder(db, { id: null, clientId: null, citizenId: c2.id, customer: 'زينب علي', title: 'هويّات' });
    expect(saveOrder(db, { id: o2.id, clientId: school.id, title: 'هويّات' }).citizenId).toBeNull();
    // وطلبٌ جديدٌ لجهةٍ لا يُربط بشخصٍ ولو أُرسل.
    expect(saveOrder(db, { id: null, clientId: school.id, citizenId: c2.id, title: 'شهادات' }).citizenId).toBeNull();
  });
});

describe('الموعد بكلام الموظف', () => {
  it.each([
    ['2026-09-23', 'متأخّر يومين', 'late'],
    ['2026-09-24', 'متأخّر يومًا', 'late'],
    ['2026-09-25', 'اليوم', 'today'],
    ['2026-09-26', 'غدًا', 'soon'],
    ['2026-09-30', 'بعد 5 أيام', 'later']
  ])('%s ← %s', (due, text, tone) => {
    expect(dueLabel(due, '2026-09-25')).toEqual({ text, tone });
  });

  it('واليوم محلّيٌّ لا عالميّ', () => {
    expect(localToday(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
  });
});
