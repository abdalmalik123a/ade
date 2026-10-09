/**
 * وصل استلام الطلب (الموجة ٢) — خيارٌ مطفأ في الأصل (قرار المالك: «لا يأخذه أحدٌ عادةً… خيارًا يُفعل ولا يُفعل»).
 *
 * لزبونٍ يترك عند المكتب ما يُنجز ويعود: اسم المكتب وهاتفه وعنوانه، و«وصل استلام» برقم الطلب، وتاريخ الاستلام، والزبون
 * وهاتفه، والمطلوب وعدده، وما تركه عندنا، وموعد التسليم. **بلا مبالغ** (ديوان أداة إنتاجٍ لا دفتر حسابات) **ولا باركود**
 * (للهويات وحدها). على ورقة A4 العادية — ما في كلّ مكتب — نسختان كلٌّ بثلثها يفصلهما خطّ قصّ (المالك: «نعم نسختان»):
 * للزبون، وللمكتب تُرفق بما تركه فلا تختلط أغراض الزبائن.
 */
import { escapeHtml } from './html';
import { formatGregorian, fromIsoDate, localStamp } from './dates';
import type { Order } from './orders';

export type ReceiptOffice = { name: string; phone: string; address: string };

const COPIES = ['نسخة الزبون', 'نسخة المكتب'] as const;

/** تاريخٌ للوصل: يومٌ مخزَّن (YYYY-MM-DD) أو وقتٌ من القاعدة (UTC) — بأسماء الشهور العراقية. */
function dayText(value: string | null): string | null {
  if (!value) return null;
  const day = fromIsoDate(value.length > 10 ? localStamp(value).slice(0, 10) : value);
  return day ? formatGregorian(day) : null;
}

/** سطرٌ في الوصل: عنوانه وقيمته — وما لا قيمة له لا يُكتب. */
function line(label: string, value: string | null | undefined, extra = ''): string {
  const v = value?.trim();
  if (!v) return '';
  return `<div style="display:flex;gap:3mm;padding:1.2mm 0;border-bottom:0.2mm dotted #999${extra}"><span style="min-width:30mm;color:#444">${escapeHtml(label)}</span><span style="flex:1;font-weight:600">${escapeHtml(v)}</span></div>`;
}

function copyHtml(order: Order, office: ReceiptOffice, copy: string): string {
  const contact = [office.phone.trim(), office.address.trim()].filter(Boolean).join(' — ');
  const what = order.quantity ? `${order.title} — العدد ${order.quantity}` : order.title;
  return [
    `<div data-receipt-copy="${escapeHtml(copy)}" style="height:99mm;box-sizing:border-box;padding:7mm 10mm 5mm;display:flex;flex-direction:column;gap:1mm;font-size:10.5pt;line-height:1.5">`,
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;border-bottom:0.4mm solid #000;padding-bottom:1.5mm">`,
    `<div><div style="font-size:13pt;font-weight:700">${escapeHtml(office.name.trim() || 'المكتب')}</div>`,
    contact ? `<div style="font-size:9.5pt;color:#333" dir="auto">${escapeHtml(contact)}</div>` : '',
    `</div>`,
    `<div style="text-align:left"><div style="font-size:13pt;font-weight:700">وصل استلام</div>`,
    `<div style="font-size:10pt">رقم <b dir="ltr">${order.id}</b> · ${escapeHtml(copy)}</div></div>`,
    `</div>`,
    line('تاريخ الاستلام', dayText(order.createdAt)),
    line('الزبون', order.phone ? `${order.customer} — ${order.phone}` : order.customer),
    line('المطلوب', what),
    line('ما تركه عندنا', order.received),
    line('موعد التسليم', dayText(order.dueDate) ?? 'نتّصل بكم حين يجهز'),
    `<div style="margin-top:auto;font-size:9.5pt;color:#333">يُرجى إحضار هذا الوصل عند الاستلام.</div>`,
    `</div>`
  ].join('');
}

/** ورقة الوصل كما تُطبع: A4 عليها النسختان، وبعدهما خطّ قصّ — والثلث الأخير فارغ. */
export function receiptSheet(order: Order, office: ReceiptOffice): string {
  const cut = '<div style="border-top:0.3mm dashed #666;position:relative"><span style="position:absolute;top:-2.6mm;left:6mm;font-size:9pt;background:#fff;padding:0 1mm">✂</span></div>';
  return `<div dir="rtl" data-receipt="${order.id}" style="width:210mm;height:297mm;box-sizing:border-box;background:#fff;color:#000">${COPIES.map(
    (copy) => copyHtml(order, office, copy)
  ).join(cut)}${cut}</div>`;
}
