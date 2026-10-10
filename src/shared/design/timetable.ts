/**
 * الجدول الرسمي للإمساكية (DESIGNS.md ٣٫٤) — يُقرأ ولا يُكتب بيد: ملفّ Excel أو CSV، أو جدولٌ يُلصق من موقعٍ أو Word، أو
 * أسطر PDF (`pdfTableText`). **ولا يُحسب وقتٌ ولا يُخترع**: ما في الجدول الرسمي وحده يدخل الإمساكية، فالأوقات تختلف بين
 * الوقفين وبين المدن بدقائق تفسد الصيام.
 *
 * الأعمدة تُعرف من عناوينها (الإمساك، الفجر، …) ومن قيمها (أوقاتٌ، أيّام الأسبوع، أيّام رمضان، تواريخ) — والموظّف يصحّح
 * ما أخطأ فيه قبل أن يُوضع. والتاريخ الميلادي في الجدول يعطي أوّل رمضان، واليوم يُطابَق به.
 */

import { toLatinDigits } from '../arabic';
import { parseDateText } from '../dates';

export type ColumnRole = 'skip' | 'weekday' | 'hijri' | 'gregorian' | 'time';
/** عمودٌ من الجدول: عنوانه كما جاء، ودوره، وعنوانه في الإمساكية إن كان وقتًا. */
export type TimetableColumn = { header: string; role: ColumnRole; title: string };
export type Timetable = { columns: TimetableColumn[]; rows: string[][]; headed: boolean };
export type Clock = { h: number; m: number };

/** الأوقات بترتيب اليوم — وبه تُسمّى أعمدة جدولٍ بلا عناوين. */
export const TIME_TITLES = ['الإمساك', 'الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء', 'منتصف الليل'] as const;
export const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

export const latinDigits = toLatinDigits;

/** للمطابقة: بلا تشكيلٍ ولا همزاتٍ على الألف ولا تطويل، وأشكال العرض (PDF) حروفًا. */
export function plain(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** «4:55» و«٤٫٥٥» و«04:55 ص» و«16:30» — ووقت Excel («1899/12/30 04:55»). */
export function parseClock(text: string): Clock | null {
  const s = latinDigits(text).trim();
  const m = /^(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+)?(\d{1,2})\s*[:.٫]\s*(\d{2})(?::\d{2})?\s*(ص|م|am|pm|a\.m\.|p\.m\.)?$/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const mark = m[3]?.toLowerCase();
  if ((mark === 'م' || mark?.startsWith('p')) && h < 12) h += 12;
  return { h, m: min };
}

/** الوقت كما يُطبع في الإمساكيات: باثنتي عشرة ساعة بلا «ص» ولا «م» — فالعمود يقول أيّهما. */
export const clockText = (c: Clock): string => `${c.h % 12 || 12}:${String(c.m).padStart(2, '0')}`;

export function weekdayOf(text: string): number | null {
  const s = plain(text).replace(/^يوم\s+/, '').replace(/^ال/, '');
  const i = ['احد', 'اثنين', 'ثلاثاء', 'اربعاء', 'خميس', 'جمعه', 'سبت'].indexOf(s);
  if (i >= 0) return i;
  const en = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].findIndex((n) => s.startsWith(n));
  return en >= 0 ? en : null;
}

/** عنوان العمود: أيّ وقتٍ هو، أو أيّ تاريخ — والنصّ مقلوبًا أيضًا (PDF يعطي العربية أحيانًا بترتيب العرض). */
function headerRole(header: string): { role: ColumnRole; title?: string } | null {
  const s = plain(header);
  if (!s) return null;
  for (const t of [s, [...s].reverse().join('')]) {
    if (/امساك|imsak/.test(t)) return { role: 'time', title: 'الإمساك' };
    if (/فجر|صبح|fajr/.test(t)) return { role: 'time', title: 'الفجر' };
    if (/شروق|طلوع|sunrise/.test(t)) return { role: 'time', title: 'الشروق' };
    if (/ظهر|dhuhr|zuhr/.test(t)) return { role: 'time', title: 'الظهر' };
    if (/عصر|asr/.test(t)) return { role: 'time', title: 'العصر' };
    if (/مغرب|غروب|افطار|maghrib/.test(t)) return { role: 'time', title: 'المغرب' };
    if (/عشاء|isha/.test(t)) return { role: 'time', title: 'العشاء' };
    if (/منتصف|نصف الليل|midnight/.test(t)) return { role: 'time', title: 'منتصف الليل' };
    if (/رمضان|هجري|ramadan/.test(t)) return { role: 'hijri' };
    if (/ميلادي|تاريخ|شباط|اذار|كانون|فبراير|مارس|يناير|date/.test(t)) return { role: 'gregorian' };
    if (/^(ال)?(يوم|ايام)$|^day$/.test(t)) return { role: 'weekday' };
  }
  return null;
}

/** السطر خلاياه: بالجدولة (Excel واللصق)، أو فاصلةٍ منقوطة أو فاصلة (CSV)، أو فراغين فأكثر. */
function cellsOf(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (/[;؛]/.test(line)) return line.split(/[;؛]/).map((c) => c.trim());
  if (/[,،]/.test(line) && !/\d,\d{3}/.test(line)) return line.split(/[,،]/).map((c) => c.trim());
  return line.trim().split(/\s{2,}|\s(?=\S*\d[:.٫]\d)/).map((c) => c.trim());
}

const share = (cells: string[], ok: (s: string) => boolean) => {
  const full = cells.filter((c) => c.trim());
  return full.length ? full.filter(ok).length / full.length : 0;
};

/** دور العمود من قيمه وحدها — والعنوان يغلبه إن عُرف. */
function valueRole(cells: string[]): ColumnRole {
  if (share(cells, (c) => parseClock(c) !== null) >= 0.6) return 'time';
  if (share(cells, (c) => weekdayOf(c) !== null) >= 0.6) return 'weekday';
  const nums = cells.map((c) => latinDigits(c).replace(/رمضان/, '').trim());
  if (share(nums, (c) => /^\d{1,2}$/.test(c) && Number(c) >= 1 && Number(c) <= 30) >= 0.8) return 'hijri';
  if (share(cells, (c) => parseDateText(c) !== null) >= 0.6) return 'gregorian';
  return 'skip';
}

/**
 * يقرأ الجدول: الصفوف التي فيها وقتان فأكثر هي أيّامه، وأقرب سطرٍ فوقها يعرف عناوين الأوقات هو رأسه (وما فوقه لما فرغ منه —
 * رأسٌ بسطرين). وبلا رأسٍ تُسمّى الأوقات بترتيب اليوم، ويُقال إنّها بلا عناوين فيتأكّد الموظّف.
 */
export function readTimetable(text: string): Timetable {
  const lines = latinDigits(text)
    .replace(/\r/g, '')
    .split('\n')
    .map(cellsOf)
    .filter((cells) => cells.some((c) => c.trim()));
  const isDay = (cells: string[]) => cells.filter((c) => parseClock(c) !== null).length >= 2;
  const first = lines.findIndex(isDay);
  if (first < 0) return { columns: [], rows: [], headed: false };
  const rows = lines.slice(first).filter(isDay).slice(0, 30);
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));

  // الرأس: أقرب سطرٍ فوق الأيّام يعرف عنوانين فأكثر — وخاناته الفارغة ممّا فوقه.
  const above = lines.slice(Math.max(0, first - 4), first).reverse();
  const known = (cells: string[]) => cells.filter((c) => headerRole(c)).length;
  const head = above.find((cells) => known(cells) >= 2);
  const headers = Array.from({ length: width }, (_, i) => {
    if (!head) return '';
    if (head[i]?.trim()) return head[i]!.trim();
    return above.slice(above.indexOf(head) + 1).find((cells) => cells[i]?.trim())?.[i]?.trim() ?? '';
  });

  let order = 0;
  const columns = headers.map((header, i): TimetableColumn => {
    const values = padded.map((r) => r[i]!);
    const byValue = valueRole(values);
    const byHeader = headerRole(header);
    // القيم تغلب العنوان: «اليوم» فيه أيّام الأسبوع في جدول، وأيّامُ رمضان ١–٣٠ في آخر؛ والعنوان لما لم تُعرف قيمه — إلا
    // الوقت: عمودٌ عنوانه «الفجر» بلا أوقاتٍ ليس وقتًا.
    const role = byValue !== 'skip' ? byValue : byHeader && byHeader.role !== 'time' ? byHeader.role : 'skip';
    if (role !== 'time') return { header, role, title: '' };
    const title = byHeader?.title ?? (header || (TIME_TITLES[order] ?? `وقت ${order + 1}`));
    order++;
    return { header, role, title };
  });
  return { columns, rows: padded, headed: Boolean(head) };
}

/**
 * أوّل رمضان من الجدول: التاريخ الميلادي في أوّل أيّامه (ويومُ رمضانه إن لم يكن الأوّل) — أو عدمٌ فيُسأل الموظّف.
 * و`ref` يعطي السنة لتاريخٍ بلا سنة.
 */
export function startOf(t: Timetable, ref?: Date): Date | null {
  const g = t.columns.findIndex((c) => c.role === 'gregorian');
  if (g < 0 || !t.rows.length) return null;
  const day = parseDateText(t.rows[0]![g]!, ref);
  if (!day) return null;
  const h = t.columns.findIndex((c) => c.role === 'hijri');
  const n = h >= 0 ? Number(latinDigits(t.rows[0]![h]!).replace(/\D/g, '')) : 1;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - (n >= 1 && n <= 30 ? n - 1 : 0));
}

/** يومُ الأسبوع في الجدول يخالف التاريخ المختار؟ — «الجدول يبدأ الأحد، والتاريخ المختار إثنين». */
export function weekdayClash(t: Timetable, start: Date): string | null {
  const w = t.columns.findIndex((c) => c.role === 'weekday');
  if (w < 0 || !t.rows.length) return null;
  const said = weekdayOf(t.rows[0]![w]!);
  if (said === null || said === start.getDay()) return null;
  return `الجدول يبدأ ${WEEKDAYS[said]} والتاريخ المختار ${WEEKDAYS[start.getDay()]} — تأكّد من أوّل رمضان`;
}

/** الأوقات بعناوينها: لكلّ عمود وقتٍ قيمُه أيّامًا (فارغٌ ما لم يُقرأ). */
export function timesOf(t: Timetable): { title: string; values: string[] }[] {
  return t.columns.flatMap((c, i) =>
    c.role === 'time'
      ? [{ title: c.title, values: t.rows.map((r) => { const k = parseClock(r[i] ?? ''); return k ? clockText(k) : ''; }) }]
      : []
  );
}

/** قطعةُ نصٍّ من صفحة PDF بموضعها (`getTextContent` في pdf.js): x وy أسفلها الأيسر بالنقاط، وy يصعد. */
export type PdfPiece = { str: string; x: number; y: number; w: number; h: number };

const ARABIC = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/;

/**
 * جدول صفحة PDF أسطرًا بخاناتٍ مفصولةٍ بالجدولة — كما لو نُسخ من Excel، فيقرؤه `readTimetable` نفسه: القطع في سطرٍ واحد إن
 * تقاربت ارتفاعاتها، والخانات من اليمين (الجدول العربيّ يبدأ من يمينه — والإنكليزيّ من يساره)، والقطعتان المتقاربتان خانةٌ
 * واحدة — والأرقام في الخانة من اليسار («4» و«:» و«55» تُقرأ 4:55 لا 55:4).
 */
export function pdfTableText(pieces: PdfPiece[]): string {
  const items = pieces.filter((p) => p.str.trim()).sort((a, b) => b.y - a.y);
  // اتّجاه الجدول من نصّه: عربيٌّ أكثر من لاتينيّه فمن اليمين.
  const pageRtl = items.filter((p) => ARABIC.test(p.str)).length >= items.filter((p) => /[A-Za-z]/.test(p.str)).length;
  const lines: PdfPiece[][] = [];
  for (const it of items) {
    const line = lines.find((l) => Math.abs(l[0]!.y - it.y) <= Math.max(1.5, Math.min(l[0]!.h, it.h) * 0.45));
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines
    .map((line) => {
      line.sort((a, b) => (pageRtl ? b.x + b.w - (a.x + a.w) : a.x - b.x));
      const cells: PdfPiece[][] = [];
      let edge = pageRtl ? Infinity : -Infinity;
      for (const it of line) {
        const gap = pageRtl ? edge - (it.x + it.w) : it.x - edge;
        if (cells.length && gap < Math.max(it.h, 4) * 0.6) cells[cells.length - 1]!.push(it);
        else cells.push([it]);
        edge = pageRtl ? Math.min(edge, it.x) : Math.max(edge, it.x + it.w);
      }
      return cells
        .map((cell) => {
          const rtl = cell.some((p) => ARABIC.test(p.str));
          const ordered = [...cell].sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
          return ordered
            .map((p, i) => {
              const prev = ordered[i - 1];
              const gap = !prev ? 0 : rtl ? prev.x - (p.x + p.w) : p.x - (prev.x + prev.w);
              return (prev && gap > p.h * 0.15 ? ' ' : '') + p.str.trim();
            })
            .join('');
        })
        .join('\t');
    })
    .join('\n');
}
