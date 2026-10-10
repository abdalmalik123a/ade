/**
 * الإمساكية (DESIGNS.md ٣٫٤): جدولٌ أيّامه من أوّل رمضان — يومُ الأسبوع، ويومُ رمضان، وتاريخه الميلادي — بتقويمٍ يختاره المكتب
 * (ميلادي أو هجري أو كلاهما)، وأوقاته **من الجدول الرسمي وحده** (`timetable.ts`): لا يُحسب وقتٌ ولا يُخترع، وما لم يُستورد
 * يبقى فارغًا ويُنبَّه عليه قبل الطباعة (`imsakiyaGaps`).
 *
 * والإعداد (أوّل رمضان، التقويم، الأرقام، تمييز الجمعة) يُحفظ في الجدول نفسه (`TableElement.imsakiya`)، فيُعاد بناء أيّامه
 * بتقويمٍ آخر أو بأرقامٍ أخرى ولا تضيع أوقاته — والأيّام والتواريخ محسوبةٌ من أوّل رمضان لا من تقويمٍ فلكيّ، فرؤية العراق
 * (يومٌ بعد أمّ القرى أو قبله) يحسمها التاريخ الذي يختاره المكتب.
 */
import { toIndic } from '../arabic';
import { AR_MONTHS, fromIsoDate, hijriParts, isoDate } from '../dates';
import { luminance, mix } from './kit/color';
import { latinDigits, TIME_TITLES, WEEKDAYS } from './timetable';
import type { Canvas, ImsakiyaSettings, TableCell, TableColumn, TableElement, TableRowStyle } from './model/types';

/** اسما العنصرين في التصميم: الجدول، وسطر السنة تحت العنوان. */
export const IMSAKIYA_TABLE = 'جدول الإمساكية';
export const IMSAKIYA_YEAR = 'سنة الإمساكية';

/** أوقات الإمساكية: لكلّ عمودٍ عنوانه وقيمه أيّامًا — بأرقامٍ لاتينية («4:55»)، والأرقام تُختار عند البناء. */
export type ImsakiyaTimes = { title: string; values: string[] }[];

/** أعمدة الأيّام — ما سواها أوقات. */
const DAY_TITLES = new Set(['اليوم', 'رمضان', 'الميلادي', 'التاريخ']);
/** الأوقات السبعة بلا قيم: الإمساكية قبل أن يُستورد جدولها. */
export const NO_TIMES: ImsakiyaTimes = TIME_TITLES.slice(0, 7).map((title) => ({ title, values: [] }));

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOf = (s: ImsakiyaSettings) => fromIsoDate(s.start) ?? new Date();
const inDigits = (text: string, s: ImsakiyaSettings) => (s.digits === 'indic' ? toIndic(text) : text);

/** أوّل رمضان القادم بتقويم أمّ القرى وإزاحة المكتب — أو أوّل رمضان الجاري إن كنّا فيه. */
export function nextRamadan(now: Date = new Date(), offset?: number): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const p = hijriParts(today, offset);
  if (p.m === 9) return addDays(today, 1 - p.d);
  for (let i = 1; i <= 400; i++) {
    const q = hijriParts(addDays(today, i), offset);
    if (q.m === 9 && q.d === 1) return addDays(today, i);
  }
  return today;
}

/** إعداد إمساكيةٍ جديدة: رمضان القادم بالتقويمين، وأرقامٌ هندية، والجمعة مميّزة. */
export const freshSettings = (now: Date = new Date()): ImsakiyaSettings => ({ start: isoDate(nextRamadan(now)), calendar: 'both', digits: 'indic', fridays: true });

/** سطر السنة: «١٤٤٨ هـ — ٢٠٢٧ م» بتقويم الإمساكية (والسنتان الميلاديّتان إن عبر رمضانُ رأسَ السنة). */
export function yearLine(s: ImsakiyaSettings, days = 30): string {
  const start = startOf(s);
  const end = addDays(start, days - 1);
  // من وسط الشهر: فأوّل رمضان في العراق قد يكون آخر شعبان في أمّ القرى، والسنة واحدة.
  const hijri = `${hijriParts(addDays(start, 10), 0).y} هـ`;
  const gYears = start.getFullYear() === end.getFullYear() ? `${start.getFullYear()}` : `${start.getFullYear()} – ${end.getFullYear()}`;
  const line = s.calendar === 'hijri' ? hijri : s.calendar === 'gregorian' ? `${gYears} م` : `${hijri} — ${gYears} م`;
  return inDigits(line, s);
}

/** أعمدة الأيّام بتقويم الإمساكية وعرضها. */
function dayColumns(s: ImsakiyaSettings): { title: string; width: number; cell: (d: Date, i: number) => string }[] {
  return [
    { title: 'اليوم', width: 12, cell: (d) => WEEKDAYS[d.getDay()]! },
    ...(s.calendar !== 'gregorian' ? [{ title: 'رمضان', width: 8, cell: (_d: Date, i: number) => String(i + 1) }] : []),
    ...(s.calendar !== 'hijri'
      ? // «٢٨ كانون الثاني» أطولها — فلا يلتفّ سطره ويطول الجدول.
        [{ title: s.calendar === 'both' ? 'الميلادي' : 'التاريخ', width: 18, cell: (d: Date) => `${d.getDate()} ${AR_MONTHS[d.getMonth()]}` }]
      : [])
  ];
}

/** الجدول: أعمدة الأيّام ثم الأوقات بعرضٍ متساوٍ، وصفٌّ لكلّ يوم — وأيّام الجمعة إن طُلب تمييزها. */
export function imsakiyaGrid(times: ImsakiyaTimes, s: ImsakiyaSettings, days = 30): { columns: TableColumn[]; rows: TableCell[][]; fridays: number[] } {
  const start = startOf(s);
  const dayCols = dayColumns(s);
  const timeCols = times.length ? times : NO_TIMES;
  const rest = 100 - dayCols.reduce((sum, c) => sum + c.width, 0);
  const columns: TableColumn[] = [
    ...dayCols.map((c) => ({ title: c.title, widthPercent: c.width, align: 'center' as const })),
    ...timeCols.map((t) => ({ title: t.title, widthPercent: Math.round((rest / timeCols.length) * 100) / 100, align: 'center' as const }))
  ];
  const fridays: number[] = [];
  const rows = Array.from({ length: days }, (_, i): TableCell[] => {
    const d = addDays(start, i);
    if (s.fridays && d.getDay() === 5) fridays.push(i);
    return [...dayCols.map((c) => ({ text: inDigits(c.cell(d, i), s) })), ...timeCols.map((t) => ({ text: inDigits(t.values[i] ?? '', s) }))];
  });
  return { columns, rows, fridays };
}

/**
 * الصفّ المميَّز (الجمعة) بلون ترويسة الجدول: على الورق الفاتح مسحتُه الفاتحة، وعلى الداكن (`ink` حبرُ صفوفه الفاتح) لونُه
 * نفسه — والخطّ عريض. ولونٌ ليس سداسيًّا يُترك فيبقى العريض وحده.
 */
export function markedRow(headerBg: string, ink: string | null): TableRowStyle {
  if (!/^#[0-9a-f]{6}$/i.test(headerBg)) return { bold: true };
  if (ink) return { bg: headerBg, color: luminance(headerBg) > 0.55 ? '#111111' : ink, bold: true };
  return { bg: mix(headerBg, '#ffffff', 0.8), bold: true };
}

/** أنماط الصفوف: المميَّز بلونه، والباقي بحبر الورق الداكن إن كان — أو عدمٌ إن لم يبقَ شيء. */
export function markedRows(count: number, marked: number[], headerBg: string, ink: string | null): (TableRowStyle | null)[] | undefined {
  const mark = markedRow(headerBg, ink);
  const out = Array.from({ length: count }, (_, i) => (marked.includes(i) ? mark : ink ? { color: ink } : null));
  return out.some(Boolean) ? out : undefined;
}

/** حبر الصفوف على الورق الداكن: لونٌ بلا خلفيةٍ في أنماط الصفوف (المعرض يكتبه لكلّ صفّ). */
const inkOf = (t: TableElement): string | null => t.rowStyles?.find((r) => r?.color && !r.bg)?.color ?? null;

/** جدول الإمساكية في التصميم: بإعداده، أو باسمه. */
export function imsakiyaTable(canvas: Canvas): TableElement | undefined {
  return canvas.elements.find((e): e is TableElement => e.kind === 'table' && (Boolean(e.imsakiya) || e.name === IMSAKIYA_TABLE));
}

/** أوقات الجدول كما هي فيه — كلّ عمودٍ ليس من أعمدة الأيّام، بأرقامٍ لاتينية. */
export function timesIn(table: TableElement): ImsakiyaTimes {
  return table.columns.flatMap((c, i) => (DAY_TITLES.has(c.title) ? [] : [{ title: c.title, values: table.rows.map((r) => latinDigits(r[i]?.text ?? '').trim()) }]));
}

/**
 * يملأ الإمساكية: أوقاتٌ جديدة من الجدول الرسمي (أو `null` فتبقى أوقاتها) بإعدادٍ جديد — فيُعاد بناء الجدول وسطر السنة.
 * والأيّام بعدد أيّام الجدول الرسمي (٢٩ أو ٣٠)، وبغيره كما كانت. ونسخةٌ جديدة لا تُمسّ بها الأولى (فالتراجع يعيدها).
 */
export function fillImsakiya(canvas: Canvas, times: ImsakiyaTimes | null, s: ImsakiyaSettings): Canvas {
  const table = imsakiyaTable(canvas);
  if (!table) return canvas;
  const use = times ?? timesIn(table);
  const longest = Math.max(0, ...use.map((t) => t.values.length));
  const days = Math.min(30, Math.max(1, times ? longest || 30 : table.rows.length));
  const grid = imsakiyaGrid(use, s, days);
  const rowStyles = markedRows(days, grid.fridays, table.headerBg ?? '#f1f5f9', inkOf(table));
  const next: TableElement = { ...table, columns: grid.columns, rows: grid.rows, imsakiya: s, rowStyles };
  if (!rowStyles) delete next.rowStyles;
  const year = yearLine(s, days);
  return {
    ...canvas,
    elements: canvas.elements.map((el) =>
      el.id === table.id ? next : el.kind === 'text' && el.name === IMSAKIYA_YEAR ? { ...el, inlines: [{ kind: 'run' as const, text: year }] } : el
    )
  };
}

/** الإمساكية كما تُفتح من المعرض: أيّامها لرمضان القادم — فعيّنة القائمة ثابتةٌ (للّقطات) ورمضان يتقدّم كلّ سنة. */
export function freshImsakiya(canvas: Canvas, now: Date = new Date()): Canvas {
  const table = imsakiyaTable(canvas);
  return table ? fillImsakiya(canvas, null, { ...(table.imsakiya ?? freshSettings(now)), start: isoDate(nextRamadan(now)) }) : canvas;
}

/** خانات الأوقات الفارغة في الإمساكية، من كلّها — للفحص قبل الطباعة. وعدمٌ إن لم تكن إمساكية. */
export function imsakiyaGaps(canvas: Canvas): { empty: number; total: number } | null {
  const table = imsakiyaTable(canvas);
  if (!table) return null;
  const cells = timesIn(table).flatMap((t) => t.values);
  return { empty: cells.filter((v) => !v).length, total: cells.length };
}
