/**
 * التاريخان الميلادي والهجري — التصميم يعرضهما جنبًا إلى جنب في سجل الصادر.
 *
 * **الميلادي هو الأصل** في كتب العراق ودوائره، والهجري يُضاف لمن يحتاجه (قرار المالك، ٦ تشرين
 * الأول ٢٠٢٦). والهجري يُحسب بتقويم أمّ القرى — متاحٌ في Intl بلا حزمة — وبداية الشهر في العراق
 * تُعلَن بالرؤية فقد تخالفه بيوم: فيُزاح بإعداد المكتب (`hijriOffset`، من −٢ إلى +٢ يومًا).
 */

import { toIndic, toLatinDigits } from './arabic';

export const AR_MONTHS = [
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

const HIJRI_NUMERIC = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });

/** الهجري أرقامًا — السنة والشهر واليوم — بإزاحة المكتب: منه يُعرف أوّل رمضان (الإمساكية، ٣٫٤). */
export function hijriParts(date: Date, offsetDays: number = hijriOffsetDays): { y: number; m: number; d: number } {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays, 12);
  const parts = HIJRI_NUMERIC.formatToParts(day);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** الشهور بأسمائها العراقية والمصرية والمغاربية والإنكليزية — مطبَّعةً بلا همزات. */
const MONTH_NAMES: [RegExp, number][] = [
  [/كانون الثاني|يناير|جانفي|^jan/, 1],
  [/شباط|فبراير|فيفري|^feb/, 2],
  [/اذار|مارس|^mar/, 3],
  [/نيسان|ابريل|افريل|^apr/, 4],
  [/ايار|مايو|^ماي$|^may/, 5],
  [/حزيران|يونيو|جوان|^jun/, 6],
  [/تموز|يوليو|جويليه|^jul/, 7],
  [/^اب$|اغسطس|اوت|^aug/, 8],
  [/ايلول|سبتمبر|^sep/, 9],
  [/تشرين الاول|اكتوبر|^oct/, 10],
  [/تشرين الثاني|نوفمبر|^nov/, 11],
  [/كانون الاول|ديسمبر|^dec/, 12]
];

/**
 * تاريخٌ ميلاديّ من نصّه كما يُكتب: «2027/02/08» (Excel)، «8/2/2027» و«٨ / ٢ / ٢٠٢٧» و«8-2» (اليوم ثم الشهر كما في العراق)،
 * «8 شباط 2027» (وما يكتبه `formatGregorian`). والسنة الغائبة سنةُ `ref` أو جارتها الأقرب إليه — وما سوى ذلك عدم.
 */
export function parseDateText(text: string, ref: Date = new Date()): Date | null {
  const s = toLatinDigits(text)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  let y: number | null = null;
  let mo = 0;
  let d = 0;
  let m = /^(\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s.*)?$/.exec(s);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2}|\d{4}))?$/.exec(s))) {
    [d, mo] = [Number(m[1]), Number(m[2])];
    if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  } else if ((m = /^(\d{1,2}) ([^\d]+?)(?: (\d{4}))?(?: ?م)?$/.exec(s))) {
    const month = MONTH_NAMES.find(([re]) => re.test(m![2]!.trim()));
    if (!month) return null;
    [d, mo] = [Number(m[1]), month[1]];
    if (m[3]) y = Number(m[3]);
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y === null) {
    const near = [-1, 0, 1].map((k) => new Date(ref.getFullYear() + k, mo - 1, d));
    near.sort((a, b) => Math.abs(a.getTime() - ref.getTime()) - Math.abs(b.getTime() - ref.getTime()));
    y = near[0]!.getFullYear();
  }
  const out = new Date(y, mo - 1, d);
  return out.getMonth() === mo - 1 ? out : null;
}

/**
 * قيمة حقل التاريخ بتقويمه (٣٫٤): ما يُقرأ تاريخًا يُكتب بالتقويم المختار، بأرقامٍ هندية إن كُتب بها — وما لا يُقرأ
 * (تاريخٌ هجريٌّ مكتوب، أو نصٌّ آخر) يبقى كما كُتب.
 */
export function dateValueIn(text: string, calendar: Calendar): string {
  const date = parseDateText(text);
  if (!date) return text;
  const out = formatDateIn(date, calendar);
  return /[٠-٩]/.test(text) ? toIndic(out) : out;
}

/** صيغة التخزين: YYYY-MM-DD بالتوقيت المحلي، لا UTC — وإلا انزاح اليوم. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** تاريخ اليوم محليًّا YYYY-MM-DD — لا بالتوقيت العالمي، فالمكتب في بغداد لا في غرينتش (ز٢: كانت ثلاث نسخ). */
export const localToday = (now: Date = new Date()): string => isoDate(now);

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

/** قيم البطاقة بتقاويم حقولها (٣٫٤): حقلٌ له تقويمٌ يُكتب تاريخه به — في البطاقة الواحدة وفي كلّ بطاقةٍ من الدفعة — وما سواه كما هو. */
export function valuesInCalendars(values: Record<string, string>, calendars: Record<string, Calendar> | undefined): Record<string, string> {
  if (!calendars || !Object.keys(calendars).length) return values;
  const out = { ...values };
  for (const [key, calendar] of Object.entries(calendars)) if (out[key]?.trim()) out[key] = dateValueIn(out[key]!, calendar);
  return out;
}
