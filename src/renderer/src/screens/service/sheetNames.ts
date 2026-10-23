/**
 * أسماء قائمة الدمج في الشبّاك من ملفّ Excel أو CSV (D121 — S36) — منقولةٌ من `CounterFill.tsx` (D137).
 *
 * الملفّ يصل من `files:readSheet` أعمدةً بالجدولة (وCSV مثله: exceljs يقرؤه)، ويُقرأ بقارئ استيراد الزبائن نفسه (`readTable`)
 * فالعنوان يُعرف كما يُعرف هناك: «الإسم» بالهمزة و«الأسم» و«الاسم الثلاثي» و«اسم الطالبة» أسماء، و«ت» تسلسلٌ لا يُؤخذ،
 * و«الاسم» و«اسم الأب» و«اسم الجد» تُجمع اسمًا واحدًا. وكانت قائمةٌ رأسها «ت | الإسم | الصف» تصير «ت ١ ٢ ٣».
 * وبلا عمود اسم: أوّل عمودٍ ليس أرقامًا.
 */
import { normalizeFold } from '@shared/arabic';
import { importRows, readTable } from '@shared/citizenImport';

const fold = (s: string) => normalizeFold(s).replace(/[_\s]+/g, ' ').trim();
/** «اسم» كلمةً وحدها: «جاسم» و«قاسم» و«باسم» فيها «اسم» — اسمُ أوّل صاحبٍ في قائمةٍ بلا عنوان، لا عنوانٌ يُترك. */
const NAME_HEADER = /(^| )(ال)?اسم( |$)|name/;
/** خانةٌ أرقامٌ وحدها (بعد الطيّ تصير الهندية عربية): التسلسل والدرجة والسنة. */
const NUMBER = /^[\d\s.,/-]+$/;
const clean = (s: string) => s.replace(/^["'\s]+|["'\s]+$/g, '').trim();
const numeric = (cells: string[]) => cells.some(Boolean) && cells.every((v) => !v || NUMBER.test(fold(v)));

/** أسماء الملفّ بترتيبها — أو لا شيء إن لم يكن فيه عمودٌ غير الأرقام. */
export function namesFromSheet(text: string): string[] {
  const table = readTable(text);
  // سطر العناوين ما عرف منه الاستيراد عمودًا — إلا «اسمًا» عُرف من «جاسم محمد» في أوّل الأسطر.
  const header = table.headed && table.columns.some((c) => c.target && (c.target !== 'fullName' || NAME_HEADER.test(fold(c.header))));
  if (header && table.columns.some((c) => c.target === 'fullName')) {
    return importRows(table).map((r) => clean(r.fullName ?? '')).filter(Boolean);
  }
  // والسطر الأوّل الذي حسبه الاستيراد عناوين وليس كذلك يعود صفًّا (`readTable` يسمّي الخانة الفارغة «العمود ن»).
  let rows = table.headed && !header ? [table.columns.map((c, i) => (c.header === `العمود ${i + 1}` ? '' : c.header)), ...table.rows] : table.rows;
  const col = (i: number) => rows.map((r) => clean(r[i] ?? ''));
  const width = table.columns.length;
  // عنوانٌ لم يُعرف فوق عمود أرقام («ت» فوق ١، ٢، ٣): سطر عناوين يُترك.
  if (!header && rows.length > 1 && Array.from({ length: width }, (_, i) => col(i)).some((c) => c[0] && !numeric([c[0]]) && numeric(c.slice(1)))) {
    rows = rows.slice(1);
  }
  // وما رُبط بخانةٍ أخرى (العنوان، الهاتف) يأتي بعد ما لم يُربط.
  const order = Array.from({ length: width }, (_, i) => i).sort((a, b) => Number(header && Boolean(table.columns[a]!.target)) - Number(header && Boolean(table.columns[b]!.target)));
  const pick = order.find((i) => col(i).some(Boolean) && !numeric(col(i)));
  return pick === undefined ? [] : col(pick).filter(Boolean);
}
