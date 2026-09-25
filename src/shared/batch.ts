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
};

const fold = (s: string) => normalizeFold(s).replace(/[_\s]+/g, ' ').trim();

function split(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('،')) return line.split('،');
  if (line.includes(',')) return line.split(',');
  return [line];
}

export function parseRows(text: string, keys: string[]): Parsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
  if (!lines.length) return { rows: [], mapped: [], ignored: [], headed: false };

  const byFold = new Map(keys.map((k) => [fold(k), k]));
  const first = split(lines[0]!).map((c) => c.trim());
  const hits = first.map((c) => byFold.get(fold(c)) ?? null);
  const headed = hits.some(Boolean);

  const columns: (string | null)[] = headed ? hits : keys.slice(0, first.length);
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
    ignored: headed ? first.filter((_, i) => !hits[i]) : [],
    headed
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
