/**
 * الدفعة: قائمةُ أسماءٍ تُلصق من Excel، وصورٌ تُطابَق بأصحابها.
 *
 * المدرسة ترسل قائمة الصفّ جدولًا ومجلّدَ صورٍ باسم كل طالب أو رقمه. فتُنسخ
 * الأعمدة من Excel وتُلصق كما هي (الأعمدة بالجدولة)، والسطر الأول عناوين إن
 * طابق حقول التصميم — وإلا فالأعمدة بترتيب الحقول. ولا يُخمَّن ما لا يُعرف:
 * العمود الذي لا يطابق حقلًا يُترك ويُقال عنه.
 */
import { normalizeFold } from './arabic';

export type Parsed = {
  rows: Record<string, string>[];
  /** الحقول التي وجدت عمودها. */
  mapped: string[];
  /** عناوين أعمدةٍ لا حقل لها — تُعرض ليعرف المكتب ما تُرك. */
  ignored: string[];
  headed: boolean;
  /**
   * كلّ عمودٍ وحقله: `id` مفتاحه في ربط المكتب (عنوانه مطويًّا، أو «#رقمه» بلا عناوين)،
   * و`manual` أربطه الموظف بيده — فيُحفظ مع التصميم ويُطبَّق على قائمة السنة القادمة.
   */
  columns: { id: string; header: string; key: string | null; manual: boolean }[];
};

/**
 * ربط الأعمدة بالحقول يدويًّا (هـ٥): عنوان العمود مطويًّا ← مفتاح الحقل، و`null` «اتركه».
 * يغلب المطابقة الآلية؛ فقائمة مدرسةٍ عنوانها «اسم التلميذ» تذهب إلى «الاسم» مرّةً وإلى الأبد.
 */
export type BatchMap = Record<string, string | null>;

const fold = (s: string) => normalizeFold(s).replace(/[_\s]+/g, ' ').trim();

/** مفتاح العمود في الربط — ما يُحفظ مع التصميم. */
export const columnId = (header: string, index: number, headed: boolean) => (headed ? fold(header) : `#${index + 1}`);

function split(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('،')) return line.split('،');
  if (line.includes(',')) return line.split(',');
  return [line];
}

export function parseRows(text: string, keys: string[], map: BatchMap = {}): Parsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
  if (!lines.length) return { rows: [], mapped: [], ignored: [], headed: false, columns: [] };

  const byFold = new Map(keys.map((k) => [fold(k), k]));
  const first = split(lines[0]!).map((c) => c.trim());
  const hits = first.map((c) => byFold.get(fold(c)) ?? null);
  // السطر الأول عناوين إن طابق حقلًا — أو إن ربط المكتب عنوانًا منه بيده من قبل.
  const headed = hits.some(Boolean) || first.some((c) => fold(c) in map);
  const auto: (string | null)[] = headed ? hits : keys.slice(0, first.length);
  const known = new Set(keys);
  const columns: (string | null)[] = auto.map((key, i) => {
    const id = columnId(first[i] ?? '', i, headed);
    if (!(id in map)) return key;
    const manual = map[id];
    return manual && known.has(manual) ? manual : null;
  });
  const body = headed ? lines.slice(1) : lines;
  const rows = body
    .map((line) => {
      const cells = split(line);
      const row: Record<string, string> = {};
      columns.forEach((key, i) => {
        const v = cells[i]?.trim();
        if (key && v) row[key] = v;
      });
      return row;
    })
    .filter((row) => Object.keys(row).length > 0);

  return {
    rows,
    mapped: columns.filter((k): k is string => Boolean(k)),
    ignored: headed ? first.filter((_, i) => !columns[i]) : [],
    headed,
    columns: first.map((header, i) => {
      const id = columnId(header, i, headed);
      return { id, header: headed ? header : `العمود ${i + 1}`, key: columns[i] ?? null, manual: id in map };
    })
  };
}

export type Photo = { name: string; src: string };

/**
 * يطابق الصور بأصحابها: اسمُ الملف هو الاسم أو الرقم، بلا حسابٍ للهمزات
 * والتشكيل والمسافات الزائدة («زينب_علي.jpg» لـ«زينب علي»).
 */
export function matchPhotos(
  rows: Record<string, string>[],
  photos: Photo[],
  photoKey: string,
  byKeys: string[]
): { rows: Record<string, string>[]; matched: number; unmatched: string[] } {
  const index = new Map(photos.map((p) => [fold(p.name), p.src]));
  let matched = 0;
  const unmatched: string[] = [];
  const out = rows.map((row) => {
    if (row[photoKey]) {
      matched++;
      return row;
    }
    for (const key of byKeys) {
      const v = row[key];
      const src = v ? index.get(fold(v)) : undefined;
      if (src) {
        matched++;
        return { ...row, [photoKey]: src };
      }
    }
    unmatched.push(row[byKeys[0] ?? ''] ?? '—');
    return row;
  });
  return { rows: out, matched, unmatched };
}

/**
 * حقلُ اسم صاحب البطاقة في القائمة: «الاسم» أو «اسم الطالب» — لا «اسم المدرسة»
 * ولا «اسم الأم». منه يُقترح جنسه، وبه يُنادى في استوديو التصوير.
 */
export function nameKeyOf(keys: string[]): string | undefined {
  return (
    keys.find((k) => /^(ال)?اسم(\s+ال(طالب|طالبة|تلميذ|تلميذة|موظف|موظفة|مكرم|مكرّم|مكرمة|متدرب|متدربة|خريج|خريجة))?$/.test(k)) ??
    keys.find((k) => k.startsWith('اسم') && !/الأم|الام|المدرسة|المدير|المسؤول|الجهة|الشيخ|المعلم|الأب|الاب/.test(k))
  );
}
