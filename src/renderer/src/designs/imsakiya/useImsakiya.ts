/**
 * لوح الإمساكية (٣٫٤): الجدول الرسمي يُقرأ من ملفٍّ (Excel أو CSV أو PDF) أو يُلصق، ثمّ يُراجع ربط أعمدته، ثمّ يوضع في
 * الإمساكية — وإعدادها (أوّل رمضان، التقويم، الأرقام، الجمعة) يُطبَّق فور تغييره ويُحفظ في جدولها. وكلٌّ خطوةٌ يعيدها التراجع.
 */
import { useState } from 'react';
import { toIndic, count } from '@shared/arabic';
import type { ImsakiyaSettings, TableElement } from '@shared/canvas';
import { fromIsoDate, isoDate } from '@shared/dates';
import { fillImsakiya, freshSettings, imsakiyaGaps } from '@shared/design/imsakiya';
import { readTimetable, startOf, timesOf, weekdayClash, type ColumnRole, type Timetable } from '@shared/design/timetable';
import { errorText } from '../../lib/errors';
import type { DesignEditor } from '../editor/useDesignEditor';
import { pdfTable } from './readPdf';

/** جدولٌ قُرئ ولم يوضع بعد: من أين جاء، وأعمدته كما فهمها ديوان (والموظّف يصحّحها). */
export type Pending = { from: string; table: Timetable };

export function useImsakiya(ed: DesignEditor, table: TableElement) {
  const settings = table.imsakiya ?? freshSettings();
  const [pending, setPending] = useState<Pending | null>(null);
  const [pasting, setPasting] = useState(false);
  const [reading, setReading] = useState(false);

  const take = (from: string, text: string) => {
    const read = readTimetable(text);
    if (!read.rows.length) {
      ed.say(`لا أوقات في «${from}» — الجدول الرسمي صفوفٌ بأوقاتٍ مثل ٤:٥٥`, 'warn');
      return;
    }
    setPending({ from, table: read });
    setPasting(false);
  };

  const fromFile = async () => {
    setReading(true);
    try {
      const got = await window.diwan.files.readSheet('imsakiya');
      if (!got) return;
      if (!got.pdf) return take(got.name, got.text);
      const text = await pdfTable(got.pdf);
      if (!text.trim()) ed.say('هذا الـPDF صورةٌ بلا نصّ — اطلب الجدول Excel أو PDF نصّيًّا، أو انسخه إلى Excel والصقه هنا', 'warn');
      else take(got.name, text);
    } catch (e) {
      ed.say(errorText(e, 'تعذّر قراءة الجدول'), 'warn');
    } finally {
      setReading(false);
    }
  };

  /** دور عمودٍ وعنوانه بيد الموظّف — «الفجر» لا «الإمساك»، أو «اتركه». */
  const setColumn = (i: number, role: ColumnRole, title = '') =>
    setPending((p) => p && { ...p, table: { ...p.table, columns: p.table.columns.map((c, k) => (k === i ? { ...c, role, title } : c)) } });

  const ref = fromIsoDate(settings.start) ?? new Date();
  const start = pending ? startOf(pending.table, ref) : null;
  const clash = pending ? weekdayClash(pending.table, start ?? ref) : null;

  const place = () => {
    if (!pending) return;
    const times = timesOf(pending.table);
    if (!times.length) return ed.say('لم يُختر عمود وقتٍ واحد', 'warn');
    ed.apply(fillImsakiya(ed.canvas, times, { ...settings, ...(start && { start: isoDate(start) }) }));
    ed.say(`الإمساكية: ${count(pending.table.rows.length, 'يوم')} بأوقاتها (${toIndic(times.length)} في اليوم) من «${pending.from}» — قابلها بالجدول الرسمي قبل الطباعة`, 'ok');
    setPending(null);
  };

  /** الإعداد يُطبَّق فورًا — والأوقات كما هي. */
  const update = (patch: Partial<ImsakiyaSettings>) => ed.apply(fillImsakiya(ed.canvas, null, { ...settings, ...patch }));

  return { settings, pending, setPending, pasting, setPasting, reading, fromFile, take, setColumn, start, clash, place, update, gaps: imsakiyaGaps(ed.canvas) };
}

export type Imsakiya = ReturnType<typeof useImsakiya>;
