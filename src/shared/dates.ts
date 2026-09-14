/**
 * التاريخان الميلادي والهجري — التصميم يعرضهما جنبًا إلى جنب في سجل الصادر.
 * التقويم أم القرى هو المعتمد رسميًا في المراسلات، ومتاح داخل Intl بلا أي حزمة.
 */

const AR_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
];

/** 14 تشرين الثاني 2024 — بأسماء الشهور العراقية لا المصرية. */
export function formatGregorian(date: Date): string {
  return `${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** 12 جمادى الأولى 1446 */
export function formatHijri(date: Date): string {
  const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}

/** صيغة التخزين: YYYY-MM-DD بالتوقيت المحلي، لا UTC — وإلا انزاح اليوم. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
