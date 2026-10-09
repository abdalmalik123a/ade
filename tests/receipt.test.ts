/**
 * وصل استلام الطلب (الموجة ٢): نسختان على A4 — للزبون وللمكتب — بلا مبالغ ولا باركود.
 */
import { describe, expect, it } from 'vitest';
import { receiptSheet } from '../src/shared/receipt';
import type { Order } from '../src/shared/orders';

const ORDER: Order = {
  id: 128,
  clientId: null,
  citizenId: null,
  customer: 'سالم حسن',
  clientLogo: null,
  phone: '07701234567',
  title: 'هويّات الطلبة',
  quantity: 40,
  dueDate: '2026-10-10',
  status: 'new',
  notes: 'ملاحظةٌ للمكتب وحده',
  templateId: null,
  templateTitle: null,
  batchText: 'قائمة الأسماء',
  received: 'هوية موحّدة و٤ صور',
  createdAt: '2026-10-07 07:30:00',
  updatedAt: '2026-10-07 07:30:00',
  deliveredAt: null
};
const OFFICE = { name: 'مكتب النور للاستنساخ', phone: '07801112233', address: 'بغداد — الكرادة' };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('وصل الاستلام', () => {
  it('نسختان: للزبون وللمكتب، وكلٌّ بما يلزم', () => {
    const html = receiptSheet(ORDER, OFFICE);
    expect(html.match(/data-receipt-copy=/g)).toHaveLength(2);
    expect(html).toContain('data-receipt-copy="نسخة الزبون"');
    expect(html).toContain('data-receipt-copy="نسخة المكتب"');
    const t = text(html);
    for (const part of [
      'مكتب النور للاستنساخ',
      '07801112233 — بغداد — الكرادة',
      'وصل استلام',
      'رقم 128',
      'تاريخ الاستلام 7 تشرين الأول 2026',
      'سالم حسن — 07701234567',
      'هويّات الطلبة — العدد 40',
      'ما تركه عندنا هوية موحّدة و٤ صور',
      'موعد التسليم 10 تشرين الأول 2026',
      'يُرجى إحضار هذا الوصل عند الاستلام'
    ])
      expect(t, part).toContain(part);
    // ما للمكتب وحده لا يُطبع للزبون
    expect(t).not.toContain('ملاحظةٌ للمكتب');
    expect(t).not.toContain('قائمة الأسماء');
  });

  it('بلا مبالغ ولا باركود — ديوان أداة إنتاجٍ لا دفتر حسابات', () => {
    const html = receiptSheet(ORDER, OFFICE);
    for (const money of ['دينار', 'المبلغ', 'السعر', 'الأجرة', 'المجموع', 'د.ع']) expect(html).not.toContain(money);
    expect(html).not.toMatch(/<svg|<canvas|barcode/i);
  });

  it('وما لم يُكتب لا سطر له — وبلا موعدٍ «نتّصل بكم حين يجهز»', () => {
    const t = text(receiptSheet({ ...ORDER, phone: null, quantity: null, dueDate: null, received: null }, { name: '', phone: '', address: '' }));
    expect(t).toContain('المكتب');
    expect(t).not.toContain('ما تركه عندنا');
    expect(t).not.toContain('العدد');
    expect(t).toContain('موعد التسليم نتّصل بكم حين يجهز');
    expect(t).toContain('الزبون سالم حسن ');
  });

  it('وما يكتبه الموظف نصٌّ لا علامات', () => {
    const html = receiptSheet({ ...ORDER, customer: '<b onclick="x">أحمد</b>', received: '<img src=x>' }, OFFICE);
    expect(html).not.toContain('<b onclick');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;b onclick=');
  });
});
