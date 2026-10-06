/**
 * التاريخان الميلادي والهجري — التصميم يعرضهما جنبًا إلى جنب في سجل الصادر.
 *
 * **الميلادي هو الأصل** في كتب العراق ودوائره، والهجري يُضاف لمن يحتاجه (قرار المالك، ٦ تشرين
 * الأول ٢٠٢٦). والهجري يُحسب بتقويم أمّ القرى — متاحٌ في Intl بلا حزمة — وبداية الشهر في العراق
 * تُعلَن بالرؤية فقد تخالفه بيوم: فيُزاح بإعداد المكتب (`hijriOffset`، من −٢ إلى +٢ يومًا).
 */

const AR_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
];

/** 14 تشرين الثاني 2024 — بأسماء الشهور العراقية لا المصرية. */
export function formatGregorian(date: Date): string {
  return `${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** إزاحة الهجري بالأيام: عددٌ صحيح من −٢ إلى +٢، وما سواه صفر. */
export function clampHijriOffset(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(-2, Math.min(2, n)) : 0;
}

let hijriOffsetDays = 0;

/** إزاحة المكتب — تُضبط عند الإقلاع وكلّما غيّرها من الإعدادات (App.tsx). */
export function setHijriOffset(days: number): void {
  hijriOffsetDays = clampHijriOffset(days);
}

/** 12 جمادى الأولى 1446 — بإزاحة المكتب ما لم تُعطَ غيرها. */
export function formatHijri(date: Date, offsetDays: number = hijriOffsetDays): string {
  // اليوم نفسه منتصف نهاره، مزاحًا بالأيام — فلا تقلبه ساعةٌ عند منتصف الليل.
  const day = offsetDays ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays, 12) : date;
  const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).formatToParts(day);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}

/** صيغة التخزين: YYYY-MM-DD بالتوقيت المحلي، لا UTC — وإلا انزاح اليوم. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** أوّل الأسبوع: السبت منتصف الليل — أوّل أيّام الدوام بعد الجمعة (لـ«السجلّ» والملخّص الأسبوعي معًا). */
export function weekStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 1) % 7));
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

/**
 * وقتٌ خزّنته القاعدة (`datetime('now')`: UTC بلا علامة) بتوقيت الجهاز: «2026-10-04 14:05».
 * وكان يُعرض كما خُزّن فيتأخّر ثلاث ساعاتٍ عن توقيت العراق (المرحلة ٣ من UPGRADE.md).
 */
export function localStamp(at: string): string {
  const iso = /[TZ+]/.test(at.slice(10)) ? at : `${at.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return at.slice(0, 16);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
