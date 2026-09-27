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

/**
 * تقويم حقل التاريخ. من المكاتب ما يكتب بالهجري (العقود الشرعية والأوقاف)، ومنها
 * بالميلادي — ومنها بالاثنين معًا: «… م الموافق … هـ».
 */
export type Calendar = 'gregorian' | 'hijri' | 'both';

export const CALENDAR_LABEL: Record<Calendar, string> = {
  gregorian: 'ميلادي',
  hijri: 'هجري',
  both: 'ميلادي وهجري'
};

/**
 * التاريخ بتقويم الحقل. والهجري وحده يُعلَّم «هـ» فلا يُقرأ ميلاديًّا؛ والميلادي
 * وحده بلا علامة كما يُكتب في الكتب الرسمية.
 */
export function formatDateIn(date: Date, calendar: Calendar = 'gregorian'): string {
  if (calendar === 'hijri') return `${formatHijri(date)} هـ`;
  if (calendar === 'both') return `${formatGregorian(date)} م الموافق ${formatHijri(date)} هـ`;
  return formatGregorian(date);
}

/** من قيمة `<input type="date">` (YYYY-MM-DD) إلى تاريخٍ محلّي — لا UTC فينزاح اليوم. */
export function fromIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** كم يومًا مضى على وقتٍ (ISO) — بالتقويم المحلّي لا بالساعات: أمسِ الليلة يومٌ مضى. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(now) - day(then)) / 86_400_000);
}

/** «اليوم» · «أمس» · «منذ ٣ أيام» — لآخر نسخةٍ احتياطية وما شابهها. */
export function sinceText(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'لم يحدث بعد';
  const n = daysSince(iso, now);
  if (!Number.isFinite(n)) return 'لم يحدث بعد';
  if (n <= 0) return 'اليوم';
  if (n === 1) return 'أمس';
  if (n === 2) return 'منذ يومين';
  if (n <= 10) return `منذ ${n} أيام`;
  return `منذ ${n} يومًا`;
}

/** بعدها يُذكَّر المكتب بنسخةٍ احتياطية: أسبوع — وما يضيع في أسبوعٍ يُعاد، وفي شهرٍ لا. */
export const BACKUP_REMIND_DAYS = 7;
